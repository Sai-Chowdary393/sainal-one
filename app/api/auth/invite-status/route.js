import {
  NextResponse,
} from "next/server";

import {
  createServerSupabaseClient,
} from "../../../../lib/supabaseServer";

export async function GET() {
  try {
    const supabase =
      await createServerSupabaseClient();

    // =====================================================
    // AUTHENTICATED USER
    // =====================================================

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
          valid: false,

          error:
            "The employee invitation session could not be verified.",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // FIND EMPLOYEE
    // =====================================================

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
          user_id,
          full_name,
          email,
          employee_number,
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
      return NextResponse.json(
        {
          valid: false,

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
          valid: false,

          error:
            "This login is not linked to a SaiNal One employee.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // ACCOUNT MUST BE ENABLED
    // =====================================================

    if (
      !employee.is_active
    ) {
      return NextResponse.json(
        {
          valid: false,

          error:
            "This employee account has been deactivated.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // NEVER ALLOW OWNER ACCOUNT THROUGH INVITE SETUP
    // =====================================================

    if (
      employee
        .is_organization_owner
    ) {
      return NextResponse.json(
        {
          valid: false,

          error:
            "The organisation owner account cannot be configured through an employee invitation.",
        },
        {
          status: 403,
        }
      );
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
          valid: false,

          error:
            "This employee invitation has already been completed or is no longer active.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // AUTH EMAIL MUST MATCH EMPLOYEE EMAIL
    // =====================================================

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
          valid: false,

          error:
            "The invitation email does not match the employee account.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // VALID INVITATION
    // =====================================================

    return NextResponse.json(
      {
        valid: true,

        employee: {
          id:
            employee.id,

          full_name:
            employee.full_name,

          email:
            employee.email,

          employee_number:
            employee.employee_number,

          employment_status:
            employee.employment_status,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Invite status error:",
      error
    );

    return NextResponse.json(
      {
        valid: false,

        error:
          error.message ||
          "Unable to verify the employee invitation.",
      },
      {
        status: 500,
      }
    );
  }
}
