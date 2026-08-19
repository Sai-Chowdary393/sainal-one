import { NextResponse } from "next/server";

import {
  getCurrentEmployeeAccess,
} from "../../../../lib/accessControl";

import {
  createAdminSupabaseClient,
} from "../../../../lib/supabaseAdmin";

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
// LOAD LEAD
// ORGANISATION-SCOPED
// =========================================================

async function loadLead({
  adminSupabase,
  organizationId,
  leadId,
}) {
  const {
    data:
      lead,
    error:
      leadError,
  } =
    await adminSupabase
      .from("leads")
      .select("*")
      .eq(
        "id",
        leadId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

  if (
    leadError
  ) {
    throw new Error(
      leadError.message
    );
  }

  return lead;
}

// =========================================================
// CHECK VISIBILITY
// =========================================================

async function canViewLead({
  adminSupabase,
  access,
  lead,
}) {
  if (
    access.can(
      "leads.view_all"
    )
  ) {
    return true;
  }

  if (
    access.can(
      "leads.view_own"
    ) &&
    String(
      lead.owner_employee_id ||
        ""
    ) ===
      String(
        access.employee.id
      )
  ) {
    return true;
  }

  if (
    access.can(
      "leads.view_team"
    )
  ) {
    /*
     * SaiNal One currently uses Department as Team.
     */

    const currentDepartmentId =
      access.employee
        .department_id;

    if (
      !currentDepartmentId ||
      !lead.owner_employee_id
    ) {
      return false;
    }

    const {
      data:
        ownerEmployee,
      error:
        ownerError,
    } =
      await adminSupabase
        .from("employees")
        .select(
          `
            id,
            department_id,
            organization_id
          `
        )
        .eq(
          "id",
          lead.owner_employee_id
        )
        .eq(
          "organization_id",
          access.employee
            .organization_id
        )
        .maybeSingle();

    if (
      ownerError
    ) {
      throw new Error(
        ownerError.message
      );
    }

    return (
      ownerEmployee &&
      String(
        ownerEmployee.department_id ||
          ""
      ) ===
        String(
          currentDepartmentId
        )
    );
  }

  return false;
}

// =========================================================
// ATTACH OWNER
// =========================================================

async function attachOwner({
  adminSupabase,
  organizationId,
  lead,
}) {
  if (
    !lead?.owner_employee_id
  ) {
    return {
      ...lead,

      owner:
        null,
    };
  }

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
        lead.owner_employee_id
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

  return {
    ...lead,

    owner:
      owner ||
      null,
  };
}

// =========================================================
// LOAD ASSIGNABLE EMPLOYEES
// =========================================================

async function loadAssignableEmployees({
  adminSupabase,
  organizationId,
}) {
  const {
    data,
    error,
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
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return data || [];
}

// =========================================================
// GET
// VIEW INDIVIDUAL LEAD
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
            "A valid lead ID is required.",
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

    const canViewAnyLeads =
      access.can(
        "leads.view_all"
      ) ||
      access.can(
        "leads.view_team"
      ) ||
      access.can(
        "leads.view_own"
      );

    if (
      !canViewAnyLeads
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
    // LEAD
    // =====================================================

    const lead =
      await loadLead({
        adminSupabase,
        organizationId,
        leadId:
          id,
      });

    if (
      !lead
    ) {
      return NextResponse.json(
        {
          error:
            "Lead not found.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // VISIBILITY
    // =====================================================

    const visible =
      await canViewLead({
        adminSupabase,
        access,
        lead,
      });

    if (
      !visible
    ) {
      return forbiddenResponse(
        "You do not have permission to view this lead."
      );
    }

    // =====================================================
    // OWNER
    // =====================================================

    const formattedLead =
      await attachOwner({
        adminSupabase,
        organizationId,
        lead,
      });

    // =====================================================
    // ASSIGNABLE EMPLOYEES
    // =====================================================

    let employees = [];

    if (
      access.can(
        "leads.assign"
      )
    ) {
      employees =
        await loadAssignableEmployees({
          adminSupabase,
          organizationId,
        });
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      lead:
        formattedLead,

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

        canViewAll:
          access.can(
            "leads.view_all"
          ),

        canViewTeam:
          access.can(
            "leads.view_team"
          ),

        canViewOwn:
          access.can(
            "leads.view_own"
          ),

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
      "Lead GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load lead.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// PATCH
// UPDATE LEAD
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
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid lead ID is required.",
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

    const adminSupabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // EXISTING LEAD
    // =====================================================

    const existingLead =
      await loadLead({
        adminSupabase,
        organizationId,
        leadId:
          id,
      });

    if (
      !existingLead
    ) {
      return NextResponse.json(
        {
          error:
            "Lead not found.",
        },
        {
          status: 404,
        }
      );
    }

    const visible =
      await canViewLead({
        adminSupabase,
        access,
        lead:
          existingLead,
      });

    if (
      !visible
    ) {
      return forbiddenResponse(
        "You do not have permission to update this lead."
      );
    }

    // =====================================================
    // BODY
    // =====================================================

    const body =
      await request.json();

    const wantsOwnerChange =
      Object.prototype.hasOwnProperty.call(
        body,
        "owner_employee_id"
      );

    const editableFields = [
      "name",
      "company",
      "email",
      "phone",
      "status",
      "value",
      "notes",
      "source",
      "ai_score",
      "ai_summary",
      "ai_next_action",
    ];

    const wantsLeadEdit =
      editableFields.some(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
      );

    // =====================================================
    // EDIT PERMISSION
    // =====================================================

    if (
      wantsLeadEdit &&
      !access.can(
        "leads.edit"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to edit leads."
      );
    }

    // =====================================================
    // ASSIGN PERMISSION
    // =====================================================

    if (
      wantsOwnerChange &&
      !access.can(
        "leads.assign"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to assign or reassign leads."
      );
    }

    if (
      !wantsLeadEdit &&
      !wantsOwnerChange
    ) {
      return NextResponse.json(
        {
          error:
            "No supported lead changes were provided.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // UPDATE PAYLOAD
    // =====================================================

    const updatePayload = {};

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "name"
      )
    ) {
      const name =
        cleanText(
          body.name
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

      updatePayload.name =
        name;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "company"
      )
    ) {
      const company =
        cleanText(
          body.company
        );

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

      updatePayload.company =
        company;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "email"
      )
    ) {
      updatePayload.email =
        cleanNullableText(
          body.email
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "phone"
      )
    ) {
      updatePayload.phone =
        cleanNullableText(
          body.phone
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "status"
      )
    ) {
      updatePayload.status =
        cleanText(
          body.status
        ) ||
        "New";
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "value"
      )
    ) {
      updatePayload.value =
        cleanNullableText(
          body.value
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "notes"
      )
    ) {
      updatePayload.notes =
        cleanNullableText(
          body.notes
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "source"
      )
    ) {
      updatePayload.source =
        cleanNullableText(
          body.source
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "ai_score"
      )
    ) {
      updatePayload.ai_score =
        cleanNullableText(
          body.ai_score
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "ai_summary"
      )
    ) {
      updatePayload.ai_summary =
        cleanNullableText(
          body.ai_summary
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "ai_next_action"
      )
    ) {
      updatePayload.ai_next_action =
        cleanNullableText(
          body.ai_next_action
        );
    }

    // =====================================================
    // OWNER CHANGE
    // =====================================================

    if (
      wantsOwnerChange
    ) {
      const requestedOwnerId =
        cleanText(
          body.owner_employee_id
        );

      /*
       * Allow leads.assign users to explicitly leave a lead
       * unassigned.
       */
      if (
        !requestedOwnerId
      ) {
        updatePayload.owner_employee_id =
          null;
      } else {
        if (
          !isUuid(
            requestedOwnerId
          )
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
                organization_id,
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

        updatePayload.owner_employee_id =
          selectedOwner.id;
      }
    }

    // =====================================================
    // UPDATE
    // =====================================================

    const {
      data:
        updatedLead,
      error:
        updateError,
    } =
      await adminSupabase
        .from("leads")
        .update(
          updatePayload
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

    const formattedLead =
      await attachOwner({
        adminSupabase,
        organizationId,
        lead:
          updatedLead,
      });

    return NextResponse.json({
      lead:
        formattedLead,

      message:
        "Lead updated successfully.",
    });
  } catch (
    error
  ) {
    console.error(
      "Lead PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to update lead.",
      },
      {
        status: 500,
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
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid lead ID is required.",
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
        "leads.delete"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to delete leads."
      );
    }

    const adminSupabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // LEAD
    // =====================================================

    const lead =
      await loadLead({
        adminSupabase,
        organizationId,
        leadId:
          id,
      });

    if (
      !lead
    ) {
      return NextResponse.json(
        {
          error:
            "Lead not found.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // VISIBILITY
    // =====================================================

    const visible =
      await canViewLead({
        adminSupabase,
        access,
        lead,
      });

    if (
      !visible
    ) {
      return forbiddenResponse(
        "You do not have permission to delete this lead."
      );
    }

    // =====================================================
    // DELETE
    // =====================================================

    const {
      error:
        deleteError,
    } =
      await adminSupabase
        .from("leads")
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
        "Lead deleted successfully.",
    });
  } catch (
    error
  ) {
    console.error(
      "Lead DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to delete lead.",
      },
      {
        status: 500,
      }
    );
  }
}
