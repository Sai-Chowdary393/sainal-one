import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabaseServer";
import { getOrganizationId } from "../../../lib/getOrganizationServer";

export async function GET() {
  const supabase = await createClient();

  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", organizationId)
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
  const supabase = await createClient();

  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 401 }
    );
  }


  const body = await request.json();


  const { data, error } = await supabase
    .from("leads")
    .insert([
      {
        ...body,
        organization_id: organizationId,
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
