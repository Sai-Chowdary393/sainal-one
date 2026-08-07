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
    ...(
      workflowStep.configuration ||
      {}
    ),

    ...(
      workflowStep.action_config ||
      {}
    ),
  };
}

function getTableForRecordType(
  recordType
) {
  switch (
    String(
      recordType || ""
    )
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
// LOAD CURRENT BUSINESS RECORD
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
      "Unable to load workflow record for notification:",
      error
    );

    return null;
  }

  return data || null;
}

// =========================================================
// TEMPLATE VALUE
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

// =========================================================
// TEMPLATE REPLACEMENT
// =========================================================
//
// Supports:
//
// {{quote_number}}
// {{client}}
// {{amount}}
// {{email}}
// {{record_type}}
//
// But this is intentionally generic,
// so any field available in the payload
// or current record can be used:
//
// {{phone}}
// {{service}}
// {{status}}
// etc.
// =========================================================

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
        /*
         * Keep the variable visible if
         * SaiNal One cannot resolve it.
         *
         * This is safer than silently
         * removing important text.
         */
        return match;
      }

      return normaliseTemplateValue(
        value
      );
    }
  );
}

// =========================================================
// READ VARIABLE
// =========================================================

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

  for (
    const key of path
  ) {
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

// =========================================================
// BUILD NOTIFICATION VARIABLES
// =========================================================

function buildNotificationVariables({
  payload,
  record,
  workflowRun,
  workflowStep,
}) {
  return {
    /*
     * Database record first.
     */
    ...(record || {}),

    /*
     * Runtime payload overrides the
     * database value if explicitly
     * provided.
     */
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
// RESOLVE RECORD OWNER
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
// RESOLVE MANAGER
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
        manager_id,
        employment_status,
        availability_status,
        is_active
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
      `Unable to resolve notification manager: ${error.message}`
    );
  }

  return (
    data?.manager_id ||
    null
  );
}

// =========================================================
// RESOLVE DEPARTMENT MANAGER
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
// RESOLVE NOTIFICATION RECIPIENT
// =========================================================

async function resolveNotificationRecipient({
  supabase,
  organizationId,
  config,
  payload,
  record,
}) {
  const recipientType =
    cleanText(
      config.recipient
    ) ||
    "Record Owner";

  const ownerEmployeeId =
    getRecordOwnerEmployeeId({
      payload,
      record,
    });

  // =======================================================
  // RECORD OWNER
  // =======================================================

  if (
    recipientType ===
      "Record Owner" ||
    recipientType ===
      "Record owner"
  ) {
    return {
      recipientType:
        "Record Owner",

      employeeId:
        ownerEmployeeId,
    };
  }

  // =======================================================
  // MANAGER
  // =======================================================

  if (
    recipientType ===
      "Manager" ||
    recipientType ===
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

  // =======================================================
  // SPECIFIC EMPLOYEE
  // =======================================================

  if (
    recipientType ===
    "Employee"
  ) {
    return {
      recipientType:
        "Employee",

      employeeId:
        config.employee_id ||
        config.recipient_employee_id ||
        null,
    };
  }

  // =======================================================
  // DEPARTMENT MANAGER
  // =======================================================

  if (
    recipientType ===
      "Department Manager" ||
    recipientType ===
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

  // =======================================================
  // ORGANISATION
  // =======================================================
  //
  // user_id NULL means the notification
  // is visible organisation-wide in the
  // notification service we built.
  // =======================================================

  if (
    recipientType ===
      "Organisation" ||
    recipientType ===
      "Organization"
  ) {
    return {
      recipientType:
        "Organisation",

      employeeId:
        null,
    };
  }

  // =======================================================
  // ROLE
  // =======================================================
  //
  // The designer does not yet collect a
  // role_id, so we cannot safely resolve
  // a role recipient yet.
  // =======================================================

  if (
    recipientType ===
    "Role"
  ) {
    if (
      !config.role_id
    ) {
      throw new Error(
        'Notification recipient is set to "Role", but no role has been selected.'
      );
    }

    /*
     * Role-to-multiple-recipient support
     * will be added when we upgrade the
     * designer to select an actual role.
     */
    throw new Error(
      "Role-based notification delivery is not enabled yet."
    );
  }

  return {
    recipientType:
      "Record Owner",

    employeeId:
      ownerEmployeeId,
  };
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

    case "email":
      return executeEmail({
        workflowRun,
        workflowStep,
      });

    case "create task":
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

  const value =
    config.value ??
    config.field_value ??
    "Approved";

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
// REAL NOTIFICATION
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

  // =======================================================
  // NOTIFICATION DISABLED
  // =======================================================

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

  // =======================================================
  // LOAD RELATED RECORD
  // =======================================================

  const record =
    await loadWorkflowRecord({
      supabase,
      organizationId,
      workflowRun,
    });

  // =======================================================
  // VARIABLES
  // =======================================================

  const variables =
    buildNotificationVariables({
      payload,
      record,
      workflowRun,
      workflowStep,
    });

  // =======================================================
  // RECIPIENT
  // =======================================================

  const recipient =
    await resolveNotificationRecipient({
      supabase,
      organizationId,
      config,
      payload,
      record,
    });

  /*
   * Record Owner / Manager / Department
   * Manager require a real employee.
   *
   * Organisation deliberately uses NULL.
   */
  if (
    recipient.recipientType !==
      "Organisation" &&
    !recipient.employeeId
  ) {
    throw new Error(
      `Unable to resolve the notification recipient for "${recipient.recipientType}".`
    );
  }

  // =======================================================
  // DEFAULT TITLE
  // =======================================================

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

  // =======================================================
  // DEFAULT MESSAGE
  // =======================================================

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

  // =======================================================
  // VARIABLE REPLACEMENT
  // =======================================================

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

  // =======================================================
  // SEVERITY
  // =======================================================

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

  // =======================================================
  // OPEN RELATED RECORD
  // =======================================================

  const shouldOpenRecord =
    config.open_record !==
    false;

  /*
   * Setting record_id to NULL means the
   * notification remains readable but
   * does not navigate anywhere when
   * clicked.
   */
  const notificationRecordId =
    shouldOpenRecord
      ? workflowRun.record_id
      : null;

  const notificationRecordType =
    shouldOpenRecord
      ? workflowRun.record_type
      : null;

  // =======================================================
  // CREATE NOTIFICATION
  // =======================================================

  const notification =
    await createNotification({
      supabase,

      organizationId,

      userId:
        recipient.employeeId,

      title:
        renderedTitle,

      message:
        renderedMessage,

      type:
        notificationType,

      recordType:
        notificationRecordType,

      recordId:
        notificationRecordId,
    });

  // =======================================================
  // EMAIL FLAG
  // =======================================================
  //
  // We save and report this setting,
  // but actual email sending remains
  // part of the Email Engine milestone.
  // =======================================================

  const emailRequested =
    Boolean(
      config.send_email
    );

  return {
    success: true,

    simulated: false,

    action:
      "Notification",

    notification_id:
      notification.id,

    recipient:
      recipient.recipientType,

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

    create_notification:
      true,

    send_email_requested:
      emailRequested,

    email_sent:
      false,

    record_type:
      notification.record_type,

    record_id:
      notification.record_id,
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
