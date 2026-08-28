import {
  NextResponse,
} from "next/server";

import {
  createServerSupabaseClient,
} from "../../../../lib/supabaseServer";

import {
  getCurrentEmployeeAccess,
} from "../../../../lib/accessControl";

// =========================================================
// HELPERS
// =========================================================

function cleanText(
  value
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function cleanNullableText(
  value
) {
  const cleaned =
    cleanText(
      value
    );

  return cleaned || null;
}

function isUuid(
  value
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(
      value ||
        ""
    )
  );
}

function isDateValue(
  value
) {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value)
  );
}

function unauthenticatedResponse(
  message =
    "You must be logged in."
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status:
        401,
    }
  );
}

function forbiddenResponse(
  message =
    "You do not have permission to perform this action."
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status:
        403,
    }
  );
}

// =========================================================
// LOAD EMPLOYEE WORKSPACE
// =========================================================

async function loadEmployeeWorkspace({
  supabase,
  organizationId,
  employeeId,
}) {
  const {
    data:
      employee,
    error:
      employeeError,
  } =
    await supabase
      .from(
        "employees"
      )
      .select("*")
      .eq(
        "id",
        employeeId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

  if (
    employeeError
  ) {
    throw new Error(
      employeeError.message
    );
  }

  if (!employee) {
    return null;
  }

  // =======================================================
  // DEPARTMENT
  // =======================================================

  let department =
    null;

  if (
    employee.department_id
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "departments"
        )
        .select(
          `
            id,
            name,
            code,
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
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    department =
      data ||
      null;
  }

  // =======================================================
  // MANAGER
  // =======================================================

  let manager =
    null;

  if (
    employee.manager_id
  ) {
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
            is_active
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
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    manager =
      data ||
      null;
  }

  // =======================================================
  // BACKUP EMPLOYEE
  // =======================================================

  let backupEmployee =
    null;

  if (
    employee.backup_employee_id
  ) {
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
            is_active
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
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    backupEmployee =
      data ||
      null;
  }

  // =======================================================
  // ROLE ASSIGNMENTS
  // =======================================================

  const {
    data:
      userRoles,
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
        employeeId
      );

  if (
    userRolesError
  ) {
    throw new Error(
      userRolesError.message
    );
  }

  const roleIds = [
    ...new Set(
      (
        userRoles ||
        []
      )
        .map(
          (assignment) =>
            assignment.role_id
        )
        .filter(Boolean)
    ),
  ];

  let roleRows = [];

  if (
    roleIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "roles"
        )
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
          organizationId
        )
        .in(
          "id",
          roleIds
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    roleRows =
      data ||
      [];
  }

  const roleMap =
    new Map(
      roleRows.map(
        (role) => [
          role.id,
          role,
        ]
      )
    );

  const formattedRoles =
    (
      userRoles ||
      []
    ).map(
      (assignment) => ({
        ...assignment,

        role:
          roleMap.get(
            assignment.role_id
          ) ||
          null,
      })
    );

  return {
    ...employee,

    department,

    manager,

    backup_employee:
      backupEmployee,

    user_roles:
      formattedRoles,
  };
}

// =========================================================
// GET ONE EMPLOYEE
// =========================================================

export async function GET(
  request,
  context
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid employee ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const access =
      await getCurrentEmployeeAccess();

    if (
      !access.authenticated
    ) {
      return unauthenticatedResponse(
        access.error
      );
    }

    if (
      !access.employee
    ) {
      return forbiddenResponse(
        access.error ||
          "Your login is not linked to an active employee record."
      );
    }

    const canViewEmployees =
      access.can(
        "employees.view"
      ) ||
      access.can(
        "employees.manage"
      );

    if (
      !canViewEmployees
    ) {
      return forbiddenResponse(
        "You do not have permission to view employee records."
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const employee =
      await loadEmployeeWorkspace({
        supabase,

        organizationId:
          access.employee
            .organization_id,

        employeeId:
          id,
      });

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "Employee not found.",
        },
        {
          status:
            404,
        }
      );
    }

    return NextResponse.json({
      ...employee,

      access: {
        isOwner:
          access.isOwner,

        permissions:
          access.permissions,

        roles:
          access.roles,

        canViewEmployees:
          true,

        canManageEmployees:
          access.can(
            "employees.manage"
          ),

        canManageRoles:
          access.can(
            "roles.manage"
          ),
      },
    });
  } catch (error) {
    console.error(
      "Employee GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load employee.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// UPDATE EMPLOYEE
// =========================================================

export async function PATCH(
  request,
  context
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid employee ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const access =
      await getCurrentEmployeeAccess();

    if (
      !access.authenticated
    ) {
      return unauthenticatedResponse(
        access.error
      );
    }

    if (
      !access.employee
    ) {
      return forbiddenResponse(
        access.error ||
          "Your login is not linked to an active employee record."
      );
    }

    if (
      !access.can(
        "employees.manage"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to update employees."
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // EXISTING EMPLOYEE
    // =====================================================

    const {
      data:
        existingEmployee,
      error:
        existingEmployeeError,
    } =
      await supabase
        .from(
          "employees"
        )
        .select("*")
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      existingEmployeeError
    ) {
      throw new Error(
        existingEmployeeError.message
      );
    }

    if (
      !existingEmployee
    ) {
      return NextResponse.json(
        {
          error:
            "Employee not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const body =
      await request.json();

    // =====================================================
    // ROLE MANAGEMENT
    // =====================================================

    if (
      Array.isArray(
        body.role_ids
      ) &&
      !access.can(
        "roles.manage"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to change employee role assignments."
      );
    }

    const updates = {};

    // =====================================================
    // EMPLOYEE NUMBER
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "employee_number"
      )
    ) {
      const employeeNumber =
        cleanText(
          body.employee_number
        );

      if (
        !employeeNumber
      ) {
        return NextResponse.json(
          {
            error:
              "Employee number cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      const {
        data:
          duplicateEmployeeNumber,
        error:
          duplicateNumberError,
      } =
        await supabase
          .from(
            "employees"
          )
          .select("id")
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "employee_number",
            employeeNumber
          )
          .neq(
            "id",
            id
          )
          .maybeSingle();

      if (
        duplicateNumberError
      ) {
        throw new Error(
          duplicateNumberError.message
        );
      }

      if (
        duplicateEmployeeNumber
      ) {
        return NextResponse.json(
          {
            error:
              "Another employee already uses this employee number.",
          },
          {
            status:
              409,
          }
        );
      }

      updates.employee_number =
        employeeNumber;
    }

    // =====================================================
    // FULL NAME
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "full_name"
      )
    ) {
      const fullName =
        cleanText(
          body.full_name
        );

      if (!fullName) {
        return NextResponse.json(
          {
            error:
              "Employee name cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.full_name =
        fullName;
    }

    // =====================================================
    // EMAIL
    //
    // SECURITY / DATA CONSISTENCY:
    // employees.email must stay aligned with Supabase Auth.
    //
    // For the POC this API does not support login email
    // changes. If the frontend sends the existing email it
    // is simply ignored.
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "email"
      )
    ) {
      const requestedEmail =
        cleanText(
          body.email
        ).toLowerCase();

      const existingEmail =
        cleanText(
          existingEmployee.email
        ).toLowerCase();

      if (
        requestedEmail !==
        existingEmail
      ) {
        return NextResponse.json(
          {
            error:
              "Employee login email cannot be changed from this screen yet. Please keep the current email address.",
          },
          {
            status:
              400,
          }
        );
      }
    }

    // =====================================================
    // SIMPLE FIELDS
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "phone"
      )
    ) {
      updates.phone =
        cleanNullableText(
          body.phone
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "job_title"
      )
    ) {
      updates.job_title =
        cleanNullableText(
          body.job_title
        );
    }

    // =====================================================
    // DEPARTMENT
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "department_id"
      )
    ) {
      const departmentId =
        cleanNullableText(
          body.department_id
        );

      if (
        departmentId &&
        !isUuid(
          departmentId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Department must be a valid record ID.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        departmentId
      ) {
        const {
          data:
            department,
          error:
            departmentError,
        } =
          await supabase
            .from(
              "departments"
            )
            .select("id")
            .eq(
              "id",
              departmentId
            )
            .eq(
              "organization_id",
              organizationId
            )
            .maybeSingle();

        if (
          departmentError ||
          !department
        ) {
          return NextResponse.json(
            {
              error:
                "The selected department is not valid.",
            },
            {
              status:
                400,
            }
          );
        }
      }

      updates.department_id =
        departmentId;
    }

    // =====================================================
    // MANAGER
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "manager_id"
      )
    ) {
      const managerId =
        cleanNullableText(
          body.manager_id
        );

      if (
        managerId &&
        !isUuid(
          managerId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Manager must be a valid employee ID.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        managerId ===
        id
      ) {
        return NextResponse.json(
          {
            error:
              "An employee cannot be their own manager.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        managerId
      ) {
        const {
          data:
            manager,
          error:
            managerError,
        } =
          await supabase
            .from(
              "employees"
            )
            .select("id")
            .eq(
              "id",
              managerId
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
          managerError ||
          !manager
        ) {
          return NextResponse.json(
            {
              error:
                "The selected manager is not valid.",
            },
            {
              status:
                400,
            }
          );
        }
      }

      updates.manager_id =
        managerId;
    }

    // =====================================================
    // BACKUP EMPLOYEE
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "backup_employee_id"
      )
    ) {
      const backupEmployeeId =
        cleanNullableText(
          body.backup_employee_id
        );

      if (
        backupEmployeeId &&
        !isUuid(
          backupEmployeeId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Backup employee must be a valid employee ID.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        backupEmployeeId ===
        id
      ) {
        return NextResponse.json(
          {
            error:
              "An employee cannot be their own backup.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        backupEmployeeId
      ) {
        const {
          data:
            backupEmployee,
          error:
            backupError,
        } =
          await supabase
            .from(
              "employees"
            )
            .select("id")
            .eq(
              "id",
              backupEmployeeId
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
          backupError ||
          !backupEmployee
        ) {
          return NextResponse.json(
            {
              error:
                "The selected backup employee is not valid.",
            },
            {
              status:
                400,
            }
          );
        }
      }

      updates.backup_employee_id =
        backupEmployeeId;
    }

    // =====================================================
    // EMPLOYMENT FIELDS
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "employment_type"
      )
    ) {
      updates.employment_type =
        cleanNullableText(
          body.employment_type
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "employment_status"
      )
    ) {
      updates.employment_status =
        cleanNullableText(
          body.employment_status
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "availability_status"
      )
    ) {
      updates.availability_status =
        cleanNullableText(
          body.availability_status
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "start_date"
      )
    ) {
      const startDate =
        body.start_date ||
        null;

      if (
        !isDateValue(
          startDate
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Start date must use YYYY-MM-DD format.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.start_date =
        startDate;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "end_date"
      )
    ) {
      const endDate =
        body.end_date ||
        null;

      if (
        !isDateValue(
          endDate
        )
      ) {
        return NextResponse.json(
          {
            error:
              "End date must use YYYY-MM-DD format.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.end_date =
        endDate;
    }

    const nextStartDate =
      Object.prototype.hasOwnProperty.call(
        updates,
        "start_date"
      )
        ? updates.start_date
        : existingEmployee.start_date;

    const nextEndDate =
      Object.prototype.hasOwnProperty.call(
        updates,
        "end_date"
      )
        ? updates.end_date
        : existingEmployee.end_date;

    if (
      nextStartDate &&
      nextEndDate &&
      String(
        nextEndDate
      ) <
        String(
          nextStartDate
        )
    ) {
      return NextResponse.json(
        {
          error:
            "Employee end date cannot be before the start date.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "timezone"
      )
    ) {
      updates.timezone =
        cleanNullableText(
          body.timezone
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "locale"
      )
    ) {
      updates.locale =
        cleanNullableText(
          body.locale
        );
    }

    // =====================================================
    // ACTIVE STATUS
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "is_active"
      )
    ) {
      if (
        existingEmployee
          .is_organization_owner &&
        body.is_active ===
          false
      ) {
        return NextResponse.json(
          {
            error:
              "The organisation owner cannot be deactivated.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        String(
          existingEmployee.id
        ) ===
          String(
            access.employee.id
          ) &&
        body.is_active ===
          false
      ) {
        return NextResponse.json(
          {
            error:
              "You cannot deactivate your own employee account.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.is_active =
        Boolean(
          body.is_active
        );
    }

    // =====================================================
    // AUDIT
    // =====================================================

    if (
      Object.keys(
        updates
      ).length >
      0
    ) {
      updates.updated_by =
        access.employee
          .user_id;
    }

    // =====================================================
    // UPDATE EMPLOYEE
    // =====================================================

    let updatedEmployee =
      existingEmployee;

    if (
      Object.keys(
        updates
      ).length >
      0
    ) {
      const {
        data,
        error:
          updateError,
      } =
        await supabase
          .from(
            "employees"
          )
          .update(
            updates
          )
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .select()
          .single();

      if (
        updateError
      ) {
        throw new Error(
          updateError.message
        );
      }

      updatedEmployee =
        data;
    }

    // =====================================================
    // UPDATE ROLE ASSIGNMENTS
    // =====================================================

    if (
      Array.isArray(
        body.role_ids
      )
    ) {
      const invalidRoleId =
        body.role_ids.some(
          (roleId) =>
            !isUuid(
              roleId
            )
        );

      if (
        invalidRoleId
      ) {
        return NextResponse.json(
          {
            error:
              "One or more selected roles are invalid.",
          },
          {
            status:
              400,
          }
        );
      }

      const roleIds = [
        ...new Set(
          body.role_ids
        ),
      ];

      let validRoles = [];

      if (
        roleIds.length >
        0
      ) {
        const {
          data,
          error:
            validRolesError,
        } =
          await supabase
            .from(
              "roles"
            )
            .select(
              `
                id,
                code,
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
          validRolesError
        ) {
          throw new Error(
            validRolesError.message
          );
        }

        validRoles =
          data ||
          [];

        if (
          validRoles.length !==
          roleIds.length
        ) {
          return NextResponse.json(
            {
              error:
                "One or more selected roles are invalid.",
            },
            {
              status:
                400,
            }
          );
        }
      }

      const selectedOwnerRole =
        validRoles.some(
          (role) =>
            role.code ===
            "ORG_OWNER"
        );

      if (
        !existingEmployee
          .is_organization_owner &&
        selectedOwnerRole
      ) {
        return NextResponse.json(
          {
            error:
              "The Organisation Owner role cannot be assigned to another employee.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        existingEmployee
          .is_organization_owner &&
        !selectedOwnerRole
      ) {
        return NextResponse.json(
          {
            error:
              "The Organisation Owner must retain the Organisation Owner role.",
          },
          {
            status:
              400,
          }
        );
      }

      const {
        error:
          deleteRolesError,
      } =
        await supabase
          .from(
            "user_roles"
          )
          .delete()
          .eq(
            "employee_id",
            id
          )
          .eq(
            "organization_id",
            organizationId
          );

      if (
        deleteRolesError
      ) {
        throw new Error(
          deleteRolesError.message
        );
      }

      if (
        roleIds.length >
        0
      ) {
        const assignments =
          roleIds.map(
            (roleId) => ({
              organization_id:
                organizationId,

              employee_id:
                id,

              role_id:
                roleId,

              assigned_by:
                access.employee
                  .user_id,
            })
          );

        const {
          error:
            roleAssignmentError,
        } =
          await supabase
            .from(
              "user_roles"
            )
            .insert(
              assignments
            );

        if (
          roleAssignmentError
        ) {
          throw new Error(
            roleAssignmentError.message
          );
        }
      }
    }

    const refreshedEmployee =
      await loadEmployeeWorkspace({
        supabase,

        organizationId,

        employeeId:
          id,
      });

    return NextResponse.json({
      employee:
        refreshedEmployee ||
        updatedEmployee,

      message:
        "Employee updated successfully.",
    });
  } catch (error) {
    console.error(
      "Employee PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to update employee.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// DEACTIVATE EMPLOYEE
// =========================================================

export async function DELETE(
  request,
  context
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid employee ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const access =
      await getCurrentEmployeeAccess();

    if (
      !access.authenticated
    ) {
      return unauthenticatedResponse(
        access.error
      );
    }

    if (
      !access.employee
    ) {
      return forbiddenResponse(
        access.error ||
          "Your login is not linked to an active employee record."
      );
    }

    if (
      !access.can(
        "employees.manage"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to deactivate employees."
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const {
      data:
        employee,
      error:
        employeeError,
    } =
      await supabase
        .from(
          "employees"
        )
        .select(
          `
            id,
            user_id,
            full_name,
            is_organization_owner,
            is_active
          `
        )
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      employeeError
    ) {
      throw new Error(
        employeeError.message
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "Employee not found.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      employee
        .is_organization_owner
    ) {
      return NextResponse.json(
        {
          error:
            "The organisation owner cannot be deactivated.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      String(
        employee.id
      ) ===
      String(
        access.employee.id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot deactivate your own employee account.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !employee.is_active
    ) {
      return NextResponse.json({
        employee,

        message:
          "Employee is already inactive.",
      });
    }

    const {
      data:
        updatedEmployee,
      error:
        updateError,
    } =
      await supabase
        .from(
          "employees"
        )
        .update({
          is_active:
            false,

          employment_status:
            "Inactive",

          availability_status:
            "Unavailable",

          end_date:
            new Date()
              .toISOString()
              .split("T")[0],

          updated_by:
            access.employee
              .user_id,
        })
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .select()
        .single();

    if (
      updateError
    ) {
      throw new Error(
        updateError.message
      );
    }

    return NextResponse.json({
      employee:
        updatedEmployee,

      message:
        "Employee deactivated successfully.",
    });
  } catch (error) {
    console.error(
      "Employee DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to deactivate employee.",
      },
      {
        status:
          500,
      }
    );
  }
}
