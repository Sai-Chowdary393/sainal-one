import {
  createAdminSupabaseClient,
} from "../supabaseAdmin";

import {
  generateInvoiceNumber,
} from "../utils/generators";

import {
  findMatchingRecord,
} from "../utils/matching";

// =========================================================
// MARK INVOICE PAID
// =========================================================

export async function markInvoiceAsPaid({
  prompt,
  invoices,
  quotes,
  organizationId,
  employeeId,
}) {
  if (!organizationId) {
    throw new Error(
      "Organisation is required to update an invoice."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  let matchedInvoice =
    findMatchingRecord(
      prompt,
      invoices,
      [
        "invoice_number",
        "client",
      ]
    );

  /*
   * Invoice does not necessarily hold the original
   * quote contact, so we can resolve by quote first.
   */
  if (!matchedInvoice) {
    const matchedQuote =
      findMatchingRecord(
        prompt,
        quotes,
        [
          "quote_number",
          "client",
          "contact",
          "email",
        ]
      );

    if (matchedQuote) {
      matchedInvoice =
        invoices?.find(
          (invoice) =>
            String(
              invoice.quote_id ||
                ""
            ) ===
            String(
              matchedQuote.id
            )
        );
    }
  }

  if (!matchedInvoice) {
    return {
      notFound: true,
    };
  }

  if (
    String(
      matchedInvoice.status ||
        ""
    ).toLowerCase() ===
    "paid"
  ) {
    return {
      alreadyPaid: true,

      invoice:
        matchedInvoice,
    };
  }

  // =======================================================
  // UPDATE
  // =======================================================

  const {
    data:
      updatedInvoice,
    error,
  } =
    await supabase
      .from(
        "invoices"
      )
      .update({
        status:
          "Paid",

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        matchedInvoice.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return {
    notFound: false,
    alreadyPaid: false,

    invoice:
      updatedInvoice,
  };
}

// =========================================================
// QUOTE -> INVOICE
// =========================================================

export async function convertQuoteToInvoice({
  prompt,
  quotes,
  invoices,
  profile,
  organizationId,
  employeeId,
}) {
  if (!organizationId) {
    throw new Error(
      "Organisation is required to create an invoice."
    );
  }

  if (!employeeId) {
    throw new Error(
      "Employee ownership is required to create an invoice."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  const matchedQuote =
    findMatchingRecord(
      prompt,
      quotes,
      [
        "quote_number",
        "client",
        "contact",
        "email",
      ]
    );

  if (!matchedQuote) {
    return {
      notFound: true,
    };
  }

  // =======================================================
  // DUPLICATE CHECK
  // =======================================================

  const existingInvoice =
    invoices?.find(
      (invoice) =>
        String(
          invoice.quote_id ||
            ""
        ) ===
          String(
            matchedQuote.id
          ) ||
        (
          invoice.client ===
            matchedQuote.client &&
          invoice.service ===
            matchedQuote.service &&
          String(
            invoice.status ||
              ""
          )
            .toLowerCase()
            .includes(
              "draft"
            )
        )
    );

  if (existingInvoice) {
    return {
      alreadyExists: true,

      existing:
        existingInvoice,

      quote:
        matchedQuote,
    };
  }

  // =======================================================
  // OWNER
  // =======================================================

  const ownerEmployeeId =
    matchedQuote
      .owner_employee_id ||
    employeeId;

  // =======================================================
  // FINANCIAL VALUES
  // =======================================================

  const invoiceNumber =
    generateInvoiceNumber(
      profile.invoicePrefix
    );

  const amount =
    matchedQuote.amount ||
    "£0";

  const subtotal =
    amount;

  const vatRate =
    `${profile.vatRate}%`;

  /*
   * Keep the current commercial behaviour intact.
   * The secured Invoice API can calculate VAT when manually
   * creating/editing an invoice. We are not changing the
   * historic AI invoice calculation in this security batch.
   */
  const vatAmount =
    "£0";

  const totalAmount =
    amount;

  const now =
    new Date()
      .toISOString();

  // =======================================================
  // CREATE INVOICE
  // =======================================================

  const {
    data:
      createdInvoice,
    error,
  } =
    await supabase
      .from(
        "invoices"
      )
      .insert([
        {
          organization_id:
            organizationId,

          owner_employee_id:
            ownerEmployeeId,

          customer_id:
            matchedQuote.customer_id ||
            null,

          project_id:
            null,

          quote_id:
            matchedQuote.id,

          invoice_number:
            invoiceNumber,

          client:
            matchedQuote.client,

          service:
            matchedQuote.service,

          amount:
            totalAmount,

          subtotal,

          vat_rate:
            vatRate,

          vat_amount:
            vatAmount,

          total_amount:
            totalAmount,

          status:
            "Draft Invoice",

          due_date:
            null,

          payment_terms:
            profile.paymentTerms,

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

  // =======================================================
  // ACCEPT SOURCE QUOTE
  // =======================================================

  const {
    error:
      quoteUpdateError,
  } =
    await supabase
      .from(
        "quotes"
      )
      .update({
        status:
          "Accepted",

        updated_at:
          now,
      })
      .eq(
        "id",
        matchedQuote.id
      )
      .eq(
        "organization_id",
        organizationId
      );

  if (
    quoteUpdateError
  ) {
    throw new Error(
      quoteUpdateError.message
    );
  }

  return {
    notFound: false,
    alreadyExists: false,

    created:
      createdInvoice,

    quote:
      matchedQuote,
  };
}
