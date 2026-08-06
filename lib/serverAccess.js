import { createServerSupabaseClient } from "./supabaseServer";

function uniqueValues(values = []) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

/**
 * Loads the authenticated Supabase user and the active
 * employee record linked to that user.
 */
export async function getServerAccess() {
  const supabase =
    await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      employee: null,
      organization: null,
      roles: [],
      permissions: [],
      permissionKeys: [],
      error:
        userError?.message ||
        "You must be logged in.",
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
        employee_number,
        full_name,
        email,
        job_title,
        department_id,
        manager_id,
        backup_employee_id,
        employment_type,
        employment_status,
        availability_status,
        is_organization_owner,
        is_active
      `
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (employeeError) {
    return {
      supabase,
      user,
      employee: null,
      organization: null,
      roles: [],
      permissions: [],
      permissionKeys: [],
      error: employeeError.message,
      status: 500,
    };
  }

  if (!employee) {
    return {
      supabase,
      user,
      employee: null,
      organization: null,
      roles: [],
      permissions: [],
      permissionKeys: [],
      error:
        "Your login is not linked to an active employee record.",
      status: 403,
    };
  }

  const organizationId =
    employee.organization_id;

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
    return {
      supabase,
      user,
      employee,
      organization: null,
      roles: [],
      permissions: [],
      permissionKeys: [],
      error:
        organizationError.message,
      status: 500,
    };
  }

  if (!organization) {
    return {
      supabase,
      user,
      employee,
      organization: null,
      roles: [],
      permissions: [],
      permissionKeys: [],
      error:
        "The organisation linked to this employee could not be found.",
      status: 403,
    };
  }

  const {
    data: userRoleRows,
    error: userRolesError,
  } = await supabase
    .from("user_roles")
    .select(
      `
        id,
        employee_id,
        role_id,
        assigned_at
      `
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq("employee_id", employee.id);

  if (userRolesError) {
    return {
      supabase,
      user,
      employee,
      organization,
      roles: [],
      permissions: [],
      permissionKeys: [],
      error: userRolesError.message,
      status: 500,
    };
  }

  const roleIds = uniqueValues(
    (userRoleRows || []).map(
      (assignment) =>
        assignment.role_id
    )
  );

  let roles = [];

  if (roleIds.length > 0) {
    const {
      data: roleRows,
      error: rolesError,
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
          is_active
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq("is_active", true)
      .in("id", roleIds);

    if (rolesError) {
      return {
        supabase,
        user,
        employee,
        organization,
        roles: [],
        permissions: [],
        permissionKeys: [],
        error: rolesError.message,
        status: 500,
      };
    }

    roles = Array.isArray(roleRows)
      ? roleRows
      : [];
  }

  let permissions = [];

  if (
    employee.is_organization_owner
  ) {
    const {
      data: permissionRows,
      error: permissionsError,
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
      .eq("is_active", true);

    if (permissionsError) {
      return {
        supabase,
        user,
        employee,
        organization,
        roles,
        permissions: [],
        permissionKeys: [],
        error:
          permissionsError.message,
        status: 500,
      };
    }

    permissions = Array.isArray(
      permissionRows
    )
      ? permissionRows
      : [];
  } else if (roleIds.length > 0) {
    const {
      data: rolePermissionRows,
      error: rolePermissionsError,
    } = await supabase
      .from("role_permissions")
      .select(
        `
          role_id,
          permission_id
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .in("role_id", roleIds);

    if (rolePermissionsError) {
      return {
        supabase,
        user,
        employee,
        organization,
        roles,
        permissions: [],
        permissionKeys: [],
        error:
          rolePermissionsError.message,
        status: 500,
      };
    }

    const permissionIds =
      uniqueValues(
        (
          rolePermissionRows || []
        ).map(
          (assignment) =>
            assignment.permission_id
        )
      );

    if (
      permissionIds.length > 0
    ) {
      const {
        data: permissionRows,
        error:
          permissionsError,
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
        .in("id", permissionIds);

      if (permissionsError) {
        return {
          supabase,
          user,
          employee,
          organization,
          roles,
          permissions: [],
          permissionKeys: [],
          error:
            permissionsError.message,
          status: 500,
        };
      }

      permissions =
        Array.isArray(
          permissionRows
        )
          ? permissionRows
          : [];
    }
  }

  const permissionMap = new Map();

  permissions.forEach(
    (permission) => {
      if (
        permission?.permission_key
      ) {
        permissionMap.set(
          permission.permission_key,
          permission
        );
      }
    }
  );

  permissions = [
    ...permissionMap.values(),
  ];

  const permissionKeys =
    permissions.map(
      (permission) =>
        permission.permission_key
    );

  return {
    supabase,
    user,
    employee,
    organization,
    roles,
    permissions,
    permissionKeys,
    error: null,
    status: 200,
  };
}

/**
 * Returns true when the authenticated employee has the
 * requested permission.
 *
 * Organisation owners always receive full access.
 */
export function hasServerPermission(
  access,
  permissionKey
) {
  if (!permissionKey) {
    return true;
  }

  if (
    access?.employee
      ?.is_organization_owner
  ) {
    return true;
  }

  return (
    access?.permissionKeys || []
  ).includes(permissionKey);
}

/**
 * Returns true when at least one permission is granted.
 */
export function hasAnyServerPermission(
  access,
  permissionKeys = []
) {
  if (
    access?.employee
      ?.is_organization_owner
  ) {
    return true;
  }

  return permissionKeys.some(
    (permissionKey) =>
      hasServerPermission(
        access,
        permissionKey
      )
  );
}

/**
 * For the first workflow version, organisation owners
 * and employees with organisation management rights may
 * manage workflow definitions.
 */
export function canManageWorkflows(
  access
) {
  if (
    access?.employee
      ?.is_organization_owner
  ) {
    return true;
  }

  return hasAnyServerPermission(
    access,
    [
      "organization.manage",
      "roles.manage",
    ]
  );
}
