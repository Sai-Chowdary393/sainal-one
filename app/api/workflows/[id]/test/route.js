import { NextResponse } from "next/server";

import {
  getServerAccess,
} from "../../../../../lib/serverAccess";

import {
  loadWorkflowById,
} from "../../../../../lib/workflows/workflowEngine";

import {
  startWorkflowRun,
} from "../../../../../lib/workflow-runtime/runner";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function now() {
  return new Date().toISOString();
}

export async function POST(
  request,
  context
) {
  let workflowEvent = null;
  let access = null;

  try {
    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid workflow ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    access =
      await getServerAccess();

    if (!access.employee) {
      return NextResponse.json(
        {
          error: access.error,
        },
        {
          status: access.status,
        }
      );
    }

    const organizationId =
      access.employee.organization_id;

    const workflow =
      await loadWorkflowById({
        supabase:
          access.supabase,

        organizationId,

        workflowId: id,
      });

    if (!workflow) {
      return NextResponse.json(
        {
          error:
            "Workflow not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      workflow.status !==
        "Active" ||
      workflow.is_active !== true
    ) {
      return NextResponse.json(
        {
          error:
            "Only active workflows can be tested.",
        },
        {
          status: 400,
        }
      );
    }

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const suppliedPayload =
      body?.payload &&
      typeof body.payload ===
        "object" &&
      !Array.isArray(
        body.payload
      )
        ? body.payload
        : {};

    const testPayload = {
      ...suppliedPayload,

      __test_mode: true,

      __workflow_id:
        workflow.id,

      __workflow_code:
        workflow.code,

      __tested_at: now(),
    };

    /*
     * Create a workflow event specifically
     * for this test.
     *
     * IMPORTANT:
     * We intentionally start ONLY the workflow
     * being tested rather than every workflow
     * using the same trigger.
     */
    const {
      data: createdEvent,
      error: eventError,
    } = await access.supabase
      .from("workflow_events")
      .insert([
        {
          organization_id:
            organizationId,

          event_name:
            workflow.trigger_event,

          record_type:
            String(
              workflow.module ||
                "record"
            ).toLowerCase(),

          record_id: null,

          payload:
            testPayload,

          status:
            "Processing",

          error_message: null,

          created_by:
            access.user.id,
        },
      ])
      .select()
      .single();

    if (eventError) {
      throw new Error(
        `Unable to create workflow test event: ${eventError.message}`
      );
    }

    workflowEvent =
      createdEvent;

    const execution =
      await startWorkflowRun({
        supabase:
          access.supabase,

        organizationId,

        workflowId:
          workflow.id,

        workflowEventId:
          workflowEvent.id,

        recordType:
          String(
            workflow.module ||
              "record"
          ).toLowerCase(),

        recordId: null,

        triggerEvent:
          workflow.trigger_event,

        inputPayload:
          testPayload,

        initiatedBy:
          access.user.id,
      });

    const {
      error: eventUpdateError,
    } = await access.supabase
      .from("workflow_events")
      .update({
        status:
          "Processed",

        error_message:
          null,

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
      console.error(
        "Workflow test event update error:",
        eventUpdateError
      );
    }

    const result =
      execution?.result ||
      {};

    const waiting =
      result.state ===
      "Waiting";

    return NextResponse.json(
      {
        workflow: {
          id:
            workflow.id,

          name:
            workflow.name,

          code:
            workflow.code,

          module:
            workflow.module,

          trigger_event:
            workflow.trigger_event,

          version:
            workflow.version,
        },

        event: {
          ...workflowEvent,

          status:
            "Processed",

          processed_at:
            now(),
        },

        workflow_run:
          execution.workflowRun ||
          null,

        execution: {
          success: true,

          result,
        },

        message:
          waiting
            ? `Workflow test started successfully and is waiting at "${result.stepName || "an approval step"}".`
            : "Workflow test completed successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Workflow test POST error:",
      error
    );

    if (
      workflowEvent &&
      access?.employee
    ) {
      try {
        await access.supabase
          .from(
            "workflow_events"
          )
          .update({
            status: "Failed",

            error_message:
              error.message ||
              "Workflow test failed.",

            processed_at:
              now(),
          })
          .eq(
            "id",
            workflowEvent.id
          )
          .eq(
            "organization_id",
            access.employee
              .organization_id
          );
      } catch (
        eventUpdateError
      ) {
        console.error(
          "Unable to mark workflow test event as failed:",
          eventUpdateError
        );
      }
    }

    const message =
      error.message ||
      "Unable to test workflow.";

    const lowerMessage =
      message.toLowerCase();

    const isBusinessError =
      lowerMessage.includes(
        "not active"
      ) ||
      lowerMessage.includes(
        "required"
      ) ||
      lowerMessage.includes(
        "valid workflow"
      );

    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          isBusinessError
            ? 400
            : 500,
      }
    );
  }
}
