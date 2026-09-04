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

const NON_ISSUED_INVOICE_STATUSES =
  new Set([
    "draft",
    "draft invoice",
    "cancelled",
  ]);

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function cleanNullableText(
  value
) {
  const cleaned =
    cleanText(value);

  return cleaned || null;
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
      error: message,
    },
    {
      status: 403,
    }
  );
}

function normaliseStatus(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function parseMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const cleaned =
    String(value)
      .replace(/,/g, "")
      .replace(
        /[^0-9.-]/g,
        ""
      );

  const parsed =
    Number.parseFloat(
      cleaned
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function roundMoney(value) {
  return Math.round(
    (
      Number(value || 0) +
      Number.EPSILON
    ) *
      100
  ) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(
    Number(value || 0)
  );
}

function getProjectPermissions(
  access
) {
  return getRecordPermissions(
    access,
    {
      prefix: "projects",
      module: "Projects",
    }
  );
}

function getTaskPermissions(
  access
) {
  return getRecordPermissions(
    access,
    {
      prefix: "tasks",
      module: "Tasks",
    }
  );
}

function getCustomerPermissions(
  access
) {
  return getRecordPermissions(
    access,
    {
      prefix: "customers",
      module: "Customers",
    }
  );
}

function getQuotePermissions(
  access
) {
  return getRecordPermissions(
    access,
    {
      prefix: "quotes",
      module: "Quotes",
    }
  );
}

function getInvoicePermissions(
  access
) {
  return getRecordPermissions(
    access,
    {
      prefix: "invoices",
      module: "Invoices",
    }
  );
}

function hasViewPermission(
  permissions
) {
  return Boolean(
    permissions.canViewAll ||
      permissions.canViewTeam ||
      permissions.canViewOwn
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
      .from("projects")
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
    !hasViewPermission(
      taskPermissions
    )
  ) {
    return {
      tasks: [],
      taskPermissions,
    };
  }

  let query =
    supabase
      .from("tasks")
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
    data: taskRows,
    error: taskError,
  } =
    await query.order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (taskError) {
    throw new Error(
      taskError.message
    );
  }

  const employeeIds = [
    ...new Set(
      (taskRows || [])
        .map(
          (task) =>
            task.assigned_employee_id
        )
        .filter(Boolean)
    ),
  ];

  let employeeMap =
    new Map();

  if (
    employeeIds.length > 0
  ) {
    const {
      data: taskEmployees,
      error:
        taskEmployeesError,
    } =
      await supabase
        .from("employees")
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
        (taskEmployees || [])
          .map(
            (employee) => [
              employee.id,
              employee,
            ]
          )
      );
  }

  const tasks =
    (taskRows || [])
      .map(
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

  return {
    tasks,
    taskPermissions,
  };
}

// =========================================================
// LOAD RELATED SINGLE RECORD
// =========================================================

async function loadVisibleRelatedRecord({
  supabase,
  access,
  organizationId,
  table,
  recordId,
  permissions,
  select = "*",
}) {
  if (
    !recordId ||
    !hasViewPermission(
      permissions
    )
  ) {
    return null;
  }

  const {
    data: record,
    error,
  } =
    await supabase
      .from(table)
      .select(select)
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        recordId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!record) {
    return null;
  }

  const {
    data: securityRecord,
    error: securityError,
  } =
    await supabase
      .from(table)
      .select(
        "id, owner_employee_id"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        recordId
      )
      .maybeSingle();

  if (securityError) {
    throw new Error(
      securityError.message
    );
  }

  if (!securityRecord) {
    return null;
  }

  const visible =
    await canViewOwnedRecord({
      supabase,
      access,
      permissions,
      record:
        securityRecord,
    });

  return visible
    ? record
    : null;
}

// =========================================================
// LOAD INVOICES WITH INVOICE RBAC
// =========================================================

async function loadVisibleInvoices({
  supabase,
  access,
  organizationId,
  projectId,
}) {
  const permissions =
    getInvoicePermissions(
      access
    );

  if (
    !hasViewPermission(
      permissions
    )
  ) {
    return [];
  }

  let query =
    supabase
      .from("invoices")
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
        "owner_employee_id",
        teamIds
      );
  } else if (
    !permissions.canViewAll &&
    permissions.canViewOwn
  ) {
    query =
      query.eq(
        "owner_employee_id",
        access.employee.id
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

  return data || [];
}

// =========================================================
// LOAD PAYMENTS FOR VISIBLE PROJECT INVOICES
// =========================================================

async function loadInvoicePayments({
  supabase,
  organizationId,
  invoices,
}) {
  const invoiceIds =
    (invoices || [])
      .map(
        (invoice) =>
          invoice.id
      )
      .filter(Boolean);

  if (
    invoiceIds.length === 0
  ) {
    return [];
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "invoice_payments"
      )
      .select(
        `
          id,
          invoice_id,
          amount,
          payment_date,
          payment_method,
          reference,
          notes,
          recorded_by_employee_id,
          created_at
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .in(
        "invoice_id",
        invoiceIds
      )
      .order(
        "payment_date",
        {
          ascending: false,
        }
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

  return data || [];
}

// =========================================================
// BUILD PROJECT FINANCIAL SUMMARY
// =========================================================

function buildProjectFinancialSummary({
  project,
  invoices,
  payments,
}) {
  const projectValue =
    roundMoney(
      parseMoney(
        project?.amount
      )
    );

  /*
   * Only issued invoices count as actual invoiced revenue.
   *
   * Excluded:
   * - Draft
   * - Draft Invoice
   * - Cancelled
   */
  const issuedInvoices =
    (invoices || [])
      .filter(
        (invoice) =>
          !NON_ISSUED_INVOICE_STATUSES
            .has(
              normaliseStatus(
                invoice.status
              )
            )
      );

  const issuedInvoiceIds =
    new Set(
      issuedInvoices.map(
        (invoice) =>
          invoice.id
      )
    );

  const totalInvoiced =
    roundMoney(
      issuedInvoices.reduce(
        (
          total,
          invoice
        ) =>
          total +
          parseMoney(
            invoice.total_amount ||
              invoice.amount ||
              invoice.subtotal
          ),
        0
      )
    );

  /*
   * Only payments against issued invoices
   * contribute to the project finance summary.
   */
  const validPayments =
    (payments || [])
      .filter(
        (payment) =>
          issuedInvoiceIds.has(
            payment.invoice_id
          )
      );

  const totalPaid =
    roundMoney(
      validPayments.reduce(
        (
          total,
          payment
        ) =>
          total +
          parseMoney(
            payment.amount
          ),
        0
      )
    );

  const outstanding =
    roundMoney(
      Math.max(
        0,
        totalInvoiced -
          totalPaid
      )
    );

  const remainingToInvoice =
    roundMoney(
      Math.max(
        0,
        projectValue -
          totalInvoiced
      )
    );

  return {
    project_value:
      projectValue,

    total_invoiced:
      totalInvoiced,

    total_paid:
      totalPaid,

    outstanding,

    remaining_to_invoice:
      remainingToInvoice,

    project_value_display:
      formatCurrency(
        projectValue
      ),

    total_invoiced_display:
      formatCurrency(
        totalInvoiced
      ),

    total_paid_display:
      formatCurrency(
        totalPaid
      ),

    outstanding_display:
      formatCurrency(
        outstanding
      ),

    remaining_to_invoice_display:
      formatCurrency(
        remainingToInvoice
      ),

    invoice_count:
      issuedInvoices.length,

    payment_count:
      validPayments.length,
  };
}

// =========================================================
// ENRICH INVOICE FINANCIALS
// =========================================================

function enrichInvoicesWithPayments({
  invoices,
  payments,
}) {
  const paymentsByInvoice =
    new Map();

  for (
    const payment of
    payments || []
  ) {
    if (
      !paymentsByInvoice.has(
        payment.invoice_id
      )
    ) {
      paymentsByInvoice.set(
        payment.invoice_id,
        []
      );
    }

    paymentsByInvoice
      .get(
        payment.invoice_id
      )
      .push(
        payment
      );
  }

  return (invoices || [])
    .map(
      (invoice) => {
        const invoicePayments =
          paymentsByInvoice.get(
            invoice.id
          ) || [];

        const total =
          roundMoney(
            parseMoney(
              invoice.total_amount ||
                invoice.amount ||
                invoice.subtotal
            )
          );

        const paid =
          roundMoney(
            invoicePayments.reduce(
              (
                runningTotal,
                payment
              ) =>
                runningTotal +
                parseMoney(
                  payment.amount
                ),
              0
            )
          );

        const outstanding =
          roundMoney(
            Math.max(
              0,
              total -
                paid
            )
          );

        return {
          ...invoice,

          payment_summary: {
            total,
            paid,
            outstanding,

            total_display:
              formatCurrency(
                total
              ),

            paid_display:
              formatCurrency(
                paid
              ),

            outstanding_display:
              formatCurrency(
                outstanding
              ),

            payment_count:
              invoicePayments.length,
          },
        };
      }
    );
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

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid project ID is required.",
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

    const projectPermissions =
      getProjectPermissions(
        access
      );

    if (
      !hasViewPermission(
        projectPermissions
      )
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
        projectId: id,
      });

    if (!project) {
      return NextResponse.json(
        {
          error:
            "Project not found.",
        },
        {
          status: 404,
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
        record: project,
      });

    const {
      tasks,
      taskPermissions,
    } =
      await loadProjectTasks({
        supabase,
        access,
        organizationId,
        projectId: id,
      });

    // =====================================================
    // CUSTOMER
    // =====================================================

    const customerPermissions =
      getCustomerPermissions(
        access
      );

    const customer =
      await loadVisibleRelatedRecord({
        supabase,
        access,
        organizationId,

        table:
          "customers",

        recordId:
          project.customer_id,

        permissions:
          customerPermissions,

        select:
          `
            id,
            customer_name,
            company,
            email,
            phone,
            status
          `,
      });

    // =====================================================
    // QUOTE
    // =====================================================

    const quotePermissions =
      getQuotePermissions(
        access
      );

    const quote =
      await loadVisibleRelatedRecord({
        supabase,
        access,
        organizationId,

        table:
          "quotes",

        recordId:
          project.quote_id,

        permissions:
          quotePermissions,

        select:
          `
            id,
            quote_number,
            client,
            contact,
            service,
            amount,
            status
          `,
      });

    // =====================================================
    // INVOICES
    // =====================================================

    const rawInvoices =
      await loadVisibleInvoices({
        supabase,
        access,
        organizationId,
        projectId: id,
      });

    // =====================================================
    // PAYMENTS
    // =====================================================

    const invoicePayments =
      await loadInvoicePayments({
        supabase,
        organizationId,
        invoices:
          rawInvoices,
      });

    // =====================================================
    // FINANCIALS
    // =====================================================

    const invoices =
      enrichInvoicesWithPayments({
        invoices:
          rawInvoices,

        payments:
          invoicePayments,
      });

    const financialSummary =
      buildProjectFinancialSummary({
        project,
        invoices:
          rawInvoices,
        payments:
          invoicePayments,
      });

    // =====================================================
    // ASSIGNABLE EMPLOYEES
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

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      project:
        formattedProject,

      customer,

      quote,

      tasks,

      invoices,

      financialSummary,

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
        status: 500,
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

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid project ID is required.",
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
        projectId: id,
      });

    if (!project) {
      return NextResponse.json(
        {
          error:
            "Project not found.",
        },
        {
          status: 404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record: project,
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
        (field) =>
          Object.prototype
            .hasOwnProperty
            .call(
              body,
              field
            )
      );

    const wantsOwnerChange =
      Object.prototype
        .hasOwnProperty
        .call(
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
          status: 400,
        }
      );
    }

    const updates = {};

    if (
      Object.prototype
        .hasOwnProperty
        .call(
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
            status: 400,
          }
        );
      }

      updates.project_name =
        projectName;
    }

    if (
      Object.prototype
        .hasOwnProperty
        .call(
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
      Object.prototype
        .hasOwnProperty
        .call(
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
      Object.prototype
        .hasOwnProperty
        .call(
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
            status: 400,
          }
        );
      }

      updates.status =
        body.status;
    }

    const nextStartDate =
      Object.prototype
        .hasOwnProperty
        .call(
          body,
          "start_date"
        )
        ? body.start_date ||
          null
        : project.start_date;

    const nextDueDate =
      Object.prototype
        .hasOwnProperty
        .call(
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
          status: 400,
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
          status: 400,
        }
      );
    }

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          body,
          "start_date"
        )
    ) {
      updates.start_date =
        nextStartDate;
    }

    if (
      Object.prototype
        .hasOwnProperty
        .call(
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
              status: 400,
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
              status: 400,
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
        .from("projects")
        .update(updates)
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

    if (updateError) {
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
        status: 500,
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

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid project ID is required.",
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
        projectId: id,
      });

    if (!project) {
      return NextResponse.json(
        {
          error:
            "Project not found.",
        },
        {
          status: 404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record: project,
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
          .from("tasks")
          .select(
            "id",
            {
              count: "exact",
              head: true,
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
          .from("invoices")
          .select(
            "id",
            {
              count: "exact",
              head: true,
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
        tasksResult.count || 0
      ) > 0 ||
      Number(
        invoicesResult.count || 0
      ) > 0
    ) {
      return NextResponse.json(
        {
          error:
            "This project cannot be deleted while tasks or invoices are linked to it. Cancel the project instead.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error:
        deleteError,
    } =
      await supabase
        .from("projects")
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (deleteError) {
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
        status: 500,
      }
    );
  }
}
