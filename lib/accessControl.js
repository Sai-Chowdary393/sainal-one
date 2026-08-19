import {
  createServerSupabaseClient,
} from "./supabaseServer";

export async function getCurrentEmployeeAccess() {
  const supabase =
    await createServerSupabaseClient();

  // =========================================================
  // AUTHENTICATION
  // =========================================================

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
    return {
      authenticated: false,
      user: null,
      employee: null,
      permissions: [],
      roles: [],
      roleDetails: [],
      isOwner: false,
      error:
        "You must be logged in.",

      can() {
        return false;
      },
    };
  }

  // =========================================================
  // EMPLOYEE
  // =========================================================

  /*
   * IMPORTANT:
   *
   * department_id is required for view_team permissions.
   *
   * Keep the employee context rich enough that downstream
   * APIs do not need to re-load the current employee just
   * to determine ownership/team access.
   */
  const {
    data:
      employee,
    error:
      employeeError,
  } =
    await supabase
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
      user,
      employee: null,
      permissions: [],
      roles: [],
      roleDetails: [],
      isOwner: false,
      error:
        employeeError.message,

      can() {
        return false;
      },
    };
  }

  if (
    !employee
  ) {
    return {
      authenticated: true,
      user,
      employee: null,
      permissions: [],
      roles: [],
      roleDetails: [],
      isOwner: false,
      error:
        "Your login is not linked to an active employee record.",

      can() {
        return false;
      },
    };
  }

  // =========================================================
  // ORGANISATION OWNER
  // =========================================================

  /*
   * The Organisation Owner receives full access regardless
   * of the role_permissions table.
   *
   * This is deliberate protection against accidentally
   * locking the organisation owner out of SaiNal One.
   */
  if (
    employee
      .is_organization_owner
  ) {
    return {
      authenticated: true,

      user,

      employee,

      roles: [
        "ORG_OWNER",
      ],

      roleDetails: [
        {
          code:
            "ORG_OWNER",

          name:
            "Organisation Owner",

          is_system_role:
            true,

          is_active:
            true,
        },
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

  // =========================================================
  // USER ROLE ASSIGNMENTS
  // =========================================================

  const {
    data:
      userRoleRows,
    error:
      userRolesError,
  } =
    await supabase
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
      user,
      employee,
      permissions: [],
      roles: [],
      roleDetails: [],
      isOwner: false,
      error:
        userRolesError.message,

      can() {
        return false;
      },
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
                  assignment.role_id
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
      user,
      employee,
      permissions: [],
      roles: [],
      roleDetails: [],
      isOwner: false,
      error: null,

      can() {
        return false;
      },
    };
  }

  // =========================================================
  // ACTIVE ROLES
  // =========================================================

  const {
    data:
      roleRows,
    error:
      rolesError,
  } =
    await supabase
      .from("roles")
      .select(
        `
          id,
          code,
          name,
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
    return {
      authenticated: true,
      user,
      employee,
      permissions: [],
      roles: [],
      roleDetails: [],
      isOwner: false,
      error:
        rolesError.message,

      can() {
        return false;
      },
    };
  }

  const activeRoles =
    Array.isArray(
      roleRows
    )
      ? roleRows
      : [];

  const activeRoleIds =
    activeRoles
      .map(
        (
          role
        ) =>
          role.id
      )
      .filter(Boolean);

  const roleCodes =
    activeRoles
      .map(
        (
          role
        ) =>
          role.code
      )
      .filter(Boolean);

  if (
    activeRoleIds.length ===
    0
  ) {
    return {
      authenticated: true,
      user,
      employee,
      permissions: [],
      roles: [],
      roleDetails: [],
      isOwner: false,
      error: null,

      can() {
        return false;
      },
    };
  }

  // =========================================================
  // ROLE PERMISSION ASSIGNMENTS
  // =========================================================

  const {
    data:
      rolePermissionRows,
    error:
      rolePermissionsError,
  } =
    await supabase
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
      user,
      employee,
      permissions: [],
      roles:
        roleCodes,
      roleDetails:
        activeRoles,
      isOwner: false,
      error:
        rolePermissionsError.message,

      can() {
        return false;
      },
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
                  assignment.permission_id
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
      user,
      employee,
      permissions: [],
      roles:
        roleCodes,
      roleDetails:
        activeRoles,
      isOwner: false,
      error: null,

      can() {
        return false;
      },
    };
  }

  // =========================================================
  // ACTIVE PERMISSIONS
  // =========================================================

  const {
    data:
      permissionRows,
    error:
      permissionsError,
  } =
    await supabase
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
      user,
      employee,
      permissions: [],
      roles:
        roleCodes,
      roleDetails:
        activeRoles,
      isOwner: false,
      error:
        permissionsError.message,

      can() {
        return false;
      },
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
              permission.permission_key
          )
          .filter(Boolean)
      ),
    ];

  const permissionSet =
    new Set(
      permissionKeys
    );

  // =========================================================
  // RESPONSE
  // =========================================================

  return {
    authenticated: true,

    user,

    employee,

    permissions:
      permissionKeys,

    permissionDetails:
      permissionRows ||
      [],

    roles:
      roleCodes,

    roleDetails:
      activeRoles,

    isOwner: false,

    error: null,

    can(
      permissionKey
    ) {
      if (
        !permissionKey
      ) {
        return false;
      }

      return permissionSet.has(
        permissionKey
      );
    },
  };
}

// =========================================================
// HELPER FUNCTIONS
// =========================================================

export function hasPermission(
  access,
  permissionKey
) {
  if (
    !access ||
    !permissionKey
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

  if (
    !Array.isArray(
      permissionKeys
    )
  ) {
    return false;
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

  if (
    !Array.isArray(
      permissionKeys
    )
  ) {
    return false;
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
