import {
  createServerSupabaseClient,
} from "./supabaseServer";

// =========================================================
// HELPERS
// =========================================================

function uniqueValues(
  values = []
) {
  return [
    ...new Set(
      values.filter(
        Boolean
      )
    ),
  ];
}

function normalise(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

// =========================================================
// SERVER ACCESS
// =========================================================

export async function getServerAccess() {
  const supabase =
    await createServerSupabaseClient();

  // =======================================================
  // AUTH USER
  // =======================================================

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
    return buildAccess({
      supabase,

      error:
        userError?.message ||
        "You must be logged in.",

      status:
        401,
    });
  }

  // =======================================================
  // EMPLOYEE
  // =======================================================

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
          timezone,
          locale,
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
    return buildAccess({
      supabase,
      user,

      error:
        employeeError.message,

      status:
        500,
    });
  }

  if (
    !employee
  ) {
    return buildAccess({
      supabase,
      user,

      error:
        "Your login is not linked to an active employee record.",

      status:
        403,
    });
  }

  const organizationId =
    employee.organization_id;

  // =======================================================
  // ORGANISATION
  // =======================================================

  const {
    data:
      organization,
    error:
      organizationError,
  } =
    await supabase
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
      .eq(
        "id",
        organizationId
      )
      .maybeSingle();

  if (
    organizationError
  ) {
    return buildAccess({
      supabase,
      user,
      employee,

      error:
        organizationError.message,

      status:
        500,
    });
  }

  if (
    !organization
  ) {
    return buildAccess({
      supabase,
      user,
      employee,

      error:
        "The organisation linked to this employee could not be found.",

      status:
        403,
    });
  }

  // =======================================================
  // OWNER
  // =======================================================

  if (
    employee
      .is_organization_owner
  ) {
    const {
      data:
        permissionRows,
      error:
        permissionsError,
    } =
      await supabase
        .from(
          "permissions"
        )
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
        );

    if (
      permissionsError
    ) {
      return buildAccess({
        supabase,
        user,
        employee,
        organization,

        error:
          permissionsError.message,

        status:
          500,
      });
    }

    return buildAccess({
      supabase,
      user,
      employee,
      organization,

      roles: [
        {
          id:
            null,

          name:
            "Organisation Owner",

          code:
            "ORG_OWNER",

          is_system_role:
            true,

          is_active:
            true,
        },
      ],

      permissions:
        permissionRows ||
        [],

      status:
        200,
    });
  }

  // =======================================================
  // USER ROLES
  // =======================================================

  const {
    data:
      userRoleRows,
    error:
      userRolesError,
  } =
    await supabase
      .from(
        "user_roles"
      )
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
      .eq(
        "employee_id",
        employee.id
      );

  if (
    userRolesError
  ) {
    return buildAccess({
      supabase,
      user,
      employee,
      organization,

      error:
        userRolesError.message,

      status:
        500,
    });
  }

  const roleIds =
    uniqueValues(
      (
        userRoleRows ||
        []
      ).map(
        (
          assignment
        ) =>
          assignment.role_id
      )
    );

  // =======================================================
  // ACTIVE ROLES
  // =======================================================

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
      await supabase
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
      return buildAccess({
        supabase,
        user,
        employee,
        organization,

        error:
          rolesError.message,

        status:
          500,
      });
    }

    roles =
      roleRows ||
      [];
  }

  const activeRoleIds =
    roles
      .map(
        (
          role
        ) =>
          role.id
      )
      .filter(Boolean);

  // =======================================================
  // ROLE PERMISSIONS
  // =======================================================

  let permissions = [];

  if (
    activeRoleIds.length >
    0
  ) {
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
            role_id,
            permission_id
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "role_id",
          activeRoleIds
        );

    if (
      rolePermissionsError
    ) {
      return buildAccess({
        supabase,
        user,
        employee,
        organization,
        roles,

        error:
          rolePermissionsError.message,

        status:
          500,
      });
    }

    const permissionIds =
      uniqueValues(
        (
          rolePermissionRows ||
          []
        ).map(
          (
            assignment
          ) =>
            assignment.permission_id
        )
      );

    if (
      permissionIds.length >
      0
    ) {
      const {
        data:
          permissionRows,
        error:
          permissionsError,
      } =
        await supabase
          .from(
            "permissions"
          )
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
        return buildAccess({
          supabase,
          user,
          employee,
          organization,
          roles,

          error:
            permissionsError.message,

          status:
            500,
        });
      }

      permissions =
        permissionRows ||
        [];
    }
  }

  return buildAccess({
    supabase,
    user,
    employee,
    organization,
    roles,
    permissions,

    status:
      200,
  });
}

// =========================================================
// ACCESS OBJECT BUILDER
// =========================================================

function buildAccess({
  supabase,
  user = null,
  employee = null,
  organization = null,
  roles = [],
  permissions = [],
  error = null,
  status = 200,
}) {
  const permissionMap =
    new Map();

  (
    permissions ||
    []
  ).forEach(
    (
      permission
    ) => {
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

  const uniquePermissions =
    [
      ...permissionMap.values(),
    ];

  const permissionKeys =
    uniquePermissions.map(
      (
        permission
      ) =>
        permission.permission_key
    );

  const permissionSet =
    new Set(
      permissionKeys
    );

  const isOwner =
    Boolean(
      employee
        ?.is_organization_owner
    );

  return {
    supabase,
    user,
    employee,
    organization,
    roles:
      roles ||
      [],
    permissions:
      uniquePermissions,
    permissionKeys,
    error,
    status,
    isOwner,

    can(
      permissionKey
    ) {
      if (
        !permissionKey
      ) {
        return false;
      }

      if (
        isOwner
      ) {
        return true;
      }

      return permissionSet.has(
        permissionKey
      );
    },

    canAny(
      permissionKeysToCheck = []
    ) {
      if (
        isOwner
      ) {
        return true;
      }

      return permissionKeysToCheck.some(
        (
          permissionKey
        ) =>
          permissionSet.has(
            permissionKey
          )
      );
    },

    canModuleAction(
      moduleNames,
      actionNames
    ) {
      if (
        isOwner
      ) {
        return true;
      }

      const modules =
        (
          Array.isArray(
            moduleNames
          )
            ? moduleNames
            : [
                moduleNames,
              ]
        )
          .map(
            normalise
          );

      const actions =
        (
          Array.isArray(
            actionNames
          )
            ? actionNames
            : [
                actionNames,
              ]
        )
          .map(
            normalise
          );

      return uniquePermissions.some(
        (
          permission
        ) =>
          modules.includes(
            normalise(
              permission.module
            )
          ) &&
          actions.includes(
            normalise(
              permission.action
            )
          )
      );
    },
  };
}

// =========================================================
// EXPORTED HELPERS
// =========================================================

export function hasServerPermission(
  access,
  permissionKey
) {
  return Boolean(
    access?.can?.(
      permissionKey
    )
  );
}

export function hasAnyServerPermission(
  access,
  permissionKeys = []
) {
  return Boolean(
    access?.canAny?.(
      permissionKeys
    )
  );
}

export function hasServerModuleAction(
  access,
  moduleNames,
  actionNames
) {
  return Boolean(
    access?.canModuleAction?.(
      moduleNames,
      actionNames
    )
  );
}

export function canManageWorkflows(
  access
) {
  if (
    access?.isOwner
  ) {
    return true;
  }

  return (
    hasAnyServerPermission(
      access,
      [
        "organization.manage",
        "roles.manage",
        "workflows.manage",
      ]
    ) ||
    hasServerModuleAction(
      access,
      [
        "Workflows",
        "Administration",
      ],
      [
        "manage",
      ]
    )
  );
}
