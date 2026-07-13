import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", id)
      .eq("organization_id", ORGANIZATION_ID)
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
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
    const body = await request.json();

    const allowedStatuses = [
      "Draft",
      "Sent",
      "Accepted",
      "Rejected",
    ];

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (
      body.status &&
      allowedStatuses.includes(body.status)
    ) {
      updates.status = body.status;
    }

    if (typeof body.proposal_text === "string") {
      updates.proposal_text = body.proposal_text;
    }

    if (typeof body.title === "string") {
      updates.title = body.title;
    }

    const { data, error } = await supabase
      .from("proposals")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", ORGANIZATION_ID)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
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
