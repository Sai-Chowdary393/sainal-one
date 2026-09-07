import {
  NextResponse,
} from "next/server";

import {
  Resend,
} from "resend";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../lib/supabaseAdmin";

import {
  canViewOwnedRecord,
  getRecordPermissions,
} from "../../../../lib/recordAccess";

// =========================================================
// CONSTANTS
// =========================================================

const RELATED_CONFIG = {
  Lead: {
    table:
      "leads",

    prefix:
      "leads",

    module:
      "Leads",
  },

  Customer: {
    table:
      "customers",

    prefix:
      "customers",

    module:
      "Customers",
  },

  Project: {
    table:
      "projects",

    prefix:
      "projects",

    module:
      "Projects",
  },
};

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalise(value) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(
      value ||
        ""
    )
  );
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(
      value ||
        ""
    )
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

function messageToHtml({
  message,
  companyName,
}) {
  const content =
    escapeHtml(
      message
    ).replace(
      /\n/g,
      "<br />"
    );

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.65;color:#27241f;max-width:760px;margin:0 auto;">
      <div style="border-bottom:3px solid #d5a51d;padding-bottom:16px;margin-bottom:24px;">
        <div style="font-size:21px;font-weight:700;">
          ${escapeHtml(
            companyName
          )}
        </div>
      </div>

      <div>
        ${content}
      </div>

      <p style="margin-top:30px;">
        Kind regards,<br />
        ${escapeHtml(
          companyName
        )}
      </p>
    </div>
  `;
}

function getEmailPermissions(
  access
) {
  return getRecordPermissions(
    access,
    {
      prefix:
        "emails",

      module:
        "Emails",
    }
  );
}

function getRelatedRecordLabel({
  relatedType,
  record,
}) {
  if (
    !record
  ) {
    return null;
  }

  if (
    relatedType ===
    "Lead"
  ) {
    return (
      record.name ||
      record.company ||
      "Lead"
    );
  }

  if (
    relatedType ===
    "Customer"
  ) {
    return (
      record.customer_name ||
      record.name ||
      record.company ||
      "Customer"
    );
  }

  if (
    relatedType ===
    "Project"
  ) {
    return (
      record.project_name ||
      record.name ||
      record.title ||
      "Project"
    );
  }

  return null;
}

async function validateRelatedRecord({
  supabase,
  access,
  relatedType,
  relatedId,
}) {
  if (
    relatedType ===
    "General"
  ) {
    return null;
  }

  const config =
    RELATED_CONFIG[
      relatedType
    ];

  if (
    !config
  ) {
    throw new Error(
      "Invalid related record type."
    );
  }

  if (
    !relatedId ||
    !isUuid(
      relatedId
    )
  ) {
    throw new Error(
      `A valid ${relatedType.toLowerCase()} ID is required.`
    );
  }

  const organizationId =
    access.employee
      .organization_id;

  const {
    data:
      record,
    error,
  } =
    await supabase
      .from(
        config.table
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        relatedId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  if (
    !record
  ) {
    throw new Error(
      `The selected ${relatedType.toLowerCase()} is not valid for this organisation.`
    );
  }

  const permissions =
    getRecordPermissions(
      access,
      {
        prefix:
          config.prefix,

        module:
          config.module,
      }
    );

  const visible =
    await canViewOwnedRecord({
      supabase,
      access,
      permissions,

      record,
    });

  if (
    !visible
  ) {
    throw new Error(
      `You do not have permission to link this ${relatedType.toLowerCase()}.`
    );
  }

  return record;
}

async function writeEmailLog({
  supabase,
  organizationId,
  relatedType,
  relatedRecord,
  recipientEmail,
  subject,
  status,
  providerEmailId,
  errorMessage,
}) {
  const now =
    new Date()
      .toISOString();

  const relatedRecordId =
    relatedRecord?.id ||
    null;

  const relatedRecordNumber =
    getRelatedRecordLabel({
      relatedType,
      record:
        relatedRecord,
    });

  const {
    error,
  } =
    await supabase
      .from(
        "email_logs"
      )
      .insert([
        {
          organization_id:
            organizationId,

          recipient:
            recipientEmail,

          subject,

          email_type:
            relatedType,

          related_record_id:
            relatedRecordId,

          related_record_number:
            relatedRecordNumber,

          status,

          provider:
            "Resend",

          provider_email_id:
            providerEmailId ||
            null,

          error_message:
            errorMessage ||
            null,

          sent_at:
            status ===
            "Sent"
              ? now
              : null,

          created_at:
            now,
        },
      ]);

  if (
    error
  ) {
    console.error(
      "General email log error:",
      error
    );

    return {
      ok:
        false,

      error:
        error.message,
    };
  }

  return {
    ok:
      true,

    error:
      null,
  };
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request
) {
  try {
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
      getEmailPermissions(
        access
      );

    const canSend =
      Boolean(
        access.employee
          .is_organization_owner
      ) ||
      permissions.canCreate ||
      permissions.canSend ||
      access.can(
        "emails.send"
      ) ||
      access.canModuleAction(
        "Emails",
        "send"
      ) ||
      access.canModuleAction(
        "Communication",
        "send"
      );

    if (
      !canSend
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to send emails.",
        },
        {
          status:
            403,
        }
      );
    }

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const recipientEmail =
      cleanText(
        body.to ||
          body.email
      )
        .toLowerCase();

    const subject =
      cleanText(
        body.subject
      );

    const message =
      cleanText(
        body.message
      );

    const relatedType =
      cleanText(
        body.related_type
      ) ||
      "General";

    const relatedId =
      cleanText(
        body.related_id
      ) ||
      null;

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

    if (
      !subject
    ) {
      return NextResponse.json(
        {
          error:
            "Email subject is required.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !message
    ) {
      return NextResponse.json(
        {
          error:
            "Email message is required.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      ![
        "General",
        "Lead",
        "Customer",
        "Project",
      ].includes(
        relatedType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid related record type.",
        },
        {
          status:
            400,
        }
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    let relatedRecord =
      null;

    try {
      relatedRecord =
        await validateRelatedRecord({
          supabase,
          access,
          relatedType,
          relatedId,
        });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status:
            403,
        }
      );
    }

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
          "company_name"
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
      messageToHtml({
        message,
        companyName,
      });

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
      const logResult =
        await writeEmailLog({
          supabase,
          organizationId,
          relatedType,
          relatedRecord,
          recipientEmail,
          subject,

          status:
            "Failed",

          providerEmailId:
            null,

          errorMessage:
            sendError.message ||
            "The email could not be sent.",
        });

      return NextResponse.json(
        {
          error:
            sendError.message ||
            "The email could not be sent.",

          history_logged:
            logResult.ok,
        },
        {
          status:
            500,
        }
      );
    }

    const logResult =
      await writeEmailLog({
        supabase,
        organizationId,
        relatedType,
        relatedRecord,
        recipientEmail,
        subject,

        status:
          "Sent",

        providerEmailId:
          emailResult?.id ||
          null,

        errorMessage:
          null,
      });

    return NextResponse.json({
      message:
        logResult.ok
          ? "Email sent successfully."
          : "Email sent successfully, but the email history could not be recorded.",

      history_logged:
        logResult.ok,

      history_error:
        logResult.error,

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
      "General email send error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to send email.",
      },
      {
        status:
          500,
      }
    );
  }
}
