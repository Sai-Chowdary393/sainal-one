import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../lib/supabaseAdmin";

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function pickFirst(...values) {
  return values.find(
    (
      value
    ) =>
      cleanText(
        value
      )
  ) || "";
}

function relatedName(
  relatedType,
  record
) {
  if (
    !record
  ) {
    return "";
  }

  if (
    relatedType ===
    "Lead"
  ) {
    return pickFirst(
      record.name,
      record.company
    );
  }

  if (
    relatedType ===
    "Customer"
  ) {
    return pickFirst(
      record.customer_name,
      record.name,
      record.company
    );
  }

  if (
    relatedType ===
    "Project"
  ) {
    return pickFirst(
      record.project_name,
      record.name,
      record.title
    );
  }

  return "";
}

function buildDraft({
  relatedType,
  record,
  currentSubject,
  currentMessage,
}) {
  const name =
    relatedName(
      relatedType,
      record
    );

  const company =
    pickFirst(
      record?.company,
      record?.customer_name
    );

  const project =
    pickFirst(
      record?.project_name,
      record?.title,
      record?.name
    );

  const status =
    pickFirst(
      record?.status
    );

  const subject =
    currentSubject ||
    (
      relatedType ===
      "Lead"
        ? `Following up${name ? ` with ${name}` : ""}`
        : relatedType ===
            "Customer"
          ? `Quick update${name ? ` for ${name}` : ""}`
          : relatedType ===
              "Project"
            ? `Project update${project ? ` – ${project}` : ""}`
            : "Quick follow-up"
    );

  if (
    currentMessage
  ) {
    return {
      subject,

      message:
        currentMessage,
    };
  }

  let message =
    "Hello,\n\n";

  if (
    relatedType ===
    "Lead"
  ) {
    message +=
      `I wanted to follow up${name ? ` regarding ${name}` : ""}`;

    if (
      company &&
      company !==
        name
    ) {
      message +=
        ` at ${company}`;
    }

    message +=
      ". I wanted to check whether you had any questions and whether there is anything else we can provide to help with the next steps.\n\n";
  } else if (
    relatedType ===
    "Customer"
  ) {
    message +=
      `I wanted to share a quick update${name ? ` regarding ${name}` : ""}`;

    if (
      status
    ) {
      message +=
        ` and the current status (${status})`;
    }

    message +=
      ". Please let us know if you have any questions or if there is anything you would like us to review.\n\n";
  } else if (
    relatedType ===
    "Project"
  ) {
    message +=
      `I wanted to share a quick update${project ? ` on ${project}` : " on the project"}`;

    if (
      status
    ) {
      message +=
        `, which is currently marked as ${status}`;
    }

    message +=
      ". Please let us know if you would like to discuss any of the next steps or outstanding items.\n\n";
  } else {
    message +=
      "I wanted to get in touch with a quick follow-up. Please let me know if you have any questions or if there is anything else we can help with.\n\n";
  }

  message +=
    "Kind regards";

  return {
    subject,

    message,
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

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const relatedType =
      cleanText(
        body.related_type
      ) ||
      "General";

    const relatedId =
      cleanText(
        body.related_id
      );

    const currentSubject =
      cleanText(
        body.current_subject
      );

    const currentMessage =
      cleanText(
        body.current_message
      );

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

    let record =
      body.related_record &&
      typeof body.related_record ===
        "object"
        ? body.related_record
        : null;

    /*
     * Fetch from the database when a related record ID is supplied.
     * This keeps the draft grounded in current CRM data instead of
     * relying only on client-provided context.
     */
    if (
      relatedType !==
        "General" &&
      relatedId
    ) {
      const table =
        relatedType ===
        "Lead"
          ? "leads"
          : relatedType ===
              "Customer"
            ? "customers"
            : "projects";

      const supabase =
        createAdminSupabaseClient();

      const {
        data,
        error,
      } =
        await supabase
          .from(
            table
          )
          .select("*")
          .eq(
            "organization_id",
            access.employee
              .organization_id
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
        data
      ) {
        record =
          data;
      }
    }

    const draft =
      buildDraft({
        relatedType,
        record,
        currentSubject,
        currentMessage,
      });

    return NextResponse.json(
      draft
    );
  } catch (error) {
    console.error(
      "Email AI draft error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to generate the email draft.",
      },
      {
        status:
          500,
      }
    );
  }
}
