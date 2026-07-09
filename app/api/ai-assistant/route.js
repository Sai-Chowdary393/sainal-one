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

async function analyseLead({ name, company, email, phone, notes }) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are SaiNal One AI Operations Manager. Analyse SME leads and return short practical output only.",
        },
        {
          role: "user",
          content: `
Analyse this lead.

Name: ${name}
Company: ${company}
Email: ${email}
Phone: ${phone}
Requirement: ${notes}

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
      ai_summary: summaryMatch?.[1]?.trim() || "Lead created by AI Assistant.",
      ai_next_action:
        actionMatch?.[1]?.trim() || "Review and follow up with the lead.",
    };
  } catch (error) {
    console.error("AI lead analysis failed:", error);

    return {
      ai_score: "Warm",
      ai_summary: "Lead created by AI Assistant.",
      ai_next_action: "Review and follow up with the lead.",
    };
  }
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

  if (error) throw new Error(error.message);

  return {
    alreadyExists: false,
    created: data?.[0],
  };
}

async function createTaskFromPrompt(prompt, projects) {
  const matchedProject = projects?.find((project) =>
    prompt
      .toLowerCase()
      .includes(String(project.project_name || "").toLowerCase())
  );

  const taskName = prompt
    .replace(/create task/gi, "")
    .replace(/add task/gi, "")
    .replace(/for/gi, "")
    .trim();

  const finalTaskName = taskName || "AI Created Task";

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", ORGANIZATION_ID)
    .eq("project_id", matchedProject?.id || null)
    .ilike("task_name", finalTaskName)
    .eq("status", "Pending");

  if (existingTasks && existingTasks.length > 0) {
    return {
      alreadyExists: true,
      existing: existingTasks[0],
    };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        organization_id: ORGANIZATION_ID,
        project_id: matchedProject?.id || null,
        task_name: finalTaskName,
        status: "Pending",
        due_date: prompt.toLowerCase().includes("tomorrow")
          ? getTomorrowDate()
          : null,
      },
    ])
    .select();

  if (error) throw new Error(error.message);

  return {
    alreadyExists: false,
    created: data?.[0],
    project: matchedProject || null,
  };
}

async function createLeadFromPrompt(prompt) {
  const emailMatch = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = prompt.match(/(\+?\d[\d\s]{7,})/);
  const valueMatch = prompt.match(/£\s?\d+/i);

  let name = "Unknown Lead";
  let company = "Unknown Company";

  const nameMatch = prompt.match(/for\s+(.*?)\s+from/i);
  if (nameMatch) name = nameMatch[1].trim();

  const companyMatch = prompt.match(/from\s+(.*?)(email|phone|value|needs|$)/i);
  if (companyMatch) company = companyMatch[1].trim();

  const email = emailMatch?.[0] || "";
  const phone = phoneMatch?.[0] || "";
  const value = valueMatch?.[0] || "";

  const { data: existingLead } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", ORGANIZATION_ID)
    .eq("email", email)
    .limit(1);

  if (existingLead && existingLead.length > 0) {
    return {
      alreadyExists: true,
      existing: existingLead[0],
    };
  }

  const aiAnalysis = await analyseLead({
    name,
    company,
    email,
    phone,
    notes: prompt,
  });

  const { data, error } = await supabase
    .from("leads")
    .insert([
      {
        organization_id: ORGANIZATION_ID,
        name,
        company,
        email,
        phone,
        value,
        status: "New",
        notes: prompt,
        source: "AI Assistant",
        ai_score: aiAnalysis.ai_score,
        ai_summary: aiAnalysis.ai_summary,
        ai_next_action: aiAnalysis.ai_next_action,
      },
    ])
    .select();

  if (error) throw new Error(error.message);

  return {
    alreadyExists: false,
    created: data?.[0],
  };
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

    const { data: tasks } = await supabase
      .from("tasks")
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

    if (prompt.includes("create task") || prompt.includes("add task")) {
      const result = await createTaskFromPrompt(body.prompt, projects || []);

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Task already exists.

Task: ${result.existing.task_name}
Status: ${result.existing.status}
Due Date: ${result.existing.due_date || "No date"}

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Task created successfully.

Task: ${result.created.task_name}
Project: ${result.project?.project_name || "No project linked"}
Status: ${result.created.status}
Due Date: ${result.created.due_date || "No date"}`,
      });
    }

    if (prompt.includes("create lead") || prompt.includes("add lead")) {
      const result = await createLeadFromPrompt(body.prompt);

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Lead already exists.

Name: ${result.existing.name}
Company: ${result.existing.company}
Email: ${result.existing.email}

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Lead created successfully.

Name: ${result.created.name}
Company: ${result.created.company}
Email: ${result.created.email}
Phone: ${result.created.phone}
Value: ${result.created.value}
Status: ${result.created.status}
AI Score: ${result.created.ai_score}
AI Summary: ${result.created.ai_summary}
Next Action: ${result.created.ai_next_action}`,
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
- Tasks
- Invoices
- Follow-ups

You should:
- Give practical recommendations
- Highlight urgent actions
- Mention names, values and statuses where useful
- Keep answers clear and business-friendly
- Use UK business style
- Do not invent records that are not in the data

You can also create basic follow-ups, leads and tasks when the user clearly asks.
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

Tasks:
${JSON.stringify(tasks || [])}

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
      { error: "AI Assistant failed" },
      { status: 500 }
    );
  }
}
