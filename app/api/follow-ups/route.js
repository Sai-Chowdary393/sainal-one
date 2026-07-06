import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("follow_ups")
      .select("*")
      .order("due_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch follow-ups." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from("follow_ups")
      .insert([
        {
          related_type: body.related_type || "General",
          related_id: body.related_id || null,
          title: body.title,
          note: body.note,
          due_date: body.due_date || null,
          status: body.status || "Pending",
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create follow-up." },
      { status: 500 }
    );
  }
}
