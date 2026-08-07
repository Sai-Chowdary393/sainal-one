import {
  NextResponse,
} from "next/server";

import {
  canManageWorkflows,
  getServerAccess,
} from "../../../../../lib/serverAccess";

import {
  processApprovalDecision,
} from "../../../../../lib/workflow-runtime/approvalEngine";

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
            "A valid approval ID is required.",
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

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const result =
      await processApprovalDecision({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        currentEmployeeId:
          access.employee.id,

        stepRunId:
          id,

        decision:
          body.decision,

        comment:
          body.comment ||
          "",

        delegatedTo:
          body.delegated_to ||
          null,

        /*
         * Organisation owners / workflow
         * administrators can process an
         * unassigned test approval.
         */
        allowOverride:
          canManageWorkflows(
            access
          ),
      });

    const messages = {
      Approved:
        "Approval completed and workflow resumed successfully.",

      Rejected:
        "Approval rejected and workflow stopped.",

      RequestChanges:
        "Changes requested. The workflow is now waiting for revision.",

      Delegated:
        "Approval delegated successfully.",
    };

    return NextResponse.json({
      ...result,

      message:
        messages[
          result.action
        ] ||
        "Approval updated successfully.",
    });
  } catch (error) {
    console.error(
      "Approval decision POST error:",
      error
    );

    const message =
      error.message ||
      "Unable to process approval.";

    const lower =
      message.toLowerCase();

    const businessError =
      [
        "already",
        "assigned",
        "approval",
        "employee",
        "decision",
        "cannot",
        "not found",
      ].some(
        (value) =>
          lower.includes(
            value
          )
      );

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          businessError
            ? 400
            : 500,
      }
    );
  }
}
