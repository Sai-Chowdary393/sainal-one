import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const { data, error } = await supabase
      .from("invoices")
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
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update invoice." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from("invoices")
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
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete invoice." },
      { status: 500 }
    );
  }
}
