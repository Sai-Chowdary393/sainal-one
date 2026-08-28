import {
  createAdminSupabaseClient,
} from "../supabaseAdmin";

import {
  generateQuoteNumber,
} from "../utils/generators";

import {
  findMatchingRecord,
  detectServiceFromPrompt,
} from "../utils/matching";

// =========================================================
// CREATE QUOTE FROM AI PROMPT
// =========================================================

export async function createQuoteFromPrompt({
  prompt,
  leads,
  customers,
  quotes,
  profile,
  organizationId,
  employeeId,
}) {
  if (!organizationId) {
    throw new Error(
      "Organisation is required to create a quote."
    );
  }

  if (!employeeId) {
    throw new Error(
      "Employee ownership is required to create a quote."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  // =======================================================
  // FIND ACCESSIBLE SOURCE RECORD
  // =======================================================

  const matchedLead =
    findMatchingRecord(
      prompt,
      leads,
      [
        "name",
        "company",
        "email",
      ]
    );

  const matchedCustomer =
    findMatchingRecord(
      prompt,
      customers,
      [
        "customer_name",
        "company",
        "email",
      ]
    );

  if (
    !matchedLead &&
    !matchedCustomer
  ) {
    return {
      notFound:
        true,
    };
  }

  // =======================================================
  // COMMERCIAL DETAILS
  // =======================================================

  const amountMatch =
    prompt.match(
      /£\s?[\d,]+(?:\.\d{1,2})?/i
    );

  const amount =
    amountMatch?.[0] ||
    matchedLead?.value ||
    matchedCustomer?.value ||
    "";

  const service =
    detectServiceFromPrompt(
      prompt,
      profile
    );

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

  // =======================================================
  // OWNER
  //
  // SECURITY:
  // AI-created Quote belongs to the signed-in employee.
  // Source-record ownership is not inherited automatically.
  // =======================================================

  const ownerEmployeeId =
    employeeId;

  // =======================================================
  // DUPLICATE CHECK
  // =======================================================

  const existingQuote =
    quotes?.find(
      (quote) =>
        (
          (
            matchedLead &&
            String(
              quote.lead_id ||
                ""
            ) ===
              String(
                matchedLead.id
              )
          ) ||
          (
            matchedCustomer &&
            String(
              quote.customer_id ||
                ""
            ) ===
              String(
                matchedCustomer.id
              )
          )
        ) &&
        String(
          quote.status ||
            ""
        )
          .toLowerCase()
          .includes(
            "draft"
          )
    );

  if (existingQuote) {
    return {
      alreadyExists:
        true,

      existing:
        existingQuote,
    };
  }

  // =======================================================
  // QUOTE DOCUMENT
  // =======================================================

  const quoteNumber =
    generateQuoteNumber();

  const quoteText =
`${profile.companyName.toUpperCase()}

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

  const now =
    new Date()
      .toISOString();

  // =======================================================
  // INSERT
  // =======================================================

  const {
    data:
      createdQuote,
    error,
  } =
    await supabase
      .from(
        "quotes"
      )
      .insert([
        {
          organization_id:
            organizationId,

          owner_employee_id:
            ownerEmployeeId,

          quote_number:
            quoteNumber,

          lead_id:
            matchedLead?.id ||
            null,

          customer_id:
            matchedCustomer?.id ||
            null,

          client,

          contact,

          email,

          phone,

          service,

          amount,

          status:
            "Draft",

          quote_text:
            quoteText,

          created_at:
            now,

          updated_at:
            now,
        },
      ])
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return {
    notFound:
      false,

    alreadyExists:
      false,

    created:
      createdQuote,
  };
}
