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
          content: `
You are SaiNal One AI Operations Manager.

Analyse company data.

Give short executive business insights.

Return:
- Revenue overview
- Lead priorities
- Payment risks
- Project risks
- Follow-up actions
- Best next action

Use UK business style.
Do not invent data.
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


Projects:
${JSON.stringify(projects || [])}


Invoices:
${JSON.stringify(invoices || [])}


Follow Ups:
${JSON.stringify(followUps || [])}

Create today's management summary.
          `,
        },

      ],

    });


    return NextResponse.json({

      insights:
        completion.choices[0].message.content,

    });



  } catch (error) {

    console.error(error);


    return NextResponse.json(
      {
        error:"Failed creating AI insights",
      },
      {
        status:500,
      }
    );

  }

}
