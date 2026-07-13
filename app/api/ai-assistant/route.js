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

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function generateQuoteNumber() {
  return `SNQ-${Date.now().toString().slice(-6)}`;
}

function generateInvoiceNumber(prefix = "SNI") {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getBusinessProfile(settings) {
  return {
    companyName: settings?.company_name || "The company",
    companyEmail: settings?.company_email || "",
    companyPhone: settings?.company_phone || "",
    website: settings?.website || "",
    address: settings?.address || "",
    industry: settings?.industry || "General business services",
    businessType: settings?.business_type || "Service business",
    services: settings?.services || "Professional services",
    targetCustomers: settings?.target_customers || "Business customers",
    aiInstructions:
      settings?.ai_instructions ||
      "Give practical, professional and commercially useful advice.",
    currency: settings?.default_currency || "GBP",
    vatRate: settings?.default_vat_rate || "0",
    invoicePrefix: settings?.invoice_prefix || "SNI",
    paymentTerms:
      settings?.payment_terms ||
      "Payment due within 14 days of invoice date.",
  };
}

function businessProfilePrompt(profile) {
  return `
Company name: ${profile.companyName}
Industry: ${profile.industry}
Business type: ${profile.businessType}
Services offered: ${profile.services}
Target customers: ${profile.targetCustomers}
Website: ${profile.website}
Additional AI instructions: ${profile.aiInstructions}
  `;
}

function findMatchingRecord(prompt, records, fields) {
  const normalisedPrompt = String(prompt || "").toLowerCase();

  return records?.find((record) =>
    fields.some((field) => {
      const value = String(record?.[field] || "").trim().toLowerCase();
      return value && normalisedPrompt.includes(value);
    })
  );
}

function detectServiceFromPrompt(prompt, profile) {
  const normalisedPrompt = prompt.toLowerCase();

  const configuredServices = String(profile.services || "")
    .split(/[\n,;]+/)
    .map((service) => service.trim())
    .filter(Boolean);

  const matchedService = configuredServices.find((service) =>
    normalisedPrompt.includes(service.toLowerCase())
  );

  if (matchedService) {
    return matchedService;
  }

  const genericServiceMatch = prompt.match(
    /(?:for|service|needs?|requires?)\s+(.+?)(?:\s+£|\s+value|\s+email|\s+phone|$)/i
  );

  if (genericServiceMatch?.[1]) {
    return genericServiceMatch[1].trim();
  }

  return configuredServices[0] || "Professional Services";
}

async function markInvoiceAsPaid(prompt, invoices) {
  const matchedInvoice = findMatchingRecord(prompt, invoices, [
    "invoice_number",
    "client",
  ]);

  if (!matchedInvoice) {
    return { notFound: true };
  }

  if (String(matchedInvoice.status || "").toLowerCase() === "paid") {
    return {
      alreadyPaid: true,
      invoice: matchedInvoice,
    };
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "Paid" })
    .eq("id", matchedInvoice.id)
    .eq("organization_id", ORGANIZATION_ID)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return {
    notFound: false,
    alreadyPaid: false,
    invoice: data?.[0],
  };
}

async function analyseLead({
  name,
  company,
  email,
  phone,
  notes,
  profile,
}) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are SaiNal One AI Operations Manager.

You are working for the following business:

${businessProfilePrompt(profile)}

Analyse incoming leads in the context of this specific business.

Rules:
- Assess how well the lead matches the configured services and target customers.
- Give practical, industry-relevant advice.
- Do not assume the company provides website development unless that service is configured or requested.
- Do not invent information.
- Use professional UK business language.
- Follow the company's additional AI instructions.
          `,
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
Summary: short business-specific summary
Next Action: practical recommended next step
          `,
        },
      ],
    });

    const text = completion.choices?.[0]?.message?.content || "";

    return {
      ai_score: text.match(/Score:\s*(.*)/i)?.[1]?.trim() || "Warm",
      ai_summary:
        text.match(/Summary:\s*(.*)/i)?.[1]?.trim() ||
        "Lead created through the AI Assistant.",
      ai_next_action:
        text.match(/Next Action:\s*(.*)/i)?.[1]?.trim() ||
        "Review the requirement and contact the lead.",
    };
  } catch (error) {
    console.error("Lead analysis error:", error);

    return {
      ai_score: "Warm",
      ai_summary: "Lead created through the AI Assistant.",
      ai_next_action: "Review the requirement and contact the lead.",
    };
  }
}

async function createFollowUpFromPrompt(prompt, leads) {
  const matchedLead = findMatchingRecord(prompt, leads, [
    "name",
    "company",
    "email",
  ]);

  if (!matchedLead) {
    return { notFound: true };
  }

  const dueDate = prompt.toLowerCase().includes("tomorrow")
    ? getTomorrowDate()
    : null;

  const { data: existingFollowUps, error: existingError } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("organization_id", ORGANIZATION_ID)
    .eq("related_type", "Lead")
    .eq("related_id", matchedLead.id)
    .eq("status", "Pending");

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingFollowUps?.length > 0) {
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
        related_id: matchedLead.id,
        title: `Follow up with ${matchedLead.name}`,
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
    notFound: false,
    alreadyExists: false,
    created: data?.[0],
  };
}

async function createTaskFromPrompt(prompt, projects) {
  const matchedProject = findMatchingRecord(prompt, projects, [
    "project_name",
    "description",
  ]);

  const finalTaskName =
    prompt
      .replace(/create task/gi, "")
      .replace(/add task/gi, "")
      .replace(/\btomorrow\b/gi, "")
      .trim() || "AI Created Task";

  let existingQuery = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", ORGANIZATION_ID)
    .ilike("task_name", finalTaskName)
    .eq("status", "Pending");

  if (matchedProject?.id) {
    existingQuery = existingQuery.eq("project_id", matchedProject.id);
  } else {
    existingQuery = existingQuery.is("project_id", null);
  }

  const { data: existingTasks, error: existingError } = await existingQuery;

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingTasks?.length > 0) {
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
        description: `AI created task from request: ${prompt}`,
        status: "Pending",
        due_date: prompt.toLowerCase().includes("tomorrow")
          ? getTomorrowDate()
          : null,
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return {
    alreadyExists: false,
    created: data?.[0],
    project: matchedProject || null,
  };
}

async function createLeadFromPrompt(prompt, profile) {
  const emailMatch = prompt.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );

  const phoneMatch = prompt.match(/(\+?\d[\d\s-]{7,})/);
  const valueMatch = prompt.match(/£\s?[\d,]+(?:\.\d{1,2})?/i);

  let name = "Unknown Lead";
  let company = "Unknown Company";

  const nameMatch = prompt.match(/for\s+(.*?)\s+from/i);

  if (nameMatch?.[1]) {
    name = nameMatch[1].trim();
  }

  const companyMatch = prompt.match(
    /from\s+(.*?)(?:\s+email|\s+phone|\s+value|\s+needs|\s+requires|$)/i
  );

  if (companyMatch?.[1]) {
    company = companyMatch[1].trim();
  }

  const email = emailMatch?.[0] || "";
  const phone = phoneMatch?.[0]?.trim() || "";
  const value = valueMatch?.[0] || "";

  let duplicateQuery = supabase
    .from("leads")
    .select("*")
    .eq("organization_id", ORGANIZATION_ID);

  if (email) {
    duplicateQuery = duplicateQuery.eq("email", email);
  } else {
    duplicateQuery = duplicateQuery
      .ilike("name", name)
      .ilike("company", company);
  }

  const { data: existingLead, error: existingError } =
    await duplicateQuery.limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingLead?.length > 0) {
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
    profile,
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

  if (error) {
    throw new Error(error.message);
  }

  return {
    alreadyExists: false,
    created: data?.[0],
  };
}

async function createQuoteFromPrompt(
  prompt,
  leads,
  customers,
  quotes,
  profile
) {
  const matchedLead = findMatchingRecord(prompt, leads, [
    "name",
    "company",
    "email",
  ]);

  const matchedCustomer = findMatchingRecord(prompt, customers, [
    "customer_name",
    "company",
    "email",
  ]);

  if (!matchedLead && !matchedCustomer) {
    return { notFound: true };
  }

  const amountMatch = prompt.match(/£\s?[\d,]+(?:\.\d{1,2})?/i);

  const amount =
    amountMatch?.[0] ||
    matchedLead?.value ||
    matchedCustomer?.value ||
    "";

  const service = detectServiceFromPrompt(prompt, profile);

  const client =
    matchedLead?.company ||
    matchedCustomer?.company ||
    matchedCustomer?.customer_name ||
    "";

  const contact =
    matchedLead?.name || matchedCustomer?.customer_name || "";

  const email = matchedLead?.email || matchedCustomer?.email || "";
  const phone = matchedLead?.phone || matchedCustomer?.phone || "";

  const existingQuote = quotes?.find(
    (quote) =>
      ((matchedLead && String(quote.lead_id) === String(matchedLead.id)) ||
        (matchedCustomer &&
          String(quote.customer_id) === String(matchedCustomer.id))) &&
      String(quote.status || "").toLowerCase().includes("draft")
  );

  if (existingQuote) {
    return {
      alreadyExists: true,
      existing: existingQuote,
    };
  }

  const quoteNumber = generateQuoteNumber();

  const quoteText = `${profile.companyName.toUpperCase()}

QUOTE

Quote Number: ${quoteNumber}
Date: ${new Date().toLocaleDateString("en-GB")}

Client:
${client}
${contact}
${email}
${phone}

Service:
${service}

Estimated Cost:
${amount || "To be confirmed"}

Scope / Notes:
${prompt}

Payment Terms:
${profile.paymentTerms}

Prepared By:
${profile.companyName}
${profile.website}`;

  const { data, error } = await supabase
    .from("quotes")
    .insert([
      {
        organization_id: ORGANIZATION_ID,
        quote_number: quoteNumber,
        lead_id: matchedLead?.id || null,
        customer_id: matchedCustomer?.id || null,
        client,
        contact,
        email,
        phone,
        service,
        amount,
        status: "Draft Quote",
        quote_text: quoteText,
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return {
    notFound: false,
    alreadyExists: false,
    created: data?.[0],
  };
}

async function convertQuoteToInvoice(
  prompt,
  quotes,
  invoices,
  profile
) {
  const matchedQuote = findMatchingRecord(prompt, quotes, [
    "quote_number",
    "client",
    "contact",
  ]);

  if (!matchedQuote) {
    return { notFound: true };
  }

  const existingInvoice = invoices?.find(
    (invoice) =>
      String(invoice.quote_id || "") === String(matchedQuote.id) ||
      (invoice.client === matchedQuote.client &&
        invoice.service === matchedQuote.service &&
        String(invoice.status || "").toLowerCase().includes("draft"))
  );

  if (existingInvoice) {
    return {
      alreadyExists: true,
      existing: existingInvoice,
      quote: matchedQuote,
    };
  }

  const invoiceNumber = generateInvoiceNumber(profile.invoicePrefix);

  const amount = matchedQuote.amount || "£0";
  const subtotal = amount;
  const vatRate = `${profile.vatRate}%`;
  const vatAmount = "£0";
  const totalAmount = amount;

  const { data, error } = await supabase
    .from("invoices")
    .insert([
      {
        organization_id: ORGANIZATION_ID,
        customer_id: matchedQuote.customer_id || null,
        project_id: null,
        quote_id: matchedQuote.id,
        invoice_number: invoiceNumber,
        client: matchedQuote.client,
        service: matchedQuote.service,
        amount: totalAmount,
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        status: "Draft Invoice",
        due_date: null,
        payment_terms: profile.paymentTerms,
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  const { error: quoteUpdateError } = await supabase
    .from("quotes")
    .update({ status: "Accepted" })
    .eq("id", matchedQuote.id)
    .eq("organization_id", ORGANIZATION_ID);

  if (quoteUpdateError) {
    throw new Error(quoteUpdateError.message);
  }

  return {
    notFound: false,
    alreadyExists: false,
    created: data?.[0],
    quote: matchedQuote,
  };
}

async function convertLeadToCustomerAndProject(
  prompt,
  leads,
  customers,
  projects
) {
  const matchedLead = findMatchingRecord(prompt, leads, [
    "name",
    "company",
    "email",
  ]);

  if (!matchedLead) {
    return { notFound: true };
  }

  let existingCustomerQuery = supabase
    .from("customers")
    .select("*")
    .eq("organization_id", ORGANIZATION_ID);

  if (matchedLead.email) {
    existingCustomerQuery = existingCustomerQuery.or(
      `lead_id.eq.${matchedLead.id},email.eq.${matchedLead.email}`
    );
  } else {
    existingCustomerQuery = existingCustomerQuery.eq(
      "lead_id",
      matchedLead.id
    );
  }

  const { data: existingCustomer, error: existingCustomerError } =
    await existingCustomerQuery.limit(1);

  if (existingCustomerError) {
    throw new Error(existingCustomerError.message);
  }

  let customer = existingCustomer?.[0];

  if (!customer) {
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .insert([
        {
          organization_id: ORGANIZATION_ID,
          lead_id: matchedLead.id,
          customer_name: matchedLead.name,
          company: matchedLead.company,
          email: matchedLead.email,
          phone: matchedLead.phone,
          status: "Active",
        },
      ])
      .select();

    if (customerError) {
      throw new Error(customerError.message);
    }

    customer = customerData?.[0];
  }

  const projectName = `${matchedLead.company || matchedLead.name} - Project`;

  const existingProject = projects?.find(
    (project) =>
      String(project.customer_id) === String(customer.id) &&
      String(project.project_name || "")
        .toLowerCase()
        .includes(
          String(matchedLead.company || matchedLead.name || "").toLowerCase()
        )
  );

  let project = existingProject;

  if (!project) {
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .insert([
        {
          organization_id: ORGANIZATION_ID,
          customer_id: customer.id,
          quote_id: null,
          project_name: projectName,
          description:
            matchedLead.notes ||
            matchedLead.ai_summary ||
            "Project created from lead conversion.",
          status: "Planning",
          start_date: todayDate(),
          due_date: null,
          amount: matchedLead.value || "",
        },
      ])
      .select();

    if (projectError) {
      throw new Error(projectError.message);
    }

    project = projectData?.[0];
  }

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({ status: "Won" })
    .eq("id", matchedLead.id)
    .eq("organization_id", ORGANIZATION_ID);

  if (leadUpdateError) {
    throw new Error(leadUpdateError.message);
  }

  return {
    notFound: false,
    customerAlreadyExists: Boolean(existingCustomer?.[0]),
    projectAlreadyExists: Boolean(existingProject),
    lead: matchedLead,
    customer,
    project,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const prompt = body.prompt.toLowerCase();

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

    if (
      (prompt.includes("mark") || prompt.includes("update")) &&
      prompt.includes("invoice") &&
      prompt.includes("paid")
    ) {
      const result = await markInvoiceAsPaid(body.prompt, invoices);

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
Amount: ${result.invoice.total_amount || result.invoice.amount}
Status: ${result.invoice.status}`,
        });
      }

      return NextResponse.json({
        answer: `✅ Invoice marked as paid.

Invoice Number: ${result.invoice.invoice_number}
Client: ${result.invoice.client}
Amount: ${result.invoice.total_amount || result.invoice.amount}
Status: ${result.invoice.status}`,
      });
    }

    if (
      (prompt.includes("convert") || prompt.includes("create invoice")) &&
      (prompt.includes("quote") || prompt.includes("invoice"))
    ) {
      const result = await convertQuoteToInvoice(
        body.prompt,
        quotes,
        invoices,
        profile
      );

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
Amount: ${result.existing.total_amount || result.existing.amount}
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
Amount: ${result.created.total_amount || result.created.amount}
Invoice Status: ${result.created.status}

Quote status updated to Accepted.`,
      });
    }

    if (
      (prompt.includes("create quote") || prompt.includes("add quote")) &&
      !prompt.includes("convert")
    ) {
      const result = await createQuoteFromPrompt(
        body.prompt,
        leads,
        customers,
        quotes,
        profile
      );

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
Amount: ${result.created.amount || "To be confirmed"}
Status: ${result.created.status}`,
      });
    }

    if (
      prompt.includes("convert") &&
      prompt.includes("lead") &&
      (prompt.includes("customer") || prompt.includes("project"))
    ) {
      const result = await convertLeadToCustomerAndProject(
        body.prompt,
        leads,
        customers,
        projects
      );

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
      const result = await createFollowUpFromPrompt(body.prompt, leads);

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
      const result = await createTaskFromPrompt(body.prompt, projects);

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
      const result = await createLeadFromPrompt(body.prompt, profile);

      if (result.alreadyExists) {
        return NextResponse.json({
          answer: `⚠️ Lead already exists.

Name: ${result.existing.name}
Company: ${result.existing.company}
Email: ${result.existing.email || "Not provided"}

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Lead created successfully.

Name: ${result.created.name}
Company: ${result.created.company}
Email: ${result.created.email || "Not provided"}
Phone: ${result.created.phone || "Not provided"}
Value: ${result.created.value || "Not provided"}
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
- Tailor all recommendations to this company's industry, business type, services and target customers.
- Do not assume the company provides website development or technology services unless configured.
- Use generic terms such as service, work, project, client requirement and deliverables when appropriate.
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
${body.prompt}
          `,
        },
      ],
    });

    return NextResponse.json({
      answer:
        completion.choices?.[0]?.message?.content ||
        "No response was generated.",
    });
  } catch (error) {
    console.error("AI Assistant error:", error);

    return NextResponse.json(
      { error: "AI Assistant failed" },
      { status: 500 }
    );
  }
}
