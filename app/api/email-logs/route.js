import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalise(value) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function formatEmailType(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return "General";
  }

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1).toLowerCase()
  );
}

function canonicaliseLog(
  log
) {
  return {
    ...log,

    recipient:
      log.recipient ||
      log.recipient_email ||
      "",

    email_type:
      log.email_type ||
      formatEmailType(
        log.record_type
      ),

    related_record_id:
      log.related_record_id ||
      log.record_id ||
      null,

    related_record_number:
      log.related_record_number ||
      null,

    sent_at:
      log.sent_at ||
      log.created_at ||
      null,
  };
}

async function loadRelatedRecordNumbers({
  supabase,
  organizationId,
  logs,
}) {
  const proposalIds =
    logs
      .filter(
        (log) =>
          normalise(
            log.record_type ||
              log.email_type
          ) ===
            "proposal" &&
          log.record_id
      )
      .map(
        (log) =>
          log.record_id
      );

  const invoiceIds =
    logs
      .filter(
        (log) =>
          normalise(
            log.record_type ||
              log.email_type
          ) ===
            "invoice" &&
          log.record_id
      )
      .map(
        (log) =>
          log.record_id
      );

  const proposalMap =
    new Map();

  const invoiceMap =
    new Map();

  if (
    proposalIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "proposals"
        )
        .select(
          "id, proposal_number"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "id",
          [
            ...new Set(
              proposalIds
            ),
          ]
        );

    if (error) {
      console.error(
        "Email log proposal enrichment error:",
        error
      );
    } else {
      for (
        const record of
        data ||
        []
      ) {
        proposalMap.set(
          record.id,
          record.proposal_number ||
            "Proposal"
        );
      }
    }
  }

  if (
    invoiceIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "invoices"
        )
        .select(
          "id, invoice_number"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "id",
          [
            ...new Set(
              invoiceIds
            ),
          ]
        );

    if (error) {
      console.error(
        "Email log invoice enrichment error:",
        error
      );
    } else {
      for (
        const record of
        data ||
        []
      ) {
        invoiceMap.set(
          record.id,
          record.invoice_number ||
            "Invoice"
        );
      }
    }
  }

  return logs.map(
    (log) => {
      const recordType =
        normalise(
          log.record_type ||
            log.email_type
        );

      let relatedRecordNumber =
        log.related_record_number ||
        null;

      if (
        !relatedRecordNumber &&
        recordType ===
          "proposal"
      ) {
        relatedRecordNumber =
          proposalMap.get(
            log.record_id
          ) ||
          null;
      }

      if (
        !relatedRecordNumber &&
        recordType ===
          "invoice"
      ) {
        relatedRecordNumber =
          invoiceMap.get(
            log.record_id
          ) ||
          null;
      }

      return canonicaliseLog({
        ...log,

        related_record_number:
          relatedRecordNumber,
      });
    }
  );
}

// =========================================================
// GET
// =========================================================

export async function GET(
  request
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

    const organizationId =
      access.employee
        .organization_id;

    const supabase =
      createAdminSupabaseClient();

    const {
      searchParams,
    } =
      new URL(
        request.url
      );

    const search =
      cleanText(
        searchParams.get(
          "search"
        )
      );

    const emailType =
      cleanText(
        searchParams.get(
          "email_type"
        )
      );

    const status =
      cleanText(
        searchParams.get(
          "status"
        )
      );

    const {
      data,
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
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    let logs =
      await loadRelatedRecordNumbers({
        supabase,
        organizationId,

        logs:
          Array.isArray(
            data
          )
            ? data
            : [],
      });

    if (
      emailType
    ) {
      logs =
        logs.filter(
          (log) =>
            normalise(
              log.email_type
            ) ===
            normalise(
              emailType
            )
        );
    }

    if (
      status
    ) {
      logs =
        logs.filter(
          (log) =>
            normalise(
              log.status
            ) ===
            normalise(
              status
            )
        );
    }

    if (
      search
    ) {
      const searchValue =
        normalise(
          search
        );

      logs =
        logs.filter(
          (log) =>
            [
              log.recipient,
              log.subject,
              log.related_record_number,
              log.email_type,
              log.status,
            ].some(
              (value) =>
                normalise(
                  value
                ).includes(
                  searchValue
                )
            )
        );
    }

    return NextResponse.json(
      logs
    );
  } catch (error) {
    console.error(
      "Email logs GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load email history.",
      },
      {
        status:
          500,
      }
    );
  }
}
