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

  customers: {
    table:
      "customers",
    prefix:
      "customers",
    module:
      "Customers",
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

  tasks: {
    table:
      "tasks",
    prefix:
      "tasks",
    module:
      "Tasks",
    ownerField:
      "assigned_employee_id",
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
// HELPERS
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
          "AI insights are not currently configured.",
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
      customers,
      projects,
      tasks,
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
            MODULES.customers,
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
            MODULES.tasks,
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

    const settings =
      settingsResult
        .data?.[0] ||
      null;

    const profile =
      getBusinessProfile(
        settings
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

You work for the following business:

${businessProfilePrompt(profile)}

The supplied records have already been filtered according to the
signed-in employee's permissions.

Security rules:
- Analyse only the records supplied to you.
- Never imply that hidden records exist.
- Never reveal information that is not present in the supplied records.
- Do not invent business records.

Create a concise daily management summary.

Use this exact plain-text structure:

Management Summary - DD Month YYYY

Revenue Overview
• Insight
• Insight

Lead Priorities
• Insight
• Insight

Payment Risks
• Insight
• Insight

Project and Work Risks
• Insight
• Insight

Follow-up Actions
• Insight
• Insight

Best Next Action
One clear recommended action.

Rules:
- Tailor every insight to the configured industry and services.
- Do not assume the company provides websites, software or technology services unless configured.
- Use generic language such as service, work, project, job, deliverables and client requirement where appropriate.
- Use plain text only.
- Do not use markdown.
- Do not use asterisks.
- Do not use hashtags.
- Do not use code blocks.
- Use the bullet symbol •.
- Keep insights short and practical.
- Use professional UK business language.
- Mention names, amounts, dates and statuses where relevant.
- Do not invent information.
- Follow the company's custom AI instructions.
- If no risk exists, state that no current risk was identified.
            `,
          },

          {
            role:
              "user",

            content: `
Business Data available to this employee:

Leads:
${JSON.stringify(leads)}

Quotes:
${JSON.stringify(quotes)}

Customers:
${JSON.stringify(customers)}

Projects:
${JSON.stringify(projects)}

Tasks:
${JSON.stringify(tasks)}

Invoices:
${JSON.stringify(invoices)}

Follow-ups:
${JSON.stringify(followUps)}

Create today's management summary.
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
      "No AI insights are currently available.";

    const cleanInsights =
      insights
        .replace(
          /\*\*/g,
          ""
        )
        .replace(
          /^#+\s*/gm,
          ""
        )
        .replace(
          /```/g,
          ""
        )
        .trim();

    return NextResponse.json({
      insights:
        cleanInsights,
    });
  } catch (error) {
    console.error(
      "AI insights error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed creating AI insights.",
      },
      {
        status:
          500,
      }
    );
  }
}
