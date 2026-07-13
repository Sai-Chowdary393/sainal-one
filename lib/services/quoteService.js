import { supabase } from "../supabase";
import { generateQuoteNumber } from "../utils/generators";
import {
  findMatchingRecord,
  detectServiceFromPrompt,
} from "../utils/matching";

export async function createQuoteFromPrompt({
  prompt,
  leads,
  customers,
  quotes,
  profile,
  organizationId,
}) {
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
    return {
      notFound: true,
    };
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
    matchedLead?.name ||
    matchedCustomer?.customer_name ||
    "";

  const email =
    matchedLead?.email ||
    matchedCustomer?.email ||
    "";

  const phone =
    matchedLead?.phone ||
    matchedCustomer?.phone ||
    "";

  const existingQuote = quotes?.find(
    (quote) =>
      ((matchedLead &&
        String(quote.lead_id) === String(matchedLead.id)) ||
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
        organization_id: organizationId,
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
