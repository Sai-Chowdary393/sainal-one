export async function executeWorkflowAction({
  supabase,
  organizationId,
  workflowRun,
  workflowStep,
}) {
  if (!workflowStep) {
    return;
  }

  const type = String(
    workflowStep.step_type || ""
  ).toLowerCase();

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
        workflowStep,
      });

    case "email":
      return executeEmail({
        workflowStep,
      });

    default:
      console.log(
        "Unknown workflow action:",
        workflowStep.step_type
      );

      return;
  }
}

async function executeUpdateRecord({
  supabase,
  workflowRun,
  workflowStep,
}) {
  const moduleName =
    workflowRun.record_type;

  const recordId =
    workflowRun.record_id;

  if (!recordId) {
    return;
  }

  let table = "";

  switch (
    String(moduleName).toLowerCase()
  ) {
    case "quote":
    case "quotes":
      table = "quotes";
      break;

    case "lead":
    case "leads":
      table = "leads";
      break;

    case "customer":
    case "customers":
      table = "customers";
      break;

    case "invoice":
    case "invoices":
      table = "invoices";
      break;

    default:
      console.log(
        "Unknown module:",
        moduleName
      );
      return;
  }

  const config =
    workflowStep.configuration || {};

  const field =
    config.field ||
    "status";

  const value =
    config.value ||
    "Approved";

  const update = {};

  update[field] = value;

  const { error } =
    await supabase
      .from(table)
      .update(update)
      .eq("id", recordId);

  if (error) {
    throw error;
  }

  console.log(
    "Record updated:",
    table,
    recordId
  );
}

async function executeNotification() {
  console.log(
    "Notification action executed."
  );
}

async function executeEmail() {
  console.log(
    "Email action executed."
  );
}
