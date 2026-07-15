import { NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Quote ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Load the quote being converted.
     */
    const { data: quote, error: quoteError } =
      await supabase
        .from("quotes")
        .select("*")
        .eq("id", id)
        .eq("organization_id", ORGANIZATION_ID)
        .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        {
          error:
            quoteError?.message ||
            "Quote not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * If the quote is already linked to a customer,
     * return that customer rather than creating another.
     */
    if (quote.customer_id) {
      const {
        data: linkedCustomer,
        error: linkedCustomerError,
      } = await supabase
        .from("customers")
        .select("*")
        .eq("id", quote.customer_id)
        .eq("organization_id", ORGANIZATION_ID)
        .maybeSingle();

      if (
        !linkedCustomerError &&
        linkedCustomer
      ) {
        return NextResponse.json({
          message:
            "Quote is already linked to this customer.",
          alreadyExisted: true,
          customer: linkedCustomer,
          quote,
        });
      }
    }

    /*
     * Search for an existing customer.
     */
    const { data: customers, error: customersError } =
      await supabase
        .from("customers")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID);

    if (customersError) {
      return NextResponse.json(
        {
          error: customersError.message,
        },
        {
          status: 500,
        }
      );
    }

    const existingCustomer = (
      customers || []
    ).find((customer) => {
      const sameLead =
        quote.lead_id &&
        String(customer.lead_id) ===
          String(quote.lead_id);

      const sameEmail =
        normalise(quote.email) &&
        normalise(customer.email) ===
          normalise(quote.email);

      const sameCompany =
        normalise(quote.client) &&
        normalise(customer.company) ===
          normalise(quote.client);

      return sameLead || sameEmail || sameCompany;
    });

    let customer = existingCustomer || null;
    let alreadyExisted = Boolean(existingCustomer);

    /*
     * Create a customer only when one does not exist.
     */
    if (!customer) {
      if (!quote.lead_id) {
        return NextResponse.json(
          {
            error:
              "This quote does not have a lead ID. A customer cannot be created because lead_id is required in your customers table.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: createdCustomer,
        error: customerCreateError,
      } = await supabase
        .from("customers")
        .insert([
          {
            lead_id: quote.lead_id,
            customer_name:
              quote.contact ||
              quote.client ||
              "Customer",
            company: quote.client || "",
            email: quote.email || "",
            phone: quote.phone || "",
            status: "Active",
            organization_id: ORGANIZATION_ID,
          },
        ])
        .select()
        .single();

      if (customerCreateError) {
        return NextResponse.json(
          {
            error: customerCreateError.message,
          },
          {
            status: 500,
          }
        );
      }

      customer = createdCustomer;
      alreadyExisted = false;
    }

    /*
     * Link the quote to the customer and keep it accepted.
     */
    const {
      data: updatedQuote,
      error: quoteUpdateError,
    } = await supabase
      .from("quotes")
      .update({
        customer_id: customer.id,
        status: "Accepted",
      })
      .eq("id", quote.id)
      .eq("organization_id", ORGANIZATION_ID)
      .select()
      .single();

    if (quoteUpdateError) {
      return NextResponse.json(
        {
          error:
            "Customer was found or created, but the quote could not be linked: " +
            quoteUpdateError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message: alreadyExisted
        ? "Existing customer linked successfully."
        : "Customer created and linked successfully.",

      alreadyExisted,
      customer,
      quote: updatedQuote,
    });
  } catch (error) {
    console.error(
      "Quote conversion error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to convert quote to customer.",
      },
      {
        status: 500,
      }
    );
  }
}
