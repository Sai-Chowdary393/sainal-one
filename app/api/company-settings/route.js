import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

const ORGANIZATION_ID = "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID)
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data?.[0] || null);
  } catch (error) {
    console.error("Company settings GET error:", error);

    return NextResponse.json(
      { error: "Failed to load company settings." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const settingsPayload = {
      company_name: body.company_name || "",
      company_email: body.company_email || "",
      company_phone: body.company_phone || "",
      website: body.website || "",
      address: body.address || "",
      company_registration_number:
        body.company_registration_number || "",
      vat_number: body.vat_number || "",
      default_currency: body.default_currency || "GBP",
      default_vat_rate: body.default_vat_rate || "20",
      invoice_prefix: body.invoice_prefix || "SNI",
      bank_name: body.bank_name || "",
      bank_account_name: body.bank_account_name || "",
      bank_sort_code: body.bank_sort_code || "",
      bank_account_number: body.bank_account_number || "",
      payment_terms:
        body.payment_terms ||
        "Payment due within 14 days of invoice date.",

      industry: body.industry || "",
      business_type: body.business_type || "",
      services: body.services || "",
      target_customers: body.target_customers || "",
      ai_instructions: body.ai_instructions || "",

      organization_id: ORGANIZATION_ID,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabase
      .from("company_settings")
      .select("id")
      .eq("organization_id", ORGANIZATION_ID)
      .limit(1);

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from("company_settings")
        .update(settingsPayload)
        .eq("id", existing[0].id)
        .eq("organization_id", ORGANIZATION_ID)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from("company_settings")
      .insert([settingsPayload])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Company settings POST error:", error);

    return NextResponse.json(
      { error: "Failed to save company settings." },
      { status: 500 }
    );
  }
}
