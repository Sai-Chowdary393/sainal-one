import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase-server";

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

    const {
      data: employees,
      error: employeesError,
    } = await supabase
      .from("employees")
      .select(
        `
          *,
          department:departments!employees_department_id_fkey(
            id,
            name,
            code
          ),
          manager:employees!employees_manager_id_fkey(
            id,
            full_name,
            employee_number
          ),
          backup_employee:employees!employees_backup_employee_id_fkey(
            id,
            full_name,
            employee_number
          ),
          user_roles(
            id,
            role:roles(
              id,
              name,
              code,
              is_system_role,
              is_active
            )
          )
        `
      )
      .eq(
        "organization_id",
        current.employee.organization_id
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

    const {
      data: departments,
      error: departmentsError,
    } = await supabase
      .from("departments")
      .select(
        `
          id,
          name,
          code,
          status
        `
      )
      .eq(
        "organization_id",
        current.employee.organization_id
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

    const {
      data: roles,
      error: rolesError,
    } = await supabase
      .from("roles")
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
        current.employee.organization_id
      )
      .order("name", {
        ascending: true,
      });

    if (rolesError) {
      return NextResponse.json(
        {
          error: rolesError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      employees:
        employees || [],

      departments:
        departments || [],

      roles:
        roles || [],

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

    const employeePayload = {
      organization_id:
        current.employee
          .organization_id,

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
        ? body.role_ids.filter(
            isUuid
          )
        : [];

    if (roleIds.length > 0) {
      const roleAssignments =
        roleIds.map((roleId) => ({
          organization_id:
            current.employee
              .organization_id,

          employee_id:
            createdEmployee.id,

          role_id: roleId,

          assigned_by:
            current.employee.user_id,
        }));

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
