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

async function getCurrentEmployee(
  supabase
) {
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
      await getCurrentEmployee(
        supabase
      );

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

    /*
     * Load employees without nested employee relationships.
     *
     * Manager and backup employee details are joined manually
     * below. This avoids Supabase schema-cache problems with
     * self-referencing employee foreign keys.
     */
    const {
      data: employeeRows,
      error: employeesError,
    } = await supabase
      .from("employees")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order("created_at", {
        ascending: false,
      });

    if (employeesError) {
      return NextResponse.json(
        {
          error:
            employeesError.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Load departments separately.
     */
    const {
      data: departmentRows,
      error: departmentsError,
    } = await supabase
      .from("departments")
      .select(
        `
          id,
          organization_id,
          name,
          code,
          description,
          manager_id,
          parent_department_id,
          status
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("name", {
        ascending: true,
      });

    if (departmentsError) {
      return NextResponse.json(
        {
          error:
            departmentsError.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Load roles separately.
     */
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
      .order("name", {
        ascending: true,
      });

    if (rolesError) {
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

    /*
     * Load user-role assignments separately.
     */
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

    const employees =
      Array.isArray(employeeRows)
        ? employeeRows
        : [];

    const departments =
      Array.isArray(departmentRows)
        ? departmentRows
        : [];

    const roles =
      Array.isArray(roleRows)
        ? roleRows
        : [];

    const userRoles =
      Array.isArray(userRoleRows)
        ? userRoleRows
        : [];

    /*
     * Create lookup maps so related data can be assembled
     * without additional database requests.
     */
    const employeeMap =
      new Map(
        employees.map(
          (employee) => [
            employee.id,
            employee,
          ]
        )
      );

    const departmentMap =
      new Map(
        departments.map(
          (department) => [
            department.id,
            department,
          ]
        )
      );

    const roleMap =
      new Map(
        roles.map((role) => [
          role.id,
          role,
        ])
      );

    const rolesByEmployee =
      new Map();

    userRoles.forEach(
      (assignment) => {
        const role =
          roleMap.get(
            assignment.role_id
          ) || null;

        const formattedAssignment = {
          id: assignment.id,
          employee_id:
            assignment.employee_id,
          role_id:
            assignment.role_id,
          assigned_at:
            assignment.assigned_at,
          role,
        };

        const currentAssignments =
          rolesByEmployee.get(
            assignment.employee_id
          ) || [];

        currentAssignments.push(
          formattedAssignment
        );

        rolesByEmployee.set(
          assignment.employee_id,
          currentAssignments
        );
      }
    );

    /*
     * Return the same structure expected by the Employees page.
     */
    const formattedEmployees =
      employees.map((employee) => {
        const manager =
          employee.manager_id
            ? employeeMap.get(
                employee.manager_id
              )
            : null;

        const backupEmployee =
          employee.backup_employee_id
            ? employeeMap.get(
                employee.backup_employee_id
              )
            : null;

        return {
          ...employee,

          department:
            employee.department_id
              ? departmentMap.get(
                  employee.department_id
                ) || null
              : null,

          manager: manager
            ? {
                id: manager.id,
                full_name:
                  manager.full_name,
                employee_number:
                  manager.employee_number,
              }
            : null,

          backup_employee:
            backupEmployee
              ? {
                  id:
                    backupEmployee.id,
                  full_name:
                    backupEmployee.full_name,
                  employee_number:
                    backupEmployee.employee_number,
                }
              : null,

          user_roles:
            rolesByEmployee.get(
              employee.id
            ) || [],
        };
      });

    return NextResponse.json({
      employees:
        formattedEmployees,

      departments,

      roles,

      currentEmployee:
        current.employee,
    });
  } catch (error) {
    console.error(
      "Employees GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load employees.",
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
      await getCurrentEmployee(
        supabase
      );

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
            "Only the organisation owner can create employees.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const fullName =
      cleanText(body.full_name);

    const email = cleanText(
      body.email
    ).toLowerCase();

    const employeeNumber =
      cleanText(
        body.employee_number
      );

    if (!fullName) {
      return NextResponse.json(
        {
          error:
            "Employee name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid employee email address.",
        },
        {
          status: 400,
        }
      );
    }

    if (!employeeNumber) {
      return NextResponse.json(
        {
          error:
            "Employee number is required.",
        },
        {
          status: 400,
        }
      );
    }

    const userId =
      cleanNullableText(
        body.user_id
      );

    if (
      userId &&
      !isUuid(userId)
    ) {
      return NextResponse.json(
        {
          error:
            "Auth User ID must be a valid UUID.",
        },
        {
          status: 400,
        }
      );
    }

    const departmentId =
      cleanNullableText(
        body.department_id
      );

    const managerId =
      cleanNullableText(
        body.manager_id
      );

    const backupEmployeeId =
      cleanNullableText(
        body.backup_employee_id
      );

    const optionalUuidValues = [
      {
        name: "Department",
        value: departmentId,
      },
      {
        name: "Manager",
        value: managerId,
      },
      {
        name: "Backup employee",
        value: backupEmployeeId,
      },
    ];

    for (
      const item of
      optionalUuidValues
    ) {
      if (
        item.value &&
        !isUuid(item.value)
      ) {
        return NextResponse.json(
          {
            error:
              `${item.name} must be a valid record ID.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    const organizationId =
      current.employee.organization_id;

    /*
     * Validate that selected department belongs to the
     * current organisation.
     */
    if (departmentId) {
      const {
        data: department,
        error: departmentError,
      } = await supabase
        .from("departments")
        .select("id")
        .eq("id", departmentId)
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
            status: 400,
          }
        );
      }
    }

    /*
     * Validate manager and backup employee organisation.
     */
    const relatedEmployeeIds = [
      managerId,
      backupEmployeeId,
    ].filter(Boolean);

    if (
      relatedEmployeeIds.length > 0
    ) {
      const {
        data:
          relatedEmployees,
        error:
          relatedEmployeesError,
      } = await supabase
        .from("employees")
        .select("id")
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "id",
          relatedEmployeeIds
        );

      if (
        relatedEmployeesError
      ) {
        return NextResponse.json(
          {
            error:
              relatedEmployeesError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (
        (relatedEmployees || [])
          .length !==
        new Set(
          relatedEmployeeIds
        ).size
      ) {
        return NextResponse.json(
          {
            error:
              "The selected manager or backup employee is not valid.",
          },
          {
            status: 400,
          }
        );
      }
    }

    const employeePayload = {
      organization_id:
        organizationId,

      user_id: userId,

      employee_number:
        employeeNumber,

      full_name: fullName,

      email,

      phone:
        cleanNullableText(
          body.phone
        ),

      job_title:
        cleanNullableText(
          body.job_title
        ),

      department_id:
        departmentId,

      manager_id:
        managerId,

      backup_employee_id:
        backupEmployeeId,

      employment_type:
        cleanText(
          body.employment_type
        ) || "Employee",

      employment_status:
        cleanText(
          body.employment_status
        ) || "Active",

      availability_status:
        cleanText(
          body.availability_status
        ) || "Available",

      start_date:
        cleanNullableText(
          body.start_date
        ),

      end_date:
        cleanNullableText(
          body.end_date
        ),

      timezone:
        cleanText(body.timezone) ||
        "Europe/London",

      locale:
        cleanText(body.locale) ||
        "en-GB",

      is_organization_owner:
        false,

      is_active:
        body.is_active !== false,

      created_by:
        current.employee.user_id,

      updated_by:
        current.employee.user_id,
    };

    const {
      data: createdEmployee,
      error: createError,
    } = await supabase
      .from("employees")
      .insert([
        employeePayload,
      ])
      .select()
      .single();

    if (createError) {
      return NextResponse.json(
        {
          error:
            createError.message,
        },
        {
          status: 500,
        }
      );
    }

    const roleIds =
      Array.isArray(body.role_ids)
        ? [
            ...new Set(
              body.role_ids.filter(
                isUuid
              )
            ),
          ]
        : [];

    if (roleIds.length > 0) {
      /*
       * Confirm every role belongs to the current organisation.
       */
      const {
        data: validRoles,
        error: validRolesError,
      } = await supabase
        .from("roles")
        .select("id")
        .eq(
          "organization_id",
          organizationId
        )
        .in("id", roleIds);

      if (validRolesError) {
        await supabase
          .from("employees")
          .delete()
          .eq(
            "id",
            createdEmployee.id
          );

        return NextResponse.json(
          {
            error:
              validRolesError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (
        (validRoles || []).length !==
        roleIds.length
      ) {
        await supabase
          .from("employees")
          .delete()
          .eq(
            "id",
            createdEmployee.id
          );

        return NextResponse.json(
          {
            error:
              "One or more selected roles are invalid.",
          },
          {
            status: 400,
          }
        );
      }

      const roleAssignments =
        roleIds.map(
          (roleId) => ({
            organization_id:
              organizationId,

            employee_id:
              createdEmployee.id,

            role_id: roleId,

            assigned_by:
              current.employee.user_id,
          })
        );

      const {
        error: rolesError,
      } = await supabase
        .from("user_roles")
        .insert(roleAssignments);

      if (rolesError) {
        await supabase
          .from("employees")
          .delete()
          .eq(
            "id",
            createdEmployee.id
          );

        return NextResponse.json(
          {
            error:
              "The employee could not be assigned roles: " +
              rolesError.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    return NextResponse.json(
      {
        employee:
          createdEmployee,

        message:
          "Employee created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Employees POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create employee.",
      },
      {
        status: 500,
      }
    );
  }
}
