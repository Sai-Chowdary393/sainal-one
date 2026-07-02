import { supabase } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request, context) {
  const body = await request.json();
  const { id } = await context.params;

  const { data, error } = await supabase
    .from("tasks")
    .update(body)
    .eq("id", id)
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(request, context) {
  const { id } = await context.params;

  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
