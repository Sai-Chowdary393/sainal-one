import {
  createAdminSupabaseClient,
} from "../supabaseAdmin";

import {
  businessProfilePrompt,
} from "../ai/businessProfile";

// =========================================================
// AI LEAD ANALYSIS
// =========================================================

async function analyseLead({
  name,
  company,
  email,
  phone,
  notes,
  profile,
  openai,
}) {
  try {
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

Analyse incoming leads in the context of this specific business.

Rules:
- Assess how well the lead matches the configured services.
- Consider whether the lead matches the target customers.
- Give practical and industry-relevant advice.
- Do not assume the company provides website development unless configured or requested.
- Do not invent information.
- Use professional UK business language.
- Follow the company's custom AI instructions.
            `,
          },

          {
            role:
              "user",

            content: `
Analyse this lead.

Name: ${name}
Company: ${company}
Email: ${email}
Phone: ${phone}
Requirement: ${notes}

Return exactly in this format:

Score: Hot/Warm/Cold
Summary: short business-specific summary
Next Action: practical recommended next step
            `,
          },
        ],
      });

    const text =
      completion
        .choices?.[0]
        ?.message
        ?.content ||
      "";

    return {
      ai_score:
        text.match(
          /Score:\s*(.*)/i
        )?.[1]?.trim() ||
        "Warm",

      ai_summary:
        text.match(
          /Summary:\s*(.*)/i
        )?.[1]?.trim() ||
        "Lead created through the AI Assistant.",

      ai_next_action:
        text.match(
          /Next Action:\s*(.*)/i
        )?.[1]?.trim() ||
        "Review the requirement and contact the lead.",
    };
  } catch (error) {
    console.error(
      "Lead analysis error:",
      error
    );

    return {
      ai_score:
        "Warm",

      ai_summary:
        "Lead created through the AI Assistant.",

      ai_next_action:
        "Review the requirement and contact the lead.",
    };
  }
}

// =========================================================
// CREATE LEAD FROM AI PROMPT
// =========================================================

export async function createLeadFromPrompt({
  prompt,
  profile,
  organizationId,
  employeeId,
  openai,
}) {
  if (
    !organizationId
  ) {
    throw new Error(
      "Organisation is required to create a lead."
    );
  }

  if (
    !employeeId
  ) {
    throw new Error(
      "Employee ownership is required to create a lead."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  // =======================================================
  // EXTRACT BASIC VALUES
  // =======================================================

  const emailMatch =
    prompt.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

  const phoneMatch =
    prompt.match(
      /(\+?\d[\d\s-]{7,})/
    );

  const valueMatch =
    prompt.match(
      /£\s?[\d,]+(?:\.\d{1,2})?/i
    );

  let name =
    "Unknown Lead";

  let company =
    "Unknown Company";

  // =======================================================
  // NAME
  // =======================================================

  const nameMatch =
    prompt.match(
      /for\s+(.*?)\s+from/i
    );

  if (
    nameMatch?.[1]
  ) {
    name =
      nameMatch[1]
        .trim();
  }

  // =======================================================
  // COMPANY
  // =======================================================

  const companyMatch =
    prompt.match(
      /from\s+(.*?)(?:\s+email|\s+phone|\s+value|\s+needs|\s+requires|$)/i
    );

  if (
    companyMatch?.[1]
  ) {
    company =
      companyMatch[1]
        .trim();
  }

  const email =
    emailMatch?.[0] ||
    "";

  const phone =
    phoneMatch?.[0]
      ?.trim() ||
    "";

  const value =
    valueMatch?.[0] ||
    "";

  // =======================================================
  // DUPLICATE CHECK
  // =======================================================

  let duplicateQuery =
    supabase
      .from(
        "leads"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      );

  if (
    email
  ) {
    duplicateQuery =
      duplicateQuery.eq(
        "email",
        email
      );
  } else {
    duplicateQuery =
      duplicateQuery
        .ilike(
          "name",
          name
        )
        .ilike(
          "company",
          company
        );
  }

  const {
    data:
      existingLeads,
    error:
      existingError,
  } =
    await duplicateQuery.limit(
      1
    );

  if (
    existingError
  ) {
    throw new Error(
      existingError.message
    );
  }

  if (
    existingLeads?.length >
    0
  ) {
    return {
      alreadyExists:
        true,

      existing:
        existingLeads[0],
    };
  }

  // =======================================================
  // AI ANALYSIS
  // =======================================================

  const aiAnalysis =
    await analyseLead({
      name,
      company,
      email,
      phone,

      notes:
        prompt,

      profile,
      openai,
    });

  const now =
    new Date()
      .toISOString();

  // =======================================================
  // INSERT
  // =======================================================

  const {
    data:
      createdLead,
    error,
  } =
    await supabase
      .from(
        "leads"
      )
      .insert([
        {
          organization_id:
            organizationId,

          owner_employee_id:
            employeeId,

          name,

          company,

          email,

          phone,

          value,

          status:
            "New",

          notes:
            prompt,

          source:
            "AI Assistant",

          ai_score:
            aiAnalysis.ai_score,

          ai_summary:
            aiAnalysis.ai_summary,

          ai_next_action:
            aiAnalysis.ai_next_action,

          created_at:
            now,
        },
      ])
      .select()
      .single();

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return {
    alreadyExists:
      false,

    created:
      createdLead,
  };
}
