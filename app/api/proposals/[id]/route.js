import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const ALLOWED_STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
];

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Proposal ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", id)
      .eq("organization_id", ORGANIZATION_ID)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            "Proposal not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proposal GET error:", error);

    return NextResponse.json(
      {
        error: "Failed to load proposal.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Proposal ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const body = await request.json();

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === "string") {
      const title = cleanText(body.title);

      if (!title) {
        return NextResponse.json(
          {
            error: "Proposal title cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.title = title;
    }

    if (typeof body.client === "string") {
      const client = cleanText(body.client);

      if (!client) {
        return NextResponse.json(
          {
            error: "Client name cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.client = client;
    }

    if (typeof body.contact === "string") {
      updates.contact = cleanText(body.contact);
    }

    if (typeof body.email === "string") {
      const email = cleanText(body.email);

      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return NextResponse.json(
          {
            error:
              "Please enter a valid email address.",
          },
          {
            status: 400,
          }
        );
      }

      updates.email = email;
    }

    if (typeof body.service === "string") {
      const service = cleanText(body.service);

      if (!service) {
        return NextResponse.json(
          {
            error: "Service cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.service = service;
    }

    if (typeof body.amount === "string") {
      updates.amount = cleanText(body.amount);
    }

    if (typeof body.proposal_text === "string") {
      const proposalText = body.proposal_text.trim();

      if (!proposalText) {
        return NextResponse.json(
          {
            error:
              "Proposal content cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.proposal_text = proposalText;
    }

    if (typeof body.status === "string") {
      if (!ALLOWED_STATUSES.includes(body.status)) {
        return NextResponse.json(
          {
            error: "Invalid proposal status.",
          },
          {
            status: 400,
          }
        );
      }

      updates.status = body.status;
    }

    const editableFields = [
      "title",
      "client",
      "contact",
      "email",
      "service",
      "amount",
      "proposal_text",
      "status",
    ];

    const hasEditableField = editableFields.some(
      (field) =>
        Object.prototype.hasOwnProperty.call(
          updates,
          field
        )
    );

    if (!hasEditableField) {
      return NextResponse.json(
        {
          error:
            "No valid proposal fields were provided.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } = await supabase
      .from("proposals")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", ORGANIZATION_ID)
      .select()
      .single();

    if (error) {
      console.error(
        "Proposal update database error:",
        error
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "Proposal not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proposal PATCH error:", error);

    return NextResponse.json(
      {
        error: "Failed to update proposal.",
      },
      {
        status: 500,
      }
    );
  }
}
