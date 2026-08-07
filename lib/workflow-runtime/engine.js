// =========================================================
// SAINAL ONE
// WORKFLOW RUNTIME - EVENT ENGINE
// =========================================================
//
// Public entry point for business events.
//
// Example:
//
// Quote module emits:
//
// module: "Quotes"
// eventName: "quote_submitted"
// recordType: "quote"
// recordId: <uuid>
//
// Engine:
//
// 1. Creates workflow_event.
// 2. Finds matching active workflows.
// 3. Creates workflow_runs.
// 4. Starts each workflow.
// 5. Updates workflow_event.
// =========================================================

import {
  findActiveWorkflowsForEvent,
} from "../workflows/workflowEngine";

import {
  startWorkflowRun,
} from "./runner";

function cleanText(value) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function now() {
  return new Date().toISOString();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export async function emitWorkflowEvent({
  supabase,
  organizationId,
  userId = null,

  module,
  eventName,
  recordType,
  recordId = null,
  payload = {},
}) {
  const cleanModule =
    cleanText(module);

  const cleanEventName =
    cleanText(eventName)
      .toLowerCase();

  const cleanRecordType =
    cleanText(recordType);

  if (!cleanModule) {
    throw new Error(
      "Workflow module is required."
    );
  }

  if (!cleanEventName) {
    throw new Error(
      "Workflow event name is required."
    );
  }

  if (!cleanRecordType) {
    throw new Error(
      "Workflow record type is required."
    );
  }

  if (
    recordId &&
    !isUuid(recordId)
  ) {
    throw new Error(
      "Workflow record ID must be a valid UUID."
    );
  }

  // =======================================================
  // CREATE EVENT
  // =======================================================

  const {
    data: workflowEvent,
    error: eventError,
  } = await supabase
    .from("workflow_events")
    .insert([
      {
        organization_id:
          organizationId,

        event_name:
          cleanEventName,

        record_type:
          cleanRecordType,

        record_id:
          recordId || null,

        payload:
          payload || {},

        status:
          "Processing",

        error_message:
          null,

        created_by:
          userId,
      },
    ])
    .select()
    .single();

  if (eventError) {
    throw new Error(
      `Unable to create workflow event: ${eventError.message}`
    );
  }

  try {
    // =====================================================
    // FIND WORKFLOWS
    // =====================================================

    const workflows =
      await findActiveWorkflowsForEvent({
        supabase,
        organizationId,

        module:
          cleanModule,

        triggerEvent:
          cleanEventName,
      });

    const executions = [];

    // =====================================================
    // START WORKFLOWS
    // =====================================================

    for (
      const workflow of
      workflows
    ) {
      try {
        const execution =
          await startWorkflowRun({
            supabase,
            organizationId,

            workflowId:
              workflow.id,

            workflowEventId:
              workflowEvent.id,

            recordType:
              cleanRecordType,

            recordId:
              recordId || null,

            triggerEvent:
              cleanEventName,

            inputPayload:
              payload || {},

            initiatedBy:
              userId,
          });

        executions.push({
          workflow_id:
            workflow.id,

          workflow_name:
            workflow.name,

          success: true,

          workflow_run_id:
            execution
              .workflowRun
              ?.id,

          result:
            execution.result,
        });
      } catch (
        workflowError
      ) {
        console.error(
          `Workflow "${workflow.name}" failed:`,
          workflowError
        );

        executions.push({
          workflow_id:
            workflow.id,

          workflow_name:
            workflow.name,

          success: false,

          error:
            workflowError.message,
        });
      }
    }

    const failedExecutions =
      executions.filter(
        (execution) =>
          !execution.success
      );

    const eventStatus =
      failedExecutions.length >
      0
        ? "CompletedWithErrors"
        : "Processed";

    const eventErrorMessage =
      failedExecutions.length >
      0
        ? failedExecutions
            .map(
              (execution) =>
                execution.error
            )
            .join(" | ")
        : null;

    const {
      error: eventUpdateError,
    } = await supabase
      .from("workflow_events")
      .update({
        status:
          eventStatus,

        error_message:
          eventErrorMessage,

        processed_at:
          now(),
      })
      .eq(
        "id",
        workflowEvent.id
      )
      .eq(
        "organization_id",
        organizationId
      );

    if (eventUpdateError) {
      throw new Error(
        `Workflow event finished, but its status could not be updated: ${eventUpdateError.message}`
      );
    }

    return {
      event: {
        ...workflowEvent,

        status:
          eventStatus,

        processed_at:
          now(),
      },

      workflow_count:
        workflows.length,

      executions,
    };
  } catch (error) {
    await supabase
      .from("workflow_events")
      .update({
        status: "Failed",

        error_message:
          error.message ||
          "Workflow event processing failed.",

        processed_at:
          now(),
      })
      .eq(
        "id",
        workflowEvent.id
      )
      .eq(
        "organization_id",
        organizationId
      );

    throw error;
  }
}
