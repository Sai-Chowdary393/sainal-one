import { NextResponse } from "next/server";

import {
  canManageWorkflows,
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  createWorkflowDefinition,
  loadWorkflowWorkspace,
} from "../../../lib/workflows/workflowEngine";

export async function GET() {
  try {
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

    const workspace =
      await loadWorkflowWorkspace({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,
      });

    return NextResponse.json({
      ...workspace,

      currentEmployee:
        access.employee,

      canManage:
        canManageWorkflows(
          access
        ),
    });
  } catch (error) {
    console.error(
      "Workflows GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load workflows.",
      },
      {
        status: 500,
      }
    );
  }
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
          error: access.error,
        },
        {
          status: access.status,
        }
      );
    }

    if (
      !canManageWorkflows(
        access
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to create workflows.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const workflow =
      await createWorkflowDefinition({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        userId:
          access.user.id,

        input: body,
      });

    return NextResponse.json(
      {
        workflow,

        message:
          "Workflow created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Workflows POST error:",
      error
    );

    const isValidationError =
      [
        "required",
        "invalid",
        "must",
        "contain",
        "unique",
      ].some((word) =>
        String(
          error.message || ""
        )
          .toLowerCase()
          .includes(word)
      );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create workflow.",
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
