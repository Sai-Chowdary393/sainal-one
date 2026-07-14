import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "../../../../../lib/supabase";

import {
  buildEmailLayout,
  escapeHtml,
  getCompanyContactBlock,
  getCompanyDisplayName,
} from "../../../../../lib/email/emailUtils";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function formatDate(value) {
  if (!value) {
    return "Not specified";
  }

  return new Date(value).toLocaleDateString("en-GB");
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const [invoiceResult, settingsResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .eq("organization_id", ORGANIZATION_ID)
        .single(),

      supabase
        .from("company_settings")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID)
        .limit(1),
    ]);

    if (invoiceResult.error || !invoiceResult.data) {
      return NextResponse.json(
        {
          error:
            invoiceResult.error?.message ||
            "Invoice not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (settingsResult.error) {
      return NextResponse.json(
        {
          error: settingsResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    const invoice = invoiceResult.data;
    const settings = settingsResult.data?.[0] || null;

    let relatedQuote = null;

    if (invoice.quote_id) {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", invoice.quote_id)
        .eq("organization_id", ORGANIZATION_ID)
        .maybeSingle();

      if (error) {
        console.error(
          "Related quote lookup error:",
          error
        );
      }

      relatedQuote = data || null;
    }

    const recipientEmail = String(
      body.to ||
        relatedQuote?.email ||
        ""
    ).trim();

    if (!recipientEmail) {
      return NextResponse.json(
        {
          error:
            "No recipient email was found. Please enter the client's email address.",
        },
        {
          status: 400,
        }
      );
    }

    const companyName =
      getCompanyDisplayName(settings);

    const subject =
      String(body.subject || "").trim() ||
      `Invoice ${invoice.invoice_number} from ${companyName}`;

    const contactName =
      relatedQuote?.contact ||
      invoice.client ||
      "Client";

    const introductoryText =
      String(body.message || "").trim() ||
      `Dear ${contactName},

Please find the details of invoice ${invoice.invoice_number} below.

Please contact us if you have any questions regarding this invoice.`;

    const amount =
      invoice.total_amount ||
      invoice.amount ||
      "Not specified";

    const contentHtml = `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        style="
          border-collapse: collapse;
          background: #faf9f6;
          border-radius: 10px;
        "
      >
        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            Invoice Number
          </td>
          <td style="padding: 11px 14px;">
            ${escapeHtml(invoice.invoice_number)}
          </td>
        </tr>

        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            Client
          </td>
          <td style="padding: 11px 14px;">
            ${escapeHtml(invoice.client || "-")}
          </td>
        </tr>

        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            Service
          </td>
          <td style="padding: 11px 14px;">
            ${escapeHtml(invoice.service || "-")}
          </td>
        </tr>

        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            Subtotal
          </td>
          <td style="padding: 11px 14px;">
            ${escapeHtml(
              invoice.subtotal ||
                invoice.amount ||
                "-"
            )}
          </td>
        </tr>

        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            VAT
          </td>
          <td style="padding: 11px 14px;">
            ${escapeHtml(
              invoice.vat_amount ||
                "£0"
            )}
            ${
              invoice.vat_rate
                ? ` (${escapeHtml(invoice.vat_rate)})`
                : ""
            }
          </td>
        </tr>

        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            Total Amount
          </td>
          <td
            style="
              padding: 11px 14px;
              font-weight: 700;
              color: #9a7200;
            "
          >
            ${escapeHtml(amount)}
          </td>
        </tr>

        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            Due Date
          </td>
          <td style="padding: 11px 14px;">
            ${escapeHtml(
              formatDate(invoice.due_date)
            )}
          </td>
        </tr>

        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            Status
          </td>
          <td style="padding: 11px 14px;">
            ${escapeHtml(invoice.status || "-")}
          </td>
        </tr>

        <tr>
          <td style="padding: 11px 14px; font-weight: 700;">
            Payment Terms
          </td>
          <td style="padding: 11px 14px;">
            ${escapeHtml(
              invoice.payment_terms ||
                settings?.payment_terms ||
                "-"
            )}
          </td>
        </tr>
      </table>

      <div
        style="
          margin-top: 24px;
          padding: 18px;
          background: #fff8dc;
          border-radius: 8px;
        "
      >
        <strong>Payment details</strong><br /><br />

        Bank:
        ${escapeHtml(
          settings?.bank_name || "-"
        )}<br />

        Account name:
        ${escapeHtml(
          settings?.bank_account_name || "-"
        )}<br />

        Sort code:
        ${escapeHtml(
          settings?.bank_sort_code || "-"
        )}<br />

        Account number:
        ${escapeHtml(
          settings?.bank_account_number || "-"
        )}<br /><br />

        Please use
        <strong>
          ${escapeHtml(invoice.invoice_number)}
        </strong>
        as the payment reference.
      </div>
    `;

    const html = buildEmailLayout({
      companyName,
      title: `Invoice ${invoice.invoice_number}`,
      introductoryText,
      contentHtml,
      footerText: `${getCompanyContactBlock(
        settings
      )}

Invoice reference: ${invoice.invoice_number}`,
    });

    const fromAddress =
      process.env.EMAIL_FROM ||
      `${companyName} <onboarding@resend.dev>`;

    const resend = getResendClient();

    const { data, error } =
      await resend.emails.send({
        from: fromAddress,
        to: [recipientEmail],
        subject,
        html,
        replyTo:
          settings?.company_email ||
          undefined,
      });

    if (error) {
      console.error(
        "Resend invoice error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Failed to send invoice email.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Update the invoice to Sent after a successful email.
     * Do not overwrite Paid invoices.
     */
    let updatedInvoice = invoice;

    if (
      String(invoice.status || "").toLowerCase() !==
      "paid"
    ) {
      const {
        data: invoiceUpdateData,
        error: invoiceUpdateError,
      } = await supabase
        .from("invoices")
        .update({
          status: "Sent",
        })
        .eq("id", invoice.id)
        .eq(
          "organization_id",
          ORGANIZATION_ID
        )
        .select()
        .single();

      if (invoiceUpdateError) {
        console.error(
          "Invoice sent but status update failed:",
          invoiceUpdateError
        );
      } else {
        updatedInvoice = invoiceUpdateData;
      }
    }

    return NextResponse.json({
      message:
        "Invoice email sent successfully.",
      emailId: data?.id || null,
      recipient: recipientEmail,
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error(
      "Send invoice email error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to send invoice email.",
      },
      {
        status: 500,
      }
    );
  }
}
