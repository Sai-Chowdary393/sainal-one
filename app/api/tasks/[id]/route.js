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
  "Open",
  "Pending",
  "To Do",
  "In Progress",
  "Completed",
  "Blocked",
  "Cancelled",
];

const ALLOWED_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

// =========================================================
// HELPERS
// =========================================================

function cleanText(
  value
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function cleanNullableText(
  value
) {
  const cleaned =
    cleanText(
      value
    );

  return cleaned ||
    null;
}

function normaliseStatus(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function isUuid(
  value
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(
      value ||
        ""
    )
  );
}

function isDateValue(
  value
) {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(
      value
    )
  );
}

function forbidden(
  message
) {
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

function conflict(
  message
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status:
        409,
    }
  );
}

function getPermissions(
  access
) {
  return getRecordPermissions(
    access,
    {
      prefix:
        "tasks",

      module:
        "Tasks",
    }
  );
}

// =========================================================
// LOAD TASK
// =========================================================

async function loadTask({
  supabase,
  organizationId,
  taskId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "tasks"
      )
      .select("*")
      .eq(
        "id",
        taskId
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
// CHECK PARENT PROJECT LOCK
// =========================================================

async function isTaskProjectCompleted({
  supabase,
  organizationId,
  task,
}) {
  if (
    !task?.project_id
  ) {
    return false;
  }

  const {
    data:
      project,
    error,
  } =
    await supabase
      .from(
        "projects"
      )
      .select(
        "id, status"
      )
      .eq(
        "id",
        task.project_id
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

  if (!project) {
    /*
     * Do not silently treat a missing parent
     * project as Completed.
     *
     * Existing task operations continue to use
     * their normal validation and organisation
     * boundaries.
     */
    return false;
  }

  return (
    normaliseStatus(
      project.status
    ) ===
    "completed"
  );
}

// =========================================================
// ENRICH TASK
// =========================================================

async function enrichTask({
  supabase,
  organizationId,
  task,
}) {
  if (
    !task ||
    !task.assigned_employee_id
  ) {
    return {
      ...task,

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
      .select(
        `
          id,
          full_name,
          email,
          job_title,
          department_id
        `
      )
      .eq(
        "id",
        task.assigned_employee_id
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
    ...task,

    assigned_employee:
      employee ||
      null,
  };
}

// =========================================================
// CAN VIEW TASK
// =========================================================

async function canAccessTask({
  supabase,
  access,
  permissions,
  task,
}) {
  return canViewOwnedRecord({
    supabase,
    access,
    permissions,

    record:
      task,

    ownerField:
      "assigned_employee_id",
  });
}

// =========================================================
// GET ONE TASK
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
            "A valid task ID is required.",
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
        "You do not have permission to view tasks."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const task =
      await loadTask({
        supabase,
        organizationId,

        taskId:
          id,
      });

    if (!task) {
      return NextResponse.json(
        {
          error:
            "Task not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canAccessTask({
        supabase,
        access,
        permissions,
        task,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to view this task."
      );
    }

    const formattedTask =
      await enrichTask({
        supabase,
        organizationId,
        task,
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
      task:
        formattedTask,

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
      "Task GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load task.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// PATCH TASK
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
            "A valid task ID is required.",
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

    const existingTask =
      await loadTask({
        supabase,
        organizationId,

        taskId:
          id,
      });

    if (
      !existingTask
    ) {
      return NextResponse.json(
        {
          error:
            "Task not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canAccessTask({
        supabase,
        access,
        permissions,

        task:
          existingTask,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to update this task."
      );
    }

    // =====================================================
    // COMPLETED PROJECT LOCK
    // =====================================================

    const projectCompleted =
      await isTaskProjectCompleted({
        supabase,
        organizationId,

        task:
          existingTask,
      });

    if (
      projectCompleted
    ) {
      return conflict(
        "This task belongs to a completed project and delivery is locked. Reopen the project before editing its tasks."
      );
    }

    const body =
      await request.json();

    const editableFields = [
      "task_name",
      "description",
      "status",
      "due_date",
      "priority",
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

    const wantsAssigneeChange =
      Object.prototype.hasOwnProperty.call(
        body,
        "assigned_employee_id"
      );

    if (
      wantsEdit &&
      !permissions.canEdit
    ) {
      return forbidden(
        "You do not have permission to edit tasks."
      );
    }

    if (
      wantsAssigneeChange &&
      !permissions.canAssign
    ) {
      return forbidden(
        "You do not have permission to assign tasks."
      );
    }

    if (
      !wantsEdit &&
      !wantsAssigneeChange
    ) {
      return NextResponse.json(
        {
          error:
            "No supported task changes were provided.",
        },
        {
          status:
            400,
        }
      );
    }

    const updates = {
      updated_at:
        new Date()
          .toISOString(),
    };

    // =====================================================
    // NAME
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "task_name"
      )
    ) {
      const taskName =
        cleanText(
          body.task_name
        );

      if (
        !taskName
      ) {
        return NextResponse.json(
          {
            error:
              "Task name cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.task_name =
        taskName;
    }

    // =====================================================
    // DESCRIPTION
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "description"
      )
    ) {
      updates.description =
        cleanNullableText(
          body.description
        );
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
              "Invalid task status.",
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
    // PRIORITY
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "priority"
      )
    ) {
      if (
        !ALLOWED_PRIORITIES.includes(
          body.priority
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid task priority.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.priority =
        body.priority;
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
        !isDateValue(
          dueDate
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Task due date must use YYYY-MM-DD format.",
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
    // ASSIGNEE
    // =====================================================

    if (
      wantsAssigneeChange
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
                "The selected task assignee is not valid.",
            },
            {
              status:
                400,
            }
          );
        }

        const employee =
          await validateRecordOwner({
            supabase,
            organizationId,

            employeeId,
          });

        if (
          !employee
        ) {
          return NextResponse.json(
            {
              error:
                "The selected task assignee is not valid.",
            },
            {
              status:
                400,
            }
          );
        }

        updates.assigned_employee_id =
          employee.id;
      }
    }

    // =====================================================
    // UPDATE
    // =====================================================

    const {
      data:
        updatedTask,
      error:
        updateError,
    } =
      await supabase
        .from(
          "tasks"
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

    const formattedTask =
      await enrichTask({
        supabase,
        organizationId,

        task:
          updatedTask,
      });

    return NextResponse.json({
      task:
        formattedTask,

      message:
        "Task updated successfully.",
    });
  } catch (error) {
    console.error(
      "Task PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to update task.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// DELETE TASK
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
            "A valid task ID is required.",
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
        "You do not have permission to delete tasks."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const task =
      await loadTask({
        supabase,
        organizationId,

        taskId:
          id,
      });

    if (!task) {
      return NextResponse.json(
        {
          error:
            "Task not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canAccessTask({
        supabase,
        access,
        permissions,
        task,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to delete this task."
      );
    }

    // =====================================================
    // COMPLETED PROJECT LOCK
    // =====================================================

    const projectCompleted =
      await isTaskProjectCompleted({
        supabase,
        organizationId,
        task,
      });

    if (
      projectCompleted
    ) {
      return conflict(
        "This task belongs to a completed project and delivery is locked. Reopen the project before deleting its tasks."
      );
    }

    /*
     * Workflow-created tasks are audit-linked records.
     * We keep them and allow completion/cancellation rather
     * than silently destroying workflow history.
     */
    if (
      task.workflow_run_id
    ) {
      return NextResponse.json(
        {
          error:
            "Workflow-created tasks cannot be deleted. Mark the task Completed or Cancelled instead.",
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
          "tasks"
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
      task,

      message:
        "Task deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Task DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to delete task.",
      },
      {
        status:
          500,
      }
    );
  }
}
