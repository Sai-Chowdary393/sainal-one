import {
  NextResponse,
} from "next/server";

import {
  createServerSupabaseClient,
} from "../../../../lib/supabaseServer";

export async function POST() {
  try {
    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase.auth
        .getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Your invitation session could not be verified.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * Find the employee linked to this invited Auth user.
     */
    const {
      data:
        employee,
      error:
        employeeError,
    } = await supabase
      .from("employees")
      .select(
        `
          id,
          organization_id,
          user_id,
          email,
          employment_status,
          is_active
        `
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (
      employeeError
    ) {
      return NextResponse.json(
        {
          error:
            employeeError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !employee
    ) {
      return NextResponse.json(
        {
          error:
            "Your login is not linked to a SaiNal One employee.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      !employee.is_active
    ) {
      return NextResponse.json(
        {
          error:
            "This employee account is currently inactive.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Only transition Invited employees.
     * Calling this route again is harmless.
     */
    if (
      employee
        .employment_status ===
      "Invited"
    ) {
      const {
        error:
          updateError,
      } = await supabase
        .from("employees")
        .update({
          employment_status:
            "Active",

          updated_by:
            user.id,
        })
        .eq(
          "id",
          employee.id
        )
        .eq(
          "user_id",
          user.id
        );

      if (
        updateError
      ) {
        return NextResponse.json(
          {
            error:
              updateError.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    return NextResponse.json({
      success: true,

      message:
        "Employee onboarding completed successfully.",
    });
  } catch (error) {
    console.error(
      "Complete invite error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to complete employee onboarding.",
      },
      {
        status: 500,
      }
    );
  }
}
