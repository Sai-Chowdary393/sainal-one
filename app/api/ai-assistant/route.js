import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import OpenAI from "openai";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

async function createFollowUpFromPrompt(prompt, leads) {
  const matchedLead = leads?.find((lead) =>
    prompt.toLowerCase().includes(String(lead.name || "").toLowerCase())
  );

  const leadName = matchedLead?.name || "Lead";

  const dueDate = prompt.toLowerCase().includes("tomorrow")
    ? getTomorrowDate()
    : null;

  const { data: existingFollowUps } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("organization_id", ORGANIZATION_ID)
    .eq("related_type", "Lead")
    .eq("related_id", matchedLead?.id || null)
    .eq("status", "Pending");

  if (existingFollowUps && existingFollowUps.length > 0) {
    return {
      alreadyExists: true,
      existing: existingFollowUps[0],
    };
  }

  const { data, error } = await supabase
    .from("follow_ups")
    .insert([
      {
        organization_id: ORGANIZATION_ID,
        related_type: "Lead",
        related_id: matchedLead?.id || null,
        title: `Follow up with ${leadName}`,
        note: `AI created follow-up from request: ${prompt}`,
        due_date: dueDate,
        status: "Pending",
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return {
    alreadyExists: false,
    created: data?.[0],
  };
}

async function createLeadFromPrompt(prompt) {
  const { data, error } = await supabase
    .from("leads")
    .insert([
      {
        organization_id: ORGANIZATION_ID,
        name: "AI Created Lead",
        company: "New Company",
        email: "",
        phone: "",
        status: "New",
        value: "",
        notes: prompt,
        source: "AI Assistant",
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0];
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const prompt = body.prompt.toLowerCase();

    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID);

    const { data: quotes } = await supabase
      .from("quotes")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID);

    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID);

    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID);

    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID);

    const { data: followUps } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID);

    if (
      prompt.includes("create follow-up") ||
      prompt.includes("create follow up") ||
      prompt.includes("add follow-up") ||
      prompt.includes("add follow up")
    ) {
      const result = await createFollowUpFromPrompt(body.prompt, leads || []);

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Follow-up already exists.

Title: ${result.existing.title}
Status: ${result.existing.status}
Due Date: ${result.existing.due_date || "No date"}

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Follow-up created successfully.

Title: ${result.created.title}
Status: ${result.created.status}
Due Date: ${result.created.due_date || "No date"}
Note: ${result.created.note}`,
      });
    }

    if (prompt.includes("create lead") || prompt.includes("add lead")) {
      const lead = await createLeadFromPrompt(body.prompt);

      return NextResponse.json({
        answer: `✅ Lead created successfully.

Name: ${lead.name}
Company: ${lead.company}
Status: ${lead.status}
Source: ${lead.source}`,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are SaiNal One AI Operations Manager.

You help SME business owners understand and manage their business.

You can analyse:
- Leads
- Quotes
- Customers
- Projects
- Invoices
- Follow-ups

You should:
- Give practical recommendations
- Highlight urgent actions
- Mention names, values and statuses where useful
- Keep answers clear and business-friendly
- Use UK business style
- Do not invent records that are not in the data

You can also create basic follow-ups and leads when the user clearly asks.
          `,
        },
        {
          role: "user",
          content: `
Business Data:

Leads:
${JSON.stringify(leads || [])}

Quotes:
${JSON.stringify(quotes || [])}

Customers:
${JSON.stringify(customers || [])}

Projects:
${JSON.stringify(projects || [])}

Invoices:
${JSON.stringify(invoices || [])}

Follow Ups:
${JSON.stringify(followUps || [])}

User Question:
${body.prompt}
          `,
        },
      ],
    });

    return NextResponse.json({
      answer: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "AI Assistant failed",
      },
      {
        status: 500,
      }
    );
  }
}
