import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function GET(
  request,
  context
) {
  try {
    const { customerId } =
      await context.params;

    if (!customerId) {
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

    const { data, error } =
      await supabase
        .from("timeline")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        )
        .eq(
          "customer_id",
          customerId
        )
        .order("created_at", {
          ascending: false,
        });

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
      "Customer timeline GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load customer timeline.",
      },
      {
        status: 500,
      }
    );
  }
}
