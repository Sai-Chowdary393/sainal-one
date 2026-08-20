import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../lib/supabaseAdmin";

import {
  attachRecordOwner,
  buildClientAccess,
  canViewOwnedRecord,
  getRecordPermissions,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../../lib/recordAccess";

// =========================================================
// CONSTANTS
// =========================================================

const ALLOWED_STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
];

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
    String(
      value ||
        ""
    )
  );
}

function forbidden(message) {
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

function getPermissions(access) {
  return getRecordPermissions(
    access,
    {
      prefix:
        "proposals",

      module:
        "Proposals",
    }
  );
}

// =========================================================
// LOAD RECORD
// =========================================================

async function loadProposal({
  supabase,
  organizationId,
  proposalId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "proposals"
      )
      .select("*")
      .eq(
        "id",
        proposalId
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

  return data;
}

// =========================================================
// GET
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
            "A valid proposal ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const permissions =
      getPermissions(
        access
      );

    if (
      !permissions.canViewAll &&
      !permissions.canViewTeam &&
      !permissions.canViewOwn
    ) {
      return forbidden(
        "You do not have permission to view proposals."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const proposal =
      await loadProposal({
        supabase,
        organizationId,

        proposalId:
          id,
      });

    if (
      !proposal
    ) {
      return NextResponse.json(
        {
          error:
            "Proposal not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,

        record:
          proposal,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to view this proposal."
      );
    }

    const formattedProposal =
      await attachRecordOwner({
        supabase,
        organizationId,

        record:
          proposal,
      });

    let employees = [];

    if (
      permissions.canAssign
    ) {
      employees =
        await loadAssignableEmployees({
          supabase,
          organizationId,
        });
    }

    return NextResponse.json({
      proposal:
        formattedProposal,

      employees,

      currentEmployee:
        access.employee,

      access:
        buildClientAccess({
          access,
          permissions,
        }),
    });
  } catch (error) {
    console.error(
      "Proposal GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load proposal.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// PATCH
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
            "A valid proposal ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const permissions =
      getPermissions(
        access
      );

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const proposal =
      await loadProposal({
        supabase,
        organizationId,

        proposalId:
          id,
      });

    if (
      !proposal
    ) {
      return NextResponse.json(
        {
          error:
            "Proposal not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,

        record:
          proposal,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to update this proposal."
      );
    }

    const body =
      await request.json();

    const editableFields = [
      "title",
      "client",
      "contact",
      "email",
      "service",
      "amount",
      "proposal_text",
      "status",
    ];

    const wantsEdit =
      editableFields.some(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
      );

    const wantsOwnerChange =
      Object.prototype.hasOwnProperty.call(
        body,
        "owner_employee_id"
      );

    if (
      wantsEdit &&
      !permissions.canEdit
    ) {
      return forbidden(
        "You do not have permission to edit proposals."
      );
    }

    if (
      wantsOwnerChange &&
      !permissions.canAssign
    ) {
      return forbidden(
        "You do not have permission to assign proposals."
      );
    }

    if (
      !wantsEdit &&
      !wantsOwnerChange
    ) {
      return NextResponse.json(
        {
          error:
            "No supported proposal changes were provided.",
        },
        {
          status:
            400,
        }
      );
    }

    const updates = {
      updated_at:
        new Date()
          .toISOString(),
    };

    // =====================================================
    // TITLE
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "title"
      )
    ) {
      const title =
        cleanText(
          body.title
        );

      if (
        !title
      ) {
        return NextResponse.json(
          {
            error:
              "Proposal title cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.title =
        title;
    }

    // =====================================================
    // CLIENT
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "client"
      )
    ) {
      const client =
        cleanText(
          body.client
        );

      if (
        !client
      ) {
        return NextResponse.json(
          {
            error:
              "Client name cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.client =
        client;
    }

    // =====================================================
    // CONTACT
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "contact"
      )
    ) {
      updates.contact =
        cleanNullableText(
          body.contact
        );
    }

    // =====================================================
    // EMAIL
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "email"
      )
    ) {
      const email =
        cleanText(
          body.email
        );

      if (
        email &&
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
            status:
              400,
          }
        );
      }

      updates.email =
        email ||
        null;
    }

    // =====================================================
    // SERVICE
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "service"
      )
    ) {
      const service =
        cleanText(
          body.service
        );

      if (
        !service
      ) {
        return NextResponse.json(
          {
            error:
              "Service cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.service =
        service;
    }

    // =====================================================
    // AMOUNT
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "amount"
      )
    ) {
      updates.amount =
        cleanNullableText(
          body.amount
        );
    }

    // =====================================================
    // TEXT
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "proposal_text"
      )
    ) {
      const proposalText =
        cleanText(
          body.proposal_text
        );

      if (
        !proposalText
      ) {
        return NextResponse.json(
          {
            error:
              "Proposal content cannot be empty.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.proposal_text =
        proposalText;
    }

    // =====================================================
    // STATUS
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "status"
      )
    ) {
      if (
        !ALLOWED_STATUSES.includes(
          body.status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid proposal status.",
          },
          {
            status:
              400,
          }
        );
      }

      updates.status =
        body.status;
    }

    // =====================================================
    // OWNER
    // =====================================================

    if (
      wantsOwnerChange
    ) {
      const requestedOwnerId =
        cleanText(
          body.owner_employee_id
        );

      if (
        !requestedOwnerId
      ) {
        updates.owner_employee_id =
          null;
      } else {
        if (
          !isUuid(
            requestedOwnerId
          )
        ) {
          return NextResponse.json(
            {
              error:
                "The selected proposal owner is not valid.",
            },
            {
              status:
                400,
            }
          );
        }

        const owner =
          await validateRecordOwner({
            supabase,
            organizationId,

            employeeId:
              requestedOwnerId,
          });

        if (
          !owner
        ) {
          return NextResponse.json(
            {
              error:
                "The selected proposal owner is not valid.",
            },
            {
              status:
                400,
            }
          );
        }

        updates.owner_employee_id =
          owner.id;
      }
    }

    // =====================================================
    // UPDATE
    // =====================================================

    const {
      data:
        updatedProposal,
      error:
        updateError,
    } =
      await supabase
        .from(
          "proposals"
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

    const formattedProposal =
      await attachRecordOwner({
        supabase,
        organizationId,

        record:
          updatedProposal,
      });

    return NextResponse.json({
      proposal:
        formattedProposal,

      message:
        "Proposal updated successfully.",
    });
  } catch (error) {
    console.error(
      "Proposal PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to update proposal.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// DELETE
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
            "A valid proposal ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const permissions =
      getPermissions(
        access
      );

    if (
      !permissions.canDelete
    ) {
      return forbidden(
        "You do not have permission to delete proposals."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const proposal =
      await loadProposal({
        supabase,
        organizationId,

        proposalId:
          id,
      });

    if (
      !proposal
    ) {
      return NextResponse.json(
        {
          error:
            "Proposal not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,

        record:
          proposal,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to delete this proposal."
      );
    }

    const {
      error:
        deleteError,
    } =
      await supabase
        .from(
          "proposals"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (
      deleteError
    ) {
      throw new Error(
        deleteError.message
      );
    }

    return NextResponse.json({
      message:
        "Proposal deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Proposal DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to delete proposal.",
      },
      {
        status:
          500,
      }
    );
  }
}
