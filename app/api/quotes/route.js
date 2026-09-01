import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

import {
  createQuote,
} from "../../../lib/quotes/quoteEngine";

// =========================================================
// PERMISSIONS
// =========================================================

function getQuotePermissions(
  access
) {
  const canGenericView =
    Boolean(
      access.isOwner ||
        access.can(
          "quotes.view"
        ) ||
        access.canModuleAction(
          "Quotes",
          "view"
        )
    );

  return {
    canView:
      canGenericView,

    canViewAll:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.view_all"
          ) ||
          access.canModuleAction(
            "Quotes",
            "view_all"
          )
      ),

    canViewTeam:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.view_team"
          ) ||
          access.canModuleAction(
            "Quotes",
            "view_team"
          )
      ),

    /*
     * Security-safe compatibility:
     *
     * quotes.view does NOT become view_all.
     *
     * It becomes view_own so existing roles with the
     * generic View Quotes permission can still access
     * the quotes they own.
     */
    canViewOwn:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.view_own"
          ) ||
          access.canModuleAction(
            "Quotes",
            "view_own"
          ) ||
          canGenericView
      ),

    canCreate:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.create"
          ) ||
          access.canModuleAction(
            "Quotes",
            "create"
          )
      ),

    canEdit:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.edit"
          ) ||
          access.canModuleAction(
            "Quotes",
            "edit"
          )
      ),

    canDelete:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.delete"
          ) ||
          access.canModuleAction(
            "Quotes",
            "delete"
          )
      ),

    canSend:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.send"
          ) ||
          access.canModuleAction(
            "Quotes",
            "send"
          )
      ),

    canApprove:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.approve"
          ) ||
          access.canModuleAction(
            "Quotes",
            [
              "approve",
              "approval",
            ]
          )
      ),

    canAssign:
      Boolean(
        access.isOwner ||
          access.can(
            "quotes.assign"
          ) ||
          access.canModuleAction(
            "Quotes",
            "assign"
          )
      ),
  };
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

// =========================================================
// OWNER DETAILS
// =========================================================

async function attachOwners({
  adminSupabase,
  organizationId,
  quotes,
}) {
  const ownerIds =
    [
      ...new Set(
        (
          quotes ||
          []
        )
          .map(
            (
              quote
            ) =>
              quote
                .owner_employee_id
          )
          .filter(Boolean)
      ),
    ];

  if (
    ownerIds.length ===
    0
  ) {
    return (
      quotes ||
      []
    ).map(
      (
        quote
      ) => ({
        ...quote,

        owner:
          null,
      })
    );
  }

  const {
    data:
      employees,
    error,
  } =
    await adminSupabase
      .from(
        "employees"
      )
      .select(
        `
          id,
          full_name,
          email,
          job_title,
          department_id
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .in(
        "id",
        ownerIds
      );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  const employeeMap =
    new Map(
      (
        employees ||
        []
      ).map(
        (
          employee
        ) => [
          employee.id,
          employee,
        ]
      )
    );

  return (
    quotes ||
    []
  ).map(
    (
      quote
    ) => ({
      ...quote,

      owner:
        quote
          .owner_employee_id
          ? employeeMap.get(
              quote
                .owner_employee_id
            ) ||
            null
          : null,
    })
  );
}

// =========================================================
// GET
// =========================================================

export async function GET() {
  try {
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
      getQuotePermissions(
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

    const adminSupabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    let query =
      adminSupabase
        .from(
          "quotes"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    // =====================================================
    // TEAM VISIBILITY
    // =====================================================

    if (
      !permissions.canViewAll &&
      permissions.canViewTeam
    ) {
      const departmentId =
        access.employee
          .department_id;

      let ownerIds = [
        access.employee.id,
      ];

      if (
        departmentId
      ) {
        const {
          data:
            teamEmployees,
          error:
            teamError,
        } =
          await adminSupabase
            .from(
              "employees"
            )
            .select("id")
            .eq(
              "organization_id",
              organizationId
            )
            .eq(
              "department_id",
              departmentId
            )
            .eq(
              "is_active",
              true
            );

        if (
          teamError
        ) {
          throw new Error(
            teamError.message
          );
        }

        ownerIds =
          (
            teamEmployees ||
            []
          )
            .map(
              (
                employee
              ) =>
                employee.id
            )
            .filter(Boolean);

        if (
          ownerIds.length ===
          0
        ) {
          ownerIds = [
            access.employee.id,
          ];
        }
      }

      query =
        query.in(
          "owner_employee_id",
          ownerIds
        );
    }

    // =====================================================
    // OWN VISIBILITY
    // =====================================================

    else if (
      !permissions.canViewAll &&
      permissions.canViewOwn
    ) {
      query =
        query.eq(
          "owner_employee_id",
          access.employee.id
        );
    }

    const {
      data:
        quoteRows,
      error:
        quotesError,
    } =
      await query.order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (
      quotesError
    ) {
      throw new Error(
        quotesError.message
      );
    }

    const quotes =
      await attachOwners({
        adminSupabase,
        organizationId,

        quotes:
          quoteRows ||
          [],
      });

    let employees = [];

    if (
      permissions.canAssign
    ) {
      const {
        data,
        error,
      } =
        await adminSupabase
          .from(
            "employees"
          )
          .select(
            `
              id,
              full_name,
              email,
              job_title,
              department_id
            `
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "full_name",
            {
              ascending:
                true,
            }
          );

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }

      employees =
        data ||
        [];
    }

    return NextResponse.json({
      quotes,

      employees,

      currentEmployee:
        access.employee,

      access: {
        ...permissions,

        isOwner:
          access.isOwner,

        permissions:
          access.permissionKeys ||
          [],

        roles:
          access.roles ||
          [],
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Quotes GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load quotes.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request
) {
  try {
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
      getQuotePermissions(
        access
      );

    if (
      !permissions.canCreate
    ) {
      return forbidden(
        "You do not have permission to create quotes."
      );
    }

    const body =
      await request.json();

    const adminSupabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    let ownerEmployeeId =
      access.employee.id;

    if (
      body.owner_employee_id
    ) {
      if (
        !permissions.canAssign
      ) {
        return forbidden(
          "You do not have permission to assign quotes."
        );
      }

      const {
        data:
          owner,
        error:
          ownerError,
      } =
        await adminSupabase
          .from(
            "employees"
          )
          .select("id")
          .eq(
            "id",
            body.owner_employee_id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();

      if (
        ownerError
      ) {
        throw new Error(
          ownerError.message
        );
      }

      if (
        !owner
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

      ownerEmployeeId =
        owner.id;
    }

    const quote =
      await createQuote({
        supabase:
          adminSupabase,

        organizationId,

        ownerEmployeeId,

        input:
          body,
      });

    const [
      formattedQuote,
    ] =
      await attachOwners({
        adminSupabase,
        organizationId,

        quotes: [
          quote,
        ],
      });

    return NextResponse.json(
      {
        quote:
          formattedQuote,

        message:
          "Quote created successfully.",
      },
      {
        status:
          201,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Quotes POST error:",
      error
    );

    const message =
      error.message ||
      "Unable to create quote.";

    const validationError =
      [
        "invalid",
        "required",
        "uuid",
        "not valid for this organisation",
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
          validationError
            ? 400
            : 500,
      }
    );
  }
}
