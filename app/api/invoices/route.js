import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}


export async function POST(request) {
  try {
    const body = await request.json();

    const invoiceNumber =
      "SNI-" + Math.floor(100000 + Math.random() * 900000);

    const { data, error } = await supabase
      .from("invoices")
      .insert([
        {
          customer_id: body.customer_id,
          project_id: body.project_id,
          invoice_number: invoiceNumber,
          client: body.client,
          service: body.service,
          amount: body.amount,
          status: "Draft Invoice",
          due_date: body.due_date,
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

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
