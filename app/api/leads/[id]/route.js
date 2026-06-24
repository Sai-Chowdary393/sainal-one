import { supabase } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request, context) {
  const { id } = await context.params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("leads")
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

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Lead deleted successfully",
  });
}
