import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";

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
            "A valid department ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const currentEmployee =
      await getCurrentEmployee(supabase);

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
            "Only the organisation owner can update departments.",
        },
        {
          status: 403,
        }
      );
    }

    const organizationId =
      currentEmployee.organization_id;

    const {
      data: existingDepartment,
      error: existingError,
    } = await supabase
      .from("departments")
      .select("*")
      .eq("id", id)
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (
      existingError ||
      !existingDepartment
    ) {
      return NextResponse.json(
        {
          error:
            existingError?.message ||
            "Department not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body = await request.json();

    const updates = {
      updated_by:
        currentEmployee.user_id,
    };

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "name"
      )
    ) {
      const name = cleanText(
        body.name
      );

      if (!name) {
        return NextResponse.json(
          {
            error:
              "Department name cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.name = name;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "code"
      )
    ) {
      const code = cleanText(
        body.code
      ).toUpperCase();

      if (!code) {
        return NextResponse.json(
          {
            error:
              "Department code cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.code = code;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "description"
      )
    ) {
      updates.description =
        cleanNullableText(
          body.description
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "status"
      )
    ) {
      const allowedStatuses = [
        "Active",
        "Inactive",
        "Archived",
      ];

      if (
        !allowedStatuses.includes(
          body.status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid department status.",
          },
          {
            status: 400,
          }
        );
      }

      updates.status = body.status;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "parent_department_id"
      )
    ) {
      const parentDepartmentId =
        cleanNullableText(
          body.parent_department_id
        );

      if (
        parentDepartmentId === id
      ) {
        return NextResponse.json(
          {
            error:
              "A department cannot be its own parent.",
          },
          {
            status: 400,
          }
        );
      }

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

      if (parentDepartmentId) {
        const {
          data: parentDepartment,
          error: parentError,
        } = await supabase
          .from("departments")
          .select(
            `
              id,
              parent_department_id
            `
          )
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

        if (
          parentDepartment
            .parent_department_id === id
        ) {
          return NextResponse.json(
            {
              error:
                "This parent selection would create a circular department structure.",
            },
            {
              status: 400,
            }
          );
        }
      }

      updates.parent_department_id =
        parentDepartmentId;
    }

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

        if (
          managerError ||
          !manager
        ) {
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

      updates.manager_id = managerId;
    }

    const {
      data: department,
      error: updateError,
    } = await supabase
      .from("departments")
      .update(updates)
      .eq("id", id)
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      department,

      message:
        "Department updated successfully.",
    });
  } catch (error) {
    console.error(
      "Department PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to update department.",
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
            "A valid department ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const currentEmployee =
      await getCurrentEmployee(supabase);

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
            "Only the organisation owner can archive departments.",
        },
        {
          status: 403,
        }
      );
    }

    const organizationId =
      currentEmployee.organization_id;

    const {
      data: department,
      error: departmentError,
    } = await supabase
      .from("departments")
      .select(
        `
          id,
          name,
          status
        `
      )
      .eq("id", id)
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
            departmentError?.message ||
            "Department not found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      count: employeeCount,
      error: employeeCountError,
    } = await supabase
      .from("employees")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq("department_id", id)
      .eq("is_active", true);

    if (employeeCountError) {
      return NextResponse.json(
        {
          error:
            employeeCountError.message,
        },
        {
          status: 500,
        }
      );
    }

    if ((employeeCount || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "This department cannot be archived while active employees are assigned to it. Reassign those employees first.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      count: childCount,
      error: childCountError,
    } = await supabase
      .from("departments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "parent_department_id",
        id
      )
      .neq("status", "Archived");

    if (childCountError) {
      return NextResponse.json(
        {
          error:
            childCountError.message,
        },
        {
          status: 500,
        }
      );
    }

    if ((childCount || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "This department cannot be archived while active child departments are linked to it.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error: archiveError,
    } = await supabase
      .from("departments")
      .update({
        status: "Archived",
        manager_id: null,
        updated_by:
          currentEmployee.user_id,
      })
      .eq("id", id)
      .eq(
        "organization_id",
        organizationId
      );

    if (archiveError) {
      return NextResponse.json(
        {
          error: archiveError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message:
        `${department.name} was archived successfully.`,
    });
  } catch (error) {
    console.error(
      "Department DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to archive department.",
      },
      {
        status: 500,
      }
    );
  }
}
