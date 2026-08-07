import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  deleteQuote,
  loadQuoteById,
  submitQuoteForApproval,
  updateQuote,
} from "../../../../lib/quotes/quoteEngine";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

// =========================================================
// GET ONE QUOTE
// =========================================================

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
            "A valid quote ID is required.",
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

    const quote =
      await loadQuoteById({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        quoteId:
          id,
      });

    if (!quote) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      quote
    );
  } catch (error) {
    console.error(
      "Quote GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load quote.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// UPDATE QUOTE
// =========================================================

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
            "A valid quote ID is required.",
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

    const body =
      await request.json();

    const quote =
      await updateQuote({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        quoteId:
          id,

        input:
          body,
      });

    if (!quote) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      quote,

      message:
        "Quote updated successfully.",
    });
  } catch (error) {
    console.error(
      "Quote PATCH error:",
      error
    );

    const message =
      error.message ||
      "Unable to update quote.";

    const businessError =
      [
        "invalid",
        "uuid",
        "pending approval",
        "cannot",
      ].some((word) =>
        message
          .toLowerCase()
          .includes(word)
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

// =========================================================
// QUOTE ACTION
// =========================================================
//
// POST /api/quotes/:id
//
// {
//   "action": "submit_for_approval"
// }
//
// =========================================================

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
            "A valid quote ID is required.",
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

    const action =
      String(
        body.action || ""
      )
        .trim()
        .toLowerCase();

    if (
      action !==
      "submit_for_approval"
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported quote action.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await submitQuoteForApproval({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        userId:
          access.user.id,

        employee:
          access.employee,

        quoteId:
          id,
      });

    return NextResponse.json({
      ...result,

      message:
        "Quote submitted for approval successfully.",
    });
  } catch (error) {
    console.error(
      "Quote action POST error:",
      error
    );

    const message =
      error.message ||
      "Unable to submit quote for approval.";

    const businessError =
      [
        "already",
        "not found",
        "cannot",
        "workflow",
        "approval",
      ].some((word) =>
        message
          .toLowerCase()
          .includes(word)
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

// =========================================================
// DELETE QUOTE
// =========================================================

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
            "A valid quote ID is required.",
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

    const deleted =
      await deleteQuote({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        quoteId:
          id,
      });

    if (!deleted) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      message:
        "Quote deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Quote DELETE error:",
      error
    );

    const message =
      error.message ||
      "Unable to delete quote.";

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          message
            .toLowerCase()
            .includes(
              "pending approval"
            )
            ? 400
            : 500,
      }
    );
  }
}
