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
// GET ONE TASK
// =========================================================

export async function GET(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    if (!isUuid(id)) {
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
        status: 500,
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
    const { id } =
      await context.params;

    if (!isUuid(id)) {
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

    const body =
      await request.json();

    // -----------------------------------------------------
    // CONFIRM TASK ACCESS FIRST
    // -----------------------------------------------------

    const {
      data: existingTask,
      error: existingTaskError,
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

    if (existingTaskError) {
      throw new Error(
        existingTaskError.message
      );
    }

    if (!existingTask) {
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

    // -----------------------------------------------------
    // PROTECTED FIELDS
    // -----------------------------------------------------

    const protectedFields =
      new Set([
        "id",
        "organization_id",
        "created_at",
        "workflow_run_id",
        "record_type",
        "record_id",
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

    updateValues.updated_at =
      new Date().toISOString();

    if (
      Object.keys(
        updateValues
      ).length ===
      1
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

    // -----------------------------------------------------
    // RESTRICT REASSIGNMENT FOR NORMAL EMPLOYEES
    // -----------------------------------------------------

    if (
      !access.employee
        .is_organization_owner
    ) {
      delete updateValues
        .assigned_employee_id;
    }

    // -----------------------------------------------------
    // UPDATE
    // -----------------------------------------------------

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

    return NextResponse.json({
      task,

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
        status: 500,
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
    const { id } =
      await context.params;

    if (!isUuid(id)) {
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

    // -----------------------------------------------------
    // CONFIRM TASK ACCESS FIRST
    // -----------------------------------------------------

    const {
      data: existingTask,
      error: existingTaskError,
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

    if (existingTaskError) {
      throw new Error(
        existingTaskError.message
      );
    }

    if (!existingTask) {
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

    // -----------------------------------------------------
    // DELETE
    // -----------------------------------------------------

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
      data.length === 0
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
        status: 500,
      }
    );
  }
}
