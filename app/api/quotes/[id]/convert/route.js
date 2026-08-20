import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../../lib/supabaseAdmin";

import {
  canViewOwnedRecord,
  getRecordPermissions,
} from "../../../../../lib/recordAccess";

// =========================================================
// HELPERS
// =========================================================

function isUuid(
  value
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(
      value ||
        ""
    )
  );
}

function normalise(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getCustomerName(
  quote
) {
  const contact =
    String(
      quote.contact ||
        ""
    ).trim();

  const client =
    String(
      quote.client ||
        ""
    ).trim();

  return (
    contact ||
    client ||
    "Customer"
  );
}

function forbidden(
  message
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status:
        403,
    }
  );
}

// =========================================================
// POST
// QUOTE -> CUSTOMER
// =========================================================

export async function POST(
  request,
  context
) {
  try {
    const {
      id,
    } =
      await context.params;

    if (
      !isUuid(
        id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid quote ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // ACCESS
    // =====================================================

    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const quotePermissions =
      getRecordPermissions(
        access,
        {
          prefix:
            "quotes",

          module:
            "Quotes",
        }
      );

    const customerPermissions =
      getRecordPermissions(
        access,
        {
          prefix:
            "customers",

          module:
            "Customers",
        }
      );

    /*
     * Converting a quote creates/links a customer and changes
     * the quote, so both sides of the operation are secured.
     */
    const canConvertQuote =
      quotePermissions.canConvert ||
      quotePermissions.canEdit;

    if (
      !canConvertQuote
    ) {
      return forbidden(
        "You do not have permission to convert quotes."
      );
    }

    if (
      !customerPermissions.canCreate
    ) {
      return forbidden(
        "You do not have permission to create customers."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // QUOTE
    // =====================================================

    const {
      data:
        quote,
      error:
        quoteError,
    } =
      await supabase
        .from(
          "quotes"
        )
        .select("*")
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      quoteError
    ) {
      throw new Error(
        quoteError.message
      );
    }

    if (
      !quote
    ) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status:
            404,
        }
      );
    }

    // =====================================================
    // RECORD VISIBILITY
    // =====================================================

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,

        permissions:
          quotePermissions,

        record:
          quote,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to convert this quote."
      );
    }

    // =====================================================
    // ALREADY LINKED
    // =====================================================

    if (
      quote.customer_id
    ) {
      const {
        data:
          linkedCustomer,
        error:
          linkedCustomerError,
      } =
        await supabase
          .from(
            "customers"
          )
          .select("*")
          .eq(
            "id",
            quote.customer_id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .maybeSingle();

      if (
        linkedCustomerError
      ) {
        throw new Error(
          linkedCustomerError.message
        );
      }

      if (
        linkedCustomer
      ) {
        return NextResponse.json({
          message:
            "Quote is already linked to this customer.",

          alreadyExisted:
            true,

          customer:
            linkedCustomer,

          quote,
        });
      }
    }

    // =====================================================
    // LEAD REQUIREMENT
    // =====================================================

    if (
      !quote.lead_id
    ) {
      return NextResponse.json(
        {
          error:
            "This quote is not linked to a lead. Please confirm that the quote contains the original lead_id before converting it to a customer.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // EXISTING CUSTOMER
    // =====================================================

    const {
      data:
        customers,
      error:
        customersError,
    } =
      await supabase
        .from(
          "customers"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    if (
      customersError
    ) {
      throw new Error(
        customersError.message
      );
    }

    const quoteEmail =
      normalise(
        quote.email
      );

    const existingCustomer =
      (
        customers ||
        []
      ).find(
        (
          customer
        ) => {
          const sameLead =
            Boolean(
              quote.lead_id
            ) &&
            Boolean(
              customer.lead_id
            ) &&
            String(
              customer.lead_id
            ) ===
              String(
                quote.lead_id
              );

          const customerEmail =
            normalise(
              customer.email
            );

          const sameEmail =
            Boolean(
              quoteEmail
            ) &&
            Boolean(
              customerEmail
            ) &&
            customerEmail ===
              quoteEmail;

          return (
            sameLead ||
            sameEmail
          );
        }
      );

    let customer =
      existingCustomer ||
      null;

    let alreadyExisted =
      Boolean(
        existingCustomer
      );

    // =====================================================
    // CREATE CUSTOMER
    // =====================================================

    if (
      !customer
    ) {
      /*
       * The customer inherits the quote owner.
       *
       * Older unassigned quotes fall back to the employee
       * performing the conversion.
       */
      const ownerEmployeeId =
        quote.owner_employee_id ||
        access.employee.id;

      const {
        data:
          createdCustomer,
        error:
          customerCreateError,
      } =
        await supabase
          .from(
            "customers"
          )
          .insert([
            {
              lead_id:
                quote.lead_id,

              customer_name:
                getCustomerName(
                  quote
                ),

              company:
                String(
                  quote.client ||
                    ""
                ).trim(),

              email:
                String(
                  quote.email ||
                    ""
                ).trim(),

              phone:
                String(
                  quote.phone ||
                    ""
                ).trim(),

              status:
                "Active",

              organization_id:
                organizationId,

              owner_employee_id:
                ownerEmployeeId,
            },
          ])
          .select()
          .single();

      if (
        customerCreateError
      ) {
        throw new Error(
          customerCreateError.message
        );
      }

      customer =
        createdCustomer;

      alreadyExisted =
        false;
    }

    // =====================================================
    // LINK QUOTE
    // =====================================================

    const {
      data:
        updatedQuote,
      error:
        quoteUpdateError,
    } =
      await supabase
        .from(
          "quotes"
        )
        .update({
          customer_id:
            customer.id,

          status:
            "Accepted",

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          quote.id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .select()
        .single();

    if (
      quoteUpdateError
    ) {
      /*
       * Roll back a newly-created customer if the quote
       * cannot be linked.
       */
      if (
        !alreadyExisted &&
        customer?.id
      ) {
        const {
          error:
            cleanupError,
        } =
          await supabase
            .from(
              "customers"
            )
            .delete()
            .eq(
              "id",
              customer.id
            )
            .eq(
              "organization_id",
              organizationId
            );

        if (
          cleanupError
        ) {
          console.error(
            "Customer conversion rollback error:",
            cleanupError
          );
        }
      }

      throw new Error(
        "The customer could not be linked to the quote: " +
          quoteUpdateError.message
      );
    }

    return NextResponse.json({
      message:
        alreadyExisted
          ? "Existing customer linked successfully."
          : "Customer created and linked successfully.",

      alreadyExisted,

      customer,

      quote:
        updatedQuote,
    });
  } catch (
    error
  ) {
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
        status:
          500,
      }
    );
  }
}
