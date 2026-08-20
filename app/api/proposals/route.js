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
  attachRecordOwner,
  buildClientAccess,
  getRecordPermissions,
  getTeamEmployeeIds,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../lib/recordAccess";

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

function generateProposalNumber() {
  const year =
    new Date()
      .getFullYear();

  const suffix =
    Date.now()
      .toString()
      .slice(-6);

  return `SNP-${year}-${suffix}`;
}

// =========================================================
// ATTACH OWNERS
// =========================================================

async function attachOwners({
  supabase,
  organizationId,
  proposals,
}) {
  return Promise.all(
    (
      proposals ||
      []
    ).map(
      (
        proposal
      ) =>
        attachRecordOwner({
          supabase,
          organizationId,
          record:
            proposal,
        })
    )
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

    let query =
      supabase
        .from(
          "proposals"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    // =====================================================
    // TEAM
    // =====================================================

    if (
      !permissions.canViewAll &&
      permissions.canViewTeam
    ) {
      const teamEmployeeIds =
        await getTeamEmployeeIds({
          supabase,

          employee:
            access.employee,
        });

      query =
        query.in(
          "owner_employee_id",
          teamEmployeeIds
        );
    }

    // =====================================================
    // OWN
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
        proposalRows,
      error,
    } =
      await query.order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    const proposals =
      await attachOwners({
        supabase,
        organizationId,

        proposals:
          proposalRows ||
          [],
      });

    // =====================================================
    // ASSIGNABLE EMPLOYEES
    // =====================================================

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
      proposals,

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
      "Proposals GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load proposals.",
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
      getPermissions(
        access
      );

    if (
      !permissions.canCreate
    ) {
      return forbidden(
        "You do not have permission to create proposals."
      );
    }

    const body =
      await request.json();

    const title =
      cleanText(
        body.title
      );

    const client =
      cleanText(
        body.client
      );

    const service =
      cleanText(
        body.service
      );

    if (
      !title ||
      !client ||
      !service
    ) {
      return NextResponse.json(
        {
          error:
            "Proposal title, client and service are required.",
        },
        {
          status:
            400,
        }
      );
    }

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

    const status =
      cleanText(
        body.status
      ) ||
      "Draft";

    if (
      !ALLOWED_STATUSES.includes(
        status
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

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // OWNER
    // =====================================================

    let ownerEmployeeId =
      access.employee.id;

    if (
      body.owner_employee_id
    ) {
      if (
        !permissions.canAssign
      ) {
        return forbidden(
          "You do not have permission to assign proposals."
        );
      }

      const requestedOwnerId =
        cleanText(
          body.owner_employee_id
        );

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

      ownerEmployeeId =
        owner.id;
    }

    // =====================================================
    // RELATED RECORDS
    // =====================================================

    const leadId =
      body.lead_id &&
      isUuid(
        body.lead_id
      )
        ? body.lead_id
        : null;

    const customerId =
      body.customer_id &&
      isUuid(
        body.customer_id
      )
        ? body.customer_id
        : null;

    const quoteId =
      body.quote_id &&
      isUuid(
        body.quote_id
      )
        ? body.quote_id
        : null;

    // =====================================================
    // PROPOSAL NUMBER
    // =====================================================

    const proposalNumber =
      cleanText(
        body.proposal_number
      ) ||
      generateProposalNumber();

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
            "Proposal content is required.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // INSERT
    // =====================================================

    const {
      data:
        proposal,
      error:
        createError,
    } =
      await supabase
        .from(
          "proposals"
        )
        .insert([
          {
            organization_id:
              organizationId,

            proposal_number:
              proposalNumber,

            lead_id:
              leadId,

            customer_id:
              customerId,

            quote_id:
              quoteId,

            title,

            client,

            contact:
              cleanNullableText(
                body.contact
              ),

            email:
              email ||
              null,

            service,

            amount:
              cleanNullableText(
                body.amount
              ),

            status,

            proposal_text:
              proposalText,

            owner_employee_id:
              ownerEmployeeId,

            updated_at:
              new Date()
                .toISOString(),
          },
        ])
        .select()
        .single();

    if (
      createError
    ) {
      throw new Error(
        createError.message
      );
    }

    const formattedProposal =
      await attachRecordOwner({
        supabase,
        organizationId,
        record:
          proposal,
      });

    return NextResponse.json(
      {
        proposal:
          formattedProposal,

        message:
          "Proposal created successfully.",
      },
      {
        status:
          201,
      }
    );
  } catch (error) {
    console.error(
      "Proposal POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create proposal.",
      },
      {
        status:
          500,
      }
    );
  }
}
