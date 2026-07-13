import { supabase } from "../supabase";
import { findMatchingRecord } from "../utils/matching";
import { businessProfilePrompt } from "../ai/businessProfile";

function generateProposalNumber() {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `SNP-${year}-${randomNumber}`;
}

function extractRequestedAmount(prompt) {
  return (
    String(prompt || "").match(
      /£\s?[\d,]+(?:\.\d{1,2})?/i
    )?.[0] || ""
  );
}

function findRelatedRecord({
  prompt,
  leads,
  customers,
  quotes,
}) {
  const quote = findMatchingRecord(prompt, quotes, [
    "quote_number",
    "client",
    "contact",
    "email",
  ]);

  const lead = findMatchingRecord(prompt, leads, [
    "name",
    "company",
    "email",
  ]);

  const customer = findMatchingRecord(prompt, customers, [
    "customer_name",
    "company",
    "email",
  ]);

  return {
    lead,
    customer,
    quote,
  };
}

function resolveProposalDetails({
  prompt,
  lead,
  customer,
  quote,
}) {
  const client =
    quote?.client ||
    lead?.company ||
    customer?.company ||
    customer?.customer_name ||
    "";

  const contact =
    quote?.contact ||
    lead?.name ||
    customer?.customer_name ||
    "";

  const email =
    quote?.email ||
    lead?.email ||
    customer?.email ||
    "";

  const service =
    quote?.service ||
    lead?.ai_summary ||
    lead?.notes ||
    "Professional Services";

  const amount =
    extractRequestedAmount(prompt) ||
    quote?.amount ||
    lead?.value ||
    "";

  return {
    client,
    contact,
    email,
    service,
    amount,
  };
}

async function generateProposalText({
  prompt,
  profile,
  client,
  contact,
  service,
  amount,
  openai,
}) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",

    messages: [
      {
        role: "system",
        content: `
You are SaiNal One AI Proposal Manager.

You create professional commercial proposals for the following business:

${businessProfilePrompt(profile)}

Create proposals that are suitable for this company's industry,
services and target customers.

Rules:
- Use professional UK business language.
- Do not assume the company provides website development unless configured or requested.
- Do not invent client facts.
- Do not invent certifications, guarantees or legal claims.
- Keep the proposal commercially useful and ready for client review.
- Use plain text only.
- Do not use markdown symbols such as ** or #.
- Use clear headings.
- Follow the company's custom AI instructions.
        `,
      },
      {
        role: "user",
        content: `
Create a professional business proposal using these details.

Client company:
${client}

Contact:
${contact}

Service:
${service}

Estimated value:
${amount || "To be confirmed"}

User request:
${prompt}

Use this exact structure:

Proposal Title

Prepared For
Client and contact details

Prepared By
Company name and contact details

Executive Summary
A concise explanation of the client's requirement and the proposed solution

Understanding of Requirements
A practical summary of the business need

Proposed Solution
Describe the service and approach

Scope of Work
List the key deliverables using bullet points

Delivery Approach
Explain the main project stages

Estimated Timeline
Provide a sensible indicative timeline, but clearly state that it is subject to confirmation

Investment
Show the supplied amount, or state that pricing is to be confirmed

Payment Terms
Use the company's configured payment terms

Assumptions
List reasonable assumptions without inventing facts

Next Steps
Explain how the client can proceed

Validity
State that the proposal is valid for 30 days unless otherwise agreed
        `,
      },
    ],
  });

  return (
    completion.choices?.[0]?.message?.content?.trim() ||
    "Proposal content could not be generated."
  );
}

export async function createProposalFromPrompt({
  prompt,
  profile,
  leads,
  customers,
  quotes,
  openai,
  organizationId,
}) {
  const {
    lead,
    customer,
    quote,
  } = findRelatedRecord({
    prompt,
    leads,
    customers,
    quotes,
  });

  if (!lead && !customer && !quote) {
    return {
      notFound: true,
    };
  }

  const {
    client,
    contact,
    email,
    service,
    amount,
  } = resolveProposalDetails({
    prompt,
    lead,
    customer,
    quote,
  });

  let existingQuery = supabase
    .from("proposals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "Draft");

  if (quote?.id) {
    existingQuery = existingQuery.eq("quote_id", quote.id);
  } else if (lead?.id) {
    existingQuery = existingQuery.eq("lead_id", lead.id);
  } else if (customer?.id) {
    existingQuery = existingQuery.eq(
      "customer_id",
      customer.id
    );
  }

  const {
    data: existingProposals,
    error: existingError,
  } = await existingQuery.limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingProposals?.length > 0) {
    return {
      alreadyExists: true,
      existing: existingProposals[0],
    };
  }

  const proposalNumber = generateProposalNumber();

  const proposalText = await generateProposalText({
    prompt,
    profile,
    client,
    contact,
    service,
    amount,
    openai,
  });

  const title = `${service} Proposal for ${client}`;

  const { data, error } = await supabase
    .from("proposals")
    .insert([
      {
        organization_id: organizationId,
        proposal_number: proposalNumber,
        lead_id: lead?.id || quote?.lead_id || null,
        customer_id:
          customer?.id ||
          quote?.customer_id ||
          null,
        quote_id: quote?.id || null,
        client,
        contact,
        email,
        title,
        service,
        amount,
        status: "Draft",
        proposal_text: proposalText,
        updated_at: new Date().toISOString(),
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
