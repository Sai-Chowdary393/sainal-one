import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

// =========================================================
// HELPERS
// =========================================================

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function sameId(
  first,
  second
) {
  if (!first || !second) {
    return false;
  }

  return (
    String(first) ===
    String(second)
  );
}

function sameEmail(
  first,
  second
) {
  if (!first || !second) {
    return false;
  }

  return (
    normalise(first) ===
    normalise(second)
  );
}

function uniqueRecords(
  records = []
) {
  const map =
    new Map();

  records.forEach(
    (record) => {
      if (!record?.id) {
        return;
      }

      map.set(
        String(
          record.id
        ),
        record
      );
    }
  );

  return [
    ...map.values(),
  ];
}

function getMoneyValue(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  return (
    Number(
      String(
        value
      ).replace(
        /[^0-9.-]/g,
        ""
      )
    ) || 0
  );
}

function formatCurrency(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      minimumFractionDigits:
        0,

      maximumFractionDigits:
        0,
    }
  );
}

function isPaidStatus(
  status
) {
  return [
    "paid",
    "settled",
  ].includes(
    normalise(
      status
    )
  );
}

function isCompletedStatus(
  status
) {
  return [
    "completed",
    "complete",
    "done",
    "closed",
  ].includes(
    normalise(
      status
    )
  );
}

function isOverdueStatus(
  status
) {
  return [
    "overdue",
    "late",
  ].includes(
    normalise(
      status
    )
  );
}

function recordTypeMatches(
  value,
  aliases = []
) {
  const recordType =
    normalise(
      value
    );

  return aliases
    .map(
      normalise
    )
    .includes(
      recordType
    );
}

// =========================================================
// TASK EMPLOYEE ENRICHMENT
// =========================================================

async function enrichTasksWithEmployees({
  supabase,
  organizationId,
  tasks,
}) {
  const employeeIds = [
    ...new Set(
      (tasks || [])
        .map(
          (task) =>
            task.assigned_employee_id
        )
        .filter(Boolean)
    ),
  ];

  if (
    employeeIds.length ===
    0
  ) {
    return (
      tasks || []
    ).map(
      (task) => ({
        ...task,

        assigned_employee:
          null,
      })
    );
  }

  const {
    data:
      employeeRows,
    error,
  } =
    await supabase
      .from("employees")
      .select(
        `
          id,
          full_name,
          email,
          job_title
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .in(
        "id",
        employeeIds
      );

  if (error) {
    console.error(
      "Customer task employee lookup error:",
      error
    );

    return (
      tasks || []
    ).map(
      (task) => ({
        ...task,

        assigned_employee:
          null,
      })
    );
  }

  const employeeMap =
    new Map(
      (
        employeeRows ||
        []
      ).map(
        (
          employee
        ) => [
          String(
            employee.id
          ),
          employee,
        ]
      )
    );

  return (
    tasks || []
  ).map(
    (task) => ({
      ...task,

      assigned_employee:
        task.assigned_employee_id
          ? employeeMap.get(
              String(
                task.assigned_employee_id
              )
            ) ||
            null
          : null,
    })
  );
}

// =========================================================
// CUSTOMER SUMMARY
// =========================================================

function buildCustomerSummary({
  customer,
  quotes,
  projects,
  tasks,
  invoices,
  followUps,
}) {
  const pendingTasks =
    tasks.filter(
      (task) =>
        !isCompletedStatus(
          task.status
        )
    );

  const activeProjects =
    projects.filter(
      (project) =>
        !isCompletedStatus(
          project.status
        )
    );

  const overdueInvoices =
    invoices.filter(
      (invoice) =>
        isOverdueStatus(
          invoice.status
        )
    );

  const outstandingInvoices =
    invoices.filter(
      (invoice) =>
        !isPaidStatus(
          invoice.status
        )
    );

  const recommendations =
    [];

  if (
    overdueInvoices.length >
    0
  ) {
    recommendations.push(
      `${overdueInvoices.length} overdue invoice${
        overdueInvoices.length ===
        1
          ? " requires"
          : "s require"
      } attention.`
    );
  }

  if (
    pendingTasks.length >
    0
  ) {
    recommendations.push(
      `${pendingTasks.length} open task${
        pendingTasks.length ===
        1
          ? " is"
          : "s are"
      } currently associated with this customer.`
    );
  }

  if (
    activeProjects.length >
    0
  ) {
    recommendations.push(
      `Review progress across ${activeProjects.length} active project${
        activeProjects.length ===
        1
          ? ""
          : "s"
      }.`
    );
  }

  if (
    followUps.length ===
      0 &&
    pendingTasks.length ===
      0
  ) {
    recommendations.push(
      "Consider scheduling the next customer follow-up."
    );
  }

  if (
    outstandingInvoices.length >
      0 &&
    overdueInvoices.length ===
      0
  ) {
    recommendations.push(
      "Monitor outstanding invoices and upcoming payment dates."
    );
  }

  if (
    recommendations.length ===
    0
  ) {
    recommendations.push(
      "No immediate customer actions require attention."
    );
  }

  const customerName =
    customer.customer_name ||
    customer.company ||
    "This customer";

  return {
    overview:
      `${customerName} currently has ${quotes.length} quote${
        quotes.length ===
        1
          ? ""
          : "s"
      }, ${activeProjects.length} active project${
        activeProjects.length ===
        1
          ? ""
          : "s"
      }, ${pendingTasks.length} open task${
        pendingTasks.length ===
        1
          ? ""
          : "s"
      } and ${outstandingInvoices.length} outstanding invoice${
        outstandingInvoices.length ===
        1
          ? ""
          : "s"
      }.`,

    recommendations,
  };
}

// =========================================================
// GET CUSTOMER WORKSPACE
// =========================================================

export async function GET(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    if (
      !isUuid(id)
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

    // =====================================================
    // AUTHENTICATED ACCESS
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

    const supabase =
      access.supabase;

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // CUSTOMER
    // =====================================================

    const {
      data:
        customer,
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
          id
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

    if (!customer) {
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
    // LOAD ORGANISATION DATA
    // =====================================================
    //
    // We intentionally load each organisation-scoped
    // business area and build the relationship in this
    // endpoint.
    //
    // This supports both the older records and the newer
    // explicit record_id / customer_id relationships.
    //
    // =====================================================

    const [
      leadsResult,
      quotesResult,
      proposalsResult,
      projectsResult,
      tasksResult,
      invoicesResult,
      followUpsResult,
    ] =
      await Promise.all([
        supabase
          .from("leads")
          .select("*")
          .eq(
            "organization_id",
            organizationId
          ),

        supabase
          .from("quotes")
          .select("*")
          .eq(
            "organization_id",
            organizationId
          ),

        supabase
          .from(
            "proposals"
          )
          .select("*")
          .eq(
            "organization_id",
            organizationId
          ),

        supabase
          .from(
            "projects"
          )
          .select("*")
          .eq(
            "organization_id",
            organizationId
          ),

        supabase
          .from("tasks")
          .select("*")
          .eq(
            "organization_id",
            organizationId
          ),

        supabase
          .from(
            "invoices"
          )
          .select("*")
          .eq(
            "organization_id",
            organizationId
          ),

        supabase
          .from(
            "follow_ups"
          )
          .select("*")
          .eq(
            "organization_id",
            organizationId
          ),
      ]);

    const businessDataError =
      leadsResult.error ||
      quotesResult.error ||
      proposalsResult.error ||
      projectsResult.error ||
      tasksResult.error ||
      invoicesResult.error ||
      followUpsResult.error;

    if (
      businessDataError
    ) {
      throw new Error(
        businessDataError.message
      );
    }

    const allLeads =
      leadsResult.data ||
      [];

    const allQuotes =
      quotesResult.data ||
      [];

    const allProposals =
      proposalsResult.data ||
      [];

    const allProjects =
      projectsResult.data ||
      [];

    const allTasks =
      tasksResult.data ||
      [];

    const allInvoices =
      invoicesResult.data ||
      [];

    const allFollowUps =
      followUpsResult.data ||
      [];

    // =====================================================
    // ORIGINAL LEAD
    // =====================================================

    let lead =
      null;

    if (
      customer.lead_id
    ) {
      lead =
        allLeads.find(
          (item) =>
            sameId(
              item.id,
              customer.lead_id
            )
        ) ||
        null;
    }

    if (
      !lead &&
      customer.email
    ) {
      lead =
        allLeads.find(
          (item) =>
            sameEmail(
              item.email,
              customer.email
            )
        ) ||
        null;
    }

    // =====================================================
    // QUOTES
    // =====================================================
    //
    // Preferred:
    // quote.customer_id === customer.id
    //
    // Older converted records can also be resolved from
    // lead_id or email.
    //
    // =====================================================

    const quotes =
      uniqueRecords(
        allQuotes.filter(
          (quote) => {
            if (
              sameId(
                quote.customer_id,
                customer.id
              )
            ) {
              return true;
            }

            if (
              lead?.id &&
              sameId(
                quote.lead_id,
                lead.id
              )
            ) {
              return true;
            }

            if (
              customer.email &&
              sameEmail(
                quote.email,
                customer.email
              )
            ) {
              return true;
            }

            return false;
          }
        )
      );

    const quoteIds =
      new Set(
        quotes
          .map(
            (quote) =>
              quote.id
          )
          .filter(Boolean)
          .map(String)
      );

    // =====================================================
    // PROPOSALS
    // =====================================================

    const proposals =
      uniqueRecords(
        allProposals.filter(
          (proposal) => {
            if (
              sameId(
                proposal.customer_id,
                customer.id
              )
            ) {
              return true;
            }

            if (
              proposal.quote_id &&
              quoteIds.has(
                String(
                  proposal.quote_id
                )
              )
            ) {
              return true;
            }

            if (
              lead?.id &&
              sameId(
                proposal.lead_id,
                lead.id
              )
            ) {
              return true;
            }

            if (
              customer.email &&
              sameEmail(
                proposal.email,
                customer.email
              )
            ) {
              return true;
            }

            return false;
          }
        )
      );

    // =====================================================
    // PROJECTS
    // =====================================================

    const projects =
      uniqueRecords(
        allProjects.filter(
          (project) => {
            if (
              sameId(
                project.customer_id,
                customer.id
              )
            ) {
              return true;
            }

            if (
              project.quote_id &&
              quoteIds.has(
                String(
                  project.quote_id
                )
              )
            ) {
              return true;
            }

            return false;
          }
        )
      );

    const projectIds =
      new Set(
        projects
          .map(
            (project) =>
              project.id
          )
          .filter(Boolean)
          .map(String)
      );

    // =====================================================
    // TASKS
    // =====================================================
    //
    // IMPORTANT:
    //
    // A customer now receives tasks through ALL of these:
    //
    // 1. Customer → direct Task
    // 2. Customer → Quote → Workflow Task
    // 3. Customer → Project → Task
    // 4. Customer → Project record-linked Task
    //
    // This is the relationship that was missing previously.
    //
    // =====================================================

    const customerTasks =
      uniqueRecords(
        allTasks.filter(
          (task) => {
            // ---------------------------------------------
            // DIRECT CUSTOMER TASK
            // ---------------------------------------------

            if (
              recordTypeMatches(
                task.record_type,
                [
                  "customer",
                  "customers",
                ]
              ) &&
              sameId(
                task.record_id,
                customer.id
              )
            ) {
              return true;
            }

            // ---------------------------------------------
            // QUOTE / WORKFLOW TASK
            // ---------------------------------------------

            if (
              recordTypeMatches(
                task.record_type,
                [
                  "quote",
                  "quotes",
                ]
              ) &&
              task.record_id &&
              quoteIds.has(
                String(
                  task.record_id
                )
              )
            ) {
              return true;
            }

            // ---------------------------------------------
            // PROJECT TASK
            // ---------------------------------------------

            if (
              task.project_id &&
              projectIds.has(
                String(
                  task.project_id
                )
              )
            ) {
              return true;
            }

            // ---------------------------------------------
            // PROJECT RECORD TASK
            // ---------------------------------------------

            if (
              recordTypeMatches(
                task.record_type,
                [
                  "project",
                  "projects",
                ]
              ) &&
              task.record_id &&
              projectIds.has(
                String(
                  task.record_id
                )
              )
            ) {
              return true;
            }

            return false;
          }
        )
      );

    const tasks =
      await enrichTasksWithEmployees({
        supabase,

        organizationId,

        tasks:
          customerTasks,
      });

    // =====================================================
    // INVOICES
    // =====================================================

    const invoices =
      uniqueRecords(
        allInvoices.filter(
          (invoice) => {
            if (
              sameId(
                invoice.customer_id,
                customer.id
              )
            ) {
              return true;
            }

            if (
              invoice.project_id &&
              projectIds.has(
                String(
                  invoice.project_id
                )
              )
            ) {
              return true;
            }

            if (
              invoice.quote_id &&
              quoteIds.has(
                String(
                  invoice.quote_id
                )
              )
            ) {
              return true;
            }

            if (
              customer.email &&
              sameEmail(
                invoice.email,
                customer.email
              )
            ) {
              return true;
            }

            return false;
          }
        )
      );

    // =====================================================
    // FOLLOW UPS
    // =====================================================

    const followUps =
      uniqueRecords(
        allFollowUps.filter(
          (followUp) => {
            const relatedType =
              normalise(
                followUp.related_type
              );

            const relatedId =
              followUp.related_id;

            if (
              [
                "customer",
                "customers",
              ].includes(
                relatedType
              ) &&
              sameId(
                relatedId,
                customer.id
              )
            ) {
              return true;
            }

            if (
              [
                "quote",
                "quotes",
              ].includes(
                relatedType
              ) &&
              relatedId &&
              quoteIds.has(
                String(
                  relatedId
                )
              )
            ) {
              return true;
            }

            if (
              [
                "project",
                "projects",
              ].includes(
                relatedType
              ) &&
              relatedId &&
              projectIds.has(
                String(
                  relatedId
                )
              )
            ) {
              return true;
            }

            return false;
          }
        )
      );

    // =====================================================
    // FINANCIAL SUMMARY
    // =====================================================

    const totalInvoiced =
      invoices.reduce(
        (
          total,
          invoice
        ) =>
          total +
          getMoneyValue(
            invoice.total_amount ??
              invoice.amount
          ),
        0
      );

    const totalPaid =
      invoices
        .filter(
          (invoice) =>
            isPaidStatus(
              invoice.status
            )
        )
        .reduce(
          (
            total,
            invoice
          ) =>
            total +
            getMoneyValue(
              invoice.total_amount ??
                invoice.amount
            ),
          0
        );

    const outstanding =
      invoices
        .filter(
          (invoice) =>
            !isPaidStatus(
              invoice.status
            )
        )
        .reduce(
          (
            total,
            invoice
          ) =>
            total +
            getMoneyValue(
              invoice.total_amount ??
                invoice.amount
            ),
          0
        );

    const financialSummary = {
      totalInvoiced,

      totalPaid,

      outstanding,

      totalInvoicedFormatted:
        formatCurrency(
          totalInvoiced
        ),

      totalPaidFormatted:
        formatCurrency(
          totalPaid
        ),

      outstandingFormatted:
        formatCurrency(
          outstanding
        ),
    };

    // =====================================================
    // COUNTS
    // =====================================================

    const recordCounts = {
      quotes:
        quotes.length,

      proposals:
        proposals.length,

      projects:
        projects.length,

      tasks:
        tasks.length,

      invoices:
        invoices.length,

      followUps:
        followUps.length,
    };

    // =====================================================
    // CUSTOMER INTELLIGENCE SUMMARY
    // =====================================================

    const summary =
      buildCustomerSummary({
        customer,

        quotes,

        projects,

        tasks,

        invoices,

        followUps,
      });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      customer,

      lead,

      quotes,

      proposals,

      projects,

      tasks,

      invoices,

      followUps,

      financialSummary,

      recordCounts,

      summary,
    });
  } catch (error) {
    console.error(
      "Customer GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load customer.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// UPDATE CUSTOMER
// =========================================================

export async function PATCH(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    if (
      !isUuid(id)
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

    const body =
      await request.json();

    const customerName =
      body.customer_name !==
      undefined
        ? String(
            body.customer_name ||
              ""
          ).trim()
        : undefined;

    if (
      customerName !==
        undefined &&
      !customerName
    ) {
      return NextResponse.json(
        {
          error:
            "Customer name is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // WHITELIST EDITABLE CUSTOMER FIELDS
    // =====================================================

    const updateValues = {};

    if (
      body.customer_name !==
      undefined
    ) {
      updateValues.customer_name =
        customerName;
    }

    if (
      body.company !==
      undefined
    ) {
      updateValues.company =
        String(
          body.company ||
            ""
        ).trim();
    }

    if (
      body.email !==
      undefined
    ) {
      updateValues.email =
        String(
          body.email ||
            ""
        ).trim();
    }

    if (
      body.phone !==
      undefined
    ) {
      updateValues.phone =
        String(
          body.phone ||
            ""
        ).trim();
    }

    if (
      body.status !==
      undefined
    ) {
      updateValues.status =
        String(
          body.status ||
            "Active"
        ).trim();
    }

    if (
      Object.keys(
        updateValues
      ).length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "No editable customer fields were provided.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // UPDATE WITH ORGANISATION SCOPE
    // =====================================================

    const {
      data:
        updatedCustomer,
      error,
    } =
      await access.supabase
        .from(
          "customers"
        )
        .update(
          updateValues
        )
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          access.employee
            .organization_id
        )
        .select()
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (
      !updatedCustomer
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

    /*
     * Important:
     *
     * Your current customer page expects the PATCH response
     * itself to be the customer object, so we deliberately
     * return updatedCustomer directly rather than:
     *
     * { customer: updatedCustomer }
     */

    return NextResponse.json(
      updatedCustomer
    );
  } catch (error) {
    console.error(
      "Customer PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to update customer.",
      },
      {
        status: 500,
      }
    );
  }
}
