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

    const {
      data: departmentRows,
      error: departmentsError,
    } = await supabase
      .from("departments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", {
        ascending: true,
      });

    if (departmentsError) {
      return NextResponse.json(
        {
          error: departmentsError.message,
        },
        {
          status: 500,
        }
      );
    }

    const {
      data: employeeRows,
      error: employeesError,
    } = await supabase
      .from("employees")
      .select(
        `
          id,
          employee_number,
          full_name,
          email,
          job_title,
          department_id,
          employment_status,
          is_active
        `
      )
      .eq("organization_id", organizationId)
      .order("full_name", {
        ascending: true,
      });

    if (employeesError) {
      return NextResponse.json(
        {
          error: employeesError.message,
        },
        {
          status: 500,
        }
      );
    }

    const departments = Array.isArray(
      departmentRows
    )
      ? departmentRows
      : [];

    const employees = Array.isArray(
      employeeRows
    )
      ? employeeRows
      : [];

    const departmentMap = new Map(
      departments.map((department) => [
        department.id,
        department,
      ])
    );

    const employeeMap = new Map(
      employees.map((employee) => [
        employee.id,
        employee,
      ])
    );

    const employeeCountByDepartment =
      new Map();

    employees.forEach((employee) => {
      if (!employee.department_id) {
        return;
      }

      employeeCountByDepartment.set(
        employee.department_id,
        (employeeCountByDepartment.get(
          employee.department_id
        ) || 0) + 1
      );
    });

    const formattedDepartments =
      departments.map((department) => {
        const manager = department.manager_id
          ? employeeMap.get(
              department.manager_id
            )
          : null;

        const parentDepartment =
          department.parent_department_id
            ? departmentMap.get(
                department.parent_department_id
              )
            : null;

        return {
          ...department,

          manager: manager
            ? {
                id: manager.id,
                full_name:
                  manager.full_name,
                employee_number:
                  manager.employee_number,
                job_title:
                  manager.job_title,
              }
            : null,

          parent_department:
            parentDepartment
              ? {
                  id:
                    parentDepartment.id,
                  name:
                    parentDepartment.name,
                  code:
                    parentDepartment.code,
                }
              : null,

          employee_count:
            employeeCountByDepartment.get(
              department.id
            ) || 0,
        };
      });

    return NextResponse.json({
      departments:
        formattedDepartments,

      employees,

      currentEmployee:
        current.employee,
    });
  } catch (error) {
    console.error(
      "Departments GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load departments.",
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
            "Only the organisation owner can create departments.",
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
          error:
            "Department name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          error:
            "Department code is required.",
        },
        {
          status: 400,
        }
      );
    }

    const parentDepartmentId =
      cleanNullableText(
        body.parent_department_id
      );

    const managerId =
      cleanNullableText(
        body.manager_id
      );

    if (
      parentDepartmentId &&
      !isUuid(parentDepartmentId)
    ) {
      return NextResponse.json(
        {
          error:
            "Parent department must be a valid record ID.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      managerId &&
      !isUuid(managerId)
    ) {
      return NextResponse.json(
        {
          error:
            "Department manager must be a valid employee ID.",
        },
        {
          status: 400,
        }
      );
    }

    const organizationId =
      current.employee.organization_id;

    if (parentDepartmentId) {
      const {
        data: parentDepartment,
        error: parentError,
      } = await supabase
        .from("departments")
        .select("id")
        .eq("id", parentDepartmentId)
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

      if (
        parentError ||
        !parentDepartment
      ) {
        return NextResponse.json(
          {
            error:
              "The selected parent department is not valid.",
          },
          {
            status: 400,
          }
        );
      }
    }

    if (managerId) {
      const {
        data: manager,
        error: managerError,
      } = await supabase
        .from("employees")
        .select("id")
        .eq("id", managerId)
        .eq(
          "organization_id",
          organizationId
        )
        .eq("is_active", true)
        .maybeSingle();

      if (managerError || !manager) {
        return NextResponse.json(
          {
            error:
              "The selected department manager is not valid.",
          },
          {
            status: 400,
          }
        );
      }
    }

    const {
      data: department,
      error: createError,
    } = await supabase
      .from("departments")
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

          parent_department_id:
            parentDepartmentId,

          manager_id: managerId,

          status:
            cleanText(body.status) ||
            "Active",

          created_by:
            current.employee.user_id,

          updated_by:
            current.employee.user_id,
        },
      ])
      .select()
      .single();

    if (createError) {
      return NextResponse.json(
        {
          error: createError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        department,

        message:
          "Department created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Departments POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create department.",
      },
      {
        status: 500,
      }
    );
  }
}
