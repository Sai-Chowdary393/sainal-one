import {
  createNotification,
} from "../notifications/notificationService";

// =========================================================
// HELPERS
// =========================================================

function now() {
  return new Date().toISOString();
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getStepConfig(
  workflowStep
) {
  return {
    ...(workflowStep.configuration ||
      {}),

    ...(workflowStep.action_config ||
      {}),
  };
}

function getTableForRecordType(
  recordType
) {
  switch (
    String(recordType || "")
      .trim()
      .toLowerCase()
  ) {
    case "quote":
    case "quotes":
      return "quotes";

    case "lead":
    case "leads":
      return "leads";

    case "customer":
    case "customers":
      return "customers";

    case "invoice":
    case "invoices":
      return "invoices";

    case "project":
    case "projects":
      return "projects";

    case "proposal":
    case "proposals":
      return "proposals";

    case "follow_up":
    case "follow-up":
    case "followups":
    case "follow-ups":
      return "follow_ups";

    default:
      return null;
  }
}

// =========================================================
// LOAD BUSINESS RECORD
// =========================================================

async function loadWorkflowRecord({
  supabase,
  organizationId,
  workflowRun,
}) {
  const recordId =
    workflowRun.record_id;

  if (!recordId) {
    return null;
  }

  const table =
    getTableForRecordType(
      workflowRun.record_type
    );

  if (!table) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from(table)
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
    console.error(
      "Unable to load workflow record:",
      error
    );

    return null;
  }

  return data || null;
}

// =========================================================
// TEMPLATE HELPERS
// =========================================================

function normaliseTemplateValue(
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
      return "";
    }
  }

  return String(value);
}

function getVariableValue(
  variables,
  variableName
) {
  const path =
    String(
      variableName || ""
    )
      .split(".")
      .filter(Boolean);

  let current =
    variables;

  for (const key of path) {
    if (
      current === null ||
      current === undefined ||
      typeof current !==
        "object" ||
      !(key in current)
    ) {
      return undefined;
    }

    current =
      current[key];
  }

  return current;
}

function renderTemplate(
  template,
  variables
) {
  const source =
    String(
      template || ""
    );

  return source.replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
    (
      match,
      variableName
    ) => {
      const value =
        getVariableValue(
          variables,
          variableName
        );

      if (
        value === undefined ||
        value === null
      ) {
        return match;
      }

      return normaliseTemplateValue(
        value
      );
    }
  );
}

function buildWorkflowVariables({
  payload,
  record,
  workflowRun,
  workflowStep,
}) {
  return {
    ...(record || {}),
    ...(payload || {}),

    record_type:
      workflowRun.record_type ||
      "",

    record_id:
      workflowRun.record_id ||
      "",

    workflow_run_id:
      workflowRun.id ||
      "",

    workflow_step:
      workflowStep.name ||
      "",

    step_name:
      workflowStep.name ||
      "",
  };
}

// =========================================================
// RECORD OWNER
// =========================================================

function getRecordOwnerEmployeeId({
  payload,
  record,
}) {
  return (
    payload?.owner_employee_id ||
    payload?.employee_id ||
    record?.owner_employee_id ||
    record?.employee_id ||
    record?.assigned_employee_id ||
    null
  );
}

// =========================================================
// MANAGER RESOLUTION
// =========================================================

async function resolveManagerEmployeeId({
  supabase,
  organizationId,
  ownerEmployeeId,
}) {
  if (!ownerEmployeeId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from("employees")
    .select(
      `
        id,
        manager_id
      `
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      ownerEmployeeId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to resolve employee manager: ${error.message}`
    );
  }

  return (
    data?.manager_id ||
    null
  );
}

// =========================================================
// DEPARTMENT MANAGER
// =========================================================

async function resolveDepartmentManagerId({
  supabase,
  organizationId,
  ownerEmployeeId,
}) {
  if (!ownerEmployeeId) {
    return null;
  }

  const {
    data: employee,
    error: employeeError,
  } = await supabase
    .from("employees")
    .select(
      `
        id,
        department_id
      `
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      ownerEmployeeId
    )
    .maybeSingle();

  if (employeeError) {
    throw new Error(
      `Unable to resolve employee department: ${employeeError.message}`
    );
  }

  if (
    !employee?.department_id
  ) {
    return null;
  }

  const {
    data: department,
    error: departmentError,
  } = await supabase
    .from("departments")
    .select(
      `
        id,
        manager_id
      `
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      employee.department_id
    )
    .maybeSingle();

  if (departmentError) {
    throw new Error(
      `Unable to resolve department manager: ${departmentError.message}`
    );
  }

  return (
    department?.manager_id ||
    null
  );
}

// =========================================================
// GENERIC EMPLOYEE RECIPIENT RESOLUTION
// =========================================================

async function resolveEmployeeRecipient({
  supabase,
  organizationId,
  recipientType,
  employeeId,
  payload,
  record,
}) {
  const type =
    cleanText(
      recipientType
    ) ||
    "Record Owner";

  const ownerEmployeeId =
    getRecordOwnerEmployeeId({
      payload,
      record,
    });

  // RECORD OWNER
  if (
    type === "Record Owner" ||
    type === "Record owner"
  ) {
    return {
      recipientType:
        "Record Owner",

      employeeId:
        ownerEmployeeId,
    };
  }

  // OWNER'S MANAGER
  if (
    type === "Manager" ||
    type ===
      "Record owner's manager"
  ) {
    const managerId =
      await resolveManagerEmployeeId({
        supabase,
        organizationId,
        ownerEmployeeId,
      });

    return {
      recipientType:
        "Manager",

      employeeId:
        managerId,
    };
  }

  // SPECIFIC EMPLOYEE
  if (
    type === "Employee"
  ) {
    return {
      recipientType:
        "Employee",

      employeeId:
        employeeId ||
        null,
    };
  }

  // DEPARTMENT MANAGER
  if (
    type ===
      "Department Manager" ||
    type ===
      "Department manager"
  ) {
    const departmentManagerId =
      await resolveDepartmentManagerId({
        supabase,
        organizationId,
        ownerEmployeeId,
      });

    return {
      recipientType:
        "Department Manager",

      employeeId:
        departmentManagerId,
    };
  }

  return {
    recipientType:
      "Record Owner",

    employeeId:
      ownerEmployeeId,
  };
}

// =========================================================
// DUE DATE
// =========================================================

function calculateTaskDueDate(
  dueOffset
) {
  const value =
    String(
      dueOffset || "1_day"
    ).toLowerCase();

  const dueDate =
    new Date();

  switch (value) {
    case "today":
      break;

    case "1_day":
      dueDate.setDate(
        dueDate.getDate() + 1
      );
      break;

    case "2_days":
      dueDate.setDate(
        dueDate.getDate() + 2
      );
      break;

    case "3_days":
      dueDate.setDate(
        dueDate.getDate() + 3
      );
      break;

    case "7_days":
      dueDate.setDate(
        dueDate.getDate() + 7
      );
      break;

    case "14_days":
      dueDate.setDate(
        dueDate.getDate() + 14
      );
      break;

    case "30_days":
      dueDate.setDate(
        dueDate.getDate() + 30
      );
      break;

    default:
      dueDate.setDate(
        dueDate.getDate() + 1
      );
      break;
  }

  return dueDate
    .toISOString()
    .slice(0, 10);
}

// =========================================================
// UPDATE RECORD VALUE TYPE
// =========================================================

function convertConfiguredValue(
  value,
  valueType
) {
  const type =
    String(
      valueType || "text"
    ).toLowerCase();

  switch (type) {
    case "number": {
      const numberValue =
        Number(value);

      if (
        Number.isNaN(
          numberValue
        )
      ) {
        throw new Error(
          `"${value}" is not a valid number.`
        );
      }

      return numberValue;
    }

    case "boolean":
      return (
        value === true ||
        String(value)
          .toLowerCase() ===
          "true"
      );

    case "null":
      return null;

    case "text":
    default:
      return value;
  }
}

// =========================================================
// PUBLIC EXECUTOR
// =========================================================

export async function executeWorkflowAction({
  supabase,
  organizationId,
  workflowRun,
  workflowStep,
  payload = {},
}) {
  if (!workflowStep) {
    throw new Error(
      "Workflow action step is required."
    );
  }

  const type =
    String(
      workflowStep.step_type ||
      ""
    )
      .trim()
      .toLowerCase();

  switch (type) {
    case "update":
    case "update record":
      return executeUpdateRecord({
        supabase,
        organizationId,
        workflowRun,
        workflowStep,
      });

    case "notification":
      return executeNotification({
        supabase,
        organizationId,
        workflowRun,
        workflowStep,
        payload,
      });

    case "create task":
      return executeCreateTask({
        supabase,
        organizationId,
        workflowRun,
        workflowStep,
        payload,
      });

    case "email":
      return executeEmail({
        workflowRun,
        workflowStep,
      });

    case "wait":
    case "ai action":
      return {
        success: true,
        simulated: true,
        action:
          workflowStep.step_type,
        message:
          `${workflowStep.step_type} execution is not enabled yet.`,
      };

    default:
      return {
        success: true,
        simulated: true,
        action:
          workflowStep.step_type,
        message:
          `No real executor exists yet for "${workflowStep.step_type}".`,
      };
  }
}

// =========================================================
// UPDATE RECORD
// =========================================================

async function executeUpdateRecord({
  supabase,
  organizationId,
  workflowRun,
  workflowStep,
}) {
  const recordType =
    workflowRun.record_type;

  const recordId =
    workflowRun.record_id;

  if (!recordId) {
    throw new Error(
      `Update Record step "${workflowStep.name}" cannot run because the workflow has no record ID.`
    );
  }

  const table =
    getTableForRecordType(
      recordType
    );

  if (!table) {
    throw new Error(
      `Update Record does not yet support record type "${recordType}".`
    );
  }

  const config =
    getStepConfig(
      workflowStep
    );

  const field =
    String(
      config.field ||
      config.field_name ||
      "status"
    ).trim();

  const rawValue =
    config.value ??
    config.field_value ??
    "Approved";

  const value =
    convertConfiguredValue(
      rawValue,
      config.value_type ||
        "text"
    );

  if (!field) {
    throw new Error(
      `Update Record step "${workflowStep.name}" has no field configured.`
    );
  }

  const protectedFields =
    new Set([
      "id",
      "organization_id",
      "created_at",
    ]);

  if (
    protectedFields.has(
      field
    )
  ) {
    throw new Error(
      `Workflow actions cannot update protected field "${field}".`
    );
  }

  // =======================================================
  // OPTIONAL: ONLY UPDATE WHEN CHANGED
  // =======================================================

  if (
    config.only_if_changed !==
    false
  ) {
    const {
      data: currentRecord,
      error:
        currentRecordError,
    } = await supabase
      .from(table)
      .select(field)
      .eq(
        "id",
        recordId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (currentRecordError) {
      throw new Error(
        `Unable to check current ${field} value: ${currentRecordError.message}`
      );
    }

    if (
      currentRecord &&
      currentRecord[field] ===
        value
    ) {
      return {
        success: true,

        simulated: false,

        skipped: true,

        action:
          "Update Record",

        table,

        record_id:
          recordId,

        field,

        value,

        message:
          `${table}.${field} already contains the configured value.`,
      };
    }
  }

  const updateValues = {
    [field]:
      value,
  };

  const tablesWithUpdatedAt =
    new Set([
      "quotes",
      "leads",
      "customers",
      "invoices",
      "projects",
      "proposals",
      "follow_ups",
    ]);

  if (
    tablesWithUpdatedAt.has(
      table
    )
  ) {
    updateValues.updated_at =
      now();
  }

  const {
    data,
    error,
  } = await supabase
    .from(table)
    .update(
      updateValues
    )
    .eq(
      "id",
      recordId
    )
    .eq(
      "organization_id",
      organizationId
    )
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(
      `Update Record failed for ${table}: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      `The ${recordType} record could not be found in this organisation.`
    );
  }

  return {
    success: true,

    simulated: false,

    action:
      "Update Record",

    table,

    record_id:
      recordId,

    field,

    value,

    record:
      data,

    message:
      `${table}.${field} updated successfully.`,
  };
}

// =========================================================
// NOTIFICATION
// =========================================================

async function executeNotification({
  supabase,
  organizationId,
  workflowRun,
  workflowStep,
  payload,
}) {
  const config =
    getStepConfig(
      workflowStep
    );

  if (
    config.create_notification ===
    false
  ) {
    return {
      success: true,
      simulated: false,
      skipped: true,
      action:
        "Notification",
      message:
        "In-app notification creation is disabled for this workflow step.",
    };
  }

  const record =
    await loadWorkflowRecord({
      supabase,
      organizationId,
      workflowRun,
    });

  const variables =
    buildWorkflowVariables({
      payload,
      record,
      workflowRun,
      workflowStep,
    });

  const recipientType =
    cleanText(
      config.recipient
    ) ||
    "Record Owner";

  // =======================================================
  // ORGANISATION-WIDE
  // =======================================================

  let targetEmployeeId =
    null;

  let resolvedRecipientType =
    recipientType;

  if (
    recipientType !==
      "Organisation" &&
    recipientType !==
      "Organization"
  ) {
    if (
      recipientType ===
      "Role"
    ) {
      throw new Error(
        "Role-based notification delivery is not enabled yet."
      );
    }

    const recipient =
      await resolveEmployeeRecipient({
        supabase,
        organizationId,

        recipientType,

        employeeId:
          config.employee_id ||
          config.recipient_employee_id,

        payload,
        record,
      });

    targetEmployeeId =
      recipient.employeeId;

    resolvedRecipientType =
      recipient.recipientType;

    if (
      !targetEmployeeId
    ) {
      throw new Error(
        `Unable to resolve the notification recipient for "${resolvedRecipientType}".`
      );
    }
  } else {
    resolvedRecipientType =
      "Organisation";
  }

  let title =
    cleanText(
      config.title
    );

  if (!title) {
    if (
      String(
        workflowRun.record_type ||
        ""
      ).toLowerCase() ===
      "quote"
    ) {
      title =
        "Quote approved";
    } else {
      title =
        workflowStep.name ||
        "Workflow notification";
    }
  }

  let message =
    cleanText(
      config.message
    );

  if (!message) {
    const quoteNumber =
      variables.quote_number;

    if (
      String(
        workflowRun.record_type ||
        ""
      ).toLowerCase() ===
        "quote" &&
      quoteNumber
    ) {
      message =
        `Quote ${quoteNumber} has been approved.`;
    } else {
      message =
        `${
          workflowStep.name ||
          "Workflow action"
        } has been completed.`;
    }
  }

  const renderedTitle =
    renderTemplate(
      title,
      variables
    );

  const renderedMessage =
    renderTemplate(
      message,
      variables
    );

  const severity =
    cleanText(
      config.type ||
      config.severity
    ).toLowerCase() ||
    "info";

  const allowedSeverities =
    new Set([
      "info",
      "success",
      "warning",
      "error",
    ]);

  const notificationType =
    allowedSeverities.has(
      severity
    )
      ? severity
      : "info";

  const shouldOpenRecord =
    config.open_record !==
    false;

  const notification =
    await createNotification({
      supabase,

      organizationId,

      userId:
        targetEmployeeId,

      title:
        renderedTitle,

      message:
        renderedMessage,

      type:
        notificationType,

      recordType:
        shouldOpenRecord
          ? workflowRun.record_type
          : null,

      recordId:
        shouldOpenRecord
          ? workflowRun.record_id
          : null,
    });

  return {
    success: true,

    simulated: false,

    action:
      "Notification",

    notification_id:
      notification.id,

    recipient:
      resolvedRecipientType,

    user_id:
      notification.user_id,

    title:
      notification.title,

    message:
      notification.message,

    severity:
      notification.type,

    open_record:
      shouldOpenRecord,

    send_email_requested:
      Boolean(
        config.send_email
      ),

    email_sent:
      false,
  };
}

// =========================================================
// CREATE TASK
// =========================================================

async function executeCreateTask({
  supabase,
  organizationId,
  workflowRun,
  workflowStep,
  payload,
}) {
  const config =
    getStepConfig(
      workflowStep
    );

  // =======================================================
  // LOAD ORIGINATING BUSINESS RECORD
  // =======================================================

  const record =
    await loadWorkflowRecord({
      supabase,
      organizationId,
      workflowRun,
    });

  const variables =
    buildWorkflowVariables({
      payload,
      record,
      workflowRun,
      workflowStep,
    });

  // =======================================================
  // TASK NAME
  // =======================================================

  const configuredTaskName =
    cleanText(
      config.task_name
    );

  const taskNameTemplate =
    configuredTaskName ||
    workflowStep.name ||
    "Workflow task";

  const taskName =
    renderTemplate(
      taskNameTemplate,
      variables
    );

  if (!cleanText(taskName)) {
    throw new Error(
      `Create Task step "${workflowStep.name}" requires a task title.`
    );
  }

  // =======================================================
  // DESCRIPTION
  // =======================================================

  const taskDescription =
    renderTemplate(
      config.task_description ||
        workflowStep.description ||
        "",
      variables
    );

  // =======================================================
  // ASSIGNEE
  // =======================================================

  const assigneeType =
    cleanText(
      config.task_assignee
    ) ||
    "Record Owner";

  const recipient =
    await resolveEmployeeRecipient({
      supabase,
      organizationId,

      recipientType:
        assigneeType,

      employeeId:
        config.employee_id ||
        config.assigned_employee_id,

      payload,
      record,
    });

  if (
    !recipient.employeeId
  ) {
    throw new Error(
      `Unable to resolve the task assignee for "${recipient.recipientType}".`
    );
  }

  // =======================================================
  // DUE DATE
  // =======================================================

  const dueDate =
    calculateTaskDueDate(
      config.due_offset ||
      "1_day"
    );

  // =======================================================
  // PRIORITY
  // =======================================================

  const allowedPriorities =
    new Set([
      "Low",
      "Medium",
      "High",
      "Urgent",
    ]);

  const requestedPriority =
    cleanText(
      config.priority
    ) ||
    "Medium";

  const priority =
    allowedPriorities.has(
      requestedPriority
    )
      ? requestedPriority
      : "Medium";

  // =======================================================
  // STATUS
  // =======================================================

  const allowedStatuses =
    new Set([
      "Open",
      "In Progress",
      "Blocked",
    ]);

  const requestedStatus =
    cleanText(
      config.task_status
    ) ||
    "Open";

  const taskStatus =
    allowedStatuses.has(
      requestedStatus
    )
      ? requestedStatus
      : "Open";

  // =======================================================
  // ORIGINATING RECORD LINK
  // =======================================================

  const linkRecord =
    config.link_record !==
    false;

  // =======================================================
  // PROJECT LINK
  // =======================================================
  //
  // If the originating record itself
  // is a project, use that record as
  // project_id as well.
  // =======================================================

  let projectId =
    null;

  const recordType =
    String(
      workflowRun.record_type ||
      ""
    ).toLowerCase();

  if (
    recordType ===
      "project" ||
    recordType ===
      "projects"
  ) {
    projectId =
      workflowRun.record_id ||
      null;
  }

  // =======================================================
  // CREATE REAL TASK
  // =======================================================

  const taskInsert = {
    organization_id:
      organizationId,

    project_id:
      projectId,

    task_name:
      taskName,

    description:
      taskDescription ||
      null,

    status:
      taskStatus,

    due_date:
      dueDate,

    assigned_employee_id:
      recipient.employeeId,

    record_type:
      linkRecord
        ? workflowRun.record_type
        : null,

    record_id:
      linkRecord
        ? workflowRun.record_id
        : null,

    workflow_run_id:
      workflowRun.id ||
      null,

    priority,

    updated_at:
      now(),
  };

  const {
    data: task,
    error,
  } = await supabase
    .from("tasks")
    .insert(
      taskInsert
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Create Task failed: ${error.message}`
    );
  }

  return {
    success: true,

    simulated: false,

    action:
      "Create Task",

    task_id:
      task.id,

    task_name:
      task.task_name,

    status:
      task.status,

    priority:
      task.priority,

    due_date:
      task.due_date,

    assigned_employee_id:
      task.assigned_employee_id,

    assigned_to:
      recipient.recipientType,

    record_type:
      task.record_type,

    record_id:
      task.record_id,

    workflow_run_id:
      task.workflow_run_id,

    message:
      `Task "${task.task_name}" created successfully.`,
  };
}

// =========================================================
// EMAIL - STILL SIMULATED
// =========================================================

async function executeEmail({
  workflowRun,
  workflowStep,
}) {
  const config =
    getStepConfig(
      workflowStep
    );

  console.log(
    "SaiNal One email action:",
    {
      workflowRunId:
        workflowRun.id,

      step:
        workflowStep.name,

      config,
    }
  );

  return {
    success: true,

    simulated: true,

    action:
      "Email",

    message:
      "Email step completed in simulation mode.",
  };
}
