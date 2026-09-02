import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../../lib/supabaseAdmin";

import {
  attachRecordOwner,
  canViewOwnedRecord,
  getRecordPermissions,
} from "../../../../../lib/recordAccess";

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function forbidden(message) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  );
}

function getPermissions(access) {
  return getRecordPermissions(
    access,
    {
      prefix: "invoices",
      module: "Invoices",
    }
  );
}

function parseMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const cleaned =
    String(value)
      .replace(/,/g, "")
      .replace(/[^0-9.-]/g, "");

  const parsed =
    Number.parseFloat(cleaned);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function roundMoney(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

function isValidDate(value) {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(
    Number(value || 0)
  );
}

// =========================================================
// LOAD INVOICE
// =========================================================

async function loadInvoice({
  supabase,
  organizationId,
  invoiceId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from("invoices")
      .select("*")
      .eq(
        "id",
        invoiceId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return data;
}

// =========================================================
// LOAD PAYMENTS
// =========================================================

async function loadPayments({
  supabase,
  organizationId,
  invoiceId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "invoice_payments"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "invoice_id",
        invoiceId
      )
      .order(
        "payment_date",
        {
          ascending: false,
        }
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

// =========================================================
// ENRICH PAYMENT EMPLOYEES
// =========================================================

async function attachPaymentEmployees({
  supabase,
  organizationId,
  payments,
}) {
  const employeeIds =
    [
      ...new Set(
        payments
          .map(
            (payment) =>
              payment.recorded_by_employee_id
          )
          .filter(Boolean)
      ),
    ];

  if (
    employeeIds.length === 0
  ) {
    return payments.map(
      (payment) => ({
        ...payment,
        recorded_by: null,
      })
    );
  }

  const {
    data: employees,
    error,
  } =
    await supabase
      .from("employees")
      .select(
        `
          id,
          full_name,
          job_title
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .in(
        "id",
        employeeIds
      );

  if (error) {
    console.error(
      "Payment employee loading error:",
      error
    );

    return payments.map(
      (payment) => ({
        ...payment,
        recorded_by: null,
      })
    );
  }

  const employeeMap =
    new Map(
      (employees || []).map(
        (employee) => [
          employee.id,
          employee,
        ]
      )
    );

  return payments.map(
    (payment) => ({
      ...payment,

      recorded_by:
        employeeMap.get(
          payment.recorded_by_employee_id
        ) || null,
    })
  );
}

// =========================================================
// CALCULATE PAYMENT SUMMARY
// =========================================================

function calculateSummary({
  invoice,
  payments,
}) {
  const invoiceTotal =
    parseMoney(
      invoice.total_amount ||
      invoice.amount ||
      0
    );

  const paidAmount =
    roundMoney(
      payments.reduce(
        (
          total,
          payment
        ) =>
          total +
          Number(
            payment.amount ||
              0
          ),
        0
      )
    );

  const outstandingAmount =
    roundMoney(
      Math.max(
        0,
        invoiceTotal -
          paidAmount
      )
    );

  return {
    invoiceTotal:
      roundMoney(
        invoiceTotal
      ),

    paidAmount,

    outstandingAmount,
  };
}

// =========================================================
// GET
// =========================================================

export async function GET(
  request,
  context
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid invoice ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // ACCESS
    // =====================================================

    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const permissions =
      getPermissions(
        access
      );

    if (
      !permissions.canViewAll &&
      !permissions.canViewTeam &&
      !permissions.canViewOwn
    ) {
      return forbidden(
        "You do not have permission to view invoice payments."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // INVOICE
    // =====================================================

    const invoice =
      await loadInvoice({
        supabase,
        organizationId,
        invoiceId: id,
      });

    if (!invoice) {
      return NextResponse.json(
        {
          error:
            "Invoice not found.",
        },
        {
          status: 404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record: invoice,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to view payments for this invoice."
      );
    }

    // =====================================================
    // PAYMENTS
    // =====================================================

    const payments =
      await loadPayments({
        supabase,
        organizationId,
        invoiceId: id,
      });

    const enrichedPayments =
      await attachPaymentEmployees({
        supabase,
        organizationId,
        payments,
      });

    const summary =
      calculateSummary({
        invoice,
        payments,
      });

    return NextResponse.json({
      payments:
        enrichedPayments,

      summary: {
        invoice_total:
          summary.invoiceTotal,

        paid_amount:
          summary.paidAmount,

        outstanding_amount:
          summary.outstandingAmount,

        invoice_total_display:
          formatCurrency(
            summary.invoiceTotal
          ),

        paid_amount_display:
          formatCurrency(
            summary.paidAmount
          ),

        outstanding_amount_display:
          formatCurrency(
            summary.outstandingAmount
          ),
      },
    });
  } catch (error) {
    console.error(
      "Invoice payments GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load invoice payments.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request,
  context
) {
  let insertedPaymentId =
    null;

  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid invoice ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // ACCESS
    // =====================================================

    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const permissions =
      getPermissions(
        access
      );

    /*
     * For now, recording a payment requires
     * invoice edit access.
     *
     * Later we can introduce a dedicated:
     * invoices.record_payment permission.
     */
    if (
      !permissions.canEdit
    ) {
      return forbidden(
        "You do not have permission to record invoice payments."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // LOAD INVOICE
    // =====================================================

    const invoice =
      await loadInvoice({
        supabase,
        organizationId,
        invoiceId: id,
      });

    if (!invoice) {
      return NextResponse.json(
        {
          error:
            "Invoice not found.",
        },
        {
          status: 404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record: invoice,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to record a payment for this invoice."
      );
    }

    // =====================================================
    // STATUS VALIDATION
    // =====================================================

    const currentStatus =
      String(
        invoice.status ||
          ""
      )
        .trim()
        .toLowerCase();

    if (
      currentStatus ===
      "cancelled"
    ) {
      return NextResponse.json(
        {
          error:
            "Payments cannot be recorded against a cancelled invoice.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      currentStatus ===
      "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "This invoice is already fully paid.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      currentStatus ===
        "draft" ||
      currentStatus ===
        "draft invoice"
    ) {
      return NextResponse.json(
        {
          error:
            "Send the invoice before recording a payment.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // BODY
    // =====================================================

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const amount =
      roundMoney(
        parseMoney(
          body.amount
        )
      );

    const paymentDate =
      cleanText(
        body.payment_date
      );

    const paymentMethod =
      cleanText(
        body.payment_method
      );

    const reference =
      cleanText(
        body.reference
      );

    const notes =
      cleanText(
        body.notes
      );

    // =====================================================
    // VALIDATION
    // =====================================================

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Payment amount must be greater than £0.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !paymentDate ||
      !isValidDate(
        paymentDate
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid payment date is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // EXISTING PAYMENTS
    // =====================================================

    const existingPayments =
      await loadPayments({
        supabase,
        organizationId,
        invoiceId: id,
      });

    const beforeSummary =
      calculateSummary({
        invoice,
        payments:
          existingPayments,
      });

    if (
      beforeSummary.outstandingAmount <=
      0
    ) {
      return NextResponse.json(
        {
          error:
            "This invoice has already been fully paid.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      amount >
      beforeSummary.outstandingAmount
    ) {
      return NextResponse.json(
        {
          error:
            `Payment cannot exceed the outstanding balance of ${formatCurrency(
              beforeSummary.outstandingAmount
            )}.`,
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // INSERT PAYMENT
    // =====================================================

    const {
      data:
        payment,
      error:
        paymentError,
    } =
      await supabase
        .from(
          "invoice_payments"
        )
        .insert([
          {
            organization_id:
              organizationId,

            invoice_id:
              id,

            amount,

            payment_date:
              paymentDate,

            payment_method:
              paymentMethod ||
              null,

            reference:
              reference ||
              null,

            notes:
              notes ||
              null,

            recorded_by_employee_id:
              access.employee.id,
          },
        ])
        .select()
        .single();

    if (
      paymentError
    ) {
      throw new Error(
        paymentError.message
      );
    }

    insertedPaymentId =
      payment.id;

    // =====================================================
    // RECALCULATE
    // =====================================================

    const allPayments = [
      ...existingPayments,
      payment,
    ];

    const afterSummary =
      calculateSummary({
        invoice,
        payments:
          allPayments,
      });

    // =====================================================
    // AUTOMATIC STATUS
    // =====================================================

    const nextStatus =
      afterSummary
        .outstandingAmount <=
      0.009
        ? "Paid"
        : "Partially Paid";

    const {
      data:
        updatedInvoice,
      error:
        updateError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .update({
          status:
            nextStatus,
        })
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .select()
        .single();

    if (
      updateError
    ) {
      /*
       * Best-effort rollback.
       *
       * If invoice status could not be updated,
       * remove the payment we just created so
       * the financial state does not become
       * inconsistent.
       */
      await supabase
        .from(
          "invoice_payments"
        )
        .delete()
        .eq(
          "id",
          payment.id
        )
        .eq(
          "organization_id",
          organizationId
        );

      insertedPaymentId =
        null;

      throw new Error(
        updateError.message
      );
    }

    // =====================================================
    // ATTACH OWNER
    // =====================================================

    const formattedInvoice =
      await attachRecordOwner({
        supabase,
        organizationId,
        record:
          updatedInvoice,
      });

    // =====================================================
    // PAYMENT EMPLOYEE
    // =====================================================

    const [
      enrichedPayment,
    ] =
      await attachPaymentEmployees({
        supabase,
        organizationId,
        payments: [
          payment,
        ],
      });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        message:
          nextStatus ===
          "Paid"
            ? "Payment recorded. Invoice is now fully paid."
            : "Payment recorded successfully.",

        payment:
          enrichedPayment,

        invoice:
          formattedInvoice,

        summary: {
          invoice_total:
            afterSummary.invoiceTotal,

          paid_amount:
            afterSummary.paidAmount,

          outstanding_amount:
            afterSummary.outstandingAmount,

          invoice_total_display:
            formatCurrency(
              afterSummary.invoiceTotal
            ),

          paid_amount_display:
            formatCurrency(
              afterSummary.paidAmount
            ),

          outstanding_amount_display:
            formatCurrency(
              afterSummary.outstandingAmount
            ),
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Invoice payment POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to record invoice payment.",
      },
      {
        status: 500,
      }
    );
  }
}
