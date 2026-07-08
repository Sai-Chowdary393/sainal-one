import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .insert([
        {
          name: body.name,
          company: body.company || "Website Enquiry",
          email: body.email,
          phone: body.phone || "",
          status: "New",
          value: body.value || "",
          notes: body.message || body.notes || "",
          source: "Website",
          organization_id: ORGANIZATION_ID,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lead created successfully.",
      lead: data?.[0],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create website lead." },
      { status: 500 }
    );
  }
}
