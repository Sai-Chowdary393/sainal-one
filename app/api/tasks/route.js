import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

// =========================================================
// HELPERS
// =========================================================

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

// =========================================================
// GET TASKS
// =========================================================
//
// DEFAULT
// GET /api/tasks
// → logged-in employee's assigned tasks
//
// PROJECT DASHBOARD
// GET /api/tasks?scope=projects
// → all project-linked tasks in organisation
//
// SINGLE PROJECT
// GET /api/tasks?scope=project&project_id=UUID
// → all tasks for one project
//
// =========================================================

export async function GET(
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

    const organizationId =
      access.employee
        .organization_id;

    const employeeId =
      access.employee.id;

    const url =
      new URL(
        request.url
      );

    const scope =
      String(
        url.searchParams.get(
          "scope"
        ) || "mine"
      )
        .trim()
        .toLowerCase();

    const projectId =
      url.searchParams.get(
        "project_id"
      );

    let query =
      access.supabase
        .from("tasks")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    // =====================================================
    // MY WORK
    // =====================================================

    if (
      scope === "mine"
    ) {
      query =
        query.eq(
          "assigned_employee_id",
          employeeId
        );
    }

    // =====================================================
    // ALL PROJECT TASKS
    // =====================================================

    else if (
      scope === "projects"
    ) {
      query =
        query.not(
          "project_id",
          "is",
          null
        );
    }

    // =====================================================
    // SINGLE PROJECT
    // =====================================================

    else if (
      scope === "project"
    ) {
      if (
        !projectId ||
        !isUuid(projectId)
      ) {
        return NextResponse.json(
          {
            error:
              "A valid project_id is required for project task scope.",
          },
          {
            status: 400,
          }
        );
      }

      query =
        query.eq(
          "project_id",
          projectId
        );
    }

    // =====================================================
    // INVALID SCOPE
    // =====================================================

    else {
      return NextResponse.json(
        {
          error:
            "Unsupported task scope.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data,
      error,
    } =
      await query.order(
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

      scope,

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
        now,

      updated_at:
        now,
    };

    const {
      data,
      error,
    } =
      await access.supabase
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
