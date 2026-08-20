import {
  NextResponse,
} from "next/server";

import {
  Resend,
} from "resend";

import {
  getServerAccess,
} from "../../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../../lib/supabaseAdmin";

import {
  canViewOwnedRecord,
  getRecordPermissions,
} from "../../../../../lib/recordAccess";

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(
      value ||
        ""
    )
  );
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(
      value ||
        ""
    )
  );
}

function forbidden(message) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status:
        403,
    }
  );
}

function getPermissions(access) {
  return getRecordPermissions(
    access,
    {
      prefix:
        "invoices",

      module:
        "Invoices",
    }
  );
}

function escapeHtml(value) {
  return String(
    value ||
      ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function invoiceToHtml({
  invoice,
  settings,
}) {
  const companyName =
    settings
      ?.company_name ||
    "SaiNal Technologies Ltd";

  const address =
    settings
      ?.address ||
    "";

  const website =
    settings
      ?.website ||
    "";

  const paymentTerms =
    invoice.payment_terms ||
    settings
      ?.payment_terms ||
    "";

  const total =
    invoice.total_amount ||
    invoice.amount ||
    "£0.00";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#28251f;max-width:760px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;border-bottom:3px solid #d5a51d;padding-bottom:20px;margin-bottom:28px;">
        <div>
          <div style="font-size:22px;font-weight:700;">
            ${escapeHtml(companyName)}
          </div>

          ${
            address
              ? `<div style="color:#77736a;">${escapeHtml(address)}</div>`
              : ""
          }

          ${
            website
              ? `<div style="color:#77736a;">${escapeHtml(website)}</div>`
              : ""
          }
        </div>

        <div style="text-align:right;">
          <div style="font-size:24px;font-weight:700;color:#9a7100;">
            INVOICE
          </div>

          <div>
            ${escapeHtml(
              invoice.invoice_number ||
                ""
            )}
          </div>
        </div>
      </div>

      <p>
        Hello,
      </p>

      <p>
        Please find the invoice details below.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:28px 0;">
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">
            <strong>Client</strong>
          </td>

          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">
            ${escapeHtml(invoice.client)}
          </td>
        </tr>

        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">
            <strong>Service</strong>
          </td>

          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">
            ${escapeHtml(invoice.service)}
          </td>
        </tr>

        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">
            <strong>Subtotal</strong>
          </td>

          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">
            ${escapeHtml(
              invoice.subtotal ||
                invoice.amount
            )}
          </td>
        </tr>

        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">
            <strong>VAT</strong>
          </td>

          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">
            ${escapeHtml(
              invoice.vat_amount ||
                "£0.00"
            )}
            ${
              invoice.vat_rate
                ? ` (${escapeHtml(invoice.vat_rate)})`
                : ""
            }
          </td>
        </tr>

        <tr>
          <td style="padding:14px 10px;">
            <strong>Total</strong>
          </td>

          <td style="padding:14px 10px;text-align:right;font-size:20px;font-weight:700;color:#9a7100;">
            ${escapeHtml(total)}
          </td>
        </tr>
      </table>

      ${
        invoice.due_date
          ? `
            <p>
              <strong>Due date:</strong>
              ${escapeHtml(invoice.due_date)}
            </p>
          `
          : ""
      }

      ${
        paymentTerms
          ? `
            <p>
              <strong>Payment terms:</strong><br />
              ${escapeHtml(paymentTerms)}
            </p>
          `
          : ""
      }

      <p style="margin-top:30px;">
        Thank you for your business.
      </p>

      <p>
        Kind regards,<br />
        ${escapeHtml(companyName)}
      </p>
    </div>
  `;
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request,
  context
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(
        id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid invoice ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // ACCESS
    // =====================================================

    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const permissions =
      getPermissions(
        access
      );

    const canSend =
      permissions.canSend ||
      access.can(
        "invoices.send"
      ) ||
      access.canModuleAction(
        "Invoices",
        "send"
      );

    if (
      !canSend
    ) {
      return forbidden(
        "You do not have permission to send invoices."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // INVOICE
    // =====================================================

    const {
      data:
        invoice,
      error:
        invoiceError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .select("*")
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      invoiceError
    ) {
      throw new Error(
        invoiceError.message
      );
    }

    if (
      !invoice
    ) {
      return NextResponse.json(
        {
          error:
            "Invoice not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,

        record:
          invoice,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to send this invoice."
      );
    }

    // =====================================================
    // REQUEST
    // =====================================================

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    let recipientEmail =
      cleanText(
        body.email ||
          body.to ||
          invoice.email
      )
        .toLowerCase();

    // =====================================================
    // FALLBACK EMAIL FROM QUOTE / CUSTOMER
    // =====================================================

    if (
      !recipientEmail &&
      invoice.quote_id
    ) {
      const {
        data:
          quote,
      } =
        await supabase
          .from(
            "quotes"
          )
          .select(
            "email"
          )
          .eq(
            "id",
            invoice.quote_id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .maybeSingle();

      recipientEmail =
        cleanText(
          quote?.email
        )
          .toLowerCase();
    }

    if (
      !recipientEmail &&
      invoice.customer_id
    ) {
      const {
        data:
          customer,
      } =
        await supabase
          .from(
            "customers"
          )
          .select(
            "email"
          )
          .eq(
            "id",
            invoice.customer_id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .maybeSingle();

      recipientEmail =
        cleanText(
          customer?.email
        )
          .toLowerCase();
    }

    if (
      !recipientEmail ||
      !isEmail(
        recipientEmail
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid recipient email address is required.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // COMPANY SETTINGS
    // =====================================================

    const {
      data:
        companySettings,
      error:
        settingsError,
    } =
      await supabase
        .from(
          "company_settings"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      settingsError
    ) {
      throw new Error(
        settingsError.message
      );
    }

    const companyName =
      companySettings
        ?.company_name ||
      "SaiNal Technologies Ltd";

    const subject =
      cleanText(
        body.subject
      ) ||
      `Invoice ${
        invoice.invoice_number ||
        ""
      } from ${companyName}`;

    // =====================================================
    // ENVIRONMENT
    // =====================================================

    const resendApiKey =
      process.env
        .RESEND_API_KEY;

    const emailFrom =
      process.env
        .EMAIL_FROM;

    if (
      !resendApiKey
    ) {
      return NextResponse.json(
        {
          error:
            "Email service is not configured. RESEND_API_KEY is missing.",
        },
        {
          status:
            500,
        }
      );
    }

    if (
      !emailFrom
    ) {
      return NextResponse.json(
        {
          error:
            "Email sender is not configured. EMAIL_FROM is missing.",
        },
        {
          status:
            500,
        }
      );
    }

    // =====================================================
    // SEND
    // =====================================================

    const resend =
      new Resend(
        resendApiKey
      );

    const {
      data:
        emailResult,
      error:
        sendError,
    } =
      await resend.emails.send({
        from:
          emailFrom,

        to: [
          recipientEmail,
        ],

        subject,

        html:
          invoiceToHtml({
            invoice,

            settings:
              companySettings,
          }),
      });

    if (
      sendError
    ) {
      console.error(
        "Invoice email sending error:",
        sendError
      );

      return NextResponse.json(
        {
          error:
            sendError.message ||
            "The invoice email could not be sent.",
        },
        {
          status:
            500,
        }
      );
    }

    // =====================================================
    // UPDATE STATUS
    // =====================================================

    const currentStatus =
      String(
        invoice.status ||
          ""
      )
        .trim()
        .toLowerCase();

    const nextStatus =
      [
        "paid",
        "partially paid",
      ].includes(
        currentStatus
      )
        ? invoice.status
        : "Sent";

    const {
      data:
        updatedInvoice,
      error:
        updateError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .update({
          status:
            nextStatus,
        })
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .select()
        .single();

    if (
      updateError
    ) {
      throw new Error(
        updateError.message
      );
    }

    // =====================================================
    // EMAIL LOG
    // =====================================================

    const {
      error:
        logError,
    } =
      await supabase
        .from(
          "email_logs"
        )
        .insert([
          {
            organization_id:
              organizationId,

            record_type:
              "invoice",

            record_id:
              id,

            recipient_email:
              recipientEmail,

            subject,

            status:
              "Sent",

            provider:
              "Resend",

            provider_message_id:
              emailResult?.id ||
              null,

            sent_by_user_id:
              access.user?.id ||
              null,

            sent_by_employee_id:
              access.employee.id,

            created_at:
              new Date()
                .toISOString(),
          },
        ]);

    if (
      logError
    ) {
      console.error(
        "Invoice email log error:",
        logError
      );
    }

    return NextResponse.json({
      message:
        "Invoice sent successfully.",

      invoice:
        updatedInvoice,

      email: {
        id:
          emailResult?.id ||
          null,

        to:
          recipientEmail,

        subject,
      },
    });
  } catch (error) {
    console.error(
      "Invoice send error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to send invoice.",
      },
      {
        status:
          500,
      }
    );
  }
}
