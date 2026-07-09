import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import OpenAI from "openai";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

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

Important:
You are currently advisory only.
You can suggest actions, but you cannot directly update the database unless a separate action API is created.
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
