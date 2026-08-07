import { NextResponse } from "next/server";

import {
  getServerAccess,
} from "../../../../../lib/serverAccess";

import {
  loadWorkflowById,
} from "../../../../../lib/workflows/workflowEngine";

import {
  emitWorkflowEvent,
} from "../../../../../lib/workflow-runtime/engine";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export async function POST(
  request,
  context
) {
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

    const access =
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

    const workflow =
      await loadWorkflowById({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

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

    const body =
      await request.json();

    const payload =
      body.payload &&
      typeof body.payload ===
        "object"
        ? body.payload
        : {};

    /*
     * During a test we don't need a real
     * quote/customer/project record yet.
     *
     * record_id remains null.
     */
    const result =
      await emitWorkflowEvent({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        userId:
          access.user.id,

        module:
          workflow.module,

        eventName:
          workflow.trigger_event,

        recordType:
          String(
            workflow.module ||
              "record"
          ).toLowerCase(),

        recordId: null,

        payload: {
          ...payload,

          __test_mode: true,

          __workflow_id:
            workflow.id,

          __workflow_code:
            workflow.code,
        },
      });

    const execution =
      result.executions?.find(
        (item) =>
          item.workflow_id ===
          workflow.id
      );

    return NextResponse.json(
      {
        workflow: {
          id: workflow.id,
          name:
            workflow.name,
          code:
            workflow.code,
          module:
            workflow.module,
          trigger_event:
            workflow.trigger_event,
        },

        event:
          result.event,

        execution:
          execution || null,

        message:
          execution?.success
            ? execution.result
                ?.state ===
              "Waiting"
              ? `Workflow test started successfully and is waiting at "${execution.result.stepName}".`
              : "Workflow test completed successfully."
            : "Workflow test event was processed.",
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

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to test workflow.",
      },
      {
        status: 500,
      }
    );
  }
}
