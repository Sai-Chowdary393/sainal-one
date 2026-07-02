import { supabase } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request, { params }) {
  const body = await request.json();

  const { data, error } = await supabase
    .from("tasks")
    .update(body)
    .eq("id", params.id)
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", params.id)
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
