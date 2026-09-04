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

const RELATED_RECORD_CONFIG = {
  lead: {
    table:
      "leads",

    prefix:
      "leads",

    module:
      "Leads",
  },

  quote: {
    table:
      "quotes",

    prefix:
      "quotes",

    module:
      "Quotes",
  },

  customer: {
    table:
      "customers",

    prefix:
      "customers",

    module:
      "Customers",
  },

  proposal: {
    table:
      "proposals",

    prefix:
      "proposals",

    module:
      "Proposals",
  },

  project: {
    table:
      "projects",

    prefix:
      "projects",

    module:
      "Projects",
  },

  invoice: {
    table:
      "invoices",

    prefix:
      "invoices",

    module:
      "Invoices",
  },
};

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

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normaliseRecordType(
  value
) {
  const type =
    normalise(value);

  for (
    const [
      canonical,
      aliases,
    ] of Object.entries(
      RECORD_TYPE_ALIASES
    )
  ) {
    if (
      aliases.includes(
        type
      )
    ) {
      return canonical;
    }
  }

  return type;
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
      error:
        message,
    },
    {
      status:
        403,
    }
  );
}

function getPermissions(access) {
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
          (task) =>
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
      (task) => ({
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
        (employee) => [
          employee.id,
          employee,
        ]
      )
    );

  return (
    tasks ||
    []
  ).map(
    (task) => ({
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
  if (!projectId) {
    return null;
  }

  if (!isUuid(projectId)) {
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

  // =====================================================
  // COMPLETED PROJECT LOCK
  // =====================================================

  if (
    normalise(
      project.status
    ) ===
    "completed"
  ) {
    throw new Error(
      "This project is completed and delivery is locked. Reopen the project before creating new tasks."
    );
  }

  return project;
}

// =========================================================
// VALIDATE RELATED RECORD
// =========================================================

async function validateRelatedRecordForTask({
  supabase,
  access,
  recordType,
  recordId,
}) {
  if (
    !recordType &&
    !recordId
  ) {
    return {
      recordType:
        null,

      recordId:
        null,
    };
  }

  if (
    !recordType ||
    !recordId
  ) {
    throw new Error(
      "Both record_type and record_id are required when linking a task."
    );
  }

  const canonicalType =
    normaliseRecordType(
      recordType
    );

  const config =
    RELATED_RECORD_CONFIG[
      canonicalType
    ];

  if (!config) {
    throw new Error(
      "The related record type is not supported."
    );
  }

  if (!isUuid(recordId)) {
    throw new Error(
      "The related record ID is not valid."
    );
  }

  const organizationId =
    access.employee
      .organization_id;

  const {
    data:
      record,
    error,
  } =
    await supabase
      .from(
        config.table
      )
      .select("*")
      .eq(
        "id",
        recordId
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

  if (!record) {
    throw new Error(
      "The related record is not valid for this organisation."
    );
  }

  const permissions =
    getRecordPermissions(
      access,
      {
        prefix:
          config.prefix,

        module:
          config.module,
      }
    );

  const visible =
    await canViewOwnedRecord({
      supabase,
      access,
      permissions,
      record,
    });

  if (!visible) {
    throw new Error(
      "You do not have permission to link this record to a task."
    );
  }

  return {
    recordType:
      canonicalType,

    recordId:
      record.id,
  };
}

// =========================================================
// VALIDATE WORKFLOW RUN
// =========================================================

async function validateWorkflowRun({
  supabase,
  organizationId,
  workflowRunId,
}) {
  if (!workflowRunId) {
    return null;
  }

  if (
    !isUuid(
      workflowRunId
    )
  ) {
    throw new Error(
      "The workflow run ID is not valid."
    );
  }

  const {
    data:
      workflowRun,
    error,
  } =
    await supabase
      .from(
        "workflow_runs"
      )
      .select("id")
      .eq(
        "id",
        workflowRunId
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

  if (!workflowRun) {
    throw new Error(
      "The workflow run is not valid for this organisation."
    );
  }

  return workflowRun.id;
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

      try {
        await validateProjectForTask({
          supabase,
          access,
          projectId,
        });
      } catch (error) {
        /*
         * GET access must still allow tasks belonging
         * to a completed project to be viewed.
         *
         * validateProjectForTask also enforces the
         * creation lock, so for GET we validate the
         * project directly below instead.
         */

        const {
          data:
            requestedProject,
          error:
            projectError,
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

        if (
          projectError
        ) {
          throw new Error(
            projectError.message
          );
        }

        if (
          !requestedProject
        ) {
          return NextResponse.json(
            {
              error:
                "The selected project is not valid.",
            },
            {
              status:
                404,
            }
          );
        }

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

        const projectVisible =
          await canViewOwnedRecord({
            supabase,
            access,

            permissions:
              projectPermissions,

            record:
              requestedProject,
          });

        if (
          !projectVisible
        ) {
          return NextResponse.json(
            {
              error:
                "You do not have permission to view tasks for this project.",
            },
            {
              status:
                403,
            }
          );
        }
      }

      query =
        query.eq(
          "project_id",
          projectId
        );
    } else if (
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

      try {
        const validated =
          await validateRelatedRecordForTask({
            supabase,
            access,
            recordType,
            recordId,
          });

        query =
          query
            .eq(
              "record_id",
              validated.recordId
            )
            .in(
              "record_type",
              RECORD_TYPE_ALIASES[
                validated.recordType
              ] || [
                validated.recordType,
              ]
            );
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
    } else if (
      scope ===
      "mine"
    ) {
      query =
        query.eq(
          "assigned_employee_id",
          access.employee.id
        );
    } else if (
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

    if (!taskName) {
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

    if (projectId) {
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

    /*
     * Default to the creator.
     *
     * Creating a Task under somebody else's Project
     * must not silently bypass tasks.assign.
     */
    let assignedEmployeeId =
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

      if (!employee) {
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
    // RELATED RECORD
    // =====================================================

    let relatedRecord;

    try {
      relatedRecord =
        await validateRelatedRecordForTask({
          supabase,
          access,

          recordType:
            cleanNullableText(
              body.record_type
            ),

          recordId:
            cleanNullableText(
              body.record_id
            ),
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

    // =====================================================
    // WORKFLOW RUN
    // =====================================================

    let workflowRunId =
      null;

    try {
      workflowRunId =
        await validateWorkflowRun({
          supabase,
          organizationId,

          workflowRunId:
            cleanNullableText(
              body.workflow_run_id
            ),
        });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error.message,
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
              relatedRecord
                .recordType,

            record_id:
              relatedRecord
                .recordId,

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

    if (createError) {
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
