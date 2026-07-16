import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function POST(request) {
  try {
    const body = await request.json();

    const customerId = body.customer_id;
    const quoteId = body.quote_id;

    if (!customerId) {
      return NextResponse.json(
        {
          error: "Customer ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!quoteId) {
      return NextResponse.json(
        {
          error: "Quote ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const [customerResult, quoteResult] =
      await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .eq(
            "organization_id",
            ORGANIZATION_ID
          )
          .single(),

        supabase
          .from("quotes")
          .select("*")
          .eq("id", quoteId)
          .eq(
            "organization_id",
            ORGANIZATION_ID
          )
          .single(),
      ]);

    if (
      customerResult.error ||
      !customerResult.data
    ) {
      return NextResponse.json(
        {
          error:
            customerResult.error?.message ||
            "Customer not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      quoteResult.error ||
      !quoteResult.data
    ) {
      return NextResponse.json(
        {
          error:
            quoteResult.error?.message ||
            "Quote not found.",
        },
        {
          status: 404,
        }
      );
    }

    const customer = customerResult.data;
    const quote = quoteResult.data;

    const { data: existingProject, error: existingError } =
      await supabase
        .from("projects")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        )
        .eq("quote_id", quote.id)
        .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error: existingError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (existingProject) {
      return NextResponse.json({
        message:
          "A project already exists for this quote.",
        alreadyExists: true,
        project: existingProject,
      });
    }

    const projectName = `${
      customer.company ||
      customer.customer_name
    } - ${quote.service || "Project"}`;

    const { data: createdProject, error: createError } =
      await supabase
        .from("projects")
        .insert([
          {
            organization_id:
              ORGANIZATION_ID,

            customer_id:
              customer.id,

            quote_id:
              quote.id,

            project_name:
              projectName,

            description:
              `Project created from quote ${
                quote.quote_number ||
                quote.id
              }.`,

            status:
              "Planning",

            start_date:
              new Date()
                .toISOString()
                .split("T")[0],

            due_date:
              null,

            amount:
              quote.amount ||
              "To be confirmed",
          },
        ])
        .select()
        .single();

    if (createError) {
      return NextResponse.json(
        {
          error: createError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message:
        "Project created successfully.",
      alreadyExists: false,
      project: createdProject,
    });
  } catch (error) {
    console.error(
      "Create project from customer error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create project.",
      },
      {
        status: 500,
      }
    );
  }
}
