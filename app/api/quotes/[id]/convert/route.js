import { NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getCustomerName(quote) {
  const contact = String(
    quote.contact || ""
  ).trim();

  const client = String(
    quote.client || ""
  ).trim();

  return contact || client || "Customer";
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
     * Load the quote that is being converted.
     */
    const {
      data: quote,
      error: quoteError,
    } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .eq(
        "organization_id",
        ORGANIZATION_ID
      )
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
     * If this quote already has a customer ID,
     * return the linked customer.
     */
    if (quote.customer_id) {
      const {
        data: linkedCustomer,
        error: linkedCustomerError,
      } = await supabase
        .from("customers")
        .select("*")
        .eq(
          "id",
          quote.customer_id
        )
        .eq(
          "organization_id",
          ORGANIZATION_ID
        )
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

      /*
       * The quote contains a customer ID, but
       * that customer no longer exists.
       * Continue and create or find a valid one.
       */
      console.warn(
        "Quote contains an invalid customer_id:",
        quote.customer_id
      );
    }

    /*
     * A lead ID is required because your
     * customers table uses lead_id for the
     * Lead → Quote → Customer relationship.
     */
    if (!quote.lead_id) {
      return NextResponse.json(
        {
          error:
            "This quote is not linked to a lead. Please confirm that the quote contains the original lead_id before converting it to a customer.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Search for an existing customer.
     *
     * Important:
     * We only match using lead_id or email.
     * We do not match using company name alone,
     * because one company can have several
     * different contacts.
     */
    const {
      data: customers,
      error: customersError,
    } = await supabase
      .from("customers")
      .select("*")
      .eq(
        "organization_id",
        ORGANIZATION_ID
      );

    if (customersError) {
      console.error(
        "Customer search error:",
        customersError
      );

      return NextResponse.json(
        {
          error:
            customersError.message ||
            "Failed to search customers.",
        },
        {
          status: 500,
        }
      );
    }

    const quoteEmail = normalise(
      quote.email
    );

    const existingCustomer = (
      customers || []
    ).find((customer) => {
      const sameLead =
        Boolean(quote.lead_id) &&
        Boolean(customer.lead_id) &&
        String(customer.lead_id) ===
          String(quote.lead_id);

      const customerEmail = normalise(
        customer.email
      );

      const sameEmail =
        Boolean(quoteEmail) &&
        Boolean(customerEmail) &&
        customerEmail === quoteEmail;

      return sameLead || sameEmail;
    });

    let customer =
      existingCustomer || null;

    let alreadyExisted =
      Boolean(existingCustomer);

    /*
     * Create a new customer when no matching
     * lead ID or email address exists.
     */
    if (!customer) {
      const customerPayload = {
        lead_id: quote.lead_id,

        customer_name:
          getCustomerName(quote),

        company: String(
          quote.client || ""
        ).trim(),

        email: String(
          quote.email || ""
        ).trim(),

        phone: String(
          quote.phone || ""
        ).trim(),

        status: "Active",

        organization_id:
          ORGANIZATION_ID,
      };

      const {
        data: createdCustomer,
        error: customerCreateError,
      } = await supabase
        .from("customers")
        .insert([customerPayload])
        .select()
        .single();

      if (
        customerCreateError ||
        !createdCustomer
      ) {
        console.error(
          "Customer creation error:",
          customerCreateError
        );

        return NextResponse.json(
          {
            error:
              customerCreateError?.message ||
              "Failed to create customer.",
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
     * Link the quote to the customer and set
     * the quote status to Accepted.
     */
    const {
      data: updatedQuote,
      error: quoteUpdateError,
    } = await supabase
      .from("quotes")
      .update({
        customer_id: customer.id,
        status: "Accepted",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", quote.id)
      .eq(
        "organization_id",
        ORGANIZATION_ID
      )
      .select()
      .single();

    if (
      quoteUpdateError ||
      !updatedQuote
    ) {
      console.error(
        "Quote linking error:",
        quoteUpdateError
      );

      /*
       * If this request created a brand-new
       * customer but failed to link the quote,
       * remove that customer to avoid leaving
       * an incomplete customer record.
       */
      if (
        !alreadyExisted &&
        customer?.id
      ) {
        const {
          error: cleanupError,
        } = await supabase
          .from("customers")
          .delete()
          .eq("id", customer.id)
          .eq(
            "organization_id",
            ORGANIZATION_ID
          );

        if (cleanupError) {
          console.error(
            "Customer cleanup error:",
            cleanupError
          );
        }
      }

      return NextResponse.json(
        {
          error:
            "The customer could not be linked to the quote: " +
            (quoteUpdateError?.message ||
              "Unknown database error."),
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
