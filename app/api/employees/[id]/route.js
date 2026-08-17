import {
  NextResponse,
} from "next/server";

import {
  createServerSupabaseClient,
} from "../../../../lib/supabaseServer";

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

  return (
    cleaned ||
    null
  );
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

// =========================================================
// CURRENT EMPLOYEE
// =========================================================

async function getCurrentEmployee(
  supabase
) {
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
      employee:
        null,

      user:
        null,

      error:
        userError?.message ||
        "You must be logged in.",

      status:
        401,
    };
  }

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
          organization_id,
          user_id,
          full_name,
          email,
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
      employee:
        null,

      user,

      error:
        employeeError.message,

      status:
        500,
    };
  }

  if (
    !employee
  ) {
    return {
      employee:
        null,

      user,

      error:
        "Your login is not linked to an active employee record.",

      status:
        403,
    };
  }

  return {
    employee,
    user,
    error:
      null,
    status:
      200,
  };
}

// =========================================================
// LOAD EMPLOYEE WORKSPACE
// =========================================================

async function loadEmployeeWorkspace({
  supabase,
  organizationId,
  employeeId,
}) {
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
      .from(
        "employees"
      )
      .select(
        "*"
      )
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

  if (
    !employee
  ) {
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

    if (
      error
    ) {
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

    if (
      error
    ) {
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

    if (
      error
    ) {
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

  const roleIds =
    [
      ...new Set(
        (
          userRoles ||
          []
        )
          .map(
            (
              assignment
            ) =>
              assignment.role_id
          )
          .filter(
            Boolean
          )
      ),
    ];

  let roleRows =
    [];

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

    if (
      error
    ) {
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
        (
          role
        ) => [
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
      (
        assignment
      ) => ({
        ...assignment,

        role:
          roleMap.get(
            assignment.role_id
          ) ||
          null,
      })
    );

  // =======================================================
  // RETURN
  // =======================================================

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
      !isUuid(
        id
      )
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

    const supabase =
      await createServerSupabaseClient();

    const current =
      await getCurrentEmployee(
        supabase
      );

    if (
      !current.employee
    ) {
      return NextResponse.json(
        {
          error:
            current.error,
        },
        {
          status:
            current.status,
        }
      );
    }

    const employee =
      await loadEmployeeWorkspace({
        supabase,

        organizationId:
          current.employee
            .organization_id,

        employeeId:
          id,
      });

    if (
      !employee
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

    return NextResponse.json(
      employee
    );
  } catch (
    error
  ) {
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
      !isUuid(
        id
      )
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

    const supabase =
      await createServerSupabaseClient();

    const current =
      await getCurrentEmployee(
        supabase
      );

    if (
      !current.employee
    ) {
      return NextResponse.json(
        {
          error:
            current.error,
        },
        {
          status:
            current.status,
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
            "Only the organisation owner can update employees.",
        },
        {
          status:
            403,
        }
      );
    }

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
        .select(
          "*"
        )
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          current.employee
            .organization_id
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

    const updates =
      {};

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "employee_number"
      )
    ) {
      updates.employee_number =
        cleanText(
          body.employee_number
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "full_name"
      )
    ) {
      updates.full_name =
        cleanText(
          body.full_name
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "email"
      )
    ) {
      updates.email =
        cleanText(
          body.email
        );
    }

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

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "department_id"
      )
    ) {
      updates.department_id =
        isUuid(
          body.department_id
        )
          ? body.department_id
          : null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "manager_id"
      )
    ) {
      updates.manager_id =
        isUuid(
          body.manager_id
        )
          ? body.manager_id
          : null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "backup_employee_id"
      )
    ) {
      updates.backup_employee_id =
        isUuid(
          body.backup_employee_id
        )
          ? body.backup_employee_id
          : null;
    }

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
      updates.start_date =
        body.start_date ||
        null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "end_date"
      )
    ) {
      updates.end_date =
        body.end_date ||
        null;
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

      updates.is_active =
        Boolean(
          body.is_active
        );
    }

    // =====================================================
    // SELF LINKS
    // =====================================================

    if (
      updates.manager_id ===
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
      updates.backup_employee_id ===
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
            current.employee
              .organization_id
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
    // UPDATE ROLES
    // =====================================================

    if (
      Array.isArray(
        body.role_ids
      )
    ) {
      const roleIds =
        [
          ...new Set(
            body.role_ids.filter(
              isUuid
            )
          ),
        ];

      if (
        roleIds.length >
        0
      ) {
        const {
          data:
            validRoles,
          error:
            validRolesError,
        } =
          await supabase
            .from(
              "roles"
            )
            .select(
              "id"
            )
            .eq(
              "organization_id",
              current.employee
                .organization_id
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

        const validRoleIds =
          new Set(
            (
              validRoles ||
              []
            ).map(
              (
                role
              ) =>
                role.id
            )
          );

        const invalidRole =
          roleIds.some(
            (
              roleId
            ) =>
              !validRoleIds.has(
                roleId
              )
          );

        if (
          invalidRole
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
            current.employee
              .organization_id
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
            (
              roleId
            ) => ({
              organization_id:
                current.employee
                  .organization_id,

              employee_id:
                id,

              role_id:
                roleId,

              assigned_by:
                current.user
                  ?.id ||
                current.employee
                  .user_id ||
                null,
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

    // =====================================================
    // RETURN FULL WORKSPACE
    // =====================================================

    const refreshedEmployee =
      await loadEmployeeWorkspace({
        supabase,

        organizationId:
          current.employee
            .organization_id,

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
  } catch (
    error
  ) {
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
      !isUuid(
        id
      )
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

    const supabase =
      await createServerSupabaseClient();

    const current =
      await getCurrentEmployee(
        supabase
      );

    if (
      !current.employee
    ) {
      return NextResponse.json(
        {
          error:
            current.error,
        },
        {
          status:
            current.status,
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
            "Only the organisation owner can deactivate employees.",
        },
        {
          status:
            403,
        }
      );
    }

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
          current.employee
            .organization_id
        )
        .maybeSingle();

    if (
      employeeError
    ) {
      throw new Error(
        employeeError.message
      );
    }

    if (
      !employee
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
              .split(
                "T"
              )[0],
        })
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          current.employee
            .organization_id
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
  } catch (
    error
  ) {
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
