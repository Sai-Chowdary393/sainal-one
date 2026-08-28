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
  buildClientAccess,
  canViewOwnedRecord,
  getRecordPermissions,
  getTeamEmployeeIds,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../lib/recordAccess";

// =========================================================
// CONSTANTS
// =========================================================

const ALLOWED_STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
];

const ALLOWED_RELATED_TYPES = [
  "General",
  "Lead",
  "Customer",
  "Quote",
  "Proposal",
  "Project",
  "Invoice",
];

const RELATED_CONFIG = {
  Lead: {
    table:
      "leads",

    prefix:
      "leads",

    module:
      "Leads",
  },

  Customer: {
    table:
      "customers",

    prefix:
      "customers",

    module:
      "Customers",
  },

  Quote: {
    table:
      "quotes",

    prefix:
      "quotes",

    module:
      "Quotes",
  },

  Proposal: {
    table:
      "proposals",

    prefix:
      "proposals",

    module:
      "Proposals",
  },

  Project: {
    table:
      "projects",

    prefix:
      "projects",

    module:
      "Projects",
  },

  Invoice: {
    table:
      "invoices",

    prefix:
      "invoices",

    module:
      "Invoices",
  },
};

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

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function isDateValue(value) {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value)
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
        "followups",

      module:
        "Follow-ups",
    }
  );
}

// =========================================================
// VALIDATE RELATED RECORD
// =========================================================

async function validateRelatedRecord({
  supabase,
  access,
  relatedType,
  relatedId,
}) {
  if (
    relatedType ===
    "General"
  ) {
    return null;
  }

  const config =
    RELATED_CONFIG[
      relatedType
    ];

  if (!config) {
    throw new Error(
      "Invalid related record type."
    );
  }

  if (
    !relatedId ||
    !isUuid(
      relatedId
    )
  ) {
    throw new Error(
      `A valid ${relatedType.toLowerCase()} ID is required.`
    );
  }

  const organizationId =
    access.employee
      .organization_id;

  const {
    data:
      record,
    error,
  } =
    await supabase
      .from(
        config.table
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        relatedId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!record) {
    throw new Error(
      `The selected ${relatedType.toLowerCase()} is not valid for this organisation.`
    );
  }

  const permissions =
    getRecordPermissions(
      access,
      {
        prefix:
          config.prefix,

        module:
          config.module,
      }
    );

  const visible =
    await canViewOwnedRecord({
      supabase,
      access,
      permissions,
      record,
    });

  if (!visible) {
    throw new Error(
      `You do not have permission to create a follow-up for this ${relatedType.toLowerCase()}.`
    );
  }

  return record.id;
}

// =========================================================
// ENRICH ASSIGNEES
// =========================================================

async function enrichFollowUps({
  supabase,
  organizationId,
  followUps,
}) {
  const employeeIds = [
    ...new Set(
      (
        followUps ||
        []
      )
        .map(
          (item) =>
            item.assigned_employee_id
        )
        .filter(Boolean)
    ),
  ];

  if (
    employeeIds.length ===
    0
  ) {
    return (
      followUps ||
      []
    ).map(
      (item) => ({
        ...item,

        assigned_employee:
          null,
      })
    );
  }

  const {
    data:
      employees,
    error,
  } =
    await supabase
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
        employeeIds
      );

  if (error) {
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
        (employee) => [
          employee.id,
          employee,
        ]
      )
    );

  return (
    followUps ||
    []
  ).map(
    (item) => ({
      ...item,

      assigned_employee:
        item.assigned_employee_id
          ? employeeMap.get(
              item.assigned_employee_id
            ) ||
            null
          : null,
    })
  );
}

// =========================================================
// GET
// =========================================================

export async function GET(
  request
) {
  try {
    const access =
      await getServerAccess();

    if (!access.employee) {
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
        "You do not have permission to view follow-ups."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const url =
      new URL(
        request.url
      );

    const scope =
      normalise(
        url.searchParams.get(
          "scope"
        ) ||
          "all"
      );

    const relatedType =
      cleanText(
        url.searchParams.get(
          "related_type"
        )
      );

    const relatedId =
      cleanText(
        url.searchParams.get(
          "related_id"
        )
      );

    let query =
      supabase
        .from(
          "follow_ups"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    if (
      !permissions.canViewAll &&
      permissions.canViewTeam
    ) {
      const teamIds =
        await getTeamEmployeeIds({
          supabase,

          employee:
            access.employee,
        });

      query =
        query.in(
          "assigned_employee_id",
          teamIds
        );
    } else if (
      !permissions.canViewAll &&
      permissions.canViewOwn
    ) {
      query =
        query.eq(
          "assigned_employee_id",
          access.employee.id
        );
    }

    if (
      scope ===
      "mine"
    ) {
      query =
        query.eq(
          "assigned_employee_id",
          access.employee.id
        );
    } else if (
      scope !==
      "all"
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported follow-up scope.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      relatedType
    ) {
      query =
        query.ilike(
          "related_type",
          relatedType
        );
    }

    if (
      relatedId
    ) {
      query =
        query.eq(
          "related_id",
          relatedId
        );
    }

    const {
      data,
      error,
    } =
      await query
        .order(
          "due_date",
          {
            ascending:
              true,

            nullsFirst:
              false,
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    const followUps =
      await enrichFollowUps({
        supabase,
        organizationId,

        followUps:
          data ||
          [],
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
      followUps,

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
      "Follow-ups GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to fetch follow-ups.",
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

    if (!access.employee) {
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
        "You do not have permission to create follow-ups."
      );
    }

    const body =
      await request.json();

    const title =
      cleanText(
        body.title
      );

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Follow-up title is required.",
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
      "Pending";

    if (
      !ALLOWED_STATUSES.includes(
        status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid follow-up status.",
        },
        {
          status:
            400,
        }
      );
    }

    const relatedType =
      cleanText(
        body.related_type
      ) ||
      "General";

    if (
      !ALLOWED_RELATED_TYPES.includes(
        relatedType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid related record type.",
        },
        {
          status:
            400,
        }
      );
    }

    const requestedRelatedId =
      cleanNullableText(
        body.related_id
      );

    const dueDate =
      body.due_date ||
      null;

    if (
      !isDateValue(
        dueDate
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Follow-up due date must use YYYY-MM-DD format.",
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
    // RELATED RECORD
    // =====================================================

    let relatedId =
      null;

    if (
      relatedType !==
      "General"
    ) {
      try {
        relatedId =
          await validateRelatedRecord({
            supabase,
            access,
            relatedType,

            relatedId:
              requestedRelatedId,
          });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error.message,
          },
          {
            status:
              403,
          }
        );
      }
    }

    // =====================================================
    // ASSIGNEE
    // =====================================================

    let assignedEmployeeId =
      access.employee.id;

    if (
      body.assigned_employee_id
    ) {
      if (
        !permissions.canAssign
      ) {
        return forbidden(
          "You do not have permission to assign follow-ups."
        );
      }

      const requestedId =
        cleanText(
          body.assigned_employee_id
        );

      if (
        !isUuid(
          requestedId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The selected follow-up assignee is not valid.",
          },
          {
            status:
              400,
          }
        );
      }

      const employee =
        await validateRecordOwner({
          supabase,
          organizationId,

          employeeId:
            requestedId,
        });

      if (!employee) {
        return NextResponse.json(
          {
            error:
              "The selected follow-up assignee is not valid.",
          },
          {
            status:
              400,
          }
        );
      }

      assignedEmployeeId =
        employee.id;
    }

    const now =
      new Date()
        .toISOString();

    const {
      data:
        followUp,
      error,
    } =
      await supabase
        .from(
          "follow_ups"
        )
        .insert([
          {
            organization_id:
              organizationId,

            related_type:
              relatedType,

            related_id:
              relatedId,

            title,

            note:
              cleanNullableText(
                body.note
              ),

            due_date:
              dueDate,

            status,

            assigned_employee_id:
              assignedEmployeeId,

            created_at:
              now,

            updated_at:
              now,
          },
        ])
        .select()
        .single();

    if (error) {
      throw new Error(
        error.message
      );
    }

    const [
      formattedFollowUp,
    ] =
      await enrichFollowUps({
        supabase,
        organizationId,

        followUps: [
          followUp,
        ],
      });

    return NextResponse.json(
      {
        followUp:
          formattedFollowUp,

        message:
          "Follow-up created successfully.",
      },
      {
        status:
          201,
      }
    );
  } catch (error) {
    console.error(
      "Follow-up POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create follow-up.",
      },
      {
        status:
          500,
      }
    );
  }
}
