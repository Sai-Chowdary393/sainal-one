import {
  createServerSupabaseClient,
} from "./supabaseServer";

export async function getCurrentEmployeeAccess() {
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
    return {
      authenticated: false,
      employee: null,
      permissions: [],
      roles: [],
      isOwner: false,
      error:
        "You must be logged in.",
    };
  }

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
        employee_number,
        full_name,
        email,
        employment_status,
        is_organization_owner,
        is_active
      `
    )
    .eq(
      "user_id",
      user.id
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (
    employeeError
  ) {
    return {
      authenticated: true,
      employee: null,
      permissions: [],
      roles: [],
      isOwner: false,
      error:
        employeeError.message,
    };
  }

  if (
    !employee
  ) {
    return {
      authenticated: true,
      employee: null,
      permissions: [],
      roles: [],
      isOwner: false,
      error:
        "Your login is not linked to an active employee record.",
    };
  }

  /*
   * Organisation Owner always receives full access.
   *
   * We still load permissions below for normal employees.
   */
  if (
    employee
      .is_organization_owner
  ) {
    return {
      authenticated: true,

      employee,

      roles: [
        "ORG_OWNER",
      ],

      permissions: [
        "*",
      ],

      isOwner: true,

      error: null,

      can() {
        return true;
      },
    };
  }

  // =====================================================
  // USER ROLES
  // =====================================================

  const {
    data:
      userRoleRows,
    error:
      userRolesError,
  } = await supabase
    .from("user_roles")
    .select(
      `
        role_id
      `
    )
    .eq(
      "organization_id",
      employee.organization_id
    )
    .eq(
      "employee_id",
      employee.id
    );

  if (
    userRolesError
  ) {
    return {
      authenticated: true,
      employee,
      permissions: [],
      roles: [],
      isOwner: false,
      error:
        userRolesError.message,
    };
  }

  const roleIds =
    Array.isArray(
      userRoleRows
    )
      ? [
          ...new Set(
            userRoleRows
              .map(
                (
                  assignment
                ) =>
                  assignment
                    .role_id
              )
              .filter(Boolean)
          ),
        ]
      : [];

  if (
    roleIds.length ===
    0
  ) {
    return {
      authenticated: true,

      employee,

      permissions: [],

      roles: [],

      isOwner: false,

      error: null,

      can() {
        return false;
      },
    };
  }

  // =====================================================
  // ACTIVE ROLES
  // =====================================================

  const {
    data:
      roleRows,
    error:
      rolesError,
  } = await supabase
    .from("roles")
    .select(
      `
        id,
        code,
        name,
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
    return {
      authenticated: true,
      employee,
      permissions: [],
      roles: [],
      isOwner: false,
      error:
        rolesError.message,
    };
  }

  const activeRoles =
    Array.isArray(
      roleRows
    )
      ? roleRows
      : [];

  const activeRoleIds =
    activeRoles.map(
      (
        role
      ) =>
        role.id
    );

  const roleCodes =
    activeRoles.map(
      (
        role
      ) =>
        role.code
    );

  if (
    activeRoleIds.length ===
    0
  ) {
    return {
      authenticated: true,

      employee,

      permissions: [],

      roles: [],

      isOwner: false,

      error: null,

      can() {
        return false;
      },
    };
  }

  // =====================================================
  // ROLE PERMISSIONS
  // =====================================================

  const {
    data:
      rolePermissionRows,
    error:
      rolePermissionsError,
  } = await supabase
    .from(
      "role_permissions"
    )
    .select(
      `
        permission_id
      `
    )
    .eq(
      "organization_id",
      employee.organization_id
    )
    .in(
      "role_id",
      activeRoleIds
    );

  if (
    rolePermissionsError
  ) {
    return {
      authenticated: true,
      employee,
      permissions: [],
      roles: roleCodes,
      isOwner: false,
      error:
        rolePermissionsError
          .message,
    };
  }

  const permissionIds =
    Array.isArray(
      rolePermissionRows
    )
      ? [
          ...new Set(
            rolePermissionRows
              .map(
                (
                  assignment
                ) =>
                  assignment
                    .permission_id
              )
              .filter(Boolean)
          ),
        ]
      : [];

  if (
    permissionIds.length ===
    0
  ) {
    return {
      authenticated: true,

      employee,

      permissions: [],

      roles:
        roleCodes,

      isOwner: false,

      error: null,

      can() {
        return false;
      },
    };
  }

  // =====================================================
  // PERMISSION KEYS
  // =====================================================

  const {
    data:
      permissionRows,
    error:
      permissionsError,
  } = await supabase
    .from("permissions")
    .select(
      `
        id,
        permission_key,
        module,
        name,
        is_active
      `
    )
    .eq(
      "is_active",
      true
    )
    .in(
      "id",
      permissionIds
    );

  if (
    permissionsError
  ) {
    return {
      authenticated: true,
      employee,
      permissions: [],
      roles: roleCodes,
      isOwner: false,
      error:
        permissionsError
          .message,
    };
  }

  const permissionKeys =
    [
      ...new Set(
        (
          permissionRows ||
          []
        )
          .map(
            (
              permission
            ) =>
              permission
                .permission_key
          )
          .filter(Boolean)
      ),
    ];

  return {
    authenticated: true,

    employee,

    permissions:
      permissionKeys,

    roles:
      roleCodes,

    isOwner: false,

    error: null,

    can(
      permissionKey
    ) {
      return permissionKeys
        .includes(
          permissionKey
        );
    },
  };
}

export function hasPermission(
  access,
  permissionKey
) {
  if (
    !access
  ) {
    return false;
  }

  if (
    access.isOwner
  ) {
    return true;
  }

  return (
    Array.isArray(
      access.permissions
    ) &&
    access.permissions.includes(
      permissionKey
    )
  );
}

export function hasAnyPermission(
  access,
  permissionKeys = []
) {
  if (
    !access
  ) {
    return false;
  }

  if (
    access.isOwner
  ) {
    return true;
  }

  return permissionKeys.some(
    (
      permissionKey
    ) =>
      access.permissions
        ?.includes(
          permissionKey
        )
  );
}

export function hasAllPermissions(
  access,
  permissionKeys = []
) {
  if (
    !access
  ) {
    return false;
  }

  if (
    access.isOwner
  ) {
    return true;
  }

  return permissionKeys.every(
    (
      permissionKey
    ) =>
      access.permissions
        ?.includes(
          permissionKey
        )
  );
}
