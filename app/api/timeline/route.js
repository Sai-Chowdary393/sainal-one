import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const customerId =
      searchParams.get("customer_id");

    let query = supabase
      .from("timeline")
      .select("*")
      .eq(
        "organization_id",
        ORGANIZATION_ID
      )
      .order("created_at", {
        ascending: false,
      });

    if (customerId) {
      query = query.eq(
        "customer_id",
        customerId
      );
    }

    const { data, error } =
      await query;

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

    return NextResponse.json(
      data || []
    );
  } catch (error) {
    console.error(
      "Timeline GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load timeline.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request) {
  try {
    const body =
      await request.json();

    const {
      customer_id,
      project_id,
      quote_id,
      invoice_id,
      event_type,
      title,
      description,
    } = body;

    if (!customer_id) {
      return NextResponse.json(
        {
          error:
            "Customer ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!event_type) {
      return NextResponse.json(
        {
          error:
            "Event type is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Timeline title is required.",
        },
        {
          status: 400,
        }
      );
    }

    const timelineRow = {
      organization_id:
        ORGANIZATION_ID,

      customer_id,

      project_id:
        project_id || null,

      quote_id:
        quote_id || null,

      invoice_id:
        invoice_id || null,

      event_type,

      title,

      description:
        description || null,
    };

    const { data, error } =
      await supabase
        .from("timeline")
        .insert([timelineRow])
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

    return NextResponse.json(
      data,
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Timeline POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create timeline event.",
      },
      {
        status: 500,
      }
    );
  }
}
