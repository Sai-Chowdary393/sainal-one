// =========================================================
// SAINAL ONE
// WORKFLOW ACTION EXECUTOR
// =========================================================
//
// Executes automatic workflow actions.
//
// VERSION 1:
//
// - Update Record      REAL
// - Notification       SIMULATED
// - Email              SIMULATED
//
// Future:
//
// - Create Task
// - Create Record
// - AI Action
// - Send Email
// - In-App Notification
// - Invoice Creation
// - Project Creation
// - Webhook
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
        payload,
      });

    case "notification":
      return executeNotification({
        workflowRun,
        workflowStep,
        payload,
      });

    case "email":
      return executeEmail({
        workflowRun,
        workflowStep,
        payload,
      });

    /*
     * We haven't implemented these
     * real side effects yet.
     *
     * They are recorded as simulated
     * rather than silently ignored.
     */
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

  /*
   * VERSION 1 behaviour:
   *
   * If the designer does not yet have
   * field/value configuration, an Update
   * Record node defaults to:
   *
   * status = Approved
   *
   * This means your existing
   * "Mark Quote Approved" node will work
   * immediately.
   */
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

  /*
   * Protect fields that a workflow should
   * never modify dynamically.
   */
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

  /*
   * Most SaiNal One business tables have
   * updated_at. Add it for the tables that
   * currently support it.
   */
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

  console.log(
    "SaiNal One workflow updated record:",
    {
      table,
      recordId,
      field,
      value,
    }
  );

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
  workflowRun,
  workflowStep,
}) {
  const config =
    getStepConfig(
      workflowStep
    );

  /*
   * Real notification storage/delivery
   * comes in the next milestone.
   */
  console.log(
    "SaiNal One notification action:",
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
      "Notification",

    message:
      "Notification step completed in simulation mode.",
  };
}

// =========================================================
// EMAIL
// =========================================================

async function executeEmail({
  workflowRun,
  workflowStep,
}) {
  const config =
    getStepConfig(
      workflowStep
    );

  /*
   * Real Resend delivery comes later.
   */
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
