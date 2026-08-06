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
            "A valid role ID is required.",
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
            "Only the organisation owner can update roles.",
        },
        {
          status: 403,
        }
      );
    }

    const organizationId =
      currentEmployee.organization_id;

    const {
      data: existingRole,
      error: existingError,
    } = await supabase
      .from("roles")
      .select("*")
      .eq("id", id)
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (
      existingError ||
      !existingRole
    ) {
      return NextResponse.json(
        {
          error:
            existingError?.message ||
            "Role not found.",
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
      if (existingRole.is_system_role) {
        if (
          cleanText(body.name) !==
          existingRole.name
        ) {
          return NextResponse.json(
            {
              error:
                "The name of a protected system role cannot be changed.",
            },
            {
              status: 400,
            }
          );
        }
      } else {
        const name = cleanText(
          body.name
        );

        if (!name) {
          return NextResponse.json(
            {
              error:
                "Role name cannot be empty.",
            },
            {
              status: 400,
            }
          );
        }

        updates.name = name;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "code"
      )
    ) {
      if (existingRole.is_system_role) {
        if (
          cleanText(
            body.code
          ).toUpperCase() !==
          existingRole.code
        ) {
          return NextResponse.json(
            {
              error:
                "The code of a protected system role cannot be changed.",
            },
            {
              status: 400,
            }
          );
        }
      } else {
        const code = cleanText(
          body.code
        ).toUpperCase();

        if (!code) {
          return NextResponse.json(
            {
              error:
                "Role code cannot be empty.",
            },
            {
              status: 400,
            }
          );
        }

        updates.code = code;
      }
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
        "is_active"
      )
    ) {
      if (
        existingRole.is_system_role &&
        body.is_active === false
      ) {
        return NextResponse.json(
          {
            error:
              "The Organisation Owner system role cannot be deactivated.",
          },
          {
            status: 400,
          }
        );
      }

      updates.is_active =
        Boolean(body.is_active);
    }

    const editableKeys =
      Object.keys(updates).filter(
        (key) => key !== "updated_by"
      );

    if (editableKeys.length > 0) {
      const {
        error: updateError,
      } = await supabase
        .from("roles")
        .update(updates)
        .eq("id", id)
        .eq(
          "organization_id",
          organizationId
        );

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
    }

    if (
      Array.isArray(
        body.permission_ids
      )
    ) {
      const permissionIds = [
        ...new Set(
          body.permission_ids.filter(
            isUuid
          )
        ),
      ];

      if (
        existingRole.is_system_role &&
        existingRole.code ===
          "ORG_OWNER"
      ) {
        const {
          data: allPermissions,
          error:
            allPermissionsError,
        } = await supabase
          .from("permissions")
          .select("id")
          .eq("is_active", true);

        if (allPermissionsError) {
          return NextResponse.json(
            {
              error:
                allPermissionsError.message,
            },
            {
              status: 500,
            }
          );
        }

        const allPermissionIds = (
          allPermissions || []
        ).map(
          (permission) =>
            permission.id
        );

        if (
          permissionIds.length !==
          allPermissionIds.length
        ) {
          return NextResponse.json(
            {
              error:
                "The Organisation Owner role must retain every active permission.",
            },
            {
              status: 400,
            }
          );
        }

        const selectedSet = new Set(
          permissionIds
        );

        const missingPermission =
          allPermissionIds.some(
            (permissionId) =>
              !selectedSet.has(
                permissionId
              )
          );

        if (missingPermission) {
          return NextResponse.json(
            {
              error:
                "The Organisation Owner role must retain every active permission.",
            },
            {
              status: 400,
            }
          );
        }
      } else if (
        permissionIds.length > 0
      ) {
        const {
          data: validPermissions,
          error:
            permissionsError,
        } = await supabase
          .from("permissions")
          .select("id")
          .eq("is_active", true)
          .in("id", permissionIds);

        if (permissionsError) {
          return NextResponse.json(
            {
              error:
                permissionsError.message,
            },
            {
              status: 500,
            }
          );
        }

        if (
          (validPermissions || [])
            .length !==
          permissionIds.length
        ) {
          return NextResponse.json(
            {
              error:
                "One or more selected permissions are invalid.",
            },
            {
              status: 400,
            }
          );
        }
      }

      const {
        error: deleteError,
      } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", id)
        .eq(
          "organization_id",
          organizationId
        );

      if (deleteError) {
        return NextResponse.json(
          {
            error:
              "The role details were updated, but existing permissions could not be cleared: " +
              deleteError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (permissionIds.length > 0) {
        const assignments =
          permissionIds.map(
            (permissionId) => ({
              organization_id:
                organizationId,

              role_id: id,

              permission_id:
                permissionId,

              granted_by:
                currentEmployee.user_id,
            })
          );

        const {
          error: insertError,
        } = await supabase
          .from("role_permissions")
          .insert(assignments);

        if (insertError) {
          return NextResponse.json(
            {
              error:
                "The existing permissions were cleared, but the new permissions could not be assigned: " +
                insertError.message,
            },
            {
              status: 500,
            }
          );
        }
      }
    }

    const {
      data: updatedRole,
      error: refreshedRoleError,
    } = await supabase
      .from("roles")
      .select("*")
      .eq("id", id)
      .eq(
        "organization_id",
        organizationId
      )
      .single();

    if (refreshedRoleError) {
      return NextResponse.json(
        {
          error:
            refreshedRoleError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      role: updatedRole,

      message:
        "Role and permissions updated successfully.",
    });
  } catch (error) {
    console.error(
      "Role PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to update role.",
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
            "A valid role ID is required.",
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
            "Only the organisation owner can deactivate roles.",
        },
        {
          status: 403,
        }
      );
    }

    const organizationId =
      currentEmployee.organization_id;

    const {
      data: role,
      error: roleError,
    } = await supabase
      .from("roles")
      .select(
        `
          id,
          name,
          code,
          is_system_role,
          is_active
        `
      )
      .eq("id", id)
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (roleError || !role) {
      return NextResponse.json(
        {
          error:
            roleError?.message ||
            "Role not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (role.is_system_role) {
      return NextResponse.json(
        {
          error:
            "Protected system roles cannot be deactivated or deleted.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      count: assignmentCount,
      error: assignmentError,
    } = await supabase
      .from("user_roles")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("role_id", id)
      .eq(
        "organization_id",
        organizationId
      );

    if (assignmentError) {
      return NextResponse.json(
        {
          error:
            assignmentError.message,
        },
        {
          status: 500,
        }
      );
    }

    if ((assignmentCount || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "This role cannot be deactivated while employees are assigned to it. Remove the role from those employees first.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error: deactivateError,
    } = await supabase
      .from("roles")
      .update({
        is_active: false,
        updated_by:
          currentEmployee.user_id,
      })
      .eq("id", id)
      .eq(
        "organization_id",
        organizationId
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
        `${role.name} was deactivated successfully.`,
    });
  } catch (error) {
    console.error(
      "Role DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to deactivate role.",
      },
      {
        status: 500,
      }
    );
  }
}
