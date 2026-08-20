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
  buildClientAccess,
  canViewOwnedRecord,
  getRecordPermissions,
  getTeamEmployeeIds,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../lib/recordAccess";

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

const RECORD_TYPE_ALIASES = {
  lead: [
    "lead",
    "leads",
  ],

  quote: [
    "quote",
    "quotes",
  ],

  customer: [
    "customer",
    "customers",
  ],

  proposal: [
    "proposal",
    "proposals",
  ],

  project: [
    "project",
    "projects",
  ],

  invoice: [
    "invoice",
    "invoices",
  ],
};

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

function normalise(
  value
) {
  return String(
    value ||
      ""
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
// ENRICH TASK ASSIGNEES
// =========================================================

async function enrichTasksWithEmployees({
  supabase,
  organizationId,
  tasks,
}) {
  const employeeIds = [
    ...new Set(
      (
        tasks ||
        []
      )
        .map(
          (
            task
          ) =>
            task.assigned_employee_id
        )
        .filter(Boolean)
    ),
  ];

  if (
    employeeIds.length ===
    0
  ) {
    return (
      tasks ||
      []
    ).map(
      (
        task
      ) => ({
        ...task,

        assigned_employee:
          null,
      })
    );
  }

  const {
    data:
      employees,
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
        "organization_id",
        organizationId
      )
      .in(
        "id",
        employeeIds
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  const employeeMap =
    new Map(
      (
        employees ||
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

  return (
    tasks ||
    []
  ).map(
    (
      task
    ) => ({
      ...task,

      assigned_employee:
        task.assigned_employee_id
          ? employeeMap.get(
              task.assigned_employee_id
            ) ||
            null
          : null,
    })
  );
}

// =========================================================
// VALIDATE PROJECT
// =========================================================

async function validateProjectForTask({
  supabase,
  access,
  projectId,
}) {
  if (
    !projectId
  ) {
    return null;
  }

  if (
    !isUuid(
      projectId
    )
  ) {
    throw new Error(
      "The selected project is not valid."
    );
  }

  const organizationId =
    access.employee
      .organization_id;

  const {
    data:
      project,
    error,
  } =
    await supabase
      .from(
        "projects"
      )
      .select("*")
      .eq(
        "id",
        projectId
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
    throw new Error(
      "The selected project is not valid."
    );
  }

  /*
   * Prevent a Tasks user from attaching work to a Project
   * that they themselves cannot access.
   */
  const projectPermissions =
    getRecordPermissions(
      access,
      {
        prefix:
          "projects",

        module:
          "Projects",
      }
    );

  const visible =
    await canViewOwnedRecord({
      supabase,
      access,

      permissions:
        projectPermissions,

      record:
        project,
    });

  if (!visible) {
    throw new Error(
      "You do not have permission to create tasks for this project."
    );
  }

  return project;
}

// =========================================================
// GET TASKS
// =========================================================

export async function GET(
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

    const url =
      new URL(
        request.url
      );

    const scope =
      normalise(
        url.searchParams.get(
          "scope"
        ) ||
          "all"
      );

    const projectId =
      cleanText(
        url.searchParams.get(
          "project_id"
        )
      );

    const recordType =
      normalise(
        url.searchParams.get(
          "record_type"
        )
      );

    const recordId =
      cleanText(
        url.searchParams.get(
          "record_id"
        )
      );

    let query =
      supabase
        .from(
          "tasks"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    // =====================================================
    // RBAC VISIBILITY
    // =====================================================

    if (
      !permissions.canViewAll &&
      permissions.canViewTeam
    ) {
      const teamIds =
        await getTeamEmployeeIds({
          supabase,

          employee:
            access.employee,
        });

      query =
        query.in(
          "assigned_employee_id",
          teamIds
        );
    } else if (
      !permissions.canViewAll &&
      permissions.canViewOwn
    ) {
      query =
        query.eq(
          "assigned_employee_id",
          access.employee.id
        );
    }

    // =====================================================
    // PROJECT FILTER
    // =====================================================

    if (
      scope ===
        "project" ||
      projectId
    ) {
      if (
        !projectId ||
        !isUuid(
          projectId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "A valid project_id is required.",
          },
          {
            status:
              400,
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
    // RELATED RECORD FILTER
    // =====================================================

    else if (
      scope ===
      "record"
    ) {
      if (
        !recordType ||
        !recordId
      ) {
        return NextResponse.json(
          {
            error:
              "record_type and record_id are required.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        !isUuid(
          recordId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "A valid record_id is required.",
          },
          {
            status:
              400,
          }
        );
      }

      const recordAliases =
        RECORD_TYPE_ALIASES[
          recordType
        ] || [
          recordType,
        ];

      query =
        query
          .eq(
            "record_id",
            recordId
          )
          .in(
            "record_type",
            recordAliases
          );
    }

    // =====================================================
    // MY TASKS
    // =====================================================

    else if (
      scope ===
      "mine"
    ) {
      query =
        query.eq(
          "assigned_employee_id",
          access.employee.id
        );
    }

    // =====================================================
    // VALID SCOPES
    // =====================================================

    else if (
      scope !==
      "all"
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported task scope.",
        },
        {
          status:
            400,
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
          ascending:
            false,
        }
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    const tasks =
      await enrichTasksWithEmployees({
        supabase,
        organizationId,

        tasks:
          data ||
          [],
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
      tasks,

      employees,

      scope,

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
        status:
          500,
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
        "You do not have permission to create tasks."
      );
    }

    const body =
      await request.json();

    const taskName =
      cleanText(
        body.task_name ||
          body.title
      );

    if (
      !taskName
    ) {
      return NextResponse.json(
        {
          error:
            "Task name is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const status =
      cleanText(
        body.status
      ) ||
      "To Do";

    if (
      !ALLOWED_STATUSES.includes(
        status
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

    const priority =
      cleanText(
        body.priority
      ) ||
      "Medium";

    if (
      !ALLOWED_PRIORITIES.includes(
        priority
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

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // PROJECT
    // =====================================================

    let project =
      null;

    const projectId =
      cleanText(
        body.project_id
      );

    if (
      projectId
    ) {
      try {
        project =
          await validateProjectForTask({
            supabase,
            access,
            projectId,
          });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error.message,
          },
          {
            status:
              403,
          }
        );
      }
    }

    // =====================================================
    // ASSIGNEE
    // =====================================================

    let assignedEmployeeId =
      project
        ?.owner_employee_id ||
      access.employee.id;

    if (
      body.assigned_employee_id
    ) {
      if (
        !permissions.canAssign
      ) {
        return forbidden(
          "You do not have permission to assign tasks."
        );
      }

      const requestedEmployeeId =
        cleanText(
          body.assigned_employee_id
        );

      if (
        !isUuid(
          requestedEmployeeId
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

          employeeId:
            requestedEmployeeId,
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

      assignedEmployeeId =
        employee.id;
    }

    // =====================================================
    // RECORD LINK
    // =====================================================

    const recordType =
      cleanNullableText(
        body.record_type
      );

    const recordId =
      cleanNullableText(
        body.record_id
      );

    if (
      recordId &&
      !isUuid(
        recordId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The related record ID is not valid.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // WORKFLOW RUN
    // =====================================================

    const workflowRunId =
      cleanNullableText(
        body.workflow_run_id
      );

    if (
      workflowRunId &&
      !isUuid(
        workflowRunId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The workflow run ID is not valid.",
        },
        {
          status:
            400,
        }
      );
    }

    const now =
      new Date()
        .toISOString();

    // =====================================================
    // INSERT
    // =====================================================

    const {
      data:
        task,
      error:
        createError,
    } =
      await supabase
        .from(
          "tasks"
        )
        .insert([
          {
            organization_id:
              organizationId,

            project_id:
              project?.id ||
              null,

            task_name:
              taskName,

            description:
              cleanNullableText(
                body.description
              ),

            status,

            due_date:
              dueDate,

            assigned_employee_id:
              assignedEmployeeId,

            record_type:
              recordType,

            record_id:
              recordId,

            workflow_run_id:
              workflowRunId,

            priority,

            created_at:
              now,

            updated_at:
              now,
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

    const [
      enrichedTask,
    ] =
      await enrichTasksWithEmployees({
        supabase,
        organizationId,

        tasks: [
          task,
        ],
      });

    return NextResponse.json(
      {
        task:
          enrichedTask,

        message:
          "Task created successfully.",
      },
      {
        status:
          201,
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
        status:
          500,
      }
    );
  }
}
