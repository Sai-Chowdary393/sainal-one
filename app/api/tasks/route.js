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

function normaliseRecordType(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function normaliseText(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(
    value
  ).trim();
}

function getRecordTypeAliases(
  value
) {
  switch (
    normaliseRecordType(
      value
    )
  ) {
    case "quote":
    case "quotes":
      return [
        "quote",
        "quotes",
      ];

    case "lead":
    case "leads":
      return [
        "lead",
        "leads",
      ];

    case "customer":
    case "customers":
      return [
        "customer",
        "customers",
      ];

    case "invoice":
    case "invoices":
      return [
        "invoice",
        "invoices",
      ];

    case "project":
    case "projects":
      return [
        "project",
        "projects",
      ];

    case "proposal":
    case "proposals":
      return [
        "proposal",
        "proposals",
      ];

    default:
      return [];
  }
}

// =========================================================
// EMPLOYEE ENRICHMENT
// =========================================================

async function enrichTasksWithEmployees({
  supabase,
  organizationId,
  tasks,
}) {
  const employeeIds = [
    ...new Set(
      (tasks || [])
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
      tasks || []
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
      .from("employees")
      .select(
        `
          id,
          full_name,
          email,
          job_title
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
    console.error(
      "Task employee enrichment error:",
      error
    );

    return (
      tasks || []
    ).map(
      (task) => ({
        ...task,

        assigned_employee:
          null,
      })
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
    tasks || []
  ).map(
    (task) => ({
      ...task,

      assigned_employee:
        task.assigned_employee_id
          ? employeeMap.get(
              task.assigned_employee_id
            ) || null
          : null,
    })
  );
}

// =========================================================
// ASSIGNMENT VALIDATION
// =========================================================

async function resolveAssignedEmployeeId({
  access,
  requestedEmployeeId,
  assignmentWasProvided,
}) {
  /*
   * Important difference:
   *
   * undefined
   * → caller did not specify assignment
   * → default to current employee
   *
   * null / ""
   * → caller deliberately selected Unassigned
   * → store NULL
   */

  if (
    !assignmentWasProvided
  ) {
    return access.employee.id;
  }

  if (
    requestedEmployeeId ===
      null ||
    normaliseText(
      requestedEmployeeId
    ) ===
      ""
  ) {
    return null;
  }

  const employeeId =
    normaliseText(
      requestedEmployeeId
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
   * Normal employees may create work for themselves,
   * but they cannot assign new tasks to another employee.
   *
   * Organisation owners can assign work across the team.
   *
   * We can extend this later to manager / task.manage
   * permissions.
   */

  if (
    !access.employee
      .is_organization_owner &&
    String(
      employeeId
    ) !==
      String(
        access.employee.id
      )
  ) {
    throw new TaskPermissionError(
      "You do not have permission to assign tasks to another employee."
    );
  }

  const {
    data:
      employee,
    error,
  } =
    await access.supabase
      .from("employees")
      .select(
        `
          id,
          organization_id,
          is_active,
          employment_status
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
// PROJECT VALIDATION
// =========================================================

async function validateProject({
  access,
  projectId,
}) {
  if (!projectId) {
    return null;
  }

  if (
    !isUuid(
      projectId
    )
  ) {
    throw new TaskValidationError(
      "A valid project ID is required."
    );
  }

  const {
    data:
      project,
    error,
  } =
    await access.supabase
      .from("projects")
      .select(
        `
          id,
          organization_id
        `
      )
      .eq(
        "id",
        projectId
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

  if (!project) {
    throw new TaskValidationError(
      "The selected project could not be found in this organisation."
    );
  }

  return project.id;
}

// =========================================================
// RECORD VALIDATION
// =========================================================

function validateRecordLink({
  recordType,
  recordId,
}) {
  const cleanRecordType =
    normaliseRecordType(
      recordType
    );

  const cleanRecordId =
    normaliseText(
      recordId
    );

  /*
   * Neither supplied is fine.
   */

  if (
    !cleanRecordType &&
    !cleanRecordId
  ) {
    return {
      recordType: null,
      recordId: null,
    };
  }

  /*
   * If one is supplied, both must be supplied.
   */

  if (
    !cleanRecordType ||
    !cleanRecordId
  ) {
    throw new TaskValidationError(
      "Both record_type and record_id are required when linking a task to a business record."
    );
  }

  if (
    getRecordTypeAliases(
      cleanRecordType
    ).length ===
    0
  ) {
    throw new TaskValidationError(
      `Unsupported task record type "${recordType}".`
    );
  }

  if (
    !isUuid(
      cleanRecordId
    )
  ) {
    throw new TaskValidationError(
      "A valid record ID is required."
    );
  }

  /*
   * Store singular lower-case form so new data
   * becomes consistent.
   *
   * Existing GET logic still supports plural legacy values.
   */

  const aliases =
    getRecordTypeAliases(
      cleanRecordType
    );

  return {
    recordType:
      aliases[0],

    recordId:
      cleanRecordId,
  };
}

// =========================================================
// CUSTOM ERRORS
// =========================================================

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
// BUSINESS RECORD
// GET /api/tasks?scope=record&record_type=quote&record_id=UUID
// → all tasks linked to one business record
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

    const recordType =
      url.searchParams.get(
        "record_type"
      );

    const recordId =
      url.searchParams.get(
        "record_id"
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
        !isUuid(
          projectId
        )
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
    // BUSINESS RECORD
    // =====================================================

    else if (
      scope === "record"
    ) {
      if (
        !recordId ||
        !isUuid(
          recordId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "A valid record_id is required for record task scope.",
          },
          {
            status: 400,
          }
        );
      }

      const recordAliases =
        getRecordTypeAliases(
          recordType
        );

      if (
        recordAliases.length ===
        0
      ) {
        return NextResponse.json(
          {
            error:
              "A supported record_type is required for record task scope.",
          },
          {
            status: 400,
          }
        );
      }

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

    const tasks =
      await enrichTasksWithEmployees({
        supabase:
          access.supabase,

        organizationId,

        tasks:
          data || [],
      });

    return NextResponse.json({
      tasks,

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
        status:
          error.status ||
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

    const body =
      await request.json();

    // =====================================================
    // TASK NAME
    // =====================================================

    const taskName =
      normaliseText(
        body.task_name ||
          body.title
      );

    if (!taskName) {
      throw new TaskValidationError(
        "Task name is required."
      );
    }

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // PROJECT
    // =====================================================

    const projectId =
      body.project_id
        ? await validateProject({
            access,

            projectId:
              body.project_id,
          })
        : null;

    // =====================================================
    // ASSIGNMENT
    // =====================================================

    const assignmentWasProvided =
      Object.prototype.hasOwnProperty.call(
        body,
        "assigned_employee_id"
      );

    const assignedEmployeeId =
      await resolveAssignedEmployeeId({
        access,

        requestedEmployeeId:
          body.assigned_employee_id,

        assignmentWasProvided,
      });

    // =====================================================
    // BUSINESS RECORD
    // =====================================================

    const recordLink =
      validateRecordLink({
        recordType:
          body.record_type,

        recordId:
          body.record_id,
      });

    // =====================================================
    // WORKFLOW RUN
    // =====================================================

    let workflowRunId =
      null;

    if (
      body.workflow_run_id
    ) {
      if (
        !isUuid(
          body.workflow_run_id
        )
      ) {
        throw new TaskValidationError(
          "A valid workflow run ID is required."
        );
      }

      workflowRunId =
        body.workflow_run_id;
    }

    // =====================================================
    // TASK VALUES
    // =====================================================

    const now =
      new Date().toISOString();

    const taskValues = {
      project_id:
        projectId,

      task_name:
        taskName,

      description:
        normaliseText(
          body.description
        ) ||
        null,

      status:
        normaliseText(
          body.status
        ) ||
        "To Do",

      due_date:
        body.due_date ||
        null,

      organization_id:
        organizationId,

      /*
       * This can now genuinely be null.
       *
       * Selecting "Unassigned" no longer silently
       * assigns the task back to the creator.
       */
      assigned_employee_id:
        assignedEmployeeId,

      record_type:
        recordLink.recordType,

      record_id:
        recordLink.recordId,

      workflow_run_id:
        workflowRunId,

      priority:
        normaliseText(
          body.priority
        ) ||
        "Medium",

      created_at:
        now,

      updated_at:
        now,
    };

    // =====================================================
    // INSERT
    // =====================================================

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

    // =====================================================
    // ENRICH RESPONSE
    // =====================================================

    const [
      enrichedTask,
    ] =
      await enrichTasksWithEmployees({
        supabase:
          access.supabase,

        organizationId,

        tasks: [
          data,
        ],
      });

    return NextResponse.json(
      {
        task:
          enrichedTask ||
          data,

        message:
          assignedEmployeeId
            ? "Task created and assigned successfully."
            : "Unassigned task created successfully.",
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
        status:
          error.status ||
          500,
      }
    );
  }
}
