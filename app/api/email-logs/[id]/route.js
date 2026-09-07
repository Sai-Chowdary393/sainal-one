import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../../lib/supabaseAdmin";

// =========================================================
// HELPERS
// =========================================================

function normalise(value) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(
      value ||
        ""
    )
  );
}

async function enrichRelatedRecord({
  supabase,
  organizationId,
  log,
}) {
  if (
    !log.related_record_id
  ) {
    return {
      ...log,

      related_record:
        null,
    };
  }

  const type =
    normalise(
      log.email_type
    );

  const config =
    type ===
    "lead"
      ? {
          table:
            "leads",

          select:
            "id, name, company, email",
        }
      : type ===
          "customer"
        ? {
            table:
              "customers",

            select:
              "id, customer_name, company, email",
          }
        : type ===
            "project"
          ? {
              table:
                "projects",

              select:
                "id, project_name, name, title, status",
            }
          : type ===
              "proposal"
            ? {
                table:
                  "proposals",

                select:
                  "id, proposal_number",
              }
            : type ===
                "invoice"
              ? {
                  table:
                    "invoices",

                  select:
                    "id, invoice_number",
                }
              : null;

  if (
    !config
  ) {
    return {
      ...log,

      related_record:
        null,
    };
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        config.table
      )
      .select(
        config.select
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        log.related_record_id
      )
      .maybeSingle();

  if (
    error
  ) {
    console.error(
      "Email detail related record enrichment error:",
      error
    );
  }

  return {
    ...log,

    related_record:
      data ||
      null,
  };
}

// =========================================================
// GET
// =========================================================

export async function GET(
  _request,
  context
) {
  try {
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

    const params =
      await context.params;

    const id =
      params?.id;

    if (
      !id ||
      !isUuid(
        id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid email record ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    const {
      data:
        log,
      error,
    } =
      await supabase
        .from(
          "email_logs"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "id",
          id
        )
        .maybeSingle();

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    if (
      !log
    ) {
      return NextResponse.json(
        {
          error:
            "Email record not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const enriched =
      await enrichRelatedRecord({
        supabase,
        organizationId,
        log,
      });

    return NextResponse.json({
      email:
        enriched,
    });
  } catch (error) {
    console.error(
      "Email detail GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load email details.",
      },
      {
        status:
          500,
      }
    );
  }
}
