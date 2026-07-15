import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function GET(request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const emailType =
      searchParams.get("email_type")?.trim() ||
      "";

    const status =
      searchParams.get("status")?.trim() || "";

    let query = supabase
      .from("email_logs")
      .select("*")
      .eq(
        "organization_id",
        ORGANIZATION_ID
      )
      .order("created_at", {
        ascending: false,
      });

    if (emailType) {
      query = query.eq(
        "email_type",
        emailType
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      const safeSearch = search
        .replace(/,/g, "")
        .replace(/%/g, "");

      query = query.or(
        `recipient.ilike.%${safeSearch}%,subject.ilike.%${safeSearch}%,related_record_number.ilike.%${safeSearch}%`
      );
    }

    const { data, error } = await query;

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
    console.error(
      "Email logs GET error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load email history.",
      },
      {
        status: 500,
      }
    );
  }
}
