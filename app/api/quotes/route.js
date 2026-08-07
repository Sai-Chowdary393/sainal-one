import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  createQuote,
  loadQuotes,
} from "../../../lib/quotes/quoteEngine";

// =========================================================
// GET ALL QUOTES
// =========================================================

export async function GET() {
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

    const quotes =
      await loadQuotes({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,
      });

    /*
     * Keep returning the array directly
     * so your existing Quotes UI is less
     * likely to break.
     */
    return NextResponse.json(
      quotes
    );
  } catch (error) {
    console.error(
      "Quotes GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load quotes.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// CREATE QUOTE
// =========================================================

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

    const quote =
      await createQuote({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        input:
          body,
      });

    /*
     * Your old endpoint returned an array
     * after insert().select().
     *
     * Keep the same response shape for now
     * to avoid breaking the current UI.
     */
    return NextResponse.json(
      [quote],
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Quotes POST error:",
      error
    );

    const message =
      error.message ||
      "Unable to create quote.";

    const validationError =
      [
        "invalid",
        "required",
        "uuid",
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
          validationError
            ? 400
            : 500,
      }
    );
  }
}
