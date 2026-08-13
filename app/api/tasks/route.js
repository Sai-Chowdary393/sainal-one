import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

// =========================================================
// GET MY TASKS
// =========================================================
//
// Returns tasks assigned to the authenticated employee.
//
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

    const organizationId =
      access.employee
        .organization_id;

    const employeeId =
      access.employee.id;

    const {
      data,
      error,
    } = await access.supabase
      .from("tasks")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "assigned_employee_id",
        employeeId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return NextResponse.json({
      tasks:
        data || [],

      currentEmployee: {
        id:
          access.employee.id,

        full_name:
          access.employee
            .full_name,

        email:
          access.employee
            .email,

        is_organization_owner:
          Boolean(
            access.employee
              .is_organization_owner
          ),
      },
    });
  } catch (error) {
    console.error(
      "Tasks GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load tasks.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// CREATE TASK
// =========================================================
//
// Creates a task inside the authenticated organisation.
//
// If assigned_employee_id is not supplied, the task is
// assigned to the current employee.
//
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

    const body =
      await request.json();

    const taskName =
      String(
        body.task_name ||
          body.title ||
          ""
      ).trim();

    if (!taskName) {
      return NextResponse.json(
        {
          error:
            "Task name is required.",
        },
        {
          status: 400,
        }
      );
    }

    const organizationId =
      access.employee
        .organization_id;

    const assignedEmployeeId =
      body.assigned_employee_id ||
      access.employee.id;

    const now =
      new Date().toISOString();

    const taskValues = {
      project_id:
        body.project_id ||
        null,

      task_name:
        taskName,

      description:
        body.description ||
        null,

      status:
        body.status ||
        "Open",

      due_date:
        body.due_date ||
        null,

      organization_id:
        organizationId,

      assigned_employee_id:
        assignedEmployeeId,

      record_type:
        body.record_type ||
        null,

      record_id:
        body.record_id ||
        null,

      workflow_run_id:
        body.workflow_run_id ||
        null,

      priority:
        body.priority ||
        "Medium",

      created_at:
        body.created_at ||
        now,

      updated_at:
        now,
    };

    const {
      data,
      error,
    } = await access.supabase
      .from("tasks")
      .insert([
        taskValues,
      ])
      .select()
      .single();

    if (error) {
      throw new Error(
        error.message
      );
    }

    return NextResponse.json(
      {
        task:
          data,

        message:
          "Task created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Tasks POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to create task.",
      },
      {
        status: 500,
      }
    );
  }
}
