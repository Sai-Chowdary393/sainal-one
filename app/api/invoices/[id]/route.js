import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const ALLOWED_STATUSES = [
  "Draft Invoice",
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
];

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleanedValue = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsedValue = Number.parseFloat(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function parseVatRate(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleanedValue = String(value)
    .replace("%", "")
    .trim();

  const parsedValue = Number.parseFloat(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatVatRate(value) {
  const numericValue = Number(value || 0);

  return `${Number.isInteger(numericValue)
    ? numericValue
    : numericValue.toFixed(2)}%`;
}

function isValidDate(value) {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Invoice ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("organization_id", ORGANIZATION_ID)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error: error?.message || "Invoice not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Invoice GET error:", error);

    return NextResponse.json(
      {
        error: "Failed to load invoice.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        {
          error: "Invoice ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const updates = {};

    if (typeof body.client === "string") {
      const client = cleanText(body.client);

      if (!client) {
        return NextResponse.json(
          {
            error: "Client name cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.client = client;
    }

    if (typeof body.service === "string") {
      const service = cleanText(body.service);

      if (!service) {
        return NextResponse.json(
          {
            error: "Service cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.service = service;
    }

    if (typeof body.status === "string") {
      if (!ALLOWED_STATUSES.includes(body.status)) {
        return NextResponse.json(
          {
            error: "Invalid invoice status.",
          },
          {
            status: 400,
          }
        );
      }

      updates.status = body.status;
    }

    if (typeof body.due_date === "string" || body.due_date === null) {
      const dueDate = body.due_date || null;

      if (dueDate && !isValidDate(dueDate)) {
        return NextResponse.json(
          {
            error: "Due date must use YYYY-MM-DD format.",
          },
          {
            status: 400,
          }
        );
      }

      updates.due_date = dueDate;
    }

    if (typeof body.payment_terms === "string") {
      updates.payment_terms = cleanText(body.payment_terms);
    }

    const hasFinancialUpdate =
      body.subtotal !== undefined ||
      body.amount !== undefined ||
      body.vat_rate !== undefined;

    if (hasFinancialUpdate) {
      const subtotalValue = parseMoney(
        body.subtotal !== undefined
          ? body.subtotal
          : body.amount
      );

      const vatRateValue = parseVatRate(body.vat_rate);

      if (subtotalValue < 0) {
        return NextResponse.json(
          {
            error: "Subtotal cannot be negative.",
          },
          {
            status: 400,
          }
        );
      }

      if (vatRateValue < 0 || vatRateValue > 100) {
        return NextResponse.json(
          {
            error: "VAT rate must be between 0 and 100.",
          },
          {
            status: 400,
          }
        );
      }

      const vatAmountValue =
        subtotalValue * (vatRateValue / 100);

      const totalAmountValue =
        subtotalValue + vatAmountValue;

      updates.subtotal = formatCurrency(subtotalValue);
      updates.amount = formatCurrency(totalAmountValue);
      updates.vat_rate = formatVatRate(vatRateValue);
      updates.vat_amount = formatCurrency(vatAmountValue);
      updates.total_amount = formatCurrency(totalAmountValue);
    }

    const allowedFields = [
      "client",
      "service",
      "status",
      "due_date",
      "payment_terms",
      "subtotal",
      "amount",
      "vat_rate",
      "vat_amount",
      "total_amount",
    ];

    const hasValidUpdate = allowedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(updates, field)
    );

    if (!hasValidUpdate) {
      return NextResponse.json(
        {
          error: "No valid invoice fields were provided.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", ORGANIZATION_ID)
      .select()
      .single();

    if (error) {
      console.error("Invoice PATCH database error:", error);

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "Invoice not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Invoice PATCH error:", error);

    return NextResponse.json(
      {
        error: "Failed to update invoice.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Invoice ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("organization_id", ORGANIZATION_ID)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message: "Invoice deleted successfully.",
      invoice: data,
    });
  } catch (error) {
    console.error("Invoice DELETE error:", error);

    return NextResponse.json(
      {
        error: "Failed to delete invoice.",
      },
      {
        status: 500,
      }
    );
  }
}
