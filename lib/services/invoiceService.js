import {
  createAdminSupabaseClient,
} from "../supabaseAdmin";

import {
  generateInvoiceNumber,
} from "../utils/generators";

import {
  findMatchingRecord,
} from "../utils/matching";

function parseMoney(value) {
  const parsed = Number.parseFloat(
    String(value || "")
      .replace(/,/g, "")
      .replace(/[^0-9.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function parseVatRate(value) {
  const parsed = Number.parseFloat(
    String(value || 0)
      .replace("%", "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatVatRate(value) {
  const number = Number(value || 0);

  return `${Number.isInteger(number) ? number : number.toFixed(2)}%`;
}

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

  if (!employeeId) {
    throw new Error(
      "Employee context is required to update an invoice."
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
      notFound:
        true,
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
      alreadyPaid:
        true,

      invoice:
        matchedInvoice,
    };
  }

  /*
   * NOTE:
   * The main SaiNal Agent no longer calls this helper to force
   * Paid directly. It records a real payment so Paid/Partially
   * Paid is calculated from invoice_payments.
   *
   * This function remains for backward compatibility only.
   */
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
    notFound:
      false,

    alreadyPaid:
      false,

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
      notFound:
        true,
    };
  }

  const quoteStatus =
    String(
      matchedQuote.status ||
        ""
    )
      .trim()
      .toLowerCase();

  if (
    ![
      "approved",
      "accepted",
    ].includes(
      quoteStatus
    )
  ) {
    throw new Error(
      "Only Approved or Accepted quotes can be converted to invoices."
    );
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
      alreadyExists:
        true,

      existing:
        existingInvoice,

      quote:
        matchedQuote,
    };
  }

  const ownerEmployeeId =
    employeeId;

  // =======================================================
  // FINANCIAL VALUES
  //
  // Quote amount becomes invoice subtotal.
  // VAT and invoice total are calculated exactly as the
  // normal Invoice API does.
  // =======================================================

  const invoiceNumber =
    generateInvoiceNumber(
      profile.invoicePrefix
    );

  const subtotalNumber =
    roundMoney(
      parseMoney(
        matchedQuote.amount
      )
    );

  const vatRateNumber =
    parseVatRate(
      profile.vatRate
    );

  if (
    vatRateNumber <
      0 ||
    vatRateNumber >
      100
  ) {
    throw new Error(
      "VAT rate must be between 0 and 100."
    );
  }

  const vatAmountNumber =
    roundMoney(
      subtotalNumber *
        (
          vatRateNumber /
          100
        )
    );

  const totalAmountNumber =
    roundMoney(
      subtotalNumber +
        vatAmountNumber
    );

  const subtotal =
    formatCurrency(
      subtotalNumber
    );

  const vatRate =
    formatVatRate(
      vatRateNumber
    );

  const vatAmount =
    formatCurrency(
      vatAmountNumber
    );

  const totalAmount =
    formatCurrency(
      totalAmountNumber
    );

  const now =
    new Date()
      .toISOString();

  const dueDate =
    new Date(
      Date.now() +
        14 *
          24 *
          60 *
          60 *
          1000
    )
      .toISOString()
      .slice(
        0,
        10
      );

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
            dueDate,

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
    const {
      error:
        cleanupError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .delete()
        .eq(
          "id",
          createdInvoice.id
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (cleanupError) {
      console.error(
        "AI invoice rollback failed:",
        cleanupError
      );
    }

    throw new Error(
      quoteUpdateError.message
    );
  }

  return {
    notFound:
      false,

    alreadyExists:
      false,

    created:
      createdInvoice,

    quote:
      matchedQuote,
  };
}
