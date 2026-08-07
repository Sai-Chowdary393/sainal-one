import {
  emitWorkflowEvent,
} from "../workflow-runtime/engine";

const QUOTE_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
  "Accepted",
  "Expired",
];

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function nullableText(value) {
  const clean = cleanText(value);

  return clean || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function now() {
  return new Date().toISOString();
}

function generateQuoteNumber() {
  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  const random =
    Math.floor(
      1000 +
        Math.random() * 9000
    );

  return `Q-${year}${month}${day}-${random}`;
}

function normalizeStatus(value) {
  const clean =
    cleanText(value) ||
    "Draft";

  const matched =
    QUOTE_STATUSES.find(
      (status) =>
        status.toLowerCase() ===
        clean.toLowerCase()
    );

  if (!matched) {
    throw new Error(
      `Invalid quote status "${clean}".`
    );
  }

  return matched;
}

function normalizeQuoteInput(
  input = {},
  {
    forCreate = false,
  } = {}
) {
  const quote = {};

  if (
    forCreate ||
    "lead_id" in input
  ) {
    quote.lead_id =
      input.lead_id
        ? String(
            input.lead_id
          )
        : null;

    if (
      quote.lead_id &&
      !isUuid(
        quote.lead_id
      )
    ) {
      throw new Error(
        "Lead ID must be a valid UUID."
      );
    }
  }

  if (
    forCreate ||
    "customer_id" in input
  ) {
    quote.customer_id =
      input.customer_id
        ? String(
            input.customer_id
          )
        : null;

    if (
      quote.customer_id &&
      !isUuid(
        quote.customer_id
      )
    ) {
      throw new Error(
        "Customer ID must be a valid UUID."
      );
    }
  }

  if (
    forCreate ||
    "client" in input
  ) {
    quote.client =
      nullableText(
        input.client
      );
  }

  if (
    forCreate ||
    "contact" in input
  ) {
    quote.contact =
      nullableText(
        input.contact
      );
  }

  if (
    forCreate ||
    "email" in input
  ) {
    quote.email =
      nullableText(
        input.email
      );
  }

  if (
    forCreate ||
    "phone" in input
  ) {
    quote.phone =
      nullableText(
        input.phone
      );
  }

  if (
    forCreate ||
    "service" in input
  ) {
    quote.service =
      nullableText(
        input.service
      );
  }

  /*
   * Your current Supabase schema
   * stores amount as TEXT.
   *
   * We therefore preserve it as
   * text for now.
   */
  if (
    forCreate ||
    "amount" in input
  ) {
    quote.amount =
      nullableText(
        input.amount ===
          null ||
        input.amount ===
          undefined
          ? ""
          : String(
              input.amount
            )
      );
  }

  if (
    forCreate ||
    "quote_text" in input
  ) {
    quote.quote_text =
      nullableText(
        input.quote_text
      );
  }

  if (
    forCreate ||
    "quote_number" in input
  ) {
    quote.quote_number =
      nullableText(
        input.quote_number
      ) ||
      (
        forCreate
          ? generateQuoteNumber()
          : null
      );
  }

  if (
    forCreate ||
    "status" in input
  ) {
    quote.status =
      normalizeStatus(
        input.status
      );
  }

  return quote;
}

// =========================================================
// LOAD ALL QUOTES
// =========================================================

export async function loadQuotes({
  supabase,
  organizationId,
}) {
  const {
    data,
    error,
  } = await supabase
    .from("quotes")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw new Error(
      `Unable to load quotes: ${error.message}`
    );
  }

  return data || [];
}

// =========================================================
// LOAD ONE QUOTE
// =========================================================

export async function loadQuoteById({
  supabase,
  organizationId,
  quoteId,
}) {
  const {
    data,
    error,
  } = await supabase
    .from("quotes")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      quoteId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load quote: ${error.message}`
    );
  }

  return data || null;
}

// =========================================================
// CREATE QUOTE
// =========================================================

export async function createQuote({
  supabase,
  organizationId,
  input,
}) {
  const quoteInput =
    normalizeQuoteInput(
      input,
      {
        forCreate: true,
      }
    );

  /*
   * New quotes must always start as Draft.
   *
   * Approval is a separate explicit action.
   */
  quoteInput.status =
    "Draft";

  const {
    data,
    error,
  } = await supabase
    .from("quotes")
    .insert([
      {
        ...quoteInput,

        organization_id:
          organizationId,

        created_at:
          now(),

        updated_at:
          now(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(
      `Unable to create quote: ${error.message}`
    );
  }

  return data;
}

// =========================================================
// UPDATE QUOTE
// =========================================================

export async function updateQuote({
  supabase,
  organizationId,
  quoteId,
  input,
}) {
  const existing =
    await loadQuoteById({
      supabase,
      organizationId,
      quoteId,
    });

  if (!existing) {
    return null;
  }

  if (
    existing.status ===
      "Pending Approval" &&
    input.status ===
      undefined
  ) {
    throw new Error(
      "This quote is pending approval and cannot be edited."
    );
  }

  const quoteInput =
    normalizeQuoteInput(
      input
    );

  delete quoteInput.quote_number;

  const {
    data,
    error,
  } = await supabase
    .from("quotes")
    .update({
      ...quoteInput,

      updated_at:
        now(),
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      quoteId
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Unable to update quote: ${error.message}`
    );
  }

  return data;
}

// =========================================================
// DELETE QUOTE
// =========================================================

export async function deleteQuote({
  supabase,
  organizationId,
  quoteId,
}) {
  const existing =
    await loadQuoteById({
      supabase,
      organizationId,
      quoteId,
    });

  if (!existing) {
    return false;
  }

  if (
    existing.status ===
    "Pending Approval"
  ) {
    throw new Error(
      "A quote pending approval cannot be deleted."
    );
  }

  const {
    error,
  } = await supabase
    .from("quotes")
    .delete()
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      quoteId
    );

  if (error) {
    throw new Error(
      `Unable to delete quote: ${error.message}`
    );
  }

  return true;
}

// =========================================================
// SUBMIT QUOTE FOR APPROVAL
// =========================================================

export async function submitQuoteForApproval({
  supabase,
  organizationId,
  userId,
  employee,
  quoteId,
}) {
  const quote =
    await loadQuoteById({
      supabase,
      organizationId,
      quoteId,
    });

  if (!quote) {
    throw new Error(
      "Quote not found."
    );
  }

  if (
    quote.status ===
    "Pending Approval"
  ) {
    throw new Error(
      "This quote is already pending approval."
    );
  }

  if (
    quote.status ===
      "Approved" ||
    quote.status ===
      "Accepted"
  ) {
    throw new Error(
      `A ${quote.status.toLowerCase()} quote cannot be submitted for approval again.`
    );
  }

  /*
   * First move the real quote to
   * Pending Approval.
   */
  const {
    data:
      pendingQuote,
    error:
      quoteUpdateError,
  } = await supabase
    .from("quotes")
    .update({
      status:
        "Pending Approval",

      updated_at:
        now(),
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      quote.id
    )
    .select()
    .single();

  if (quoteUpdateError) {
    throw new Error(
      `Unable to submit quote: ${quoteUpdateError.message}`
    );
  }

  try {
    /*
     * Convert the text amount into
     * a number for workflow conditions,
     * while preserving the original
     * value as well.
     */
    const numericAmount =
      Number(
        String(
          quote.amount || ""
        )
          .replace(/,/g, "")
          .replace(/[£$€]/g, "")
          .trim()
      );

    const payload = {
      quote_id:
        quote.id,

      quote_number:
        quote.quote_number,

      client:
        quote.client,

      contact:
        quote.contact,

      email:
        quote.email,

      phone:
        quote.phone,

      service:
        quote.service,

      amount:
        Number.isFinite(
          numericAmount
        )
          ? numericAmount
          : quote.amount,

      amount_raw:
        quote.amount,

      lead_id:
        quote.lead_id,

      customer_id:
        quote.customer_id,

      status:
        "Pending Approval",

      /*
       * This is important.
       *
       * The approval runtime can now
       * resolve:
       *
       * Quote creator/current employee
       *       ↓
       * employee.manager_id
       *       ↓
       * Manager Approval
       */
      owner_employee_id:
        employee.id,
    };

    const workflowResult =
      await emitWorkflowEvent({
        supabase,

        organizationId,

        userId,

        module:
          "Quotes",

        eventName:
          "quote_submitted",

        recordType:
          "quote",

        recordId:
          quote.id,

        payload,
      });

    /*
     * We do not want a quote stuck in
     * Pending Approval if there is no
     * matching workflow.
     */
    if (
      !workflowResult.workflow_count
    ) {
      await supabase
        .from("quotes")
        .update({
          status:
            quote.status ||
            "Draft",

          updated_at:
            now(),
        })
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "id",
          quote.id
        );

      throw new Error(
        "No active Quote Submitted workflow was found. Activate a quote approval workflow before submitting this quote."
      );
    }

    return {
      quote:
        pendingQuote,

      workflow:
        workflowResult,
    };
  } catch (error) {
    /*
     * Compensating rollback.
     *
     * If workflow startup fails,
     * restore the previous quote status.
     */
    await supabase
      .from("quotes")
      .update({
        status:
          quote.status ||
          "Draft",

        updated_at:
          now(),
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        quote.id
      );

    throw error;
  }
}
