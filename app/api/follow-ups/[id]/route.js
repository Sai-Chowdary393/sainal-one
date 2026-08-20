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
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
];

const ALLOWED_RELATED_TYPES = [
  "General",
  "Lead",
  "Customer",
  "Quote",
  "Proposal",
  "Project",
  "Invoice",
];

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value ===
    "string"
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
        "followups",

      module:
        "Follow-ups",
    }
  );
}

// =========================================================
// LOAD RECORD
// =========================================================

async function loadFollowUp({
  supabase,
  organizationId,
  id,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "follow_ups"
      )
      .select("*")
      .eq(
        "id",
        id
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
// CHECK VISIBILITY
// =========================================================

async function canAccessFollowUp({
  supabase,
  access,
  permissions,
  followUp,
}) {
  return canViewOwnedRecord({
    supabase,
    access,
    permissions,

    record:
      followUp,

    ownerField:
      "assigned_employee_id",
  });
}

// =========================================================
// ENRICH
// =========================================================

async function enrichFollowUp({
  supabase,
  organizationId,
  followUp,
}) {
  if (
    !followUp
      ?.assigned_employee_id
  ) {
    return {
      ...followUp,

      assigned_employee:
        null,
    };
  }

  const {
    data:
      employee,
    error,
  } =
    await supabase
      .from(
        "employees"
      )
      .select(`
        id,
        full_name,
        email,
        job_title,
        department_id
      `)
      .eq(
        "id",
        followUp.assigned_employee_id
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

  return {
    ...followUp,

    assigned_employee:
      employee || null,
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

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid follow-up ID is required.",
        },
        {
          status: 400,
        }
      );
    }

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
      getPermissions(access);

    if (
      !permissions.canViewAll &&
      !permissions.canViewTeam &&
      !permissions.canViewOwn
    ) {
      return forbidden(
        "You do not have permission to view follow-ups."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const followUp =
      await loadFollowUp({
        supabase,
        organizationId,
        id,
      });

    if (!followUp) {
      return NextResponse.json(
        {
          error:
            "Follow-up not found.",
        },
        {
          status: 404,
        }
      );
    }

    const visible =
      await canAccessFollowUp({
        supabase,
        access,
        permissions,
        followUp,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to view this follow-up."
      );
    }

    const formattedFollowUp =
      await enrichFollowUp({
        supabase,
        organizationId,
        followUp,
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
      followUp:
        formattedFollowUp,

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
      "Follow-up GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load follow-up.",
      },
      {
        status: 500,
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

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid follow-up ID is required.",
        },
        {
          status: 400,
        }
      );
    }

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
      getPermissions(access);

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const followUp =
      await loadFollowUp({
        supabase,
        organizationId,
        id,
      });

    if (!followUp) {
      return NextResponse.json(
        {
          error:
            "Follow-up not found.",
        },
        {
          status: 404,
        }
      );
    }

    const visible =
      await canAccessFollowUp({
        supabase,
        access,
        permissions,
        followUp,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to update this follow-up."
      );
    }

    const body =
      await request.json();

    const editableFields = [
      "title",
      "note",
      "due_date",
      "status",
      "related_type",
      "related_id",
    ];

    const wantsEdit =
      editableFields.some(
        (field) =>
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
      );

    const wantsAssignment =
      Object.prototype.hasOwnProperty.call(
        body,
        "assigned_employee_id"
      );

    if (
      wantsEdit &&
      !permissions.canEdit
    ) {
      return forbidden(
        "You do not have permission to edit follow-ups."
      );
    }

    if (
      wantsAssignment &&
      !permissions.canAssign
    ) {
      return forbidden(
        "You do not have permission to assign follow-ups."
      );
    }

    if (
      !wantsEdit &&
      !wantsAssignment
    ) {
      return NextResponse.json(
        {
          error:
            "No supported follow-up changes were provided.",
        },
        {
          status: 400,
        }
      );
    }

    const updates = {
      updated_at:
        new Date()
          .toISOString(),
    };

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "title"
      )
    ) {
      const title =
        cleanText(
          body.title
        );

      if (!title) {
        return NextResponse.json(
          {
            error:
              "Follow-up title cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.title =
        title;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "note"
      )
    ) {
      updates.note =
        cleanNullableText(
          body.note
        );
    }

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
        !isDateValue(
          dueDate
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Follow-up due date must use YYYY-MM-DD format.",
          },
          {
            status: 400,
          }
        );
      }

      updates.due_date =
        dueDate;
    }

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
              "Invalid follow-up status.",
          },
          {
            status: 400,
          }
        );
      }

      updates.status =
        body.status;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "related_type"
      )
    ) {
      if (
        !ALLOWED_RELATED_TYPES.includes(
          body.related_type
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid related record type.",
          },
          {
            status: 400,
          }
        );
      }

      updates.related_type =
        body.related_type;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "related_id"
      )
    ) {
      updates.related_id =
        cleanNullableText(
          body.related_id
        );
    }

    if (
      wantsAssignment
    ) {
      const employeeId =
        cleanText(
          body.assigned_employee_id
        );

      if (!employeeId) {
        updates.assigned_employee_id =
          null;
      } else {
        if (
          !isUuid(
            employeeId
          )
        ) {
          return NextResponse.json(
            {
              error:
                "The selected follow-up assignee is not valid.",
            },
            {
              status: 400,
            }
          );
        }

        const employee =
          await validateRecordOwner({
            supabase,
            organizationId,

            employeeId,
          });

        if (!employee) {
          return NextResponse.json(
            {
              error:
                "The selected follow-up assignee is not valid.",
            },
            {
              status: 400,
            }
          );
        }

        updates.assigned_employee_id =
          employee.id;
      }
    }

    const {
      data:
        updatedFollowUp,
      error:
        updateError,
    } =
      await supabase
        .from(
          "follow_ups"
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

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    const formattedFollowUp =
      await enrichFollowUp({
        supabase,
        organizationId,

        followUp:
          updatedFollowUp,
      });

    return NextResponse.json({
      followUp:
        formattedFollowUp,

      message:
        "Follow-up updated successfully.",
    });
  } catch (error) {
    console.error(
      "Follow-up PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to update follow-up.",
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

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid follow-up ID is required.",
        },
        {
          status: 400,
        }
      );
    }

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
      getPermissions(access);

    if (
      !permissions.canDelete
    ) {
      return forbidden(
        "You do not have permission to delete follow-ups."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const followUp =
      await loadFollowUp({
        supabase,
        organizationId,
        id,
      });

    if (!followUp) {
      return NextResponse.json(
        {
          error:
            "Follow-up not found.",
        },
        {
          status: 404,
        }
      );
    }

    const visible =
      await canAccessFollowUp({
        supabase,
        access,
        permissions,
        followUp,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to delete this follow-up."
      );
    }

    const {
      error:
        deleteError,
    } =
      await supabase
        .from(
          "follow_ups"
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

    if (deleteError) {
      throw new Error(
        deleteError.message
      );
    }

    return NextResponse.json({
      message:
        "Follow-up deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Follow-up DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to delete follow-up.",
      },
      {
        status: 500,
      }
    );
  }
}
