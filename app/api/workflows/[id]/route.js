import { NextResponse } from "next/server";

import {
  canManageWorkflows,
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  archiveWorkflowDefinition,
  loadWorkflowById,
  updateWorkflowDefinition,
} from "../../../../lib/workflows/workflowEngine";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export async function GET(
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

    return NextResponse.json({
      workflow,

      currentEmployee:
        access.employee,

      canManage:
        canManageWorkflows(
          access
        ),
    });
  } catch (error) {
    console.error(
      "Workflow GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load workflow.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
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

    if (
      !canManageWorkflows(
        access
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to update workflows.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const workflow =
      await updateWorkflowDefinition({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        workflowId: id,

        userId:
          access.user.id,

        input: body,
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

    return NextResponse.json({
      workflow,

      message:
        "Workflow updated successfully.",
    });
  } catch (error) {
    console.error(
      "Workflow PATCH error:",
      error
    );

    const isValidationError =
      [
        "required",
        "invalid",
        "must",
        "contain",
        "unique",
        "cannot",
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
          "Failed to update workflow.",
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

export async function DELETE(
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

    if (
      !canManageWorkflows(
        access
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to archive workflows.",
        },
        {
          status: 403,
        }
      );
    }

    const archived =
      await archiveWorkflowDefinition({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        workflowId: id,

        userId:
          access.user.id,
      });

    if (!archived) {
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

    return NextResponse.json({
      message:
        "Workflow archived successfully.",
    });
  } catch (error) {
    console.error(
      "Workflow DELETE error:",
      error
    );

    const isBusinessError =
      String(
        error.message || ""
      )
        .toLowerCase()
        .includes("cannot");

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to archive workflow.",
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
