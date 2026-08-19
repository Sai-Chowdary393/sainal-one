import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";
import { getCurrentEmployeeAccess } from "../../../../lib/accessControl";

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanNullableText(value) {
  const cleaned =
    cleanText(value);

  return cleaned || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function unauthenticatedResponse(
  message = "You must be logged in."
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 401,
    }
  );
}

function forbiddenResponse(
  message =
    "You do not have permission to perform this action."
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  );
}

// =========================================================
// PATCH
// UPDATE ROLE + PERMISSIONS
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
            "A valid role ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // ACCESS CONTROL
    // =====================================================

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
        "roles.manage"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to update roles."
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // EXISTING ROLE
    // =====================================================

    const {
      data:
        existingRole,
      error:
        existingError,
    } = await supabase
      .from("roles")
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
      existingError
    ) {
      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !existingRole
    ) {
      return NextResponse.json(
        {
          error:
            "Role not found.",
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
        access.employee
          .user_id,
    };

    // =====================================================
    // NAME
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "name"
      )
    ) {
      const name =
        cleanText(
          body.name
        );

      if (
        existingRole
          .is_system_role
      ) {
        if (
          name !==
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
        if (
          !name
        ) {
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

        updates.name =
          name;
      }
    }

    // =====================================================
    // CODE
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "code"
      )
    ) {
      const code =
        cleanText(
          body.code
        ).toUpperCase();

      if (
        existingRole
          .is_system_role
      ) {
        if (
          code !==
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
        if (
          !code
        ) {
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

        if (
          code ===
          "ORG_OWNER"
        ) {
          return NextResponse.json(
            {
              error:
                "ORG_OWNER is reserved for the protected Organisation Owner role.",
            },
            {
              status: 400,
            }
          );
        }

        const {
          data:
            duplicateRole,
          error:
            duplicateRoleError,
        } = await supabase
          .from("roles")
          .select("id")
          .eq(
            "organization_id",
            organizationId
          )
          .ilike(
            "code",
            code
          )
          .neq(
            "id",
            id
          )
          .maybeSingle();

        if (
          duplicateRoleError
        ) {
          return NextResponse.json(
            {
              error:
                duplicateRoleError.message,
            },
            {
              status: 500,
            }
          );
        }

        if (
          duplicateRole
        ) {
          return NextResponse.json(
            {
              error:
                "Another role already uses this code.",
            },
            {
              status: 409,
            }
          );
        }

        updates.code =
          code;
      }
    }

    // =====================================================
    // DESCRIPTION
    // =====================================================

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
        existingRole
          .is_system_role &&
        body.is_active ===
          false
      ) {
        return NextResponse.json(
          {
            error:
              "Protected system roles cannot be deactivated.",
          },
          {
            status: 400,
          }
        );
      }

      updates.is_active =
        Boolean(
          body.is_active
        );
    }

    // =====================================================
    // UPDATE ROLE DETAILS
    // =====================================================

    const editableKeys =
      Object.keys(
        updates
      ).filter(
        (key) =>
          key !==
          "updated_by"
      );

    if (
      editableKeys.length >
      0
    ) {
      const {
        error:
          updateError,
      } = await supabase
        .from("roles")
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
        );

      if (
        updateError
      ) {
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

    // =====================================================
    // UPDATE PERMISSIONS
    // =====================================================

    if (
      Array.isArray(
        body.permission_ids
      )
    ) {
      const permissionIds =
        [
          ...new Set(
            body.permission_ids.filter(
              isUuid
            )
          ),
        ];

      // ===================================================
      // ORG OWNER MUST RETAIN ALL ACTIVE PERMISSIONS
      // ===================================================

      if (
        existingRole
          .is_system_role &&
        existingRole.code ===
          "ORG_OWNER"
      ) {
        const {
          data:
            allPermissions,
          error:
            allPermissionsError,
        } = await supabase
          .from(
            "permissions"
          )
          .select("id")
          .eq(
            "is_active",
            true
          );

        if (
          allPermissionsError
        ) {
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

        const allPermissionIds =
          (
            allPermissions ||
            []
          ).map(
            (
              permission
            ) =>
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

        const selectedSet =
          new Set(
            permissionIds
          );

        const missingPermission =
          allPermissionIds.some(
            (
              permissionId
            ) =>
              !selectedSet.has(
                permissionId
              )
          );

        if (
          missingPermission
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
      } else if (
        permissionIds.length >
        0
      ) {
        // =================================================
        // VALIDATE PERMISSIONS
        // =================================================

        const {
          data:
            validPermissions,
          error:
            permissionsError,
        } = await supabase
          .from(
            "permissions"
          )
          .select("id")
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
          (
            validPermissions ||
            []
          ).length !==
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

      // ===================================================
      // CLEAR OLD PERMISSIONS
      // ===================================================

      const {
        error:
          deleteError,
      } = await supabase
        .from(
          "role_permissions"
        )
        .delete()
        .eq(
          "role_id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        );

      if (
        deleteError
      ) {
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

      // ===================================================
      // INSERT NEW PERMISSIONS
      // ===================================================

      if (
        permissionIds.length >
        0
      ) {
        const assignments =
          permissionIds.map(
            (
              permissionId
            ) => ({
              organization_id:
                organizationId,

              role_id:
                id,

              permission_id:
                permissionId,

              granted_by:
                access.employee
                  .user_id,
            })
          );

        const {
          error:
            insertError,
        } = await supabase
          .from(
            "role_permissions"
          )
          .insert(
            assignments
          );

        if (
          insertError
        ) {
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

    // =====================================================
    // REFRESH ROLE
    // =====================================================

    const {
      data:
        updatedRole,
      error:
        refreshedRoleError,
    } = await supabase
      .from("roles")
      .select("*")
      .eq(
        "id",
        id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .single();

    if (
      refreshedRoleError
    ) {
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
      role:
        updatedRole,

      message:
        "Role and permissions updated successfully.",
    });
  } catch (
    error
  ) {
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

// =========================================================
// DELETE
// DEACTIVATE ROLE
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
            "A valid role ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // ACCESS CONTROL
    // =====================================================

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
        "roles.manage"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to deactivate roles."
      );
    }

    const supabase =
      await createServerSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // ROLE
    // =====================================================

    const {
      data:
        role,
      error:
        roleError,
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
      roleError
    ) {
      return NextResponse.json(
        {
          error:
            roleError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !role
    ) {
      return NextResponse.json(
        {
          error:
            "Role not found.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // SYSTEM ROLE PROTECTION
    // =====================================================

    if (
      role
        .is_system_role
    ) {
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

    // =====================================================
    // ALREADY INACTIVE
    // =====================================================

    if (
      !role.is_active
    ) {
      return NextResponse.json({
        role,

        message:
          `${role.name} is already inactive.`,
      });
    }

    // =====================================================
    // CHECK EMPLOYEE ASSIGNMENTS
    // =====================================================

    const {
      count:
        assignmentCount,
      error:
        assignmentError,
    } = await supabase
      .from(
        "user_roles"
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "role_id",
        id
      )
      .eq(
        "organization_id",
        organizationId
      );

    if (
      assignmentError
    ) {
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

    if (
      (
        assignmentCount ||
        0
      ) >
      0
    ) {
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

    // =====================================================
    // DEACTIVATE
    // =====================================================

    const {
      data:
        deactivatedRole,
      error:
        deactivateError,
    } = await supabase
      .from("roles")
      .update({
        is_active:
          false,

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
      deactivateError
    ) {
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
      role:
        deactivatedRole,

      message:
        `${role.name} was deactivated successfully.`,
    });
  } catch (
    error
  ) {
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
