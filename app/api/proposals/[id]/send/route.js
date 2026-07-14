import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "../../../../../lib/supabase";

import {
  buildEmailLayout,
  escapeHtml,
  getCompanyContactBlock,
  getCompanyDisplayName,
  textToHtml,
} from "../../../../../lib/email/emailUtils";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const [
      proposalResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from("proposals")
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

    if (proposalResult.error || !proposalResult.data) {
      return NextResponse.json(
        {
          error:
            proposalResult.error?.message ||
            "Proposal not found.",
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

    const proposal = proposalResult.data;
    const settings = settingsResult.data?.[0] || null;

    const recipientEmail = String(
      body.to || proposal.email || ""
    ).trim();

    if (!recipientEmail) {
      return NextResponse.json(
        {
          error:
            "The proposal does not have a recipient email. Please enter an email address.",
        },
        {
          status: 400,
        }
      );
    }

    const companyName = getCompanyDisplayName(settings);

    const subject =
      String(body.subject || "").trim() ||
      `${proposal.title} – ${companyName}`;

    const introductoryText =
      String(body.message || "").trim() ||
      `Dear ${proposal.contact || "Client"},

Please find our proposal below for your review.

Please contact us if you have any questions or would like to discuss any part of the proposal.`;

    const proposalUrl = `${
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://sainal-one.vercel.app"
    }/proposals/${proposal.id}`;

    const contentHtml = `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        style="
          margin-bottom: 24px;
          border-collapse: collapse;
          background: #faf9f6;
          border-radius: 10px;
        "
      >
        <tr>
          <td style="padding: 10px 14px; font-weight: 700;">
            Proposal Number
          </td>
          <td style="padding: 10px 14px;">
            ${escapeHtml(proposal.proposal_number)}
          </td>
        </tr>

        <tr>
          <td style="padding: 10px 14px; font-weight: 700;">
            Client
          </td>
          <td style="padding: 10px 14px;">
            ${escapeHtml(proposal.client || "-")}
          </td>
        </tr>

        <tr>
          <td style="padding: 10px 14px; font-weight: 700;">
            Service
          </td>
          <td style="padding: 10px 14px;">
            ${escapeHtml(proposal.service || "-")}
          </td>
        </tr>

        <tr>
          <td style="padding: 10px 14px; font-weight: 700;">
            Investment
          </td>
          <td style="padding: 10px 14px;">
            ${escapeHtml(
              proposal.amount || "To be confirmed"
            )}
          </td>
        </tr>
      </table>

      <div
        style="
          border-top: 1px solid #e5e7eb;
          padding-top: 22px;
          margin-top: 20px;
        "
      >
        ${textToHtml(proposal.proposal_text || "")}
      </div>

      <div
        style="
          margin-top: 28px;
          padding: 16px;
          background: #fff8dc;
          border-radius: 8px;
        "
      >
        <strong>Internal proposal link:</strong><br />
        <a href="${escapeHtml(proposalUrl)}">
          ${escapeHtml(proposalUrl)}
        </a>
      </div>
    `;

    const html = buildEmailLayout({
      companyName,
      title: proposal.title || "Business Proposal",
      introductoryText,
      contentHtml,
      footerText: `${getCompanyContactBlock(settings)}

Proposal reference: ${proposal.proposal_number}`,
    });

    const fromAddress =
      process.env.EMAIL_FROM ||
      `${companyName} <onboarding@resend.dev>`;

    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipientEmail],
      subject,
      html,
      replyTo:
        settings?.company_email ||
        undefined,
    });

    if (error) {
      console.error("Resend proposal error:", error);

      return NextResponse.json(
        {
          error:
            error.message ||
            "Failed to send proposal email.",
        },
        {
          status: 500,
        }
      );
    }

    const { data: updatedProposal, error: updateError } =
      await supabase
        .from("proposals")
        .update({
          status: "Sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposal.id)
        .eq("organization_id", ORGANIZATION_ID)
        .select()
        .single();

    if (updateError) {
      console.error(
        "Proposal sent but status update failed:",
        updateError
      );
    }

    return NextResponse.json({
      message: "Proposal email sent successfully.",
      emailId: data?.id || null,
      recipient: recipientEmail,
      proposal:
        updatedProposal || proposal,
    });
  } catch (error) {
    console.error("Send proposal email error:", error);

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to send proposal email.",
      },
      {
        status: 500,
      }
    );
  }
}
