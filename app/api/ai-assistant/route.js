import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import OpenAI from "openai";

import {
  getBusinessProfile,
  businessProfilePrompt,
} from "../../../lib/ai/businessProfile";

import {
  createLeadFromPrompt,
} from "../../../lib/services/leadService";

import {
  createFollowUpFromPrompt,
} from "../../../lib/services/followUpService";

import {
  createTaskFromPrompt,
} from "../../../lib/services/taskService";

import {
  createQuoteFromPrompt,
} from "../../../lib/services/quoteService";

import {
  markInvoiceAsPaid,
  convertQuoteToInvoice,
} from "../../../lib/services/invoiceService";

import {
  convertLeadToCustomerAndProject,
} from "../../../lib/services/customerProjectService";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function loadBusinessData() {
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
    throw new Error(databaseError.message);
  }

  const settings = settingsResult.data?.[0] || null;

  return {
    profile: getBusinessProfile(settings),
    leads: leadsResult.data || [],
    quotes: quotesResult.data || [],
    customers: customersResult.data || [],
    projects: projectsResult.data || [],
    tasks: tasksResult.data || [],
    invoices: invoicesResult.data || [],
    followUps: followUpsResult.data || [],
  };
}

async function answerGeneralQuestion({
  prompt,
  profile,
  leads,
  quotes,
  customers,
  projects,
  tasks,
  invoices,
  followUps,
}) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `
You are SaiNal One AI Operations Manager.

You work for this specific business:

${businessProfilePrompt(profile)}

You can analyse:
- Leads
- Quotes
- Customers
- Projects
- Tasks
- Invoices
- Follow-ups

Instructions:
- Tailor recommendations to this company's industry.
- Tailor advice to its business type and services.
- Consider the company's target customers.
- Do not assume the company provides website development or technology services unless configured.
- Use generic terms such as service, work, project, client requirement and deliverables where appropriate.
- Give practical recommendations.
- Highlight urgent actions.
- Mention names, values and statuses where useful.
- Use professional UK business language.
- Do not invent records.
- Follow the company's custom AI instructions.
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

User Question:
${prompt}
        `,
      },
    ],
  });

  return (
    completion.choices?.[0]?.message?.content ||
    "No response was generated."
  );
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.prompt?.trim()) {
      return NextResponse.json(
        {
          error: "Prompt is required",
        },
        {
          status: 400,
        }
      );
    }

    const originalPrompt = body.prompt.trim();
    const prompt = originalPrompt.toLowerCase();

    const {
      profile,
      leads,
      quotes,
      customers,
      projects,
      tasks,
      invoices,
      followUps,
    } = await loadBusinessData();

    if (
      (prompt.includes("mark") ||
        prompt.includes("update")) &&
      prompt.includes("invoice") &&
      prompt.includes("paid")
    ) {
      const result = await markInvoiceAsPaid({
        prompt: originalPrompt,
        invoices,
        organizationId: ORGANIZATION_ID,
      });

      if (result.notFound) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find that invoice. Please mention the invoice number or client name.",
        });
      }

      if (result.alreadyPaid) {
        return NextResponse.json({
          answer: `⚠️ Invoice is already marked as paid.

Invoice Number: ${result.invoice.invoice_number}
Client: ${result.invoice.client}
Amount: ${
            result.invoice.total_amount ||
            result.invoice.amount
          }
Status: ${result.invoice.status}`,
        });
      }

      return NextResponse.json({
        answer: `✅ Invoice marked as paid.

Invoice Number: ${result.invoice.invoice_number}
Client: ${result.invoice.client}
Amount: ${
          result.invoice.total_amount ||
          result.invoice.amount
        }
Status: ${result.invoice.status}`,
      });
    }

    if (
      (prompt.includes("convert") ||
        prompt.includes("create invoice")) &&
      (prompt.includes("quote") ||
        prompt.includes("invoice"))
    ) {
      const result = await convertQuoteToInvoice({
        prompt: originalPrompt,
        quotes,
        invoices,
        profile,
        organizationId: ORGANIZATION_ID,
      });

      if (result.notFound) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find that quote. Please mention the quote number, client name or contact name.",
        });
      }

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Invoice already exists.

Invoice Number: ${result.existing.invoice_number}
Client: ${result.existing.client}
Amount: ${
            result.existing.total_amount ||
            result.existing.amount
          }
Status: ${result.existing.status}

No duplicate invoice was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Invoice created successfully from quote.

Quote: ${result.quote.quote_number}
Invoice Number: ${result.created.invoice_number}
Client: ${result.created.client}
Service: ${result.created.service}
Amount: ${
          result.created.total_amount ||
          result.created.amount
        }
Invoice Status: ${result.created.status}

Quote status updated to Accepted.`,
      });
    }

    if (
      (prompt.includes("create quote") ||
        prompt.includes("add quote")) &&
      !prompt.includes("convert")
    ) {
      const result = await createQuoteFromPrompt({
        prompt: originalPrompt,
        leads,
        customers,
        quotes,
        profile,
        organizationId: ORGANIZATION_ID,
      });

      if (result.notFound) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find that lead or customer. Please mention the exact lead or customer name.",
        });
      }

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Draft quote already exists.

Quote Number: ${result.existing.quote_number}
Client: ${result.existing.client}
Amount: ${result.existing.amount}
Status: ${result.existing.status}

No duplicate quote was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Quote created successfully.

Quote Number: ${result.created.quote_number}
Client: ${result.created.client}
Contact: ${result.created.contact}
Service: ${result.created.service}
Amount: ${
          result.created.amount ||
          "To be confirmed"
        }
Status: ${result.created.status}`,
      });
    }

    if (
      prompt.includes("convert") &&
      prompt.includes("lead") &&
      (prompt.includes("customer") ||
        prompt.includes("project"))
    ) {
      const result =
        await convertLeadToCustomerAndProject({
          prompt: originalPrompt,
          leads,
          projects,
          organizationId: ORGANIZATION_ID,
        });

      if (result.notFound) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find that lead. Please mention the exact lead name.",
        });
      }

      return NextResponse.json({
        answer: `✅ Lead converted successfully.

Lead: ${result.lead.name}
Customer: ${result.customer.customer_name}
Company: ${result.customer.company}
Project: ${result.project.project_name}
Project Status: ${result.project.status}

Customer already existed: ${
          result.customerAlreadyExists ? "Yes" : "No"
        }
Project already existed: ${
          result.projectAlreadyExists ? "Yes" : "No"
        }

Lead status updated to Won.`,
      });
    }

    if (
      prompt.includes("create follow-up") ||
      prompt.includes("create follow up") ||
      prompt.includes("add follow-up") ||
      prompt.includes("add follow up")
    ) {
      const result = await createFollowUpFromPrompt({
        prompt: originalPrompt,
        leads,
        organizationId: ORGANIZATION_ID,
      });

      if (result.notFound) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find that lead. Please mention the exact lead name, company or email address.",
        });
      }

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Follow-up already exists.

Title: ${result.existing.title}
Status: ${result.existing.status}
Due Date: ${
            result.existing.due_date ||
            "No date"
          }

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Follow-up created successfully.

Title: ${result.created.title}
Status: ${result.created.status}
Due Date: ${
          result.created.due_date ||
          "No date"
        }
Note: ${result.created.note}`,
      });
    }

    if (
      prompt.includes("create task") ||
      prompt.includes("add task")
    ) {
      const result = await createTaskFromPrompt({
        prompt: originalPrompt,
        projects,
        organizationId: ORGANIZATION_ID,
      });

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Task already exists.

Task: ${result.existing.task_name}
Status: ${result.existing.status}
Due Date: ${
            result.existing.due_date ||
            "No date"
          }

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Task created successfully.

Task: ${result.created.task_name}
Project: ${
          result.project?.project_name ||
          "No project linked"
        }
Status: ${result.created.status}
Due Date: ${
          result.created.due_date ||
          "No date"
        }`,
      });
    }

    if (
      prompt.includes("create lead") ||
      prompt.includes("add lead")
    ) {
      const result = await createLeadFromPrompt({
        prompt: originalPrompt,
        profile,
        organizationId: ORGANIZATION_ID,
        openai,
      });

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Lead already exists.

Name: ${result.existing.name}
Company: ${result.existing.company}
Email: ${
            result.existing.email ||
            "Not provided"
          }

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Lead created successfully.

Name: ${result.created.name}
Company: ${result.created.company}
Email: ${
          result.created.email ||
          "Not provided"
        }
Phone: ${
          result.created.phone ||
          "Not provided"
        }
Value: ${
          result.created.value ||
          "Not provided"
        }
Status: ${result.created.status}
AI Score: ${result.created.ai_score}
AI Summary: ${result.created.ai_summary}
Next Action: ${result.created.ai_next_action}`,
      });
    }

    const answer = await answerGeneralQuestion({
      prompt: originalPrompt,
      profile,
      leads,
      quotes,
      customers,
      projects,
      tasks,
      invoices,
      followUps,
    });

    return NextResponse.json({
      answer,
    });
  } catch (error) {
    console.error("AI Assistant error:", error);

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
