import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  emitWorkflowEvent,
} from "../../../../lib/workflow-runtime/engine";

function cleanText(value) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

export async function POST(
  request
) {
  try {
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

    const body =
      await request.json();

    const module =
      cleanText(
        body.module
      );

    const eventName =
      cleanText(
        body.event_name ||
          body.trigger_event
      );

    const recordType =
      cleanText(
        body.record_type
      );

    if (!module) {
      return NextResponse.json(
        {
          error:
            "Module is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!eventName) {
      return NextResponse.json(
        {
          error:
            "Event name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!recordType) {
      return NextResponse.json(
        {
          error:
            "Record type is required.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await emitWorkflowEvent({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        userId:
          access.user.id,

        module,

        eventName,

        recordType,

        recordId:
          body.record_id ||
          null,

        payload:
          body.payload &&
          typeof body.payload ===
            "object"
            ? body.payload
            : {},
      });

    return NextResponse.json(
      {
        ...result,

        message:
          result.workflow_count >
          0
            ? `${result.workflow_count} workflow execution(s) started.`
            : "Event processed. No active workflow matched this event.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Workflow start POST error:",
      error
    );

    const message =
      error.message ||
      "Failed to start workflow.";

    const isValidationError =
      [
        "required",
        "valid uuid",
        "not active",
      ].some((text) =>
        message
          .toLowerCase()
          .includes(text)
      );

    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          isValidationError
            ? 400
            : 500,
      }
    );
  }
}
