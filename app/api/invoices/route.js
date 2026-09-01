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
// CONSTANTS
// =========================================================

const ALLOWED_CREATE_STATUSES = [
  "Draft Invoice",
  "Draft",
];

const DEFAULT_PAYMENT_TERMS =
  "Payment due within 14 days of invoice date.";

const DEFAULT_DUE_DAYS = 14;

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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function isValidDate(value) {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

// =========================================================
// DATE HELPERS
// =========================================================

function getCreatedAt() {
  return new Date().toISOString();
}

function formatDateForDatabase(date) {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function getDefaultDueDate(
  createdAt,
  days =
    DEFAULT_DUE_DAYS
) {
  const date =
    new Date(
      createdAt
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return formatDateForDatabase(
    date
  );
}

// =========================================================
// RELATED RECORD VALIDATION
// =========================================================

async function validateRelatedRecord({
  supabase,
  organizationId,
  table,
  recordId,
  label,
}) {
  if (!recordId) {
    return null;
  }

  if (!isUuid(recordId)) {
    throw new Error(
      `${label} ID must be a valid UUID.`
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        table
      )
      .select(
        "id"
      )
      .eq(
        "id",
        recordId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to validate ${label.toLowerCase()}: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      `The selected ${label.toLowerCase()} is not valid for this organisation.`
    );
  }

  return data.id;
}

// =========================================================
// MONEY HELPERS
// =========================================================

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

  return `${Number.isInteger(
    number
  )
    ? number
    : number.toFixed(
        2
      )}%`;
}

// =========================================================
// INVOICE NUMBER
// =========================================================

function generateInvoiceNumber() {
  const year =
    new Date()
      .getFullYear();

  const suffix =
    Date.now()
      .toString()
      .slice(
        -6
      );

  return `SNI-${year}-${suffix}`;
}

// =========================================================
// OWNER ATTACHMENT
// =========================================================

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
        .select(
          "*"
        )
        .eq(
          "organization_id",
          organizationId
        );

    // =====================================================
    // RECORD ACCESS
    // =====================================================

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

    // =====================================================
    // ASSIGNABLE EMPLOYEES
    // =====================================================

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
  } catch (
    error
  ) {
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

    // =====================================================
    // CLIENT / SERVICE
    // =====================================================

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

    // =====================================================
    // STATUS
    // =====================================================

    /*
     * Every newly-created invoice starts as a draft.
     */

    const status =
      cleanText(
        body.status
      ) ||
      "Draft Invoice";

    if (
      !ALLOWED_CREATE_STATUSES.includes(
        status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "New invoices must start as Draft Invoice or Draft.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // CREATED / DUE DATES
    // =====================================================

    /*
     * created_at is now explicitly set.
     *
     * If the user supplies a due date we use it.
     *
     * If no due date is supplied we automatically
     * calculate 14 days after the invoice creation date.
     */

    const createdAt =
      getCreatedAt();

    const requestedDueDate =
      cleanText(
        body.due_date
      );

    if (
      requestedDueDate &&
      !isValidDate(
        requestedDueDate
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

    const dueDate =
      requestedDueDate ||
      getDefaultDueDate(
        createdAt
      );

    // =====================================================
    // MONEY
    // =====================================================

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

    // =====================================================
    // SERVER / ORGANISATION
    // =====================================================

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

      const requestedOwnerId =
        cleanText(
          body.owner_employee_id
        );

      if (
        !isUuid(
          requestedOwnerId
        )
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

      ownerEmployeeId =
        owner.id;
    }

    // =====================================================
    // RELATED RECORD IDS
    // =====================================================

    const customerId =
      body.customer_id
        ? cleanText(
            body.customer_id
          )
        : null;

    const projectId =
      body.project_id
        ? cleanText(
            body.project_id
          )
        : null;

    const quoteId =
      body.quote_id
        ? cleanText(
            body.quote_id
          )
        : null;

    // =====================================================
    // VALIDATE CUSTOMER
    // =====================================================

    await validateRelatedRecord({
      supabase,
      organizationId,

      table:
        "customers",

      recordId:
        customerId,

      label:
        "Customer",
    });

    // =====================================================
    // VALIDATE PROJECT
    // =====================================================

    await validateRelatedRecord({
      supabase,
      organizationId,

      table:
        "projects",

      recordId:
        projectId,

      label:
        "Project",
    });

    // =====================================================
    // VALIDATE QUOTE
    // =====================================================

    await validateRelatedRecord({
      supabase,
      organizationId,

      table:
        "quotes",

      recordId:
        quoteId,

      label:
        "Quote",
    });

    // =====================================================
    // PAYMENT TERMS
    // =====================================================

    const paymentTerms =
      cleanText(
        body.payment_terms
      ) ||
      DEFAULT_PAYMENT_TERMS;

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
              customerId,

            project_id:
              projectId,

            quote_id:
              quoteId,

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

            status,

            /*
             * Explicit invoice creation date.
             */
            created_at:
              createdAt,

            /*
             * User-selected date or automatic +14 days.
             */
            due_date:
              dueDate,

            payment_terms:
              paymentTerms,

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

    // =====================================================
    // OWNER DETAILS
    // =====================================================

    const formattedInvoice =
      await attachRecordOwner({
        supabase,
        organizationId,

        record:
          invoice,
      });

    // =====================================================
    // RESPONSE
    // =====================================================

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
  } catch (
    error
  ) {
    console.error(
      "Invoice POST error:",
      error
    );

    const message =
      error.message ||
      "Failed to create invoice.";

    const validationError =
      [
        "invalid",
        "required",
        "uuid",
        "not valid for this organisation",
        "must start as",
        "yyyy-mm-dd",
      ].some(
        (
          word
        ) =>
          message
            .toLowerCase()
            .includes(
              word
            )
      );

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          validationError
            ? 400
            : 500,
      }
    );
  }
}
