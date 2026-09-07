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
  return (
    values.find(
      (
        value
      ) =>
        cleanText(
          value
        )
    ) ||
    ""
  );
}

function firstName(value) {
  const text =
    cleanText(
      value
    );

  return (
    text.split(
      /\s+/
    )[0] ||
    ""
  );
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

function getGreetingName(
  relatedType,
  record
) {
  if (
    relatedType ===
    "Lead"
  ) {
    return firstName(
      record?.name
    );
  }

  if (
    relatedType ===
    "Customer"
  ) {
    return firstName(
      pickFirst(
        record?.contact_name,
        record?.customer_name,
        record?.name
      )
    );
  }

  return "";
}

function sentenceFromInstruction(
  instruction
) {
  const value =
    cleanText(
      instruction
    );

  if (
    !value
  ) {
    return "";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  ).replace(
    /[.!?]+$/,
    ""
  );
}

function toneClosing(
  tone
) {
  if (
    tone ===
    "Friendly"
  ) {
    return "Best regards";
  }

  if (
    tone ===
    "Sales"
  ) {
    return "Best regards";
  }

  return "Kind regards";
}

function defaultSubject({
  relatedType,
  name,
  project,
  instruction,
}) {
  const instructionText =
    cleanText(
      instruction
    ).toLowerCase();

  if (
    instructionText.includes(
      "demo"
    )
  ) {
    return name
      ? `Following up after our demo, ${name}`
      : "Following up after our demo";
  }

  if (
    instructionText.includes(
      "proposal"
    )
  ) {
    return name
      ? `Following up on the proposal for ${name}`
      : "Following up on our proposal";
  }

  if (
    instructionText.includes(
      "meeting"
    )
  ) {
    return name
      ? `Following up after our meeting with ${name}`
      : "Following up after our meeting";
  }

  if (
    instructionText.includes(
      "quote"
    )
  ) {
    return name
      ? `Following up on your quote, ${name}`
      : "Following up on your quote";
  }

  if (
    relatedType ===
    "Lead"
  ) {
    return name
      ? `Following up with ${name}`
      : "Following up";
  }

  if (
    relatedType ===
    "Customer"
  ) {
    return name
      ? `Quick update for ${name}`
      : "Quick update";
  }

  if (
    relatedType ===
    "Project"
  ) {
    return project
      ? `Project update – ${project}`
      : "Project update";
  }

  return "Quick follow-up";
}

function buildDraft({
  relatedType,
  record,
  currentSubject,
  currentMessage,
  instruction,
  tone,
}) {
  const name =
    relatedName(
      relatedType,
      record
    );

  const greetingName =
    getGreetingName(
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
    defaultSubject({
      relatedType,
      name,
      project,
      instruction,
    });

  /*
   * Preserve an existing user-written message. This lets
   * Draft with AI fill empty fields without unexpectedly
   * replacing work the user already entered.
   */
  if (
    currentMessage
  ) {
    return {
      subject,
      message:
        currentMessage,
    };
  }

  const greeting =
    greetingName
      ? `Hi ${greetingName},`
      : "Hello,";

  const requestedPurpose =
    sentenceFromInstruction(
      instruction
    );

  let core = "";

  if (
    requestedPurpose
  ) {
    if (
      tone ===
      "Friendly"
    ) {
      core =
        `I hope you're well. ${requestedPurpose}.`;
    } else if (
      tone ===
      "Concise"
    ) {
      core =
        `${requestedPurpose}.`;
    } else if (
      tone ===
      "Sales"
    ) {
      core =
        `${requestedPurpose}. I wanted to make sure you have everything you need to move forward and see whether we can help with the next step.`;
    } else {
      core =
        `${requestedPurpose}. Please let me know if you have any questions or if there is anything else you need from us.`;
    }
  } else if (
    relatedType ===
    "Lead"
  ) {
    core =
      `I wanted to follow up regarding our conversation${
        company
          ? ` about ${company}`
          : ""
      }. Please let me know if you have any questions or if there is anything else we can provide to help with the next steps.`;
  } else if (
    relatedType ===
    "Customer"
  ) {
    core =
      `I wanted to share a quick update${
        status
          ? ` regarding the current status (${status})`
          : ""
      }. Please let us know if you have any questions or if there is anything you would like us to review.`;
  } else if (
    relatedType ===
    "Project"
  ) {
    core =
      `I wanted to share a quick update${
        project
          ? ` on ${project}`
          : " on the project"
      }${
        status
          ? `, which is currently marked as ${status}`
          : ""
      }. Please let us know if you would like to discuss any next steps or outstanding items.`;
  } else {
    core =
      "I wanted to get in touch with a quick follow-up. Please let me know if you have any questions or if there is anything else we can help with.";
  }

  if (
    tone ===
    "Concise"
  ) {
    core =
      core.replace(
        / Please let me know if you have any questions or if there is anything else you need from us\./,
        " Please let me know if you need anything else."
      );
  }

  const closing =
    toneClosing(
      tone
    );

  return {
    subject,

    message:
      `${greeting}\n\n${core}\n\n${closing}`,
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

    const instruction =
      cleanText(
        body.instruction
      );

    const tone =
      [
        "Professional",
        "Friendly",
        "Concise",
        "Sales",
      ].includes(
        cleanText(
          body.tone
        )
      )
        ? cleanText(
            body.tone
          )
        : "Professional";

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
        instruction,
        tone,
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
