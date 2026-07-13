import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID)
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

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Proposals GET error:", error);

    return NextResponse.json(
      {
        error: "Failed to load proposals.",
      },
      {
        status: 500,
      }
    );
  }
}
