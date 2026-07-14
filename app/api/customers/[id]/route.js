import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

function normaliseText(value) {
  return String(value || "").trim().toLowerCase();
}

function parseMoney(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  const cleanedValue = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsedValue = Number.parseFloat(cleanedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value || 0);
}

function recordMatchesCustomer(record, customer) {
  const customerId = String(customer.id || "");
  const leadId = String(customer.lead_id || "");

  const customerEmail = normaliseText(customer.email);
  const customerCompany = normaliseText(customer.company);
  const customerName = normaliseText(customer.customer_name);

  const recordCustomerId = String(
    record.customer_id || ""
  );

  const recordLeadId = String(record.lead_id || "");

  const recordEmail = normaliseText(record.email);

  const recordClient = normaliseText(
    record.client ||
      record.company ||
      record.customer_name
  );

  const recordContact = normaliseText(
    record.contact ||
      record.name
  );

  return (
    (customerId &&
      recordCustomerId === customerId) ||
    (leadId &&
      recordLeadId === leadId) ||
    (customerEmail &&
      recordEmail === customerEmail) ||
    (customerCompany &&
      recordClient === customerCompany) ||
    (customerName &&
      recordContact === customerName)
  );
}

function createCustomerSummary({
  customer,
  quotes,
  proposals,
  projects,
  tasks,
  invoices,
  followUps,
  totalInvoiced,
  totalPaid,
  outstanding,
}) {
  const companyName =
    customer.company ||
    customer.customer_name ||
    "This customer";

  const activeProjects = projects.filter((project) => {
    const status = normaliseText(project.status);

    return ![
      "completed",
      "cancelled",
      "canceled",
    ].includes(status);
  });

  const pendingTasks = tasks.filter((task) => {
    const status = normaliseText(task.status);

    return ![
      "completed",
      "complete",
      "done",
    ].includes(status);
  });

  const pendingProposals = proposals.filter((proposal) =>
    ["draft", "sent"].includes(
      normaliseText(proposal.status)
    )
  );

  const pendingQuotes = quotes.filter((quote) =>
    ["draft", "sent", "pending"].some((status) =>
      normaliseText(quote.status).includes(status)
    )
  );

  const recommendations = [];

  if (outstanding > 0) {
    recommendations.push(
      `Follow up on ${formatCurrency(
        outstanding
      )} in outstanding invoices.`
    );
  }

  if (pendingProposals.length > 0) {
    recommendations.push(
      `Review ${pendingProposals.length} proposal${
        pendingProposals.length === 1 ? "" : "s"
      } awaiting progress.`
    );
  }

  if (pendingQuotes.length > 0) {
    recommendations.push(
      `Follow up on ${pendingQuotes.length} open quote${
        pendingQuotes.length === 1 ? "" : "s"
      }.`
    );
  }

  if (
    activeProjects.length > 0 &&
    pendingTasks.length === 0
  ) {
    recommendations.push(
      "The customer has an active project but no outstanding tasks. Confirm the next delivery action."
    );
  }

  if (followUps.length === 0) {
    recommendations.push(
      "No follow-up is currently recorded. Consider scheduling the next customer contact."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "The account appears up to date. Maintain regular communication and monitor current project delivery."
    );
  }

  return {
    overview: `${companyName} has ${quotes.length} quote${
      quotes.length === 1 ? "" : "s"
    }, ${proposals.length} proposal${
      proposals.length === 1 ? "" : "s"
    }, ${projects.length} project${
      projects.length === 1 ? "" : "s"
    } and ${invoices.length} invoice${
      invoices.length === 1 ? "" : "s"
    }. Total invoiced is ${formatCurrency(
      totalInvoiced
    )}, of which ${formatCurrency(
      totalPaid
    )} has been paid.`,

    recommendations,
  };
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Customer ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const customerResult = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("organization_id", ORGANIZATION_ID)
      .single();

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

    const customer = customerResult.data;

    const [
      quotesResult,
      proposalsResult,
      projectsResult,
      tasksResult,
      invoicesResult,
      followUpsResult,
      leadsResult,
    ] = await Promise.all([
      supabase
        .from("quotes")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        ),

      supabase
        .from("proposals")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        ),

      supabase
        .from("projects")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        ),

      supabase
        .from("tasks")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        ),

      supabase
        .from("invoices")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        ),

      supabase
        .from("follow_ups")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        ),

      supabase
        .from("leads")
        .select("*")
        .eq(
          "organization_id",
          ORGANIZATION_ID
        ),
    ]);

    const databaseError =
      quotesResult.error ||
      proposalsResult.error ||
      projectsResult.error ||
      tasksResult.error ||
      invoicesResult.error ||
      followUpsResult.error ||
      leadsResult.error;

    if (databaseError) {
      return NextResponse.json(
        {
          error: databaseError.message,
        },
        {
          status: 500,
        }
      );
    }

    const allQuotes = quotesResult.data || [];
    const allProposals =
      proposalsResult.data || [];
    const allProjects =
      projectsResult.data || [];
    const allTasks = tasksResult.data || [];
    const allInvoices =
      invoicesResult.data || [];
    const allFollowUps =
      followUpsResult.data || [];
    const allLeads = leadsResult.data || [];

    const quotes = allQuotes.filter((record) =>
      recordMatchesCustomer(record, customer)
    );

    const proposals = allProposals.filter(
      (record) =>
        recordMatchesCustomer(record, customer)
    );

    const projects = allProjects.filter(
      (record) =>
        recordMatchesCustomer(record, customer)
    );

    const projectIds = new Set(
      projects.map((project) =>
        String(project.id)
      )
    );

    const tasks = allTasks.filter((task) =>
      projectIds.has(String(task.project_id))
    );

    const invoices = allInvoices.filter(
      (record) =>
        recordMatchesCustomer(record, customer) ||
        projectIds.has(
          String(record.project_id || "")
        )
    );

    const followUps = allFollowUps.filter(
      (followUp) => {
        const relatedId = String(
          followUp.related_id || ""
        );

        const relatedType = normaliseText(
          followUp.related_type
        );

        return (
          relatedId === String(customer.id) ||
          relatedId === String(customer.lead_id) ||
          (relatedType === "customer" &&
            relatedId === String(customer.id)) ||
          (relatedType === "lead" &&
            relatedId ===
              String(customer.lead_id))
        );
      }
    );

    const lead =
      allLeads.find(
        (item) =>
          String(item.id) ===
          String(customer.lead_id)
      ) || null;

    const totalInvoiced = invoices.reduce(
      (total, invoice) =>
        total +
        parseMoney(
          invoice.total_amount ||
            invoice.amount
        ),
      0
    );

    const totalPaid = invoices.reduce(
      (total, invoice) => {
        const status = normaliseText(
          invoice.status
        );

        if (status !== "paid") {
          return total;
        }

        return (
          total +
          parseMoney(
            invoice.total_amount ||
              invoice.amount
          )
        );
      },
      0
    );

    const outstanding = Math.max(
      totalInvoiced - totalPaid,
      0
    );

    const summary = createCustomerSummary({
      customer,
      quotes,
      proposals,
      projects,
      tasks,
      invoices,
      followUps,
      totalInvoiced,
      totalPaid,
      outstanding,
    });

    return NextResponse.json({
      customer,
      lead,
      quotes,
      proposals,
      projects,
      tasks,
      invoices,
      followUps,

      financialSummary: {
        totalInvoiced,
        totalPaid,
        outstanding,
        totalInvoicedFormatted:
          formatCurrency(totalInvoiced),
        totalPaidFormatted:
          formatCurrency(totalPaid),
        outstandingFormatted:
          formatCurrency(outstanding),
      },

      recordCounts: {
        quotes: quotes.length,
        proposals: proposals.length,
        projects: projects.length,
        tasks: tasks.length,
        invoices: invoices.length,
        followUps: followUps.length,
      },

      summary,
    });
  } catch (error) {
    console.error(
      "Customer detail GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load customer details.",
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
          error: "Customer ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedStatuses = [
      "Active",
      "Inactive",
      "Prospect",
      "On Hold",
    ];

    const updates = {};

    if (
      typeof body.customer_name === "string"
    ) {
      updates.customer_name =
        body.customer_name.trim();
    }

    if (typeof body.company === "string") {
      updates.company = body.company.trim();
    }

    if (typeof body.email === "string") {
      const email = body.email.trim();

      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Please enter a valid email address.",
          },
          {
            status: 400,
          }
        );
      }

      updates.email = email;
    }

    if (typeof body.phone === "string") {
      updates.phone = body.phone.trim();
    }

    if (typeof body.status === "string") {
      if (
        !allowedStatuses.includes(body.status)
      ) {
        return NextResponse.json(
          {
            error: "Invalid customer status.",
          },
          {
            status: 400,
          }
        );
      }

      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid customer fields were provided.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", id)
      .eq(
        "organization_id",
        ORGANIZATION_ID
      )
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

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Customer detail PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update customer.",
      },
      {
        status: 500,
      }
    );
  }
}
