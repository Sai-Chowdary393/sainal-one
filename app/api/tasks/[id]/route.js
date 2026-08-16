import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

// =========================================================
// HELPERS
// =========================================================

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function normaliseText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

class TaskValidationError extends Error {
  constructor(message) {
    super(message);

    this.name =
      "TaskValidationError";

    this.status =
      400;
  }
}

class TaskPermissionError extends Error {
  constructor(message) {
    super(message);

    this.name =
      "TaskPermissionError";

    this.status =
      403;
  }
}

// =========================================================
// TASK ACCESS
// =========================================================

function buildTaskAccessQuery({
  supabase,
  organizationId,
  employee,
  taskId,
}) {
  let query =
    supabase
      .from("tasks")
      .select("*")
      .eq(
        "id",
        taskId
      )
      .eq(
        "organization_id",
        organizationId
      );

  if (
    !employee
      .is_organization_owner
  ) {
    query =
      query.eq(
        "assigned_employee_id",
        employee.id
      );
  }

  return query;
}

// =========================================================
// ASSIGNMENT VALIDATION
// =========================================================

async function validateAssignedEmployee({
  access,
  assignedEmployeeId,
}) {
  /*
   * NULL / empty means deliberately Unassigned.
   */

  if (
    assignedEmployeeId ===
      null ||
    assignedEmployeeId ===
      undefined ||
    normaliseText(
      assignedEmployeeId
    ) ===
      ""
  ) {
    return null;
  }

  const employeeId =
    normaliseText(
      assignedEmployeeId
    );

  if (
    !isUuid(
      employeeId
    )
  ) {
    throw new TaskValidationError(
      "A valid employee ID is required for task assignment."
    );
  }

  /*
   * Only organisation owners may currently
   * reassign tasks.
   *
   * Later this can be extended to managers
   * or a tasks.assign permission.
   */

  if (
    !access.employee
      .is_organization_owner
  ) {
    throw new TaskPermissionError(
      "You do not have permission to reassign this task."
    );
  }

  const {
    data: employee,
    error,
  } =
    await access.supabase
      .from("employees")
      .select(
        `
          id,
          organization_id,
          full_name,
          email,
          job_title,
          employment_status,
          is_active
        `
      )
      .eq(
        "id",
        employeeId
      )
      .eq(
        "organization_id",
        access.employee
          .organization_id
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!employee) {
    throw new TaskValidationError(
      "The selected employee does not belong to this organisation."
    );
  }

  if (
    employee.is_active ===
    false
  ) {
    throw new TaskValidationError(
      "Tasks cannot be assigned to an inactive employee."
    );
  }

  if (
    normaliseText(
      employee.employment_status
    )
      .toLowerCase() ===
    "inactive"
  ) {
    throw new TaskValidationError(
      "Tasks cannot be assigned to an inactive employee."
    );
  }

  return employee.id;
}

// =========================================================
// ACTIVITY HELPERS
// =========================================================

function normaliseActivityValue(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value ===
    "object"
  ) {
    try {
      return JSON.stringify(
        value
      );
    } catch {
      return String(
        value
      );
    }
  }

  return String(
    value
  );
}

function valuesAreEqual(
  first,
  second
) {
  return (
    normaliseActivityValue(
      first
    ) ===
    normaliseActivityValue(
      second
    )
  );
}

function getFieldLabel(
  field
) {
  switch (field) {
    case "task_name":
      return "Task name";

    case "description":
      return "Description";

    case "status":
      return "Status";

    case "priority":
      return "Priority";

    case "due_date":
      return "Due date";

    case "assigned_employee_id":
      return "Assigned employee";

    default:
      return String(
        field ||
          "Field"
      );
  }
}

function getActivityType({
  field,
  newValue,
}) {
  if (
    field ===
    "status"
  ) {
    if (
      String(
        newValue || ""
      )
        .trim()
        .toLowerCase() ===
      "completed"
    ) {
      return "task_completed";
    }

    return "status_changed";
  }

  if (
    field ===
    "assigned_employee_id"
  ) {
    return "assignment_changed";
  }

  return "field_changed";
}

function getActivityMessage({
  field,
  oldValue,
  newValue,
}) {
  const fieldLabel =
    getFieldLabel(
      field
    );

  const oldText =
    normaliseActivityValue(
      oldValue
    ) ||
    "Empty";

  const newText =
    normaliseActivityValue(
      newValue
    ) ||
    "Empty";

  if (
    field ===
    "status"
  ) {
    if (
      newText
        .trim()
        .toLowerCase() ===
      "completed"
    ) {
      return `Task completed. Status changed from ${oldText} to ${newText}.`;
    }

    return `Status changed from ${oldText} to ${newText}.`;
  }

  if (
    field ===
    "priority"
  ) {
    return `Priority changed from ${oldText} to ${newText}.`;
  }

  if (
    field ===
    "due_date"
  ) {
    return `Due date changed from ${oldText} to ${newText}.`;
  }

  if (
    field ===
    "task_name"
  ) {
    return "Task name was updated.";
  }

  if (
    field ===
    "description"
  ) {
    return "Task description was updated.";
  }

  if (
    field ===
    "assigned_employee_id"
  ) {
    if (
      !newValue
    ) {
      return "Task was unassigned.";
    }

    if (
      !oldValue
    ) {
      return "Task was assigned to an employee.";
    }

    return "Task assignment was changed.";
  }

  return `${fieldLabel} changed from ${oldText} to ${newText}.`;
}

// =========================================================
// WRITE TASK ACTIVITY
// =========================================================

async function writeTaskActivity({
  supabase,
  organizationId,
  employeeId,
  taskId,
  existingTask,
  updatedTask,
  fields,
}) {
  const activityRows =
    [];

  for (
    const field of fields
  ) {
    const oldValue =
      existingTask?.[
        field
      ];

    const newValue =
      updatedTask?.[
        field
      ];

    if (
      valuesAreEqual(
        oldValue,
        newValue
      )
    ) {
      continue;
    }

    activityRows.push({
      organization_id:
        organizationId,

      task_id:
        taskId,

      employee_id:
        employeeId,

      activity_type:
        getActivityType({
          field,
          newValue,
        }),

      field_name:
        field,

      old_value:
        normaliseActivityValue(
          oldValue
        ) ||
        null,

      new_value:
        normaliseActivityValue(
          newValue
        ) ||
        null,

      message:
        getActivityMessage({
          field,
          oldValue,
          newValue,
        }),
    });
  }

  if (
    activityRows.length ===
    0
  ) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "task_activity"
      )
      .insert(
        activityRows
      );

  if (error) {
    /*
     * Do not fail an otherwise successful task update
     * because audit logging failed.
     */
    console.error(
      "Task activity logging error:",
      error
    );
  }
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
          status: 400,
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

    const {
      data: task,
      error,
    } =
      await buildTaskAccessQuery({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        employee:
          access.employee,

        taskId:
          id,
      }).maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (!task) {
      return NextResponse.json(
        {
          error:
            "Task not found or you do not have access to it.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      task,
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
          error.status ||
          500,
      }
    );
  }
}

// =========================================================
// UPDATE TASK
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
          status: 400,
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

    const body =
      await request.json();

    // =====================================================
    // LOAD CURRENT TASK
    // =====================================================

    const {
      data:
        existingTask,
      error:
        existingTaskError,
    } =
      await buildTaskAccessQuery({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        employee:
          access.employee,

        taskId:
          id,
      }).maybeSingle();

    if (
      existingTaskError
    ) {
      throw new Error(
        existingTaskError.message
      );
    }

    if (
      !existingTask
    ) {
      return NextResponse.json(
        {
          error:
            "Task not found or you do not have permission to update it.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // PROTECTED FIELDS
    // =====================================================

    const protectedFields =
      new Set([
        "id",
        "organization_id",
        "created_at",
        "workflow_run_id",
        "record_type",
        "record_id",
        "project_id",
      ]);

    const updateValues =
      {};

    Object.entries(
      body || {}
    ).forEach(
      ([
        key,
        value,
      ]) => {
        if (
          protectedFields.has(
            key
          )
        ) {
          return;
        }

        updateValues[
          key
        ] =
          value;
      }
    );

    // =====================================================
    // ASSIGNMENT SECURITY
    // =====================================================

    const assignmentWasProvided =
      Object.prototype.hasOwnProperty.call(
        updateValues,
        "assigned_employee_id"
      );

    if (
      assignmentWasProvided
    ) {
      /*
       * Normal employees may update their assigned
       * tasks but may not change ownership.
       */

      if (
        !access.employee
          .is_organization_owner
      ) {
        throw new TaskPermissionError(
          "You do not have permission to reassign this task."
        );
      }

      updateValues.assigned_employee_id =
        await validateAssignedEmployee({
          access,

          assignedEmployeeId:
            updateValues
              .assigned_employee_id,
        });
    }

    // =====================================================
    // EDITABLE FIELDS
    // =====================================================

    const editableFields =
      Object.keys(
        updateValues
      );

    if (
      editableFields.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "No editable task fields were provided.",
        },
        {
          status: 400,
        }
      );
    }

    updateValues.updated_at =
      new Date().toISOString();

    // =====================================================
    // UPDATE TASK
    // =====================================================

    let updateQuery =
      access.supabase
        .from("tasks")
        .update(
          updateValues
        )
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          access.employee
            .organization_id
        );

    if (
      !access.employee
        .is_organization_owner
    ) {
      updateQuery =
        updateQuery.eq(
          "assigned_employee_id",
          access.employee.id
        );
    }

    const {
      data: task,
      error,
    } =
      await updateQuery
        .select()
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (!task) {
      return NextResponse.json(
        {
          error:
            "Task could not be updated.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // ACTIVITY / AUDIT LOG
    // =====================================================

    await writeTaskActivity({
      supabase:
        access.supabase,

      organizationId:
        access.employee
          .organization_id,

      employeeId:
        access.employee.id,

      taskId:
        id,

      existingTask,

      updatedTask:
        task,

      fields:
        editableFields,
    });

    return NextResponse.json({
      task,

      message:
        assignmentWasProvided
          ? "Task updated and assignment saved successfully."
          : "Task updated successfully.",
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
          error.status ||
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
          status: 400,
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

    const {
      data:
        existingTask,
      error:
        existingTaskError,
    } =
      await buildTaskAccessQuery({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        employee:
          access.employee,

        taskId:
          id,
      }).maybeSingle();

    if (
      existingTaskError
    ) {
      throw new Error(
        existingTaskError.message
      );
    }

    if (
      !existingTask
    ) {
      return NextResponse.json(
        {
          error:
            "Task not found or you do not have permission to delete it.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Remove associated task history first.
     * Current task_activity relationship does not
     * use ON DELETE CASCADE.
     */

    const {
      error:
        activityDeleteError,
    } =
      await access.supabase
        .from(
          "task_activity"
        )
        .delete()
        .eq(
          "organization_id",
          access.employee
            .organization_id
        )
        .eq(
          "task_id",
          id
        );

    if (
      activityDeleteError
    ) {
      console.error(
        "Task activity cleanup error:",
        activityDeleteError
      );
    }

    // =====================================================
    // DELETE TASK
    // =====================================================

    let deleteQuery =
      access.supabase
        .from("tasks")
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          access.employee
            .organization_id
        );

    if (
      !access.employee
        .is_organization_owner
    ) {
      deleteQuery =
        deleteQuery.eq(
          "assigned_employee_id",
          access.employee.id
        );
    }

    const {
      data,
      error,
    } =
      await deleteQuery
        .select();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (
      !data ||
      data.length ===
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Task could not be deleted.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      task:
        data[0],

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
          error.status ||
          500,
      }
    );
  }
}
