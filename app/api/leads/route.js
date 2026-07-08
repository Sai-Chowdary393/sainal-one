import { supabase } from "../../../lib/supabase";
import { NextResponse } from "next/server";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function GET() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", ORGANIZATION_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data || []);
}

export async function POST(request) {
  const body = await request.json();

  const { data, error } = await supabase
    .from("leads")
    .insert([
      {
        ...body,
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

  return NextResponse.json(data);
}
