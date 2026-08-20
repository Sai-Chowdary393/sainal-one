import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

import {
  attachRecordOwner,
  buildClientAccess,
  getRecordPermissions,
  getTeamEmployeeIds,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../lib/recordAccess";

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
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
  const cleaned =
    String(
      value ||
        ""
    )
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

function generateInvoiceNumber() {
  const year =
    new Date()
      .getFullYear();

  const suffix =
    Date.now()
      .toString()
      .slice(-6);

  return `SNI-${year}-${suffix}`;
}

async function attachOwners({
  supabase,
  organizationId,
  invoices,
}) {
  return Promise.all(
    (
      invoices ||
      []
    ).map(
      (
        invoice
      ) =>
        attachRecordOwner({
          supabase,
          organizationId,
          record:
            invoice,
        })
    )
  );
}

// =========================================================
// GET
// =========================================================

export async function GET() {
  try {
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

    let query =
      supabase
        .from(
          "invoices"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    if (
      !permissions.canViewAll &&
      permissions.canViewTeam
    ) {
      const teamIds =
        await getTeamEmployeeIds({
          supabase,

          employee:
            access.employee,
        });

      query =
        query.in(
          "owner_employee_id",
          teamIds
        );
    } else if (
      !permissions.canViewAll &&
      permissions.canViewOwn
    ) {
      query =
        query.eq(
          "owner_employee_id",
          access.employee.id
        );
    }

    const {
      data:
        invoiceRows,
      error,
    } =
      await query.order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    const invoices =
      await attachOwners({
        supabase,
        organizationId,

        invoices:
          invoiceRows ||
          [],
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
      invoices,

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
      "Invoices GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to fetch invoices.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request
) {
  try {
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
      !permissions.canCreate
    ) {
      return forbidden(
        "You do not have permission to create invoices."
      );
    }

    const body =
      await request.json();

    const client =
      cleanText(
        body.client
      );

    const service =
      cleanText(
        body.service
      );

    if (
      !client ||
      !service
    ) {
      return NextResponse.json(
        {
          error:
            "Client and service are required.",
        },
        {
          status:
            400,
        }
      );
    }

    const subtotal =
      parseMoney(
        body.subtotal ??
          body.amount
      );

    const vatRate =
      parseVatRate(
        body.vat_rate
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

    const totalAmount =
      subtotal +
      vatAmount;

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // OWNER
    // =====================================================

    let ownerEmployeeId =
      access.employee.id;

    if (
      body.owner_employee_id
    ) {
      if (
        !permissions.canAssign
      ) {
        return forbidden(
          "You do not have permission to assign invoices."
        );
      }

      const owner =
        await validateRecordOwner({
          supabase,
          organizationId,

          employeeId:
            body.owner_employee_id,
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

      ownerEmployeeId =
        owner.id;
    }

    // =====================================================
    // INSERT
    // =====================================================

    const {
      data:
        invoice,
      error:
        createError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .insert([
          {
            organization_id:
              organizationId,

            customer_id:
              body.customer_id ||
              null,

            project_id:
              body.project_id ||
              null,

            quote_id:
              body.quote_id ||
              null,

            invoice_number:
              cleanText(
                body.invoice_number
              ) ||
              generateInvoiceNumber(),

            client,

            service,

            amount:
              formatCurrency(
                totalAmount
              ),

            subtotal:
              formatCurrency(
                subtotal
              ),

            vat_rate:
              formatVatRate(
                vatRate
              ),

            vat_amount:
              formatCurrency(
                vatAmount
              ),

            total_amount:
              formatCurrency(
                totalAmount
              ),

            status:
              cleanText(
                body.status
              ) ||
              "Draft Invoice",

            due_date:
              body.due_date ||
              null,

            payment_terms:
              cleanText(
                body.payment_terms
              ) ||
              "Payment due within 14 days of invoice date.",

            owner_employee_id:
              ownerEmployeeId,
          },
        ])
        .select()
        .single();

    if (
      createError
    ) {
      throw new Error(
        createError.message
      );
    }

    const formattedInvoice =
      await attachRecordOwner({
        supabase,
        organizationId,

        record:
          invoice,
      });

    return NextResponse.json(
      {
        invoice:
          formattedInvoice,

        message:
          "Invoice created successfully.",
      },
      {
        status:
          201,
      }
    );
  } catch (error) {
    console.error(
      "Invoice POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create invoice.",
      },
      {
        status:
          500,
      }
    );
  }
}
