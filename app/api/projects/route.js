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
  canViewOwnedRecord,
  getRecordPermissions,
  getTeamEmployeeIds,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../lib/recordAccess";

// =========================================================
// CONSTANTS
// =========================================================

const ALLOWED_STATUSES = [
  "Planning",
  "In Progress",
  "On Hold",
  "Completed",
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

function cleanNullableText(value) {
  const cleaned =
    cleanText(value);

  return cleaned || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function isDateValue(value) {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value)
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
      prefix:
        "projects",

      module:
        "Projects",
    }
  );
}

function getRelatedPermissions(
  access,
  prefix,
  module
) {
  return getRecordPermissions(
    access,
    {
      prefix,
      module,
    }
  );
}

// =========================================================
// ATTACH OWNERS
// =========================================================

async function attachOwners({
  supabase,
  organizationId,
  projects,
}) {
  return Promise.all(
    (
      projects ||
      []
    ).map(
      (project) =>
        attachRecordOwner({
          supabase,
          organizationId,
          record:
            project,
        })
    )
  );
}

// =========================================================
// VALIDATE RELATED RECORD
// =========================================================

async function validateRelatedRecord({
  supabase,
  access,
  organizationId,
  table,
  recordId,
  label,
  prefix,
  module,
}) {
  if (!recordId) {
    return null;
  }

  if (!isUuid(recordId)) {
    throw new Error(
      `The selected ${label.toLowerCase()} is not valid.`
    );
  }

  const {
    data:
      record,
    error,
  } =
    await supabase
      .from(table)
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        recordId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!record) {
    throw new Error(
      `The selected ${label.toLowerCase()} is not valid.`
    );
  }

  const permissions =
    getRelatedPermissions(
      access,
      prefix,
      module
    );

  const visible =
    await canViewOwnedRecord({
      supabase,
      access,
      permissions,
      record,
    });

  if (!visible) {
    throw new Error(
      `You do not have permission to use this ${label.toLowerCase()}.`
    );
  }

  return record;
}

// =========================================================
// GET
// =========================================================

export async function GET() {
  try {
    const access =
      await getServerAccess();

    if (!access.employee) {
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
        "You do not have permission to view projects."
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
          "projects"
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
      const teamEmployeeIds =
        await getTeamEmployeeIds({
          supabase,

          employee:
            access.employee,
        });

      query =
        query.in(
          "owner_employee_id",
          teamEmployeeIds
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
        projectRows,
      error:
        projectsError,
    } =
      await query.order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (projectsError) {
      throw new Error(
        projectsError.message
      );
    }

    const projects =
      await attachOwners({
        supabase,
        organizationId,

        projects:
          projectRows ||
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
      projects,

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
      "Projects GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load projects.",
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
  request
) {
  try {
    const access =
      await getServerAccess();

    if (!access.employee) {
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
        "You do not have permission to create projects."
      );
    }

    const body =
      await request.json();

    const projectName =
      cleanText(
        body.project_name
      );

    if (!projectName) {
      return NextResponse.json(
        {
          error:
            "Project name is required.",
        },
        {
          status: 400,
        }
      );
    }

    const status =
      cleanText(
        body.status
      ) ||
      "Planning";

    if (
      !ALLOWED_STATUSES.includes(
        status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid project status.",
        },
        {
          status: 400,
        }
      );
    }

    const startDate =
      body.start_date ||
      null;

    const dueDate =
      body.due_date ||
      null;

    if (
      !isDateValue(
        startDate
      ) ||
      !isDateValue(
        dueDate
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Project dates must use YYYY-MM-DD format.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      startDate &&
      dueDate &&
      String(dueDate) <
        String(startDate)
    ) {
      return NextResponse.json(
        {
          error:
            "Project due date cannot be before the start date.",
        },
        {
          status: 400,
        }
      );
    }

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
          "You do not have permission to assign projects."
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
              "The selected project owner is not valid.",
          },
          {
            status: 400,
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

      if (!owner) {
        return NextResponse.json(
          {
            error:
              "The selected project owner is not valid.",
          },
          {
            status: 400,
          }
        );
      }

      ownerEmployeeId =
        owner.id;
    }

    // =====================================================
    // CUSTOMER
    // =====================================================

    const requestedCustomerId =
      cleanText(
        body.customer_id
      );

    let customer =
      null;

    if (
      requestedCustomerId
    ) {
      try {
        customer =
          await validateRelatedRecord({
            supabase,
            access,
            organizationId,

            table:
              "customers",

            recordId:
              requestedCustomerId,

            label:
              "Customer",

            prefix:
              "customers",

            module:
              "Customers",
          });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error.message,
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // QUOTE
    // =====================================================

    const requestedQuoteId =
      cleanText(
        body.quote_id
      );

    let quote =
      null;

    if (
      requestedQuoteId
    ) {
      try {
        quote =
          await validateRelatedRecord({
            supabase,
            access,
            organizationId,

            table:
              "quotes",

            recordId:
              requestedQuoteId,

            label:
              "Quote",

            prefix:
              "quotes",

            module:
              "Quotes",
          });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error.message,
          },
          {
            status: 403,
          }
        );
      }
    }

    let customerId =
      customer?.id ||
      null;

    const quoteId =
      quote?.id ||
      null;

    /*
     * If the Quote already belongs to a Customer,
     * use that relationship unless an explicit
     * matching Customer was supplied.
     */
    if (
      quote?.customer_id
    ) {
      if (
        customerId &&
        String(
          customerId
        ) !==
          String(
            quote.customer_id
          )
      ) {
        return NextResponse.json(
          {
            error:
              "The selected quote belongs to a different customer.",
          },
          {
            status: 400,
          }
        );
      }

      if (!customerId) {
        /*
         * The Quote itself has already been validated as
         * visible. Confirm the inherited Customer is also
         * part of the same organisation.
         */
        const {
          data:
            inheritedCustomer,
          error:
            inheritedCustomerError,
        } =
          await supabase
            .from(
              "customers"
            )
            .select("id")
            .eq(
              "organization_id",
              organizationId
            )
            .eq(
              "id",
              quote.customer_id
            )
            .maybeSingle();

        if (
          inheritedCustomerError
        ) {
          throw new Error(
            inheritedCustomerError.message
          );
        }

        if (
          !inheritedCustomer
        ) {
          return NextResponse.json(
            {
              error:
                "The quote has an invalid customer relationship.",
            },
            {
              status: 400,
            }
          );
        }

        customerId =
          inheritedCustomer.id;
      }
    }

    // =====================================================
    // INSERT
    // =====================================================

    const {
      data:
        project,
      error:
        createError,
    } =
      await supabase
        .from(
          "projects"
        )
        .insert([
          {
            organization_id:
              organizationId,

            customer_id:
              customerId,

            quote_id:
              quoteId,

            project_name:
              projectName,

            description:
              cleanNullableText(
                body.description
              ),

            amount:
              cleanNullableText(
                body.amount
              ),

            status,

            start_date:
              startDate,

            due_date:
              dueDate,

            owner_employee_id:
              ownerEmployeeId,
          },
        ])
        .select()
        .single();

    if (createError) {
      throw new Error(
        createError.message
      );
    }

    const formattedProject =
      await attachRecordOwner({
        supabase,
        organizationId,

        record:
          project,
      });

    return NextResponse.json(
      {
        project:
          formattedProject,

        message:
          "Project created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Project POST error:",
      error
    );

    const message =
      error.message ||
      "Unable to create project.";

    const validationError =
      [
        "required",
        "invalid",
        "yyyy-mm-dd",
        "cannot be before",
        "different customer",
      ].some(
        (item) =>
          message
            .toLowerCase()
            .includes(
              item
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
