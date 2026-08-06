import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

async function getCurrentEmployee(supabase) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      employee: null,
      error: "You must be logged in.",
      status: 401,
    };
  }

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
        full_name,
        email,
        is_organization_owner,
        is_active
      `
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (employeeError) {
    return {
      employee: null,
      error: employeeError.message,
      status: 500,
    };
  }

  if (!employee) {
    return {
      employee: null,
      error:
        "Your login is not linked to an active employee record.",
      status: 403,
    };
  }

  return {
    employee,
    error: null,
    status: 200,
  };
}

export async function GET() {
  try {
    const supabase =
      await createServerSupabaseClient();

    const current =
      await getCurrentEmployee(supabase);

    if (!current.employee) {
      return NextResponse.json(
        {
          error: current.error,
        },
        {
          status: current.status,
        }
      );
    }

    const organizationId =
      current.employee.organization_id;

    const [
      rolesResult,
      permissionsResult,
      rolePermissionsResult,
      userRolesResult,
      employeesResult,
    ] = await Promise.all([
      supabase
        .from("roles")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .order("is_system_role", {
          ascending: false,
        })
        .order("name", {
          ascending: true,
        }),

      supabase
        .from("permissions")
        .select("*")
        .eq("is_active", true)
        .order("module", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        }),

      supabase
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
        ),

      supabase
        .from("user_roles")
        .select(
          `
            id,
            organization_id,
            employee_id,
            role_id,
            assigned_at
          `
        )
        .eq(
          "organization_id",
          organizationId
        ),

      supabase
        .from("employees")
        .select(
          `
            id,
            employee_number,
            full_name,
            email,
            job_title,
            employment_status,
            is_active
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order("full_name", {
          ascending: true,
        }),
    ]);

    if (rolesResult.error) {
      return NextResponse.json(
        {
          error: rolesResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (permissionsResult.error) {
      return NextResponse.json(
        {
          error:
            permissionsResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (rolePermissionsResult.error) {
      return NextResponse.json(
        {
          error:
            rolePermissionsResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (userRolesResult.error) {
      return NextResponse.json(
        {
          error:
            userRolesResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (employeesResult.error) {
      return NextResponse.json(
        {
          error:
            employeesResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    const roles = Array.isArray(
      rolesResult.data
    )
      ? rolesResult.data
      : [];

    const permissions = Array.isArray(
      permissionsResult.data
    )
      ? permissionsResult.data
      : [];

    const rolePermissions =
      Array.isArray(
        rolePermissionsResult.data
      )
        ? rolePermissionsResult.data
        : [];

    const userRoles = Array.isArray(
      userRolesResult.data
    )
      ? userRolesResult.data
      : [];

    const employees = Array.isArray(
      employeesResult.data
    )
      ? employeesResult.data
      : [];

    const permissionMap = new Map(
      permissions.map((permission) => [
        permission.id,
        permission,
      ])
    );

    const employeeMap = new Map(
      employees.map((employee) => [
        employee.id,
        employee,
      ])
    );

    const permissionsByRole = new Map();

    rolePermissions.forEach(
      (assignment) => {
        const permission =
          permissionMap.get(
            assignment.permission_id
          ) || null;

        if (!permission) {
          return;
        }

        const currentPermissions =
          permissionsByRole.get(
            assignment.role_id
          ) || [];

        currentPermissions.push({
          assignment_id:
            assignment.id,

          ...permission,
        });

        permissionsByRole.set(
          assignment.role_id,
          currentPermissions
        );
      }
    );

    const employeesByRole = new Map();

    userRoles.forEach((assignment) => {
      const employee =
        employeeMap.get(
          assignment.employee_id
        ) || null;

      if (!employee) {
        return;
      }

      const currentEmployees =
        employeesByRole.get(
          assignment.role_id
        ) || [];

      currentEmployees.push({
        assignment_id:
          assignment.id,

        ...employee,
      });

      employeesByRole.set(
        assignment.role_id,
        currentEmployees
      );
    });

    const formattedRoles = roles.map(
      (role) => {
        const assignedPermissions =
          permissionsByRole.get(
            role.id
          ) || [];

        const assignedEmployees =
          employeesByRole.get(role.id) ||
          [];

        return {
          ...role,

          permissions:
            assignedPermissions,

          permission_ids:
            assignedPermissions.map(
              (permission) =>
                permission.id
            ),

          employees:
            assignedEmployees,

          employee_count:
            assignedEmployees.length,

          permission_count:
            assignedPermissions.length,
        };
      }
    );

    return NextResponse.json({
      roles: formattedRoles,
      permissions,
      employees,
      currentEmployee:
        current.employee,
    });
  } catch (error) {
    console.error(
      "Roles GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load roles and permissions.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request) {
  try {
    const supabase =
      await createServerSupabaseClient();

    const current =
      await getCurrentEmployee(supabase);

    if (!current.employee) {
      return NextResponse.json(
        {
          error: current.error,
        },
        {
          status: current.status,
        }
      );
    }

    if (
      !current.employee
        .is_organization_owner
    ) {
      return NextResponse.json(
        {
          error:
            "Only the organisation owner can create roles.",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const name = cleanText(body.name);

    const code = cleanText(
      body.code
    ).toUpperCase();

    if (!name) {
      return NextResponse.json(
        {
          error: "Role name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          error: "Role code is required.",
        },
        {
          status: 400,
        }
      );
    }

    const organizationId =
      current.employee.organization_id;

    const permissionIds =
      Array.isArray(
        body.permission_ids
      )
        ? [
            ...new Set(
              body.permission_ids.filter(
                isUuid
              )
            ),
          ]
        : [];

    if (permissionIds.length > 0) {
      const {
        data: validPermissions,
        error: permissionsError,
      } = await supabase
        .from("permissions")
        .select("id")
        .eq("is_active", true)
        .in("id", permissionIds);

      if (permissionsError) {
        return NextResponse.json(
          {
            error:
              permissionsError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (
        (validPermissions || [])
          .length !==
        permissionIds.length
      ) {
        return NextResponse.json(
          {
            error:
              "One or more selected permissions are invalid.",
          },
          {
            status: 400,
          }
        );
      }
    }

    const {
      data: createdRole,
      error: roleError,
    } = await supabase
      .from("roles")
      .insert([
        {
          organization_id:
            organizationId,

          name,

          code,

          description:
            cleanNullableText(
              body.description
            ),

          is_system_role: false,

          is_active:
            body.is_active !== false,

          created_by:
            current.employee.user_id,

          updated_by:
            current.employee.user_id,
        },
      ])
      .select()
      .single();

    if (roleError) {
      return NextResponse.json(
        {
          error: roleError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (permissionIds.length > 0) {
      const assignments =
        permissionIds.map(
          (permissionId) => ({
            organization_id:
              organizationId,

            role_id: createdRole.id,

            permission_id:
              permissionId,

            granted_by:
              current.employee.user_id,
          })
        );

      const {
        error: assignmentsError,
      } = await supabase
        .from("role_permissions")
        .insert(assignments);

      if (assignmentsError) {
        await supabase
          .from("roles")
          .delete()
          .eq("id", createdRole.id)
          .eq(
            "organization_id",
            organizationId
          );

        return NextResponse.json(
          {
            error:
              "The role could not be assigned permissions: " +
              assignmentsError.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    return NextResponse.json(
      {
        role: createdRole,

        message:
          "Role created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Roles POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create role.",
      },
      {
        status: 500,
      }
    );
  }
}
