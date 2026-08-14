import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../../lib/serverAccess";

// =========================================================
// HELPERS
// =========================================================

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

// =========================================================
// GET TASK ACTIVITY
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

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // CONFIRM ACCESS TO TASK
    // =====================================================

    let taskQuery =
      access.supabase
        .from("tasks")
        .select(
          `
            id,
            organization_id,
            assigned_employee_id,
            task_name,
            status,
            created_at,
            workflow_run_id
          `
        )
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (
      !access.employee
        .is_organization_owner
    ) {
      taskQuery =
        taskQuery.eq(
          "assigned_employee_id",
          access.employee.id
        );
    }

    const {
      data: task,
      error:
        taskError,
    } =
      await taskQuery
        .maybeSingle();

    if (taskError) {
      throw new Error(
        taskError.message
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

    // =====================================================
    // LOAD ACTIVITY
    // =====================================================

    const {
      data: activityRows,
      error:
        activityError,
    } =
      await access.supabase
        .from(
          "task_activity"
        )
        .select(
          `
            id,
            organization_id,
            task_id,
            employee_id,
            activity_type,
            field_name,
            old_value,
            new_value,
            message,
            created_at
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "task_id",
          id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (activityError) {
      throw new Error(
        activityError.message
      );
    }

    const activity =
      Array.isArray(
        activityRows
      )
        ? activityRows
        : [];

    // =====================================================
    // LOAD EMPLOYEE NAMES
    // =====================================================

    const employeeIds = [
      ...new Set(
        activity
          .map(
            (item) =>
              item.employee_id
          )
          .filter(Boolean)
      ),
    ];

    let employeeMap =
      new Map();

    if (
      employeeIds.length >
      0
    ) {
      const {
        data:
          employeeRows,
        error:
          employeeError,
      } =
        await access.supabase
          .from(
            "employees"
          )
          .select(
            `
              id,
              full_name,
              email
            `
          )
          .eq(
            "organization_id",
            organizationId
          )
          .in(
            "id",
            employeeIds
          );

      if (
        employeeError
      ) {
        console.error(
          "Task activity employee lookup error:",
          employeeError
        );
      } else {
        employeeMap =
          new Map(
            (
              employeeRows ||
              []
            ).map(
              (
                employee
              ) => [
                employee.id,
                employee,
              ]
            )
          );
      }
    }

    const enrichedActivity =
      activity.map(
        (item) => {
          const employee =
            item.employee_id
              ? employeeMap.get(
                  item.employee_id
                )
              : null;

          return {
            ...item,

            employee:
              employee
                ? {
                    id:
                      employee.id,

                    full_name:
                      employee.full_name,

                    email:
                      employee.email,
                  }
                : null,
          };
        }
      );

    return NextResponse.json({
      task: {
        id:
          task.id,

        task_name:
          task.task_name,

        status:
          task.status,

        created_at:
          task.created_at,

        workflow_run_id:
          task.workflow_run_id,
      },

      activity:
        enrichedActivity,
    });
  } catch (error) {
    console.error(
      "Task activity GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load task activity.",
      },
      {
        status: 500,
      }
    );
  }
}
