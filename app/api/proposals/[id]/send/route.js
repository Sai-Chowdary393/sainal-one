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
        "proposals",

      module:
        "Proposals",
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

function proposalToHtml(
  proposal,
  companyName
) {
  const content =
    escapeHtml(
      proposal.proposal_text ||
        ""
    ).replace(
      /\n/g,
      "<br />"
    );

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#27241f;max-width:760px;margin:0 auto;">
      <div style="border-bottom:3px solid #d5a51d;padding-bottom:18px;margin-bottom:26px;">
        <div style="font-size:22px;font-weight:700;">
          ${escapeHtml(companyName)}
        </div>

        <div style="margin-top:4px;color:#77736a;">
          Proposal ${escapeHtml(
            proposal.proposal_number ||
              ""
          )}
        </div>
      </div>

      <p>
        Hello ${
          escapeHtml(
            proposal.contact
          ) ||
          "there"
        },
      </p>

      <p>
        Please find our proposal below for
        <strong>${escapeHtml(
          proposal.service ||
            proposal.title ||
            "the requested service"
        )}</strong>.
      </p>

      <div style="margin:26px 0;padding:22px;border:1px solid #e6e1d6;border-radius:12px;background:#faf8f2;">
        ${content}
      </div>

      ${
        proposal.amount
          ? `
            <p>
              <strong>Proposal value:</strong>
              ${escapeHtml(
                proposal.amount
              )}
            </p>
          `
          : ""
      }

      <p style="margin-top:30px;">
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
            "A valid proposal ID is required.",
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
        "proposals.send"
      ) ||
      access.canModuleAction(
        "Proposals",
        "send"
      );

    if (
      !canSend
    ) {
      return forbidden(
        "You do not have permission to send proposals."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // PROPOSAL
    // =====================================================

    const {
      data:
        proposal,
      error:
        proposalError,
    } =
      await supabase
        .from(
          "proposals"
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
      proposalError
    ) {
      throw new Error(
        proposalError.message
      );
    }

    if (
      !proposal
    ) {
      return NextResponse.json(
        {
          error:
            "Proposal not found.",
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
          proposal,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to send this proposal."
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

    const recipientEmail =
      cleanText(
        body.email ||
          body.to ||
          proposal.email
      )
        .toLowerCase();

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

    const subject =
      cleanText(
        body.subject
      ) ||
      `${proposal.title || "Proposal"} – ${
        proposal.proposal_number ||
        ""
      }`;

    // =====================================================
    // COMPANY
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
        .select(
          `
            company_name,
            company_email,
            website
          `
        )
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

    // =====================================================
    // EMAIL CONFIG
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

    const resend =
      new Resend(
        resendApiKey
      );

    const html =
      proposalToHtml(
        proposal,
        companyName
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

        html,
      });

    if (
      sendError
    ) {
      console.error(
        "Proposal email sending error:",
        sendError
      );

      return NextResponse.json(
        {
          error:
            sendError.message ||
            "The proposal email could not be sent.",
        },
        {
          status:
            500,
        }
      );
    }

    // =====================================================
    // UPDATE PROPOSAL
    // =====================================================

    const nextStatus =
      String(
        proposal.status ||
          ""
      )
        .trim()
        .toLowerCase() ===
        "accepted"
        ? "Accepted"
        : "Sent";

    const {
      data:
        updatedProposal,
      error:
        updateError,
    } =
      await supabase
        .from(
          "proposals"
        )
        .update({
          status:
            nextStatus,

          updated_at:
            new Date()
              .toISOString(),
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
              "proposal",

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
        "Proposal email log error:",
        logError
      );
    }

    return NextResponse.json({
      message:
        "Proposal sent successfully.",

      proposal:
        updatedProposal,

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
      "Proposal send error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to send proposal.",
      },
      {
        status:
          500,
      }
    );
  }
}
