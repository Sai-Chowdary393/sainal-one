import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
} from "../../../lib/supabaseServer";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

// =========================================================
// GET CURRENT SIGNED-IN EMPLOYEE
// =========================================================

export async function GET() {
  try {
    // =====================================================
    // AUTH USER
    // =====================================================

    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "You must be logged in.",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // SERVER ADMIN CLIENT
    // =====================================================

    const adminSupabase =
      createAdminSupabaseClient();

    // =====================================================
    // EMPLOYEE
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
            employee_number,
            full_name,
            email,
            job_title,
            employment_type,
            employment_status,
            is_organization_owner,
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
      console.error(
        "Current employee lookup error:",
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

    // =====================================================
    // AUTH USER WITHOUT EMPLOYEE
    // =====================================================

    if (
      !employee
    ) {
      return NextResponse.json({
        user: {
          id:
            user.id,

          email:
            user.email ||
            "",

          full_name:
            user.user_metadata
              ?.full_name ||
            user.email
              ?.split("@")[0] ||
            "SaiNal One User",
        },

        employee: null,

        roles: [],

        primaryRole: null,

        displayRole:
          "SaiNal One User",
      });
    }

    // =====================================================
    // ROLE ASSIGNMENTS
    // =====================================================

    const {
      data:
        assignments,
      error:
        assignmentsError,
    } =
      await adminSupabase
        .from("user_roles")
        .select(
          `
            id,
            role_id,
            assigned_at
          `
        )
        .eq(
          "organization_id",
          employee.organization_id
        )
        .eq(
          "employee_id",
          employee.id
        )
        .order(
          "assigned_at",
          {
            ascending: true,
          }
        );

    if (
      assignmentsError
    ) {
      console.error(
        "Current employee roles lookup error:",
        assignmentsError
      );

      return NextResponse.json(
        {
          error:
            assignmentsError.message,
        },
        {
          status: 500,
        }
      );
    }

    const roleIds = [
      ...new Set(
        (
          assignments ||
          []
        )
          .map(
            (
              assignment
            ) =>
              assignment.role_id
          )
          .filter(Boolean)
      ),
    ];

    // =====================================================
    // ROLES
    // =====================================================

    let roles = [];

    if (
      roleIds.length >
      0
    ) {
      const {
        data:
          roleRows,
        error:
          rolesError,
      } =
        await adminSupabase
          .from("roles")
          .select(
            `
              id,
              name,
              code,
              description,
              is_system_role,
              is_active
            `
          )
          .eq(
            "organization_id",
            employee.organization_id
          )
          .eq(
            "is_active",
            true
          )
          .in(
            "id",
            roleIds
          );

      if (
        rolesError
      ) {
        console.error(
          "Current employee role details error:",
          rolesError
        );

        return NextResponse.json(
          {
            error:
              rolesError.message,
          },
          {
            status: 500,
          }
        );
      }

      const roleMap =
        new Map(
          (
            roleRows ||
            []
          ).map(
            (
              role
            ) => [
              role.id,
              role,
            ]
          )
        );

      /*
       * Preserve assignment order.
       */
      roles =
        roleIds
          .map(
            (
              roleId
            ) =>
              roleMap.get(
                roleId
              )
          )
          .filter(Boolean);
    }

    // =====================================================
    // PRIMARY / DISPLAY ROLE
    // =====================================================

    /*
     * Organisation Owner always displays as Owner.
     */
    let primaryRole =
      null;

    let displayRole =
      "Employee";

    if (
      employee
        .is_organization_owner
    ) {
      primaryRole =
        roles.find(
          (
            role
          ) =>
            role.code ===
            "ORG_OWNER"
        ) ||
        roles[0] ||
        null;

      displayRole =
        "Owner";
    } else if (
      roles.length >
      0
    ) {
      primaryRole =
        roles[0];

      displayRole =
        primaryRole.name;
    } else if (
      employee.job_title
    ) {
      /*
       * This is only a display fallback.
       * Job title does NOT grant permissions.
       */
      displayRole =
        employee.job_title;
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      user: {
        id:
          user.id,

        email:
          user.email ||
          employee.email ||
          "",

        full_name:
          employee.full_name ||
          user.user_metadata
            ?.full_name ||
          "SaiNal One User",
      },

      employee,

      roles,

      primaryRole,

      displayRole,
    });
  } catch (
    error
  ) {
    console.error(
      "Current user profile error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load the current user profile.",
      },
      {
        status: 500,
      }
    );
  }
}
