import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import OpenAI from "openai";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {

    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID);

    const { data: quotes } = await supabase
      .from("quotes")
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
          content:
            "You are SaiNal One AI Operations Manager. Analyse business data and give short actionable insights.",
        },

        {
          role: "user",
          content: `
Analyse this business:

Leads:
${JSON.stringify(leads)}

Quotes:
${JSON.stringify(quotes)}

Projects:
${JSON.stringify(projects)}

Invoices:
${JSON.stringify(invoices)}

Follow Ups:
${JSON.stringify(followUps)}


Return maximum 5 insights.

Examples:

🔥 3 hot leads require attention

💰 £5000 revenue waiting in unpaid invoices

⚠️ Project ABC is delayed

📞 Contact customer XYZ today

📈 Sales pipeline improving
          `,
        },
      ],
    });


    return NextResponse.json({
      insights:
        completion.choices[0].message.content ||
        "No insights available.",
    });


  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        error: "Failed generating business insights",
      },
      {
        status: 500,
      }
    );
  }
}
