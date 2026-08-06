import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";

async function getAuthenticatedUser(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error:
        error?.message ||
        "You must be logged in.",
      status: 401,
    };
  }

  return {
    user,
    error: null,
    status: 200,
  };
}

export async function GET() {
  try {
    const supabase =
      await createServerSupabaseClient();

    /*
     * 1. Confirm the Supabase Auth session.
     */
    const authentication =
      await getAuthenticatedUser(
        supabase
      );

    if (!authentication.user) {
      return NextResponse.json(
        {
          error:
            authentication.error,
        },
        {
          status:
            authentication.status,
        }
      );
    }

    const authUser =
      authentication.user;

    /*
     * 2. Load the active employee record linked
     * to the current Auth user.
     */
    const {
      data: employee,
      error: employeeError,
    } = await supabase
      .from("employees")
      .select(
        `
          id,
          organization_id,
          user_id,
          employee_number,
          full_name,
          email,
          phone,
          job_title,
          department_id,
          manager_id,
          backup_employee_id,
          employment_type,
          employment_status,
          availability_status,
          start_date,
          end_date,
          profile_image_url,
          timezone,
          locale,
          is_organization_owner,
          is_active,
          created_at,
          updated_at
        `
      )
      .eq("user_id", authUser.id)
      .eq("is_active", true)
      .maybeSingle();

    if (employeeError) {
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

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "Your login is not linked to an active employee record.",
        },
        {
          status: 403,
        }
      );
    }

    const organizationId =
      employee.organization_id;

    /*
     * 3. Load the employee's organisation.
     */
    const {
      data: organization,
      error: organizationError,
    } = await supabase
      .from("organizations")
      .select(
        `
          id,
          owner_id,
          company_name,
          subscription_plan,
          status,
          created_at
        `
      )
      .eq("id", organizationId)
      .maybeSingle();

    if (organizationError) {
      return NextResponse.json(
        {
          error:
            organizationError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!organization) {
      return NextResponse.json(
        {
          error:
            "The organisation linked to this employee could not be found.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * 4. Load supporting employee relationships.
     *
     * These queries are performed separately to avoid
     * Supabase schema-cache problems with nested and
     * self-referencing relationships.
     */
    const [
      departmentResult,
      managerResult,
      backupEmployeeResult,
    ] = await Promise.all([
      employee.department_id
        ? supabase
            .from("departments")
            .select(
              `
                id,
                name,
                code,
                description,
                status
              `
            )
            .eq(
              "id",
              employee.department_id
            )
            .eq(
              "organization_id",
              organizationId
            )
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),

      employee.manager_id
        ? supabase
            .from("employees")
            .select(
              `
                id,
                employee_number,
                full_name,
                email,
                job_title
              `
            )
            .eq(
              "id",
              employee.manager_id
            )
            .eq(
              "organization_id",
              organizationId
            )
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),

      employee.backup_employee_id
        ? supabase
            .from("employees")
            .select(
              `
                id,
                employee_number,
                full_name,
                email,
                job_title
              `
            )
            .eq(
              "id",
              employee.backup_employee_id
            )
            .eq(
              "organization_id",
              organizationId
            )
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),
    ]);

    if (departmentResult.error) {
      return NextResponse.json(
        {
          error:
            departmentResult.error
              .message,
        },
        {
          status: 500,
        }
      );
    }

    if (managerResult.error) {
      return NextResponse.json(
        {
          error:
            managerResult.error
              .message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      backupEmployeeResult.error
    ) {
      return NextResponse.json(
        {
          error:
            backupEmployeeResult
              .error.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * 5. Load all role assignments for this employee.
     */
    const {
      data: userRoleRows,
      error: userRolesError,
    } = await supabase
      .from("user_roles")
      .select(
        `
          id,
          organization_id,
          employee_id,
          role_id,
          assigned_by,
          assigned_at
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "employee_id",
        employee.id
      );

    if (userRolesError) {
      return NextResponse.json(
        {
          error:
            userRolesError.message,
        },
        {
          status: 500,
        }
      );
    }

    const userRoles =
      Array.isArray(userRoleRows)
        ? userRoleRows
        : [];

    const roleIds = [
      ...new Set(
        userRoles
          .map(
            (assignment) =>
              assignment.role_id
          )
          .filter(Boolean)
      ),
    ];

    /*
     * 6. Load the employee's active roles.
     */
    let roleRows = [];

    if (roleIds.length > 0) {
      const {
        data,
        error,
      } = await supabase
        .from("roles")
        .select(
          `
            id,
            organization_id,
            name,
            code,
            description,
            is_system_role,
            is_active,
            created_at,
            updated_at
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .eq("is_active", true)
        .in("id", roleIds)
        .order("name", {
          ascending: true,
        });

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          }
        );
      }

      roleRows = Array.isArray(data)
        ? data
        : [];
    }

    const roleMap = new Map(
      roleRows.map((role) => [
        role.id,
        role,
      ])
    );

    const roles = userRoles
      .map((assignment) => {
        const role = roleMap.get(
          assignment.role_id
        );

        if (!role) {
          return null;
        }

        return {
          ...role,

          assignment_id:
            assignment.id,

          assigned_by:
            assignment.assigned_by,

          assigned_at:
            assignment.assigned_at,
        };
      })
      .filter(Boolean);

    /*
     * 7. Load all permission assignments connected
     * to the employee's active roles.
     */
    let rolePermissionRows = [];

    if (roleIds.length > 0) {
      const {
        data,
        error,
      } = await supabase
        .from("role_permissions")
        .select(
          `
            id,
            organization_id,
            role_id,
            permission_id,
            granted_by,
            granted_at
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .in("role_id", roleIds);

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          }
        );
      }

      rolePermissionRows =
        Array.isArray(data)
          ? data
          : [];
    }

    const permissionIds = [
      ...new Set(
        rolePermissionRows
          .map(
            (assignment) =>
              assignment.permission_id
          )
          .filter(Boolean)
      ),
    ];

    /*
     * 8. Load the active permission records.
     */
    let permissionRows = [];

    if (
      permissionIds.length > 0
    ) {
      const {
        data,
        error,
      } = await supabase
        .from("permissions")
        .select(
          `
            id,
            permission_key,
            module,
            action,
            name,
            description,
            is_active
          `
        )
        .eq("is_active", true)
        .in("id", permissionIds)
        .order("module", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        });

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          }
        );
      }

      permissionRows =
        Array.isArray(data)
          ? data
          : [];
    }

    /*
     * The Organisation Owner is always treated as having
     * complete access. Load every active permission so the
     * frontend can display the complete permission set.
     */
    if (
      employee.is_organization_owner
    ) {
      const {
        data: allPermissions,
        error:
          allPermissionsError,
      } = await supabase
        .from("permissions")
        .select(
          `
            id,
            permission_key,
            module,
            action,
            name,
            description,
            is_active
          `
        )
        .eq("is_active", true)
        .order("module", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        });

      if (
        allPermissionsError
      ) {
        return NextResponse.json(
          {
            error:
              allPermissionsError
                .message,
          },
          {
            status: 500,
          }
        );
      }

      permissionRows =
        Array.isArray(
          allPermissions
        )
          ? allPermissions
          : [];
    }

    /*
     * 9. Remove duplicate permissions that could be granted
     * through more than one role.
     */
    const permissionMap =
      new Map();

    permissionRows.forEach(
      (permission) => {
        if (
          permission
            ?.permission_key
        ) {
          permissionMap.set(
            permission.permission_key,
            permission
          );
        }
      }
    );

    const permissions = [
      ...permissionMap.values(),
    ];

    const permissionKeys =
      permissions.map(
        (permission) =>
          permission.permission_key
      );

    /*
     * 10. Return one normalised access payload for the
     * AccessProvider and future permission guards.
     */
    return NextResponse.json({
      authenticated: true,

      authUser: {
        id: authUser.id,
        email:
          authUser.email || null,
      },

      employee: {
        ...employee,

        department:
          departmentResult.data ||
          null,

        manager:
          managerResult.data ||
          null,

        backup_employee:
          backupEmployeeResult.data ||
          null,
      },

      organization,

      roles,

      permissions,

      permissionKeys,

      access: {
        isOrganizationOwner:
          Boolean(
            employee
              .is_organization_owner
          ),

        roleCodes: roles.map(
          (role) => role.code
        ),

        permissionKeys,
      },
    });
  } catch (error) {
    console.error(
      "Access GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load account access.",
      },
      {
        status: 500,
      }
    );
  }
}
