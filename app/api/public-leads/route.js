import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import OpenAI from "openai";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyseLead(body) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are SaiNal One AI Operations Manager. Analyse website leads for SMEs. Return short practical output only.",
        },
        {
          role: "user",
          content: `
Analyse this lead.

Name: ${body.name}
Company: ${body.company || "Not provided"}
Email: ${body.email}
Phone: ${body.phone || "Not provided"}
Message: ${body.message || body.notes || "No message"}

Return exactly in this format:

Score: Hot/Warm/Cold
Summary: short summary
Next Action: recommended next step
          `,
        },
      ],
    });

    const text = completion.choices[0].message.content || "";

    const scoreMatch = text.match(/Score:\s*(.*)/i);
    const summaryMatch = text.match(/Summary:\s*(.*)/i);
    const actionMatch = text.match(/Next Action:\s*(.*)/i);

    return {
      ai_score: scoreMatch?.[1]?.trim() || "Warm",
      ai_summary: summaryMatch?.[1]?.trim() || text,
      ai_next_action: actionMatch?.[1]?.trim() || "Follow up with the lead.",
    };
  } catch (error) {
    console.error("AI lead analysis failed:", error);

    return {
      ai_score: "Warm",
      ai_summary: "Lead captured from website.",
      ai_next_action: "Review and follow up manually.",
    };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    const aiAnalysis = await analyseLead(body);

    const { data, error } = await supabase
      .from("leads")
      .insert([
        {
          name: body.name,
          company: body.company || "Website Enquiry",
          email: body.email,
          phone: body.phone || "",
          status: "New",
          value: body.value || "",
          notes: body.message || body.notes || "",
          source: "Website",
          organization_id: ORGANIZATION_ID,
          ai_score: aiAnalysis.ai_score,
          ai_summary: aiAnalysis.ai_summary,
          ai_next_action: aiAnalysis.ai_next_action,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Lead created and analysed successfully.",
      lead: data?.[0],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create website lead." },
      { status: 500 }
    );
  }
}
