import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../lib/supabaseAdmin";

import {
  attachRecordOwner,
  buildClientAccess,
  canViewOwnedRecord,
  getRecordPermissions,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../../lib/recordAccess";

// =========================================================
// CONSTANTS
// =========================================================

const ALLOWED_STATUSES = [
  "Draft Invoice",
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
];

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
    String(
      value ||
        ""
    )
  );
}

function forbidden(message) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status:
        403,
    }
  );
}

function getPermissions(access) {
  return getRecordPermissions(
    access,
    {
      prefix:
        "invoices",

      module:
        "Invoices",
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
      .replace(
        /,/g,
        ""
      )
      .replace(
        /[^0-9.-]/g,
        ""
      );

  const parsed =
    Number.parseFloat(
      cleaned
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function parseVatRate(value) {
  const parsed =
    Number.parseFloat(
      String(
        value ||
          0
      )
        .replace(
          "%",
          ""
        )
        .trim()
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(
    value ||
      0
  );
}

function formatVatRate(value) {
  const number =
    Number(
      value ||
        0
    );

  return `${Number.isInteger(number)
    ? number
    : number.toFixed(2)}%`;
}

function isValidDate(value) {
  if (
    !value
  ) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

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
      .from(
        "invoices"
      )
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

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return data;
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
      !isUuid(
        id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid invoice ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

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
        "You do not have permission to view invoices."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const invoice =
      await loadInvoice({
        supabase,
        organizationId,

        invoiceId:
          id,
      });

    if (
      !invoice
    ) {
      return NextResponse.json(
        {
          error:
            "Invoice not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,

        record:
          invoice,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to view this invoice."
      );
    }

    const formattedInvoice =
      await attachRecordOwner({
        supabase,
        organizationId,

        record:
          invoice,
      });

    let employees = [];

    if (
      permissions.canAssign
    ) {
      employees =
        await loadAssignableEmployees({
          supabase,
          organizationId,
        });
    }

    return NextResponse.json({
      invoice:
        formattedInvoice,

      employees,

      currentEmployee:
        access.employee,

      access:
        buildClientAccess({
          access,
          permissions,
        }),
    });
  } catch (error) {
    console.error(
      "Invoice GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load invoice.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// PATCH
// =========================================================

export async function PATCH(
  request,
  context
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(
        id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid invoice ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

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

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const invoice =
      await loadInvoice({
        supabase,
        organizationId,

        invoiceId:
          id,
      });

    if (
      !invoice
    ) {
      return NextResponse.json(
        {
          error:
            "Invoice not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,

        record:
          invoice,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to update this invoice."
      );
    }

    const body =
      await request.json();

    const editableFields = [
      "client",
      "service",
      "status",
      "due_date",
      "payment_terms",
      "subtotal",
      "amount",
      "vat_rate",
    ];

    const wantsEdit =
      editableFields.some(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
      );

    const wantsOwnerChange =
      Object.prototype.hasOwnProperty.call(
        body,
        "owner_employee_id"
      );

    if (
      wantsEdit &&
      !permissions.canEdit
    ) {
      return forbidden(
        "You do not have permission to edit invoices."
      );
    }

    if (
      wantsOwnerChange &&
      !permissions.canAssign
    ) {
      return forbidden(
        "You do not have permission to assign invoices."
      );
    }

    if (
      !wantsEdit &&
      !wantsOwnerChange
    ) {
      return NextResponse.json(
        {
          error:
            "No supported invoice changes were provided.",
        },
        {
          status:
            400,
        }
      );
    }

    const updates = {};

    // =====================================================
    // CLIENT
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "client"
      )
    ) {
      const client =
        cleanText(
          body.client
        );

      if (
        !client
      ) {
        return NextResponse.json(
          {
            error:
              "Client name cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.client =
        client;
    }

    // =====================================================
    // SERVICE
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "service"
      )
    ) {
      const service =
        cleanText(
          body.service
        );

      if (
        !service
      ) {
        return NextResponse.json(
          {
            error:
              "Service cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.service =
        service;
    }

    // =====================================================
    // STATUS
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "status"
      )
    ) {
      if (
        !ALLOWED_STATUSES.includes(
          body.status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid invoice status.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.status =
        body.status;
    }

    // =====================================================
    // DUE DATE
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "due_date"
      )
    ) {
      const dueDate =
        body.due_date ||
        null;

      if (
        dueDate &&
        !isValidDate(
          dueDate
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Due date must use YYYY-MM-DD format.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.due_date =
        dueDate;
    }

    // =====================================================
    // PAYMENT TERMS
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "payment_terms"
      )
    ) {
      updates.payment_terms =
        cleanText(
          body.payment_terms
        );
    }

    // =====================================================
    // FINANCIALS
    // =====================================================

    const hasFinancialUpdate =
      Object.prototype.hasOwnProperty.call(
        body,
        "subtotal"
      ) ||
      Object.prototype.hasOwnProperty.call(
        body,
        "amount"
      ) ||
      Object.prototype.hasOwnProperty.call(
        body,
        "vat_rate"
      );

    if (
      hasFinancialUpdate
    ) {
      const subtotal =
        parseMoney(
          body.subtotal ??
            body.amount ??
            invoice.subtotal
        );

      const vatRate =
        parseVatRate(
          body.vat_rate ??
            invoice.vat_rate
        );

      if (
        subtotal <
        0
      ) {
        return NextResponse.json(
          {
            error:
              "Subtotal cannot be negative.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        vatRate <
          0 ||
        vatRate >
          100
      ) {
        return NextResponse.json(
          {
            error:
              "VAT rate must be between 0 and 100.",
          },
          {
            status:
              400,
          }
        );
      }

      const vatAmount =
        subtotal *
        (
          vatRate /
          100
        );

      const total =
        subtotal +
        vatAmount;

      updates.subtotal =
        formatCurrency(
          subtotal
        );

      updates.amount =
        formatCurrency(
          total
        );

      updates.vat_rate =
        formatVatRate(
          vatRate
        );

      updates.vat_amount =
        formatCurrency(
          vatAmount
        );

      updates.total_amount =
        formatCurrency(
          total
        );
    }

    // =====================================================
    // OWNER
    // =====================================================

    if (
      wantsOwnerChange
    ) {
      const requestedOwnerId =
        cleanText(
          body.owner_employee_id
        );

      if (
        !requestedOwnerId
      ) {
        updates.owner_employee_id =
          null;
      } else {
        const owner =
          await validateRecordOwner({
            supabase,
            organizationId,

            employeeId:
              requestedOwnerId,
          });

        if (
          !owner
        ) {
          return NextResponse.json(
            {
              error:
                "The selected invoice owner is not valid.",
            },
            {
              status:
                400,
            }
          );
        }

        updates.owner_employee_id =
          owner.id;
      }
    }

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
        .update(
          updates
        )
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
      throw new Error(
        updateError.message
      );
    }

    const formattedInvoice =
      await attachRecordOwner({
        supabase,
        organizationId,

        record:
          updatedInvoice,
      });

    return NextResponse.json({
      invoice:
        formattedInvoice,

      message:
        "Invoice updated successfully.",
    });
  } catch (error) {
    console.error(
      "Invoice PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to update invoice.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// DELETE
// =========================================================

export async function DELETE(
  request,
  context
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(
        id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid invoice ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

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
      !permissions.canDelete
    ) {
      return forbidden(
        "You do not have permission to delete invoices."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const invoice =
      await loadInvoice({
        supabase,
        organizationId,

        invoiceId:
          id,
      });

    if (
      !invoice
    ) {
      return NextResponse.json(
        {
          error:
            "Invoice not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,

        record:
          invoice,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to delete this invoice."
      );
    }

    const protectedStatuses = [
      "sent",
      "partially paid",
      "paid",
    ];

    if (
      protectedStatuses.includes(
        String(
          invoice.status ||
            ""
        )
          .trim()
          .toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Sent or paid invoices cannot be deleted. Cancel the invoice instead.",
        },
        {
          status:
            400,
        }
      );
    }

    const {
      error:
        deleteError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (
      deleteError
    ) {
      throw new Error(
        deleteError.message
      );
    }

    return NextResponse.json({
      message:
        "Invoice deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Invoice DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to delete invoice.",
      },
      {
        status:
          500,
      }
    );
  }
}
