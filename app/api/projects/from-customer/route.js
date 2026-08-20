import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../lib/supabaseAdmin";

import {
  attachRecordOwner,
  getRecordPermissions,
} from "../../../../lib/recordAccess";

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function forbidden(message) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  );
}

function getPermissions(access) {
  return getRecordPermissions(
    access,
    {
      prefix: "projects",
      module: "Projects",
    }
  );
}

function normalise(value) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function buildProjectName({
  customer,
  quote,
}) {
  const company =
    cleanText(
      customer.company
    );

  const customerName =
    cleanText(
      customer.customer_name
    );

  const service =
    cleanText(
      quote.service
    );

  const accountName =
    company ||
    customerName ||
    cleanText(
      quote.client
    ) ||
    "Customer";

  if (service) {
    return `${accountName} - ${service}`;
  }

  return `${accountName} Project`;
}

// =========================================================
// POST
// CUSTOMER + QUOTE -> PROJECT
// =========================================================

export async function POST(
  request
) {
  try {
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

    const permissions =
      getPermissions(
        access
      );

    if (
      !permissions.canCreate
    ) {
      return forbidden(
        "You do not have permission to create projects."
      );
    }

    const body =
      await request.json();

    const customerId =
      cleanText(
        body.customer_id
      );

    const quoteId =
      cleanText(
        body.quote_id
      );

    if (
      !customerId ||
      !isUuid(
        customerId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid customer ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !quoteId ||
      !isUuid(
        quoteId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid quote ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // CUSTOMER
    // =====================================================

    const {
      data: customer,
      error:
        customerError,
    } =
      await supabase
        .from(
          "customers"
        )
        .select("*")
        .eq(
          "id",
          customerId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      customerError
    ) {
      throw new Error(
        customerError.message
      );
    }

    if (
      !customer
    ) {
      return NextResponse.json(
        {
          error:
            "Customer not found.",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================================
    // QUOTE
    // =====================================================

    const {
      data: quote,
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
          quoteId
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
          status: 404,
        }
      );
    }

    // =====================================================
    // QUOTE / CUSTOMER RELATIONSHIP
    // =====================================================

    if (
      quote.customer_id &&
      String(
        quote.customer_id
      ) !==
        String(
          customer.id
        )
    ) {
      return NextResponse.json(
        {
          error:
            "The selected quote belongs to a different customer.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // DUPLICATE PROJECT
    // =====================================================

    const {
      data:
        existingProjects,
      error:
        existingError,
    } =
      await supabase
        .from(
          "projects"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    if (
      existingError
    ) {
      throw new Error(
        existingError.message
      );
    }

    const existingProject =
      (
        existingProjects ||
        []
      ).find(
        (
          project
        ) =>
          String(
            project.quote_id ||
              ""
          ) ===
            String(
              quote.id
            ) ||
          (
            String(
              project.customer_id ||
                ""
            ) ===
              String(
                customer.id
              ) &&
            normalise(
              project.status
            ) !==
              "cancelled"
          )
      );

    if (
      existingProject
    ) {
      const formattedProject =
        await attachRecordOwner({
          supabase,
          organizationId,
          record:
            existingProject,
        });

      return NextResponse.json({
        project:
          formattedProject,

        alreadyExisted:
          true,

        message:
          "A project already exists for this customer or quote.",
      });
    }

    // =====================================================
    // OWNER
    // =====================================================

    /*
     * Prefer the customer account owner.
     *
     * If the customer was created before ownership existed,
     * use the quote owner.
     *
     * Final fallback is the employee starting the project.
     */
    const ownerEmployeeId =
      customer.owner_employee_id ||
      quote.owner_employee_id ||
      access.employee.id;

    // =====================================================
    // CREATE PROJECT
    // =====================================================

    const {
      data: project,
      error:
        projectError,
    } =
      await supabase
        .from(
          "projects"
        )
        .insert([
          {
            organization_id:
              organizationId,

            customer_id:
              customer.id,

            quote_id:
              quote.id,

            project_name:
              buildProjectName({
                customer,
                quote,
              }),

            description:
              cleanText(
                quote.service
              ) ||
              `Delivery project for ${
                customer.company ||
                customer.customer_name ||
                quote.client ||
                "customer"
              }`,

            amount:
              quote.amount ||
              null,

            status:
              "Planning",

            start_date:
              null,

            due_date:
              null,

            owner_employee_id:
              ownerEmployeeId,
          },
        ])
        .select()
        .single();

    if (
      projectError
    ) {
      throw new Error(
        projectError.message
      );
    }

    // =====================================================
    // LINK QUOTE TO CUSTOMER IF REQUIRED
    // =====================================================

    if (
      !quote.customer_id
    ) {
      const {
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
          })
          .eq(
            "id",
            quote.id
          )
          .eq(
            "organization_id",
            organizationId
          );

      if (
        quoteUpdateError
      ) {
        console.error(
          "Unable to link quote customer during project creation:",
          quoteUpdateError
        );
      }
    }

    const formattedProject =
      await attachRecordOwner({
        supabase,
        organizationId,
        record:
          project,
      });

    return NextResponse.json(
      {
        project:
          formattedProject,

        customer,

        quote,

        alreadyExisted:
          false,

        message:
          "Project created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Project from customer error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to create project from customer.",
      },
      {
        status: 500,
      }
    );
  }
}
