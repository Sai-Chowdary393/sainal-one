import {
  createNotification,
} from "../notifications/notificationService";

// =========================================================
// HELPERS
// =========================================================

function now() {
  return new Date().toISOString();
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
    [field]: value,
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

  /*
   * For your current Quote workflow,
   * owner_employee_id is the salesperson
   * who submitted the quote.
   */
  const targetEmployeeId =
    config.employee_id ||
    config.recipient_employee_id ||
    payload?.owner_employee_id ||
    null;

  const quoteNumber =
    payload?.quote_number;

  let title =
    config.title ||
    workflowStep.name ||
    "Workflow notification";

  let message =
    config.message;

  /*
   * Useful default for your existing
   * "Notify Salesperson" node.
   */
  if (!message) {
    if (
      String(
        workflowRun.record_type
      ).toLowerCase() ===
        "quote" &&
      quoteNumber
    ) {
      title =
        config.title ||
        "Quote approved";

      message =
        `Quote ${quoteNumber} has been approved.`;
    } else {
      message =
        `${workflowStep.name || "Workflow action"} has been completed.`;
    }
  }

  const notification =
    await createNotification({
      supabase,

      organizationId,

      userId:
        targetEmployeeId,

      title,

      message,

      type:
        config.type ||
        "success",

      recordType:
        workflowRun.record_type,

      recordId:
        workflowRun.record_id,
    });

  return {
    success: true,

    simulated: false,

    action:
      "Notification",

    notification_id:
      notification.id,

    user_id:
      notification.user_id,

    title:
      notification.title,

    message:
      notification.message,
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
    action: "Email",
    message:
      "Email step completed in simulation mode.",
  };
}
