import { supabase } from "../supabase";
import { generateInvoiceNumber } from "../utils/generators";
import { findMatchingRecord } from "../utils/matching";

export async function markInvoiceAsPaid({
  prompt,
  invoices,
  organizationId,
}) {
  const matchedInvoice = findMatchingRecord(prompt, invoices, [
    "invoice_number",
    "client",
  ]);

  if (!matchedInvoice) {
    return {
      notFound: true,
    };
  }

  if (String(matchedInvoice.status || "").toLowerCase() === "paid") {
    return {
      alreadyPaid: true,
      invoice: matchedInvoice,
    };
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "Paid",
    })
    .eq("id", matchedInvoice.id)
    .eq("organization_id", organizationId)
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

export async function convertQuoteToInvoice({
  prompt,
  quotes,
  invoices,
  profile,
  organizationId,
}) {
  const matchedQuote = findMatchingRecord(prompt, quotes, [
    "quote_number",
    "client",
    "contact",
  ]);

  if (!matchedQuote) {
    return {
      notFound: true,
    };
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
        organization_id: organizationId,
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
    .update({
      status: "Accepted",
    })
    .eq("id", matchedQuote.id)
    .eq("organization_id", organizationId);

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
