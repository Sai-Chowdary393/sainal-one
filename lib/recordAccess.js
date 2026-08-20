// =========================================================
// SAINAL ONE
// RECORD-LEVEL ACCESS HELPERS
// =========================================================

function normalise(value) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

// =========================================================
// MODULE PERMISSIONS
// =========================================================

export function getRecordPermissions(
  access,
  {
    prefix,
    module,
  }
) {
  function can(
    action
  ) {
    if (
      access?.isOwner
    ) {
      return true;
    }

    const explicitKey =
      `${prefix}.${action}`;

    return (
      access?.can?.(
        explicitKey
      ) ||
      access?.canModuleAction?.(
        module,
        action
      )
    );
  }

  return {
    canViewAll:
      can(
        "view_all"
      ),

    canViewTeam:
      can(
        "view_team"
      ),

    canViewOwn:
      can(
        "view_own"
      ),

    canCreate:
      can(
        "create"
      ),

    canEdit:
      can(
        "edit"
      ),

    canDelete:
      can(
        "delete"
      ),

    canAssign:
      can(
        "assign"
      ),

    canSend:
      can(
        "send"
      ),

    canApprove:
      can(
        "approve"
      ),

    canConvert:
      can(
        "convert"
      ),
  };
}

// =========================================================
// TEAM EMPLOYEE IDS
// =========================================================

export async function getTeamEmployeeIds({
  supabase,
  employee,
}) {
  if (
    !employee
  ) {
    return [];
  }

  const employeeId =
    employee.id;

  const departmentId =
    employee.department_id;

  /*
   * No department = the employee is effectively a
   * one-person team for record-security purposes.
   */
  if (
    !departmentId
  ) {
    return [
      employeeId,
    ];
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "employees"
      )
      .select(
        "id"
      )
      .eq(
        "organization_id",
        employee.organization_id
      )
      .eq(
        "department_id",
        departmentId
      )
      .eq(
        "is_active",
        true
      );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  const ids =
    [
      ...new Set(
        (
          data ||
          []
        )
          .map(
            (
              item
            ) =>
              item.id
          )
          .filter(Boolean)
      ),
    ];

  if (
    ids.length ===
    0
  ) {
    return [
      employeeId,
    ];
  }

  return ids;
}

// =========================================================
// CAN VIEW RECORD
// =========================================================

export async function canViewOwnedRecord({
  supabase,
  access,
  permissions,
  record,
  ownerField = "owner_employee_id",
}) {
  if (
    !record ||
    !access?.employee
  ) {
    return false;
  }

  if (
    access.isOwner ||
    permissions.canViewAll
  ) {
    return true;
  }

  const ownerId =
    record[
      ownerField
    ];

  // =======================================================
  // OWN
  // =======================================================

  if (
    permissions.canViewOwn &&
    ownerId &&
    String(
      ownerId
    ) ===
      String(
        access.employee.id
      )
  ) {
    return true;
  }

  // =======================================================
  // TEAM
  // =======================================================

  if (
    permissions.canViewTeam &&
    ownerId
  ) {
    const teamIds =
      await getTeamEmployeeIds({
        supabase,

        employee:
          access.employee,
      });

    return teamIds.some(
      (
        employeeId
      ) =>
        String(
          employeeId
        ) ===
        String(
          ownerId
        )
    );
  }

  return false;
}

// =========================================================
// VALIDATE OWNER
// =========================================================

export async function validateRecordOwner({
  supabase,
  organizationId,
  employeeId,
}) {
  if (
    !employeeId
  ) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "employees"
      )
      .select(
        `
          id,
          full_name,
          email,
          job_title,
          department_id,
          is_active
        `
      )
      .eq(
        "id",
        employeeId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return (
    data ||
    null
  );
}

// =========================================================
// ATTACH OWNER
// =========================================================

export async function attachRecordOwner({
  supabase,
  organizationId,
  record,
  ownerField = "owner_employee_id",
}) {
  if (
    !record
  ) {
    return null;
  }

  const ownerId =
    record[
      ownerField
    ];

  if (
    !ownerId
  ) {
    return {
      ...record,

      owner:
        null,
    };
  }

  const owner =
    await validateRecordOwner({
      supabase,
      organizationId,

      employeeId:
        ownerId,
    });

  return {
    ...record,

    owner,
  };
}

// =========================================================
// ASSIGNABLE EMPLOYEES
// =========================================================

export async function loadAssignableEmployees({
  supabase,
  organizationId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "employees"
      )
      .select(
        `
          id,
          employee_number,
          full_name,
          email,
          job_title,
          department_id,
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
      .order(
        "full_name",
        {
          ascending:
            true,
        }
      );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return (
    data ||
    []
  );
}

// =========================================================
// FORMAT ACCESS FOR CLIENT
// =========================================================

export function buildClientAccess({
  access,
  permissions,
}) {
  return {
    isOwner:
      Boolean(
        access?.isOwner
      ),

    permissions:
      access
        ?.permissionKeys ||
      [],

    roles:
      access
        ?.roles ||
      [],

    ...permissions,
  };
}

// =========================================================
// PERMISSION MODULE FALLBACK
// =========================================================

export function hasModuleAction(
  access,
  module,
  actions
) {
  if (
    access?.isOwner
  ) {
    return true;
  }

  const expectedActions =
    (
      Array.isArray(
        actions
      )
        ? actions
        : [
            actions,
          ]
    )
      .map(
        normalise
      );

  return (
    access
      ?.permissions ||
    []
  ).some(
    (
      permission
    ) =>
      normalise(
        permission.module
      ) ===
        normalise(
          module
        ) &&
      expectedActions.includes(
        normalise(
          permission.action
        )
      )
  );
}
