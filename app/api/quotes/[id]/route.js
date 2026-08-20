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
  canViewOwnedRecord,
  attachRecordOwner,
  buildClientAccess,
  getRecordPermissions,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../../lib/recordAccess";

import {
  deleteQuote,
  loadQuoteById,
  submitQuoteForApproval,
  updateQuote,
} from "../../../../lib/quotes/quoteEngine";

// =========================================================
// HELPERS
// =========================================================

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

function forbidden(
  message
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

function getPermissions(
  access
) {
  return getRecordPermissions(
    access,
    {
      prefix:
        "quotes",

      module:
        "Quotes",
    }
  );
}

// =========================================================
// LOAD + VERIFY QUOTE
// =========================================================

async function loadVisibleQuote({
  supabase,
  access,
  permissions,
  quoteId,
}) {
  const quote =
    await loadQuoteById({
      supabase,

      organizationId:
        access.employee
          .organization_id,

      quoteId,
    });

  if (
    !quote
  ) {
    return {
      quote:
        null,

      visible:
        false,
    };
  }

  const visible =
    await canViewOwnedRecord({
      supabase,
      access,
      permissions,
      record:
        quote,
    });

  return {
    quote,
    visible,
  };
}

// =========================================================
// GET ONE QUOTE
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
            "A valid quote ID is required.",
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
        "You do not have permission to view quotes."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const {
      quote,
      visible,
    } =
      await loadVisibleQuote({
        supabase,
        access,
        permissions,

        quoteId:
          id,
      });

    if (
      !quote
    ) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to view this quote."
      );
    }

    const formattedQuote =
      await attachRecordOwner({
        supabase,

        organizationId:
          access.employee
            .organization_id,

        record:
          quote,
      });

    let employees = [];

    if (
      permissions.canAssign
    ) {
      employees =
        await loadAssignableEmployees({
          supabase,

          organizationId:
            access.employee
              .organization_id,
        });
    }

    return NextResponse.json({
      quote:
        formattedQuote,

      employees,

      currentEmployee:
        access.employee,

      access:
        buildClientAccess({
          access,
          permissions,
        }),
    });
  } catch (
    error
  ) {
    console.error(
      "Quote GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load quote.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// PATCH QUOTE
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
            "A valid quote ID is required.",
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

    const {
      quote:
        existingQuote,
      visible,
    } =
      await loadVisibleQuote({
        supabase,
        access,
        permissions,

        quoteId:
          id,
      });

    if (
      !existingQuote
    ) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to update this quote."
      );
    }

    const body =
      await request.json();

    const wantsOwnerChange =
      Object.prototype.hasOwnProperty.call(
        body,
        "owner_employee_id"
      );

    const quoteFields = [
      "lead_id",
      "customer_id",
      "client",
      "contact",
      "email",
      "phone",
      "service",
      "amount",
      "quote_text",
      "status",
    ];

    const wantsQuoteEdit =
      quoteFields.some(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
      );

    if (
      wantsQuoteEdit &&
      !permissions.canEdit
    ) {
      return forbidden(
        "You do not have permission to edit quotes."
      );
    }

    if (
      wantsOwnerChange &&
      !permissions.canAssign
    ) {
      return forbidden(
        "You do not have permission to assign quotes."
      );
    }

    if (
      !wantsQuoteEdit &&
      !wantsOwnerChange
    ) {
      return NextResponse.json(
        {
          error:
            "No supported quote changes were provided.",
        },
        {
          status:
            400,
        }
      );
    }

    let updatedQuote =
      existingQuote;

    // =====================================================
    // NORMAL QUOTE UPDATE
    // =====================================================

    if (
      wantsQuoteEdit
    ) {
      const quoteInput = {};

      quoteFields.forEach(
        (
          field
        ) => {
          if (
            Object.prototype.hasOwnProperty.call(
              body,
              field
            )
          ) {
            quoteInput[
              field
            ] =
              body[
                field
              ];
          }
        }
      );

      updatedQuote =
        await updateQuote({
          supabase,

          organizationId:
            access.employee
              .organization_id,

          quoteId:
            id,

          input:
            quoteInput,
        });

      if (
        !updatedQuote
      ) {
        return NextResponse.json(
          {
            error:
              "Quote not found.",
          },
          {
            status:
              404,
          }
        );
      }
    }

    // =====================================================
    // OWNER UPDATE
    // =====================================================

    if (
      wantsOwnerChange
    ) {
      const requestedOwner =
        body.owner_employee_id
          ? String(
              body.owner_employee_id
            )
          : null;

      if (
        requestedOwner &&
        !isUuid(
          requestedOwner
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The selected quote owner is not valid.",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        requestedOwner
      ) {
        const validOwner =
          await validateRecordOwner({
            supabase,

            organizationId:
              access.employee
                .organization_id,

            employeeId:
              requestedOwner,
          });

        if (
          !validOwner
        ) {
          return NextResponse.json(
            {
              error:
                "The selected quote owner is not valid.",
            },
            {
              status:
                400,
            }
          );
        }
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "quotes"
          )
          .update({
            owner_employee_id:
              requestedOwner,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            access.employee
              .organization_id
          )
          .select()
          .single();

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }

      updatedQuote =
        data;
    }

    const formattedQuote =
      await attachRecordOwner({
        supabase,

        organizationId:
          access.employee
            .organization_id,

        record:
          updatedQuote,
      });

    return NextResponse.json({
      quote:
        formattedQuote,

      message:
        "Quote updated successfully.",
    });
  } catch (
    error
  ) {
    console.error(
      "Quote PATCH error:",
      error
    );

    const message =
      error.message ||
      "Unable to update quote.";

    const businessError =
      [
        "invalid",
        "uuid",
        "pending approval",
        "cannot",
      ].some(
        (
          word
        ) =>
          message
            .toLowerCase()
            .includes(
              word
            )
      );

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          businessError
            ? 400
            : 500,
      }
    );
  }
}

// =========================================================
// POST QUOTE ACTION
// =========================================================

export async function POST(
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
            "A valid quote ID is required.",
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

    const {
      quote,
      visible,
    } =
      await loadVisibleQuote({
        supabase,
        access,
        permissions,

        quoteId:
          id,
      });

    if (
      !quote
    ) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to perform actions on this quote."
      );
    }

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const action =
      String(
        body.action ||
          ""
      )
        .trim()
        .toLowerCase();

    // =====================================================
    // SUBMIT FOR APPROVAL
    // =====================================================

    if (
      action ===
      "submit_for_approval"
    ) {
      /*
       * Submitting for approval changes the quote and starts
       * a workflow. We allow quotes.edit or quotes.approve.
       */
      if (
        !permissions.canEdit &&
        !permissions.canApprove
      ) {
        return forbidden(
          "You do not have permission to submit quotes for approval."
        );
      }

      const result =
        await submitQuoteForApproval({
          supabase,

          organizationId:
            access.employee
              .organization_id,

          userId:
            access.user.id,

          employee:
            access.employee,

          quoteId:
            id,
        });

      return NextResponse.json({
        ...result,

        message:
          "Quote submitted for approval successfully.",
      });
    }

    return NextResponse.json(
      {
        error:
          "Unsupported quote action.",
      },
      {
        status:
          400,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Quote action POST error:",
      error
    );

    const message =
      error.message ||
      "Unable to perform quote action.";

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          400,
      }
    );
  }
}

// =========================================================
// DELETE QUOTE
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
            "A valid quote ID is required.",
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
        "You do not have permission to delete quotes."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const {
      quote,
      visible,
    } =
      await loadVisibleQuote({
        supabase,
        access,
        permissions,

        quoteId:
          id,
      });

    if (
      !quote
    ) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to delete this quote."
      );
    }

    const deleted =
      await deleteQuote({
        supabase,

        organizationId:
          access.employee
            .organization_id,

        quoteId:
          id,
      });

    if (
      !deleted
    ) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status:
            404,
        }
      );
    }

    return NextResponse.json({
      message:
        "Quote deleted successfully.",
    });
  } catch (
    error
  ) {
    console.error(
      "Quote DELETE error:",
      error
    );

    const message =
      error.message ||
      "Unable to delete quote.";

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          message
            .toLowerCase()
            .includes(
              "pending approval"
            )
            ? 400
            : 500,
      }
    );
  }
}
