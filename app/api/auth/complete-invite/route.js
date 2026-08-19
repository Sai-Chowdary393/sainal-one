import {
  NextResponse,
} from "next/server";

import {
  createServerSupabaseClient,
} from "../../../../lib/supabaseServer";

import {
  createAdminSupabaseClient,
} from "../../../../lib/supabaseAdmin";

// =========================================================
// COMPLETE EMPLOYEE INVITATION
// =========================================================

export async function POST() {
  try {
    /*
     * Normal authenticated client.
     *
     * We use this only to securely establish who is
     * currently logged in.
     */
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

    // =====================================================
    // ADMIN CLIENT
    // =====================================================

    /*
     * The employee must not need permission to modify
     * their own employment status.
     *
     * The server verifies their Auth identity first,
     * then performs this controlled update using the
     * admin Supabase client.
     */
    const adminSupabase =
      createAdminSupabaseClient();

    // =====================================================
    // FIND EMPLOYEE LINKED TO AUTH USER
    // =====================================================

    const {
      data:
        employee,
      error:
        employeeError,
    } =
      await adminSupabase
        .from("employees")
        .select(
          `
            id,
            organization_id,
            user_id,
            full_name,
            email,
            employment_status,
            is_active,
            is_organization_owner
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
      console.error(
        "Complete invite employee lookup error:",
        employeeError
      );

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

    // =====================================================
    // SAFETY CHECKS
    // =====================================================

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
     * Organisation Owner accounts must never pass
     * through employee invitation onboarding.
     */
    if (
      employee
        .is_organization_owner
    ) {
      return NextResponse.json(
        {
          error:
            "The organisation owner account cannot complete employee invitation onboarding.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Double-check Auth email matches employee email.
     */
    const authEmail =
      String(
        user.email || ""
      )
        .trim()
        .toLowerCase();

    const employeeEmail =
      String(
        employee.email || ""
      )
        .trim()
        .toLowerCase();

    if (
      !authEmail ||
      !employeeEmail ||
      authEmail !==
        employeeEmail
    ) {
      return NextResponse.json(
        {
          error:
            "The authenticated email does not match the employee record.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // ALREADY COMPLETED
    // =====================================================

    /*
     * Make the endpoint idempotent.
     *
     * If onboarding has already completed, calling the
     * endpoint again simply returns success.
     */
    if (
      employee
        .employment_status ===
      "Active"
    ) {
      return NextResponse.json({
        success: true,

        alreadyCompleted:
          true,

        employee: {
          id:
            employee.id,

          employment_status:
            employee
              .employment_status,
        },

        message:
          "Employee onboarding has already been completed.",
      });
    }

    // =====================================================
    // MUST STILL BE INVITED
    // =====================================================

    if (
      employee
        .employment_status !==
      "Invited"
    ) {
      return NextResponse.json(
        {
          error:
            `This employee cannot complete invitation onboarding while their status is "${employee.employment_status}".`,
        },
        {
          status: 409,
        }
      );
    }

    // =====================================================
    // INVITED -> ACTIVE
    // =====================================================

    const {
      data:
        updatedEmployee,
      error:
        updateError,
    } =
      await adminSupabase
        .from("employees")
        .update({
          employment_status:
            "Active",

          /*
           * Keep account enabled.
           */
          is_active:
            true,

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
        )
        .eq(
          "employment_status",
          "Invited"
        )
        .select(
          `
            id,
            full_name,
            email,
            employment_status,
            is_active
          `
        )
        .single();

    if (
      updateError
    ) {
      console.error(
        "Complete invite employee update error:",
        updateError
      );

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

    if (
      !updatedEmployee
    ) {
      return NextResponse.json(
        {
          error:
            "The employee account could not be activated.",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({
      success: true,

      employee:
        updatedEmployee,

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
