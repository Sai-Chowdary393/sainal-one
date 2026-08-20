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
  attachRecordOwner,
  buildClientAccess,
  canViewOwnedRecord,
  getRecordPermissions,
  getTeamEmployeeIds,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../../lib/recordAccess";

// =========================================================
// CONSTANTS
// =========================================================

const ALLOWED_STATUSES = [
  "Planning",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
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
    String(
      value ||
        ""
    )
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

function getProjectPermissions(access) {
  return getRecordPermissions(
    access,
    {
      prefix:
        "projects",

      module:
        "Projects",
    }
  );
}

function getTaskPermissions(access) {
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
// LOAD PROJECT
// =========================================================

async function loadProject({
  supabase,
  organizationId,
  projectId,
}) {
  const {
    data,
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

  return data;
}

// =========================================================
// LOAD PROJECT TASKS WITH TASK RBAC
// =========================================================

async function loadProjectTasks({
  supabase,
  access,
  organizationId,
  projectId,
}) {
  const taskPermissions =
    getTaskPermissions(
      access
    );

  if (
    !taskPermissions.canViewAll &&
    !taskPermissions.canViewTeam &&
    !taskPermissions.canViewOwn
  ) {
    return {
      tasks: [],
      taskPermissions,
    };
  }

  let query =
    supabase
      .from(
        "tasks"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "project_id",
        projectId
      );

  if (
    !taskPermissions.canViewAll &&
    taskPermissions.canViewTeam
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
    !taskPermissions.canViewAll &&
    taskPermissions.canViewOwn
  ) {
    query =
      query.eq(
        "assigned_employee_id",
        access.employee.id
      );
  }

  const {
    data:
      taskRows,
    error:
      taskError,
  } =
    await query.order(
      "created_at",
      {
        ascending:
          true,
      }
    );

  if (
    taskError
  ) {
    throw new Error(
      taskError.message
    );
  }

  const employeeIds = [
    ...new Set(
      (
        taskRows ||
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

  let employeeMap =
    new Map();

  if (
    employeeIds.length >
    0
  ) {
    const {
      data:
        taskEmployees,
      error:
        taskEmployeesError,
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

    if (
      taskEmployeesError
    ) {
      throw new Error(
        taskEmployeesError.message
      );
    }

    employeeMap =
      new Map(
        (
          taskEmployees ||
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

  const tasks =
    (
      taskRows ||
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

  return {
    tasks,
    taskPermissions,
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

    if (
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid project ID is required.",
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

    const projectPermissions =
      getProjectPermissions(
        access
      );

    if (
      !projectPermissions.canViewAll &&
      !projectPermissions.canViewTeam &&
      !projectPermissions.canViewOwn
    ) {
      return forbidden(
        "You do not have permission to view projects."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const project =
      await loadProject({
        supabase,
        organizationId,
        projectId:
          id,
      });

    if (!project) {
      return NextResponse.json(
        {
          error:
            "Project not found.",
        },
        {
          status:
            404,
        }
      );
    }

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
      return forbidden(
        "You do not have permission to view this project."
      );
    }

    const formattedProject =
      await attachRecordOwner({
        supabase,
        organizationId,
        record:
          project,
      });

    // =====================================================
    // TASKS WITH TASK RBAC
    // =====================================================

    const {
      tasks,
      taskPermissions,
    } =
      await loadProjectTasks({
        supabase,
        access,
        organizationId,
        projectId:
          id,
      });

    // =====================================================
    // CUSTOMER
    // =====================================================

    let customer = null;

    if (
      project.customer_id
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "customers"
          )
          .select(
            `
              id,
              customer_name,
              company,
              email,
              phone,
              status
            `
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "id",
            project.customer_id
          )
          .maybeSingle();

      if (error) {
        throw new Error(
          error.message
        );
      }

      customer =
        data ||
        null;
    }

    // =====================================================
    // QUOTE
    // =====================================================

    let quote = null;

    if (
      project.quote_id
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "quotes"
          )
          .select(
            `
              id,
              quote_number,
              client,
              contact,
              service,
              amount,
              status
            `
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "id",
            project.quote_id
          )
          .maybeSingle();

      if (error) {
        throw new Error(
          error.message
        );
      }

      quote =
        data ||
        null;
    }

    // =====================================================
    // INVOICES
    // =====================================================

    const {
      data:
        invoices,
      error:
        invoicesError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "project_id",
          id
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (
      invoicesError
    ) {
      throw new Error(
        invoicesError.message
      );
    }

    // =====================================================
    // PROJECT ASSIGNMENT OPTIONS
    // =====================================================

    let employees = [];

    if (
      projectPermissions.canAssign
    ) {
      employees =
        await loadAssignableEmployees({
          supabase,
          organizationId,
        });
    }

    // =====================================================
    // TASK ASSIGNMENT OPTIONS
    // =====================================================

    let taskEmployees = [];

    if (
      taskPermissions.canAssign
    ) {
      taskEmployees =
        await loadAssignableEmployees({
          supabase,
          organizationId,
        });
    }

    return NextResponse.json({
      project:
        formattedProject,

      customer,

      quote,

      tasks,

      invoices:
        invoices ||
        [],

      employees,

      taskEmployees,

      currentEmployee:
        access.employee,

      access:
        buildClientAccess({
          access,
          permissions:
            projectPermissions,
        }),

      taskAccess:
        buildClientAccess({
          access,
          permissions:
            taskPermissions,
        }),
    });
  } catch (error) {
    console.error(
      "Project GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load project.",
      },
      {
        status:
          500,
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

    if (
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid project ID is required.",
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
      getProjectPermissions(
        access
      );

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const project =
      await loadProject({
        supabase,
        organizationId,
        projectId:
          id,
      });

    if (!project) {
      return NextResponse.json(
        {
          error:
            "Project not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record:
          project,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to update this project."
      );
    }

    const body =
      await request.json();

    const editableFields = [
      "project_name",
      "description",
      "amount",
      "status",
      "start_date",
      "due_date",
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

    const wantsOwnerChange =
      Object.prototype.hasOwnProperty.call(
        body,
        "owner_employee_id"
      );

    if (
      wantsEdit &&
      !permissions.canEdit
    ) {
      return forbidden(
        "You do not have permission to edit projects."
      );
    }

    if (
      wantsOwnerChange &&
      !permissions.canAssign
    ) {
      return forbidden(
        "You do not have permission to assign projects."
      );
    }

    if (
      !wantsEdit &&
      !wantsOwnerChange
    ) {
      return NextResponse.json(
        {
          error:
            "No supported project changes were provided.",
        },
        {
          status:
            400,
        }
      );
    }

    const updates = {};

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "project_name"
      )
    ) {
      const projectName =
        cleanText(
          body.project_name
        );

      if (!projectName) {
        return NextResponse.json(
          {
            error:
              "Project name cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.project_name =
        projectName;
    }

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

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "amount"
      )
    ) {
      updates.amount =
        cleanNullableText(
          body.amount
        );
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
              "Invalid project status.",
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

    const nextStartDate =
      Object.prototype.hasOwnProperty.call(
        body,
        "start_date"
      )
        ? body.start_date ||
          null
        : project.start_date;

    const nextDueDate =
      Object.prototype.hasOwnProperty.call(
        body,
        "due_date"
      )
        ? body.due_date ||
          null
        : project.due_date;

    if (
      !isDateValue(
        nextStartDate
      ) ||
      !isDateValue(
        nextDueDate
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Project dates must use YYYY-MM-DD format.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      nextStartDate &&
      nextDueDate &&
      String(
        nextDueDate
      ) <
        String(
          nextStartDate
        )
    ) {
      return NextResponse.json(
        {
          error:
            "Project due date cannot be before the start date.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "start_date"
      )
    ) {
      updates.start_date =
        nextStartDate;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "due_date"
      )
    ) {
      updates.due_date =
        nextDueDate;
    }

    if (
      wantsOwnerChange
    ) {
      const requestedOwnerId =
        cleanText(
          body.owner_employee_id
        );

      if (!requestedOwnerId) {
        updates.owner_employee_id =
          null;
      } else {
        if (
          !isUuid(
            requestedOwnerId
          )
        ) {
          return NextResponse.json(
            {
              error:
                "The selected project owner is not valid.",
            },
            {
              status:
                400,
            }
          );
        }

        const owner =
          await validateRecordOwner({
            supabase,
            organizationId,
            employeeId:
              requestedOwnerId,
          });

        if (!owner) {
          return NextResponse.json(
            {
              error:
                "The selected project owner is not valid.",
            },
            {
              status:
                400,
            }
          );
        }

        updates.owner_employee_id =
          owner.id;
      }
    }

    const {
      data:
        updatedProject,
      error:
        updateError,
    } =
      await supabase
        .from(
          "projects"
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

    const formattedProject =
      await attachRecordOwner({
        supabase,
        organizationId,
        record:
          updatedProject,
      });

    return NextResponse.json({
      project:
        formattedProject,

      message:
        "Project updated successfully.",
    });
  } catch (error) {
    console.error(
      "Project PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to update project.",
      },
      {
        status:
          500,
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

    if (
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid project ID is required.",
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
      getProjectPermissions(
        access
      );

    if (
      !permissions.canDelete
    ) {
      return forbidden(
        "You do not have permission to delete projects."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const project =
      await loadProject({
        supabase,
        organizationId,
        projectId:
          id,
      });

    if (!project) {
      return NextResponse.json(
        {
          error:
            "Project not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record:
          project,
      });

    if (!visible) {
      return forbidden(
        "You do not have permission to delete this project."
      );
    }

    const [
      tasksResult,
      invoicesResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "tasks"
          )
          .select(
            "id",
            {
              count:
                "exact",
              head:
                true,
            }
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "project_id",
            id
          ),

        supabase
          .from(
            "invoices"
          )
          .select(
            "id",
            {
              count:
                "exact",
              head:
                true,
            }
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "project_id",
            id
          ),
      ]);

    if (
      tasksResult.error
    ) {
      throw new Error(
        tasksResult.error.message
      );
    }

    if (
      invoicesResult.error
    ) {
      throw new Error(
        invoicesResult.error.message
      );
    }

    if (
      Number(
        tasksResult.count ||
          0
      ) >
        0 ||
      Number(
        invoicesResult.count ||
          0
      ) >
        0
    ) {
      return NextResponse.json(
        {
          error:
            "This project cannot be deleted while tasks or invoices are linked to it. Cancel the project instead.",
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
          "projects"
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
      message:
        "Project deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Project DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to delete project.",
      },
      {
        status:
          500,
      }
    );
  }
}
