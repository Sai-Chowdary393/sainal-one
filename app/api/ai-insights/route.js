import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import OpenAI from "openai";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    const [
      leadsResult,
      quotesResult,
      projectsResult,
      invoicesResult,
      followUpsResult,
    ] = await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),

      supabase
        .from("quotes")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID),

      supabase
        .from("projects")
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
      leadsResult.error ||
      quotesResult.error ||
      projectsResult.error ||
      invoicesResult.error ||
      followUpsResult.error;

    if (databaseError) {
      return NextResponse.json(
        {
          error: databaseError.message,
        },
        {
          status: 500,
        }
      );
    }

    const leads = leadsResult.data || [];
    const quotes = quotesResult.data || [];
    const projects = projectsResult.data || [];
    const invoices = invoicesResult.data || [];
    const followUps = followUpsResult.data || [];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",

      messages: [
        {
          role: "system",
          content: `
You are SaiNal One AI Operations Manager.

Analyse the company data and create a concise daily management summary.

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

Project Risks
• Insight
• Insight

Follow-up Actions
• Insight
• Insight

Best Next Action
One clear recommended action.

Formatting rules:
- Use plain text only.
- Do not use markdown.
- Do not use asterisks.
- Do not use hashtags.
- Do not use code blocks.
- Use the bullet symbol • for list items.
- Keep each insight short and practical.
- Use UK business style.
- Mention names, amounts and statuses where relevant.
- Do not invent information.
- If there is no relevant risk, clearly say that no current risk was identified.
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

Projects:
${JSON.stringify(projects)}

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
      {
        error: "Failed creating AI insights.",
      },
      {
        status: 500,
      }
    );
  }
}
