import { NextResponse } from "next/server";
import OpenAI from "openai";

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


    const completion = await openai.chat.completions.create({

      model: "gpt-4.1-mini",

      messages: [

        {
          role: "system",
          content: `
You are SaiNal One AI Assistant.

You help small businesses with:

- Writing professional client emails
- Creating follow-up messages
- Generating quotes
- Creating project plans
- Breaking projects into tasks
- Suggesting automation ideas
- Improving business workflows

Company:
SaiNal Technologies Ltd

Services:
- Website Development
- Business Automation
- Custom Applications
- Cloud & DevOps
- AI Chatbots
- Ongoing Support

Always respond professionally in UK business style.
Keep answers clear and ready to send to clients.
          `,
        },


        {
          role: "user",
          content: body.prompt,
        },


      ],

    });


    const answer =
      completion.choices[0].message.content;


    return NextResponse.json({
      answer,
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
