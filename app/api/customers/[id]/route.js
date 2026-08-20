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
  buildClientAccess,
  canViewOwnedRecord,
  getRecordPermissions,
  loadAssignableEmployees,
  validateRecordOwner,
} from "../../../../lib/recordAccess";

// =========================================================
// HELPERS
// =========================================================

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanNullableText(value) {
  const cleaned =
    cleanText(value);

  return cleaned || null;
}

function normalise(value) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
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
      prefix:
        "customers",

      module:
        "Customers",
    }
  );
}

// =========================================================
// MONEY
// =========================================================

function parseMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value ===
    "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : 0;
  }

  const cleaned =
    String(value)
      .replace(
        /[^0-9.-]/g,
        ""
      );

  const number =
    Number(
      cleaned
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

// =========================================================
// RELATIONSHIP HELPERS
// =========================================================

function sameId(
  first,
  second
) {
  if (
    !first ||
    !second
  ) {
    return false;
  }

  return (
    String(first) ===
    String(second)
  );
}

function matchesEmail(
  first,
  second
) {
  const a =
    normalise(first);

  const b =
    normalise(second);

  return Boolean(
    a &&
    b &&
    a === b
  );
}

function matchesCompany(
  first,
  second
) {
  const a =
    normalise(first);

  const b =
    normalise(second);

  return Boolean(
    a &&
    b &&
    a === b
  );
}

function recordMatchesCustomer({
  record,
  customer,
}) {
  if (
    !record ||
    !customer
  ) {
    return false;
  }

  if (
    sameId(
      record.customer_id,
      customer.id
    )
  ) {
    return true;
  }

  if (
    customer.lead_id &&
    sameId(
      record.lead_id,
      customer.lead_id
    )
  ) {
    return true;
  }

  if (
    matchesEmail(
      record.email,
      customer.email
    )
  ) {
    return true;
  }

  if (
    matchesCompany(
      record.company,
      customer.company
    )
  ) {
    return true;
  }

  if (
    matchesCompany(
      record.client,
      customer.company
    )
  ) {
    return true;
  }

  return false;
}

function taskMatchesCustomer({
  task,
  customer,
  relatedProjectIds,
  relatedQuoteIds,
}) {
  if (
    !task
  ) {
    return false;
  }

  if (
    sameId(
      task.customer_id,
      customer.id
    )
  ) {
    return true;
  }

  const relatedType =
    normalise(
      task.related_type ||
        task.record_type
    );

  const relatedId =
    task.related_id ||
    task.record_id;

  if (
    relatedType ===
      "customer" &&
    sameId(
      relatedId,
      customer.id
    )
  ) {
    return true;
  }

  if (
    relatedType ===
      "project" &&
    relatedProjectIds.has(
      String(
        relatedId ||
          ""
      )
    )
  ) {
    return true;
  }

  if (
    relatedType ===
      "quote" &&
    relatedQuoteIds.has(
      String(
        relatedId ||
          ""
      )
    )
  ) {
    return true;
  }

  return false;
}

// =========================================================
// EMPLOYEE ENRICHMENT
// =========================================================

async function attachTaskEmployees({
  supabase,
  organizationId,
  tasks,
}) {
  const employeeIds = [
    ...new Set(
      (
        tasks ||
        []
      )
        .map(
          (
            task
          ) =>
            task.assigned_employee_id ||
            task.owner_employee_id
        )
        .filter(Boolean)
    ),
  ];

  if (
    employeeIds.length ===
    0
  ) {
    return (
      tasks ||
      []
    ).map(
      (
        task
      ) => ({
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
    throw new Error(
      error.message
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
          employee.id,
          employee,
        ]
      )
    );

  return (
    tasks ||
    []
  ).map(
    (
      task
    ) => ({
      ...task,

      assigned_employee:
        employeeMap.get(
          task.assigned_employee_id ||
            task.owner_employee_id
        ) ||
        null,
    })
  );
}

// =========================================================
// CUSTOMER SUMMARY
// =========================================================

function buildSummary({
  customer,
  quotes,
  projects,
  tasks,
  invoices,
  followUps,
}) {
  const activeProjects =
    (
      projects ||
      []
    ).filter(
      (
        project
      ) => {
        const status =
          normalise(
            project.status
          );

        return ![
          "completed",
          "complete",
          "done",
          "cancelled",
          "canceled",
          "closed",
        ].includes(
          status
        );
      }
    );

  const pendingTasks =
    (
      tasks ||
      []
    ).filter(
      (
        task
      ) => {
        const status =
          normalise(
            task.status
          );

        return ![
          "completed",
          "complete",
          "done",
          "cancelled",
          "canceled",
          "closed",
        ].includes(
          status
        );
      }
    );

  const outstandingInvoices =
    (
      invoices ||
      []
    ).filter(
      (
        invoice
      ) => {
        const status =
          normalise(
            invoice.status
          );

        return ![
          "paid",
          "cancelled",
          "canceled",
          "void",
        ].includes(
          status
        );
      }
    );

  const recommendations = [];

  if (
    quotes.length ===
    0
  ) {
    recommendations.push(
      "Create a quote for this customer when a new commercial opportunity is identified."
    );
  }

  if (
    activeProjects.length >
    0
  ) {
    recommendations.push(
      "Review active project delivery and outstanding work."
    );
  }

  if (
    pendingTasks.length >
    0
  ) {
    recommendations.push(
      "Review open tasks and follow-up activity."
    );
  }

  if (
    outstandingInvoices.length >
    0
  ) {
    recommendations.push(
      "Review outstanding invoice balances and payment status."
    );
  }

  if (
    recommendations.length ===
    0
  ) {
    recommendations.push(
      "Customer activity is currently up to date."
    );
  }

  return {
    headline:
      `${customer.customer_name || "Customer"} has ${quotes.length} quote${
        quotes.length === 1
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
// GET CUSTOMER
// =========================================================

export async function GET(
  request,
  context
) {
  try {
    const {
      id,
    } =
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
      !permissions.canViewAll &&
      !permissions.canViewTeam &&
      !permissions.canViewOwn
    ) {
      return forbidden(
        "You do not have permission to view customers."
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
    // RECORD VISIBILITY
    // =====================================================

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record:
          customer,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to view this customer."
      );
    }

    const formattedCustomer =
      await attachRecordOwner({
        supabase,
        organizationId,
        record:
          customer,
      });

    // =====================================================
    // ORGANISATION DATA
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

    const results = [
      leadsResult,
      quotesResult,
      proposalsResult,
      projectsResult,
      tasksResult,
      invoicesResult,
      followUpsResult,
    ];

    const firstError =
      results.find(
        (
          result
        ) =>
          result.error
      );

    if (
      firstError?.error
    ) {
      throw new Error(
        firstError.error.message
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
    // LEAD
    // =====================================================

    const lead =
      customer.lead_id
        ? allLeads.find(
            (
              item
            ) =>
              sameId(
                item.id,
                customer.lead_id
              )
          ) ||
          null
        : allLeads.find(
            (
              item
            ) =>
              matchesEmail(
                item.email,
                customer.email
              ) ||
              matchesCompany(
                item.company,
                customer.company
              )
          ) ||
          null;

    // =====================================================
    // QUOTES
    // =====================================================

    const quotes =
      allQuotes.filter(
        (
          quote
        ) =>
          recordMatchesCustomer({
            record:
              quote,

            customer,
          })
      );

    const quoteIds =
      new Set(
        quotes.map(
          (
            quote
          ) =>
            String(
              quote.id
            )
        )
      );

    // =====================================================
    // PROPOSALS
    // =====================================================

    const proposals =
      allProposals.filter(
        (
          proposal
        ) => {
          if (
            recordMatchesCustomer({
              record:
                proposal,

              customer,
            })
          ) {
            return true;
          }

          return (
            proposal.quote_id &&
            quoteIds.has(
              String(
                proposal.quote_id
              )
            )
          );
        }
      );

    // =====================================================
    // PROJECTS
    // =====================================================

    const projects =
      allProjects.filter(
        (
          project
        ) =>
          recordMatchesCustomer({
            record:
              project,

            customer,
          })
      );

    const projectIds =
      new Set(
        projects.map(
          (
            project
          ) =>
            String(
              project.id
            )
        )
      );

    // =====================================================
    // TASKS
    // =====================================================

    const rawTasks =
      allTasks.filter(
        (
          task
        ) =>
          taskMatchesCustomer({
            task,
            customer,
            relatedProjectIds:
              projectIds,
            relatedQuoteIds:
              quoteIds,
          })
      );

    const tasks =
      await attachTaskEmployees({
        supabase,
        organizationId,
        tasks:
          rawTasks,
      });

    // =====================================================
    // INVOICES
    // =====================================================

    const invoices =
      allInvoices.filter(
        (
          invoice
        ) => {
          if (
            recordMatchesCustomer({
              record:
                invoice,

              customer,
            })
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

          return (
            invoice.quote_id &&
            quoteIds.has(
              String(
                invoice.quote_id
              )
            )
          );
        }
      );

    // =====================================================
    // FOLLOW UPS
    // =====================================================

    const followUps =
      allFollowUps.filter(
        (
          followUp
        ) => {
          if (
            sameId(
              followUp.customer_id,
              customer.id
            )
          ) {
            return true;
          }

          const relatedType =
            normalise(
              followUp.related_type
            );

          const relatedId =
            followUp.related_id;

          if (
            relatedType ===
              "customer" &&
            sameId(
              relatedId,
              customer.id
            )
          ) {
            return true;
          }

          if (
            relatedType ===
              "project" &&
            projectIds.has(
              String(
                relatedId ||
                  ""
              )
            )
          ) {
            return true;
          }

          if (
            relatedType ===
              "quote" &&
            quoteIds.has(
              String(
                relatedId ||
                  ""
              )
            )
          ) {
            return true;
          }

          return false;
        }
      );

    // =====================================================
    // FINANCIAL SUMMARY
    // =====================================================

    const totalQuoted =
      quotes.reduce(
        (
          total,
          quote
        ) =>
          total +
          parseMoney(
            quote.amount ||
              quote.value ||
              quote.total
          ),
        0
      );

    const totalInvoiced =
      invoices.reduce(
        (
          total,
          invoice
        ) =>
          total +
          parseMoney(
            invoice.amount ||
              invoice.total ||
              invoice.total_amount
          ),
        0
      );

    const paidAmount =
      invoices
        .filter(
          (
            invoice
          ) =>
            normalise(
              invoice.status
            ) ===
            "paid"
        )
        .reduce(
          (
            total,
            invoice
          ) =>
            total +
            parseMoney(
              invoice.amount ||
                invoice.total ||
                invoice.total_amount
            ),
          0
        );

    const outstandingAmount =
      Math.max(
        0,
        totalInvoiced -
          paidAmount
      );

    const financialSummary = {
      totalQuoted,
      totalInvoiced,
      paidAmount,
      outstandingAmount,
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
    // SUMMARY
    // =====================================================

    const summary =
      buildSummary({
        customer:
          formattedCustomer,

        quotes,
        projects,
        tasks,
        invoices,
        followUps,
      });

    // =====================================================
    // ASSIGNABLE EMPLOYEES
    // =====================================================

    let employees = [];

    if (
      permissions.canAssign
    ) {
      employees =
        await loadAssignableEmployees({
          supabase,
          organizationId,
        });
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      customer:
        formattedCustomer,

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

      employees,

      currentEmployee:
        access.employee,

      access:
        buildClientAccess({
          access,
          permissions,
        }),
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
// PATCH CUSTOMER
// =========================================================

export async function PATCH(
  request,
  context
) {
  try {
    const {
      id,
    } =
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

    const permissions =
      getPermissions(
        access
      );

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    // =====================================================
    // EXISTING CUSTOMER
    // =====================================================

    const {
      data:
        existingCustomer,
      error:
        existingError,
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
      existingError
    ) {
      throw new Error(
        existingError.message
      );
    }

    if (
      !existingCustomer
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

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record:
          existingCustomer,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to update this customer."
      );
    }

    const body =
      await request.json();

    const wantsOwnerChange =
      Object.prototype.hasOwnProperty.call(
        body,
        "owner_employee_id"
      );

    const editableFields = [
      "customer_name",
      "company",
      "email",
      "phone",
      "status",
    ];

    const wantsCustomerEdit =
      editableFields.some(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
      );

    if (
      wantsCustomerEdit &&
      !permissions.canEdit
    ) {
      return forbidden(
        "You do not have permission to edit customers."
      );
    }

    if (
      wantsOwnerChange &&
      !permissions.canAssign
    ) {
      return forbidden(
        "You do not have permission to assign customers."
      );
    }

    if (
      !wantsCustomerEdit &&
      !wantsOwnerChange
    ) {
      return NextResponse.json(
        {
          error:
            "No supported customer changes were provided.",
        },
        {
          status: 400,
        }
      );
    }

    const updateValues = {};

    // =====================================================
    // NORMAL FIELDS
    // =====================================================

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "customer_name"
      )
    ) {
      const customerName =
        cleanText(
          body.customer_name
        );

      if (
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

      updateValues.customer_name =
        customerName;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "company"
      )
    ) {
      updateValues.company =
        cleanNullableText(
          body.company
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "email"
      )
    ) {
      updateValues.email =
        cleanNullableText(
          body.email
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "phone"
      )
    ) {
      updateValues.phone =
        cleanNullableText(
          body.phone
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "status"
      )
    ) {
      updateValues.status =
        cleanText(
          body.status
        ) ||
        "Active";
    }

    // =====================================================
    // OWNER
    // =====================================================

    if (
      wantsOwnerChange
    ) {
      const requestedOwnerId =
        cleanText(
          body.owner_employee_id
        );

      if (
        !requestedOwnerId
      ) {
        updateValues.owner_employee_id =
          null;
      } else {
        if (
          !isUuid(
            requestedOwnerId
          )
        ) {
          return NextResponse.json(
            {
              error:
                "The selected customer owner is not valid.",
            },
            {
              status: 400,
            }
          );
        }

        const validOwner =
          await validateRecordOwner({
            supabase,
            organizationId,

            employeeId:
              requestedOwnerId,
          });

        if (
          !validOwner
        ) {
          return NextResponse.json(
            {
              error:
                "The selected customer owner is not valid.",
            },
            {
              status: 400,
            }
          );
        }

        updateValues.owner_employee_id =
          requestedOwnerId;
      }
    }

    // =====================================================
    // UPDATE
    // =====================================================

    const {
      data:
        updatedCustomer,
      error:
        updateError,
    } =
      await supabase
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
          organizationId
        )
        .select()
        .single();

    if (
      updateError
    ) {
      throw new Error(
        updateError.message
      );
    }

    const formattedCustomer =
      await attachRecordOwner({
        supabase,
        organizationId,
        record:
          updatedCustomer,
      });

    return NextResponse.json({
      customer:
        formattedCustomer,

      message:
        "Customer updated successfully.",
    });
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

// =========================================================
// DELETE CUSTOMER
// =========================================================

export async function DELETE(
  request,
  context
) {
  try {
    const {
      id,
    } =
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

    const permissions =
      getPermissions(
        access
      );

    if (
      !permissions.canDelete
    ) {
      return forbidden(
        "You do not have permission to delete customers."
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

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

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record:
          customer,
      });

    if (
      !visible
    ) {
      return forbidden(
        "You do not have permission to delete this customer."
      );
    }

    // =====================================================
    // PROTECT CUSTOMER WITH RELATED BUSINESS RECORDS
    // =====================================================

    const [
      quotesResult,
      projectsResult,
      invoicesResult,
    ] =
      await Promise.all([
        supabase
          .from("quotes")
          .select(
            "id",
            {
              count:
                "exact",
              head:
                true,
            }
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "customer_id",
            id
          ),

        supabase
          .from("projects")
          .select(
            "id",
            {
              count:
                "exact",
              head:
                true,
            }
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "customer_id",
            id
          ),

        supabase
          .from("invoices")
          .select(
            "id",
            {
              count:
                "exact",
              head:
                true,
            }
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "customer_id",
            id
          ),
      ]);

    const relationError =
      [
        quotesResult,
        projectsResult,
        invoicesResult,
      ].find(
        (
          result
        ) =>
          result.error
      );

    if (
      relationError?.error
    ) {
      throw new Error(
        relationError.error.message
      );
    }

    const relatedCount =
      Number(
        quotesResult.count ||
          0
      ) +
      Number(
        projectsResult.count ||
          0
      ) +
      Number(
        invoicesResult.count ||
          0
      );

    if (
      relatedCount >
      0
    ) {
      return NextResponse.json(
        {
          error:
            "This customer cannot be deleted because quotes, projects or invoices are linked to the record. Set the customer to Inactive instead.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // DELETE
    // =====================================================

    const {
      error:
        deleteError,
    } =
      await supabase
        .from(
          "customers"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (
      deleteError
    ) {
      throw new Error(
        deleteError.message
      );
    }

    return NextResponse.json({
      message:
        "Customer deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Customer DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to delete customer.",
      },
      {
        status: 500,
      }
    );
  }
}
