import {
  NextResponse,
} from "next/server";

import OpenAI from "openai";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

import {
  getRecordPermissions,
  getTeamEmployeeIds,
} from "../../../lib/recordAccess";

import {
  getBusinessProfile,
  businessProfilePrompt,
} from "../../../lib/ai/businessProfile";

// =========================================================
// OPENAI
// =========================================================

const openai =
  new OpenAI({
    apiKey:
      process.env
        .OPENAI_API_KEY,
  });

// =========================================================
// MODULES
// =========================================================

const MODULES = {
  leads: {
    table:
      "leads",
    prefix:
      "leads",
    module:
      "Leads",
    ownerField:
      "owner_employee_id",
  },

  quotes: {
    table:
      "quotes",
    prefix:
      "quotes",
    module:
      "Quotes",
    ownerField:
      "owner_employee_id",
  },

  projects: {
    table:
      "projects",
    prefix:
      "projects",
    module:
      "Projects",
    ownerField:
      "owner_employee_id",
  },

  invoices: {
    table:
      "invoices",
    prefix:
      "invoices",
    module:
      "Invoices",
    ownerField:
      "owner_employee_id",
  },

  followUps: {
    table:
      "follow_ups",
    prefix:
      "followups",
    module:
      "Follow-ups",
    ownerField:
      "assigned_employee_id",
  },
};

// =========================================================
// RBAC LOADER
// =========================================================

async function loadModule({
  supabase,
  access,
  config,
}) {
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

  if (
    !permissions.canViewAll &&
    !permissions.canViewTeam &&
    !permissions.canViewOwn
  ) {
    return [];
  }

  const organizationId =
    access.employee
      .organization_id;

  let query =
    supabase
      .from(
        config.table
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
        config.ownerField,
        teamIds
      );
  } else if (
    !permissions.canViewAll &&
    permissions.canViewOwn
  ) {
    query =
      query.eq(
        config.ownerField,
        access.employee.id
      );
  }

  const {
    data,
    error,
  } =
    await query.order(
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

  return data || [];
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

    if (
      !process.env
        .OPENAI_API_KEY
    ) {
      return NextResponse.json({
        insights:
          "AI business insights are not currently configured.",
      });
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const [
      settingsResult,
      leads,
      quotes,
      projects,
      invoices,
      followUps,
    ] =
      await Promise.all([
        supabase
          .from(
            "company_settings"
          )
          .select("*")
          .eq(
            "organization_id",
            organizationId
          )
          .limit(1),

        loadModule({
          supabase,
          access,
          config:
            MODULES.leads,
        }),

        loadModule({
          supabase,
          access,
          config:
            MODULES.quotes,
        }),

        loadModule({
          supabase,
          access,
          config:
            MODULES.projects,
        }),

        loadModule({
          supabase,
          access,
          config:
            MODULES.invoices,
        }),

        loadModule({
          supabase,
          access,
          config:
            MODULES.followUps,
        }),
      ]);

    if (
      settingsResult.error
    ) {
      throw new Error(
        settingsResult
          .error
          .message
      );
    }

    const profile =
      getBusinessProfile(
        settingsResult
          .data?.[0] ||
          null
      );

    const completion =
      await openai.chat.completions.create({
        model:
          "gpt-4.1-mini",

        messages: [
          {
            role:
              "system",

            content: `
You are SaiNal One AI Operations Manager.

You work for this business:

${businessProfilePrompt(profile)}

The records supplied to you have already been filtered according to
the signed-in employee's permissions.

Security rules:
- Analyse only the supplied records.
- Do not mention or infer hidden records.
- Do not invent customers, leads, quotes, projects, invoices or follow-ups.

Return a maximum of 5 concise, practical business insights.

Use professional UK business language.

Prioritise:
- leads needing attention
- sales pipeline
- payment risks
- project delivery risks
- follow-up actions

You may use simple emoji indicators such as:
🔥 opportunity
💰 revenue/payment
⚠️ risk
📞 follow-up
📈 positive trend

Do not use markdown headings.
Do not use code blocks.
            `,
          },

          {
            role:
              "user",

            content: `
Analyse the business records available to this employee.

Leads:
${JSON.stringify(leads)}

Quotes:
${JSON.stringify(quotes)}

Projects:
${JSON.stringify(projects)}

Invoices:
${JSON.stringify(invoices)}

Follow-ups:
${JSON.stringify(followUps)}

Return no more than 5 actionable insights.
            `,
          },
        ],
      });

    const insights =
      completion
        .choices?.[0]
        ?.message
        ?.content
        ?.trim() ||
      "No insights available.";

    return NextResponse.json({
      insights,
    });
  } catch (error) {
    console.error(
      "Business insights error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed generating business insights.",
      },
      {
        status:
          500,
      }
    );
  }
}
