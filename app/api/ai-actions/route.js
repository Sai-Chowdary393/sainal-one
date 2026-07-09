import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function POST(request) {
  try {
    const body = await request.json();

    const action = body.action;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required." },
        { status: 400 }
      );
    }

    if (action === "create_follow_up") {
      const { data, error } = await supabase
        .from("follow_ups")
        .insert([
          {
            organization_id: ORGANIZATION_ID,
            related_type: body.related_type || "General",
            related_id: body.related_id || null,
            title: body.title || "AI Follow-up",
            note: body.note || "",
            due_date: body.due_date || null,
            status: body.status || "Pending",
          },
        ])
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Follow-up created successfully.",
        data,
      });
    }

    if (action === "create_lead") {
      const { data, error } = await supabase
        .from("leads")
        .insert([
          {
            organization_id: ORGANIZATION_ID,
            name: body.name,
            company: body.company || "",
            email: body.email || "",
            phone: body.phone || "",
            status: body.status || "New",
            value: body.value || "",
            notes: body.notes || "",
            source: "AI Assistant",
          },
        ])
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Lead created successfully.",
        data,
      });
    }

    if (action === "create_task") {
      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            organization_id: ORGANIZATION_ID,
            project_id: body.project_id || null,
            task_name: body.task_name || "AI Created Task",
            status: body.status || "Pending",
            due_date: body.due_date || null,
          },
        ])
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Task created successfully.",
        data,
      });
    }

    return NextResponse.json(
      { error: "Unsupported action." },
      { status: 400 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "AI action failed." },
      { status: 500 }
    );
  }
}
