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
    String(
      value ||
        ""
    )
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
      (
        project
      ) =>
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

    // =====================================================
    // TEAM VISIBILITY
    // =====================================================

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
    }

    // =====================================================
    // OWN VISIBILITY
    // =====================================================

    else if (
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

    if (
      projectsError
    ) {
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

    // =====================================================
    // ASSIGNMENT OPTIONS
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
        "You do not have permission to create projects."
      );
    }

    const body =
      await request.json();

    const projectName =
      cleanText(
        body.project_name
      );

    if (
      !projectName
    ) {
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

      if (
        !owner
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

      ownerEmployeeId =
        owner.id;
    }

    // =====================================================
    // RELATED CUSTOMER
    // =====================================================

    let customerId =
      body.customer_id ||
      null;

    if (
      customerId
    ) {
      const {
        data:
          customer,
        error:
          customerError,
      } =
        await supabase
          .from(
            "customers"
          )
          .select(
            "id"
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "id",
            customerId
          )
          .maybeSingle();

      if (
        customerError
      ) {
        throw new Error(
          customerError.message
        );
      }

      if (
        !customer
      ) {
        return NextResponse.json(
          {
            error:
              "The selected customer is not valid.",
          },
          {
            status: 400,
          }
        );
      }

      customerId =
        customer.id;
    }

    // =====================================================
    // RELATED QUOTE
    // =====================================================

    let quoteId =
      body.quote_id ||
      null;

    if (
      quoteId
    ) {
      const {
        data:
          quote,
        error:
          quoteError,
      } =
        await supabase
          .from(
            "quotes"
          )
          .select(
            `
              id,
              customer_id,
              owner_employee_id
            `
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "id",
            quoteId
          )
          .maybeSingle();

      if (
        quoteError
      ) {
        throw new Error(
          quoteError.message
        );
      }

      if (
        !quote
      ) {
        return NextResponse.json(
          {
            error:
              "The selected quote is not valid.",
          },
          {
            status: 400,
          }
        );
      }

      quoteId =
        quote.id;

      /*
       * When a project is created from a quote and no
       * customer was explicitly provided, inherit the quote
       * customer relationship.
       */
      if (
        !customerId &&
        quote.customer_id
      ) {
        customerId =
          quote.customer_id;
      }

      /*
       * A normal creator keeps ownership.
       * An owner/assign-capable employee can explicitly
       * choose another owner through owner_employee_id.
       */
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

    if (
      createError
    ) {
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

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to create project.",
      },
      {
        status: 500,
      }
    );
  }
}
