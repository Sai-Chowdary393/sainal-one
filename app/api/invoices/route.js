import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
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

    const year = new Date().getFullYear();
    const invoiceNumber = `SNI-${year}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const subtotal = body.subtotal || body.amount || "£0";
    const vatRate = body.vat_rate || "0%";
    const vatAmount = body.vat_amount || "£0";
    const totalAmount = body.total_amount || body.amount || "£0";

    const { data, error } = await supabase
      .from("invoices")
      .insert([
        {
          customer_id: body.customer_id || null,
          project_id: body.project_id || null,
          organization_id: ORGANIZATION_ID,
          invoice_number: invoiceNumber,
          client: body.client,
          service: body.service,
          amount: totalAmount,
          subtotal: subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          status: "Draft Invoice",
          due_date: body.due_date || null,
          payment_terms:
            body.payment_terms || "Payment due within 14 days of invoice date.",
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
