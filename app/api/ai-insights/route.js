import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import OpenAI from "openai";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getBusinessProfile(settings) {
  return {
    companyName: settings?.company_name || "The company",
    industry: settings?.industry || "General business services",
    businessType: settings?.business_type || "Service business",
    services: settings?.services || "Professional services",
    targetCustomers: settings?.target_customers || "Business customers",
    aiInstructions:
      settings?.ai_instructions ||
      "Give practical, commercially useful recommendations.",
    currency: settings?.default_currency || "GBP",
  };
}

export async function GET() {
  try {
    const [
      settingsResult,
      leadsResult,
      quotesResult,
      customersResult,
      projectsResult,
      tasksResult,
      invoicesResult,
      followUpsResult,
    ] = await Promise.all([
      supabase
        .from("company_settings")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID)
        .limit(1),

      supabase
        .from("leads")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),

      supabase
        .from("quotes")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),

      supabase
        .from("customers")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),

      supabase
        .from("projects")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),

      supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),

      supabase
        .from("invoices")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),

      supabase
        .from("follow_ups")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),
    ]);

    const databaseError =
      settingsResult.error ||
      leadsResult.error ||
      quotesResult.error ||
      customersResult.error ||
      projectsResult.error ||
      tasksResult.error ||
      invoicesResult.error ||
      followUpsResult.error;

    if (databaseError) {
      return NextResponse.json(
        { error: databaseError.message },
        { status: 500 }
      );
    }

    const settings = settingsResult.data?.[0] || null;
    const profile = getBusinessProfile(settings);

    const leads = leadsResult.data || [];
    const quotes = quotesResult.data || [];
    const customers = customersResult.data || [];
    const projects = projectsResult.data || [];
    const tasks = tasksResult.data || [];
    const invoices = invoicesResult.data || [];
    const followUps = followUpsResult.data || [];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are SaiNal One AI Operations Manager.

You work for the following business:

Company name: ${profile.companyName}
Industry: ${profile.industry}
Business type: ${profile.businessType}
Services offered: ${profile.services}
Target customers: ${profile.targetCustomers}
Custom AI instructions: ${profile.aiInstructions}
Currency: ${profile.currency}

Analyse the company's real data and create a concise daily management summary.

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
          role: "user",
          content: `
Business Data:

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

Create today's management summary for ${profile.companyName}.
          `,
        },
      ],
    });

    const insights =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No AI insights are currently available.";

    const cleanInsights = insights
      .replace(/\*\*/g, "")
      .replace(/^#+\s*/gm, "")
      .replace(/```/g, "")
      .trim();

    return NextResponse.json({
      insights: cleanInsights,
    });
  } catch (error) {
    console.error("AI insights error:", error);

    return NextResponse.json(
      { error: "Failed creating AI insights." },
      { status: 500 }
    );
  }
}
