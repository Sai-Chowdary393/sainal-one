import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";

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
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const {
    data: employee,
  } = await supabase
    .from("employees")
    .select(
      `
        id,
        organization_id,
        user_id,
        is_organization_owner,
        is_active
      `
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  return employee || null;
}

export async function GET(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid employee ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const currentEmployee =
      await getCurrentEmployee(
        supabase
      );

    if (!currentEmployee) {
      return NextResponse.json(
        {
          error:
            "You must be logged in as an active employee.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: employee,
      error,
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
              description,
              is_system_role,
              is_active
            )
          )
        `
      )
      .eq("id", id)
      .eq(
        "organization_id",
        currentEmployee.organization_id
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "Employee not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      employee
    );
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
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid employee ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const currentEmployee =
      await getCurrentEmployee(
        supabase
      );

    if (!currentEmployee) {
      return NextResponse.json(
        {
          error:
            "You must be logged in as an active employee.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !currentEmployee
        .is_organization_owner
    ) {
      return NextResponse.json(
        {
          error:
            "Only the organisation owner can update employees.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: targetEmployee,
      error: targetError,
    } = await supabase
      .from("employees")
      .select(
        `
          id,
          user_id,
          is_organization_owner,
          organization_id
        `
      )
      .eq("id", id)
      .eq(
        "organization_id",
        currentEmployee.organization_id
      )
      .maybeSingle();

    if (
      targetError ||
      !targetEmployee
    ) {
      return NextResponse.json(
        {
          error:
            targetError?.message ||
            "Employee not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const updates = {
      updated_by:
        currentEmployee.user_id,
    };

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
            status: 400,
          }
        );
      }

      updates.full_name =
        fullName;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "email"
      )
    ) {
      const email = cleanText(
        body.email
      ).toLowerCase();

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Please enter a valid email address.",
          },
          {
            status: 400,
          }
        );
      }

      updates.email = email;
    }

    const nullableFields = [
      "phone",
      "job_title",
      "department_id",
      "manager_id",
      "backup_employee_id",
      "start_date",
      "end_date",
      "profile_image_url",
    ];

    nullableFields.forEach(
      (field) => {
        if (
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
        ) {
          updates[field] =
            cleanNullableText(
              body[field]
            );
        }
      }
    );

    const textFields = [
      "employee_number",
      "employment_type",
      "employment_status",
      "availability_status",
      "timezone",
      "locale",
    ];

    textFields.forEach((field) => {
      if (
        Object.prototype.hasOwnProperty.call(
          body,
          field
        )
      ) {
        updates[field] =
          cleanText(body[field]);
      }
    });

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "is_active"
      )
    ) {
      if (
        targetEmployee
          .is_organization_owner &&
        body.is_active === false
      ) {
        return NextResponse.json(
          {
            error:
              "The organisation owner cannot be deactivated.",
          },
          {
            status: 400,
          }
        );
      }

      updates.is_active =
        Boolean(body.is_active);
    }

    if (
      updates.manager_id === id
    ) {
      return NextResponse.json(
        {
          error:
            "An employee cannot be their own manager.",
        },
        {
          status: 400,
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
          status: 400,
        }
      );
    }

    const {
      data: updatedEmployee,
      error: updateError,
    } = await supabase
      .from("employees")
      .update(updates)
      .eq("id", id)
      .eq(
        "organization_id",
        currentEmployee.organization_id
      )
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error:
            updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      Array.isArray(body.role_ids)
    ) {
      const roleIds =
        body.role_ids.filter(
          isUuid
        );

      const {
        error: deleteRolesError,
      } = await supabase
        .from("user_roles")
        .delete()
        .eq(
          "employee_id",
          id
        )
        .eq(
          "organization_id",
          currentEmployee.organization_id
        );

      if (deleteRolesError) {
        return NextResponse.json(
          {
            error:
              "Employee details were updated, but existing roles could not be cleared: " +
              deleteRolesError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (roleIds.length > 0) {
        const assignments =
          roleIds.map(
            (roleId) => ({
              organization_id:
                currentEmployee.organization_id,

              employee_id: id,

              role_id: roleId,

              assigned_by:
                currentEmployee.user_id,
            })
          );

        const {
          error:
            roleAssignmentError,
        } = await supabase
          .from("user_roles")
          .insert(assignments);

        if (
          roleAssignmentError
        ) {
          return NextResponse.json(
            {
              error:
                "Employee details were updated, but roles could not be assigned: " +
                roleAssignmentError.message,
            },
            {
              status: 500,
            }
          );
        }
      }
    }

    return NextResponse.json({
      employee:
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
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid employee ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const currentEmployee =
      await getCurrentEmployee(
        supabase
      );

    if (!currentEmployee) {
      return NextResponse.json(
        {
          error:
            "You must be logged in as an active employee.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !currentEmployee
        .is_organization_owner
    ) {
      return NextResponse.json(
        {
          error:
            "Only the organisation owner can deactivate employees.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: targetEmployee,
      error: targetError,
    } = await supabase
      .from("employees")
      .select(
        `
          id,
          full_name,
          is_organization_owner
        `
      )
      .eq("id", id)
      .eq(
        "organization_id",
        currentEmployee.organization_id
      )
      .maybeSingle();

    if (
      targetError ||
      !targetEmployee
    ) {
      return NextResponse.json(
        {
          error:
            targetError?.message ||
            "Employee not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      targetEmployee
        .is_organization_owner
    ) {
      return NextResponse.json(
        {
          error:
            "The organisation owner cannot be deactivated.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error: deactivateError,
    } = await supabase
      .from("employees")
      .update({
        is_active: false,
        employment_status:
          "Inactive",
        availability_status:
          "Unavailable",
        updated_by:
          currentEmployee.user_id,
      })
      .eq("id", id)
      .eq(
        "organization_id",
        currentEmployee.organization_id
      );

    if (deactivateError) {
      return NextResponse.json(
        {
          error:
            deactivateError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message:
        `${targetEmployee.full_name} was deactivated successfully.`,
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
        status: 500,
      }
    );
  }
}
