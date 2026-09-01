import {
  NextResponse,
} from "next/server";

import {
  createServerSupabaseClient,
} from "../../../lib/supabaseServer";

export async function GET(
  request
) {
  const requestUrl =
    new URL(
      request.url
    );

  const code =
    requestUrl.searchParams.get(
      "code"
    );

  const next =
    requestUrl.searchParams.get(
      "next"
    ) ||
    "/reset-password";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?error=auth_callback_missing_code",
        requestUrl.origin
      )
    );
  }

  try {
    const supabase =
      await createServerSupabaseClient();

    const {
      error,
    } =
      await supabase.auth
        .exchangeCodeForSession(
          code
        );

    if (error) {
      console.error(
        "Auth callback exchange error:",
        error
      );

      return NextResponse.redirect(
        new URL(
          "/login?error=auth_callback_failed",
          requestUrl.origin
        )
      );
    }

    /*
     * Only allow an internal application path.
     * Prevents an external redirect being injected
     * through the next query parameter.
     */
    const safeNext =
      typeof next ===
        "string" &&
      next.startsWith("/") &&
      !next.startsWith("//")
        ? next
        : "/reset-password";

    return NextResponse.redirect(
      new URL(
        safeNext,
        requestUrl.origin
      )
    );
  } catch (error) {
    console.error(
      "Auth callback error:",
      error
    );

    return NextResponse.redirect(
      new URL(
        "/login?error=auth_callback_failed",
        requestUrl.origin
      )
    );
  }
}
