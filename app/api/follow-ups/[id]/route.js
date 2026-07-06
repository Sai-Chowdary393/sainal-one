import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const id = params.id;
    const body = await request.json();

    const { data, error } = await supabase
      .from("follow_ups")
      .update(body)
      .eq("id", id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update follow-up." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const id = params.id;

    const { data, error } = await supabase
      .from("follow_ups")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete follow-up." },
      { status: 500 }
    );
  }
}
