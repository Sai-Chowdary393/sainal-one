import { NextResponse } from "next/server";

import {
  getCurrentEmployeeAccess,
} from "../../../lib/accessControl";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

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

function unauthenticatedResponse(
  message = "You must be logged in."
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 401,
    }
  );
}

function forbiddenResponse(
  message =
    "You do not have permission to perform this action."
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  );
}

// =========================================================
// LOAD LEADS
// =========================================================

async function loadVisibleLeads({
  adminSupabase,
  access,
}) {
  const organizationId =
    access.employee
      .organization_id;

  const employeeId =
    access.employee.id;

  // =======================================================
  // VIEW ALL
  // =======================================================

  if (
    access.can(
      "leads.view_all"
    )
  ) {
    const {
      data,
      error,
    } =
      await adminSupabase
        .from("leads")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    return data || [];
  }

  // =======================================================
  // VIEW TEAM
  // =======================================================

  if (
    access.can(
      "leads.view_team"
    )
  ) {
    /*
     * For now, SaiNal One uses department as the team.
     *
     * If the employee has no department, fall back to
     * their own leads only.
     */

    const departmentId =
      access.employee
        .department_id;

    let ownerIds = [
      employeeId,
    ];

    if (
      departmentId
    ) {
      const {
        data:
          teamEmployees,
        error:
          teamError,
      } =
        await adminSupabase
          .from("employees")
          .select("id")
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "department_id",
            departmentId
          )
          .eq(
            "is_active",
            true
          );

      if (
        teamError
      ) {
        throw new Error(
          teamError.message
        );
      }

      ownerIds =
        [
          ...new Set(
            (
              teamEmployees ||
              []
            )
              .map(
                (
                  employee
                ) =>
                  employee.id
              )
              .filter(Boolean)
          ),
        ];

      if (
        ownerIds.length ===
        0
      ) {
        ownerIds = [
          employeeId,
        ];
      }
    }

    const {
      data,
      error,
    } =
      await adminSupabase
        .from("leads")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "owner_employee_id",
          ownerIds
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    return data || [];
  }

  // =======================================================
  // VIEW OWN
  // =======================================================

  if (
    access.can(
      "leads.view_own"
    )
  ) {
    const {
      data,
      error,
    } =
      await adminSupabase
        .from("leads")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "owner_employee_id",
          employeeId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    return data || [];
  }

  return [];
}

// =========================================================
// ATTACH OWNER DETAILS
// =========================================================

async function attachLeadOwners({
  adminSupabase,
  organizationId,
  leads,
}) {
  const ownerIds =
    [
      ...new Set(
        (
          leads ||
          []
        )
          .map(
            (
              lead
            ) =>
              lead.owner_employee_id
          )
          .filter(Boolean)
      ),
    ];

  if (
    ownerIds.length ===
    0
  ) {
    return (
      leads ||
      []
    ).map(
      (
        lead
      ) => ({
        ...lead,

        owner:
          null,
      })
    );
  }

  const {
    data:
      owners,
    error:
      ownersError,
  } =
    await adminSupabase
      .from("employees")
      .select(
        `
          id,
          employee_number,
          full_name,
          email,
          job_title,
          department_id,
          is_active
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .in(
        "id",
        ownerIds
      );

  if (
    ownersError
  ) {
    throw new Error(
      ownersError.message
    );
  }

  const ownerMap =
    new Map(
      (
        owners ||
        []
      ).map(
        (
          owner
        ) => [
          owner.id,
          owner,
        ]
      )
    );

  return (
    leads ||
    []
  ).map(
    (
      lead
    ) => ({
      ...lead,

      owner:
        lead.owner_employee_id
          ? ownerMap.get(
              lead.owner_employee_id
            ) ||
            null
          : null,
    })
  );
}

// =========================================================
// GET
// =========================================================

export async function GET() {
  try {
    // =====================================================
    // ACCESS
    // =====================================================

    const access =
      await getCurrentEmployeeAccess();

    if (
      !access.authenticated
    ) {
      return unauthenticatedResponse(
        access.error
      );
    }

    if (
      !access.employee
    ) {
      return forbiddenResponse(
        access.error ||
          "Your login is not linked to an active employee record."
      );
    }

    const canViewAll =
      access.can(
        "leads.view_all"
      );

    const canViewTeam =
      access.can(
        "leads.view_team"
      );

    const canViewOwn =
      access.can(
        "leads.view_own"
      );

    const canViewLeads =
      canViewAll ||
      canViewTeam ||
      canViewOwn;

    if (
      !canViewLeads
    ) {
      return forbiddenResponse(
        "You do not have permission to view leads."
      );
    }

    const adminSupabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // LEADS
    // =====================================================

    const visibleLeads =
      await loadVisibleLeads({
        adminSupabase,
        access,
      });

    const leads =
      await attachLeadOwners({
        adminSupabase,
        organizationId,
        leads:
          visibleLeads,
      });

    // =====================================================
    // OWNER OPTIONS
    // =====================================================

    let employees = [];

    /*
     * Only users who can assign leads need the employee
     * directory for owner selection.
     */
    if (
      access.can(
        "leads.assign"
      )
    ) {
      const {
        data:
          employeeRows,
        error:
          employeesError,
      } =
        await adminSupabase
          .from("employees")
          .select(
            `
              id,
              employee_number,
              full_name,
              email,
              job_title,
              department_id,
              is_active
            `
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "full_name",
            {
              ascending: true,
            }
          );

      if (
        employeesError
      ) {
        throw new Error(
          employeesError.message
        );
      }

      employees =
        employeeRows ||
        [];
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      leads,

      employees,

      currentEmployee:
        access.employee,

      access: {
        isOwner:
          access.isOwner,

        permissions:
          access.permissions,

        roles:
          access.roles,

        canViewAll,

        canViewTeam,

        canViewOwn,

        canCreate:
          access.can(
            "leads.create"
          ),

        canEdit:
          access.can(
            "leads.edit"
          ),

        canDelete:
          access.can(
            "leads.delete"
          ),

        canAssign:
          access.can(
            "leads.assign"
          ),
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Leads GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load leads.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST
// CREATE LEAD
// =========================================================

export async function POST(
  request
) {
  try {
    // =====================================================
    // ACCESS
    // =====================================================

    const access =
      await getCurrentEmployeeAccess();

    if (
      !access.authenticated
    ) {
      return unauthenticatedResponse(
        access.error
      );
    }

    if (
      !access.employee
    ) {
      return forbiddenResponse(
        access.error ||
          "Your login is not linked to an active employee record."
      );
    }

    if (
      !access.can(
        "leads.create"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to create leads."
      );
    }

    const body =
      await request.json();

    // =====================================================
    // VALIDATION
    // =====================================================

    const name =
      cleanText(
        body.name
      );

    const company =
      cleanText(
        body.company
      );

    if (
      !name
    ) {
      return NextResponse.json(
        {
          error:
            "Lead name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !company
    ) {
      return NextResponse.json(
        {
          error:
            "Company is required.",
        },
        {
          status: 400,
        }
      );
    }

    const adminSupabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // OWNER
    // =====================================================

    /*
     * Default behaviour:
     *
     * The employee creating the lead becomes the owner.
     */
    let ownerEmployeeId =
      access.employee.id;

    /*
     * A caller may assign the lead to somebody else only
     * if they have leads.assign.
     */
    if (
      body.owner_employee_id
    ) {
      if (
        !access.can(
          "leads.assign"
        )
      ) {
        return forbiddenResponse(
          "You do not have permission to assign leads."
        );
      }

      const requestedOwnerId =
        cleanText(
          body.owner_employee_id
        );

      const {
        data:
          selectedOwner,
        error:
          selectedOwnerError,
      } =
        await adminSupabase
          .from("employees")
          .select(
            `
              id,
              is_active
            `
          )
          .eq(
            "id",
            requestedOwnerId
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();

      if (
        selectedOwnerError
      ) {
        throw new Error(
          selectedOwnerError.message
        );
      }

      if (
        !selectedOwner
      ) {
        return NextResponse.json(
          {
            error:
              "The selected lead owner is not valid.",
          },
          {
            status: 400,
          }
        );
      }

      ownerEmployeeId =
        selectedOwner.id;
    }

    // =====================================================
    // CREATE
    // =====================================================

    const leadPayload = {
      name,

      company,

      email:
        cleanNullableText(
          body.email
        ),

      phone:
        cleanNullableText(
          body.phone
        ),

      status:
        cleanText(
          body.status
        ) ||
        "New",

      value:
        cleanNullableText(
          body.value
        ),

      notes:
        cleanNullableText(
          body.notes
        ),

      source:
        cleanText(
          body.source
        ) ||
        "Manual",

      ai_score:
        cleanNullableText(
          body.ai_score
        ),

      ai_summary:
        cleanNullableText(
          body.ai_summary
        ),

      ai_next_action:
        cleanNullableText(
          body.ai_next_action
        ),

      organization_id:
        organizationId,

      owner_employee_id:
        ownerEmployeeId,
    };

    const {
      data:
        createdLead,
      error:
        createError,
    } =
      await adminSupabase
        .from("leads")
        .insert([
          leadPayload,
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

    const {
      data:
        owner,
      error:
        ownerError,
    } =
      await adminSupabase
        .from("employees")
        .select(
          `
            id,
            employee_number,
            full_name,
            email,
            job_title,
            department_id,
            is_active
          `
        )
        .eq(
          "id",
          ownerEmployeeId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      ownerError
    ) {
      throw new Error(
        ownerError.message
      );
    }

    return NextResponse.json(
      {
        lead: {
          ...createdLead,

          owner:
            owner ||
            null,
        },

        message:
          "Lead created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Leads POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create lead.",
      },
      {
        status: 500,
      }
    );
  }
}
