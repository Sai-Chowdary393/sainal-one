import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data?.[0] || null);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load company settings." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { data: existing } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1);

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from("company_settings")
        .update({
          company_name: body.company_name,
          website: body.website,
          address: body.address,
          vat_number: body.vat_number,
          default_currency: body.default_currency,
          default_vat_rate: body.default_vat_rate,
          invoice_prefix: body.invoice_prefix,
          payment_terms: body.payment_terms,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from("company_settings")
      .insert([body])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save company settings." },
      { status: 500 }
    );
  }
}
