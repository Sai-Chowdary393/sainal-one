import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  getRecordPermissions,
  getTeamEmployeeIds,
} from "../../../lib/recordAccess";

import {
  getBusinessProfile,
  businessProfilePrompt,
} from "../../../lib/ai/businessProfile";

import {
  isWorkflowRequest,
  executeWorkflow,
} from "../../../lib/ai/workflowEngine";

import {
  createLeadFromPrompt,
} from "../../../lib/services/leadService";

import {
  createFollowUpFromPrompt,
} from "../../../lib/services/followUpService";

import {
  createTaskFromPrompt,
} from "../../../lib/services/taskService";

import {
  createQuoteFromPrompt,
} from "../../../lib/services/quoteService";

import {
  markInvoiceAsPaid,
  convertQuoteToInvoice,
} from "../../../lib/services/invoiceService";

import {
  convertLeadToCustomerAndProject,
} from "../../../lib/services/customerProjectService";

import {
  createProposalFromPrompt,
} from "../../../lib/services/proposalService";

// =========================================================
// OPENAI
// =========================================================

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY,
});

// =========================================================
// MODULE CONFIGURATION
// =========================================================

const MODULES = {
  leads: {
    table:
      "leads",

    prefix:
      "leads",

    module:
      "Leads",

    ownerField:
      "owner_employee_id",
  },

  quotes: {
    table:
      "quotes",

    prefix:
      "quotes",

    module:
      "Quotes",

    ownerField:
      "owner_employee_id",
  },

  proposals: {
    table:
      "proposals",

    prefix:
      "proposals",

    module:
      "Proposals",

    ownerField:
      "owner_employee_id",
  },

  customers: {
    table:
      "customers",

    prefix:
      "customers",

    module:
      "Customers",

    ownerField:
      "owner_employee_id",
  },

  projects: {
    table:
      "projects",

    prefix:
      "projects",

    module:
      "Projects",

    ownerField:
      "owner_employee_id",
  },

  tasks: {
    table:
      "tasks",

    prefix:
      "tasks",

    module:
      "Tasks",

    ownerField:
      "assigned_employee_id",
  },

  invoices: {
    table:
      "invoices",

    prefix:
      "invoices",

    module:
      "Invoices",

    ownerField:
      "owner_employee_id",
  },

  followUps: {
    table:
      "follow_ups",

    prefix:
      "followups",

    module:
      "Follow-ups",

    ownerField:
      "assigned_employee_id",
  },
};

// =========================================================
// HELPERS
// =========================================================

function forbidden(message) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status: 403,
    }
  );
}

function getPermissions(
  access,
  config
) {
  return getRecordPermissions(
    access,
    {
      prefix:
        config.prefix,

      module:
        config.module,
    }
  );
}

function canView(
  permissions
) {
  return Boolean(
    permissions.canViewAll ||
      permissions.canViewTeam ||
      permissions.canViewOwn
  );
}

// =========================================================
// LOAD ONE MODULE USING RBAC
// =========================================================

async function loadModuleRecords({
  access,
  config,
}) {
  const permissions =
    getPermissions(
      access,
      config
    );

  if (
    !canView(
      permissions
    )
  ) {
    return {
      records: [],
      permissions,
    };
  }

  const supabase =
    access.supabase;

  const organizationId =
    access.employee
      .organization_id;

  let query =
    supabase
      .from(
        config.table
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      );

  // =======================================================
  // TEAM ACCESS
  // =======================================================

  if (
    !permissions.canViewAll &&
    permissions.canViewTeam
  ) {
    const teamEmployeeIds =
      await getTeamEmployeeIds({
        supabase,

        employee:
          access.employee,
      });

    query =
      query.in(
        config.ownerField,
        teamEmployeeIds
      );
  }

  // =======================================================
  // OWN ACCESS
  // =======================================================

  else if (
    !permissions.canViewAll &&
    permissions.canViewOwn
  ) {
    query =
      query.eq(
        config.ownerField,
        access.employee.id
      );
  }

  const {
    data,
    error,
  } =
    await query.order(
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

  return {
    records:
      data || [],

    permissions,
  };
}

// =========================================================
// LOAD COMPANY PROFILE
// =========================================================

async function loadBusinessProfile({
  access,
}) {
  const {
    data,
    error,
  } =
    await access.supabase
      .from(
        "company_settings"
      )
      .select("*")
      .eq(
        "organization_id",
        access.employee
          .organization_id
      )
      .limit(1);

  if (error) {
    throw new Error(
      error.message
    );
  }

  const settings =
    data?.[0] ||
    null;

  return getBusinessProfile(
    settings
  );
}

// =========================================================
// LOAD ALL AI BUSINESS DATA
// =========================================================

async function loadBusinessData({
  access,
}) {
  const [
    profile,
    leadsResult,
    quotesResult,
    proposalsResult,
    customersResult,
    projectsResult,
    tasksResult,
    invoicesResult,
    followUpsResult,
  ] =
    await Promise.all([
      loadBusinessProfile({
        access,
      }),

      loadModuleRecords({
        access,
        config:
          MODULES.leads,
      }),

      loadModuleRecords({
        access,
        config:
          MODULES.quotes,
      }),

      loadModuleRecords({
        access,
        config:
          MODULES.proposals,
      }),

      loadModuleRecords({
        access,
        config:
          MODULES.customers,
      }),

      loadModuleRecords({
        access,
        config:
          MODULES.projects,
      }),

      loadModuleRecords({
        access,
        config:
          MODULES.tasks,
      }),

      loadModuleRecords({
        access,
        config:
          MODULES.invoices,
      }),

      loadModuleRecords({
        access,
        config:
          MODULES.followUps,
      }),
    ]);

  return {
    profile,

    leads:
      leadsResult.records,

    quotes:
      quotesResult.records,

    proposals:
      proposalsResult.records,

    customers:
      customersResult.records,

    projects:
      projectsResult.records,

    tasks:
      tasksResult.records,

    invoices:
      invoicesResult.records,

    followUps:
      followUpsResult.records,

    permissions: {
      leads:
        leadsResult.permissions,

      quotes:
        quotesResult.permissions,

      proposals:
        proposalsResult.permissions,

      customers:
        customersResult.permissions,

      projects:
        projectsResult.permissions,

      tasks:
        tasksResult.permissions,

      invoices:
        invoicesResult.permissions,

      followUps:
        followUpsResult.permissions,
    },
  };
}

// =========================================================
// GENERAL AI QUESTION
// =========================================================

async function answerGeneralQuestion({
  prompt,
  profile,
  leads,
  quotes,
  proposals,
  customers,
  projects,
  tasks,
  invoices,
  followUps,
}) {
  const completion =
    await openai.chat.completions.create({
      model:
        "gpt-4.1-mini",

      messages: [
        {
          role:
            "system",

          content: `
You are SaiNal One AI Operations Manager.

You work for this specific business:

${businessProfilePrompt(profile)}

You may only use the business records supplied below.

Important security rules:
- The supplied records have already been filtered according to the signed-in employee's permissions.
- Never imply that other hidden records exist.
- Never invent inaccessible records.
- Never reveal information that is not present in the supplied business data.

You can analyse:
- Leads
- Quotes
- Proposals
- Customers
- Projects
- Tasks
- Invoices
- Follow-ups

Instructions:
- Tailor recommendations to the company's industry.
- Tailor advice to its business type and configured services.
- Consider its target customers.
- Do not assume the company provides website development or technology services unless configured.
- Use generic terms such as service, work, project, client requirement and deliverables where appropriate.
- Give practical recommendations.
- Highlight urgent actions.
- Mention names, values, dates and statuses where useful.
- Use professional UK business language.
- Do not invent records.
- Follow the company's custom AI instructions.
          `,
        },

        {
          role:
            "user",

          content: `
Business Data available to this employee:

Leads:
${JSON.stringify(leads)}

Quotes:
${JSON.stringify(quotes)}

Proposals:
${JSON.stringify(proposals)}

Customers:
${JSON.stringify(customers)}

Projects:
${JSON.stringify(projects)}

Tasks:
${JSON.stringify(tasks)}

Invoices:
${JSON.stringify(invoices)}

Follow-ups:
${JSON.stringify(followUps)}

User Question:
${prompt}
          `,
        },
      ],
    });

  return (
    completion
      .choices?.[0]
      ?.message
      ?.content ||
    "No response was generated."
  );
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request
) {
  try {
    // =====================================================
    // AUTHENTICATION
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

    // =====================================================
    // OPENAI CONFIGURATION
    // =====================================================

    if (
      !process.env
        .OPENAI_API_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "AI service is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    if (
      !body.prompt?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Prompt is required",
        },
        {
          status: 400,
        }
      );
    }

    const originalPrompt =
      body.prompt.trim();

    const prompt =
      originalPrompt
        .toLowerCase();

    const organizationId =
      access.employee
        .organization_id;

    const employeeId =
      access.employee.id;

    // =====================================================
    // LOAD ONLY DATA THIS EMPLOYEE CAN ACCESS
    // =====================================================

    const {
      profile,
      leads,
      quotes,
      proposals,
      customers,
      projects,
      tasks,
      invoices,
      followUps,
      permissions,
    } =
      await loadBusinessData({
        access,
      });

    // =====================================================
    // CREATE PROPOSAL
    // =====================================================

    if (
      prompt.includes(
        "create proposal"
      ) ||
      prompt.includes(
        "generate proposal"
      ) ||
      prompt.includes(
        "prepare proposal"
      )
    ) {
      if (
        !permissions
          .proposals
          .canCreate
      ) {
        return forbidden(
          "You do not have permission to create proposals."
        );
      }

      const result =
        await createProposalFromPrompt({
          prompt:
            originalPrompt,

          profile,

          leads,

          customers,

          quotes,

          openai,

          organizationId,

          employeeId,
        });

      if (
        result.notFound
      ) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find an accessible lead, customer or quote matching that request. Please mention the exact client, contact, company or quote number.",
        });
      }

      if (
        result.alreadyExists
      ) {
        return NextResponse.json({
          answer: `⚠️ Draft proposal already exists.

Proposal Number: ${result.existing.proposal_number}
Title: ${result.existing.title}
Client: ${result.existing.client}
Status: ${result.existing.status}

No duplicate proposal was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Proposal created successfully.

Proposal Number: ${result.created.proposal_number}
Title: ${result.created.title}
Client: ${result.created.client}
Contact: ${result.created.contact}
Service: ${result.created.service}
Amount: ${result.created.amount || "To be confirmed"}
Status: ${result.created.status}`,
      });
    }

    // =====================================================
    // MULTI-STEP WORKFLOW
    //
    // The existing workflow engine can perform several
    // mutations internally. Until we add per-step RBAC to
    // workflowEngine itself, only the Organisation Owner
    // may start an AI multi-action workflow.
    // =====================================================

    if (
      isWorkflowRequest(
        originalPrompt
      )
    ) {
      if (
        !access.employee
          .is_organization_owner
      ) {
        return forbidden(
          "AI multi-step workflows currently require Organisation Owner access."
        );
      }

      const workflowResult =
        await executeWorkflow({
          prompt:
            originalPrompt,

          profile,

          leads,

          quotes,

          projects,

          invoices,

          organizationId,

          employeeId,
        });

      return NextResponse.json({
        answer:
          workflowResult.answer,

        workflow:
          true,

        success:
          workflowResult.success,

        data:
          workflowResult.data ||
          null,
      });
    }

    // =====================================================
    // MARK INVOICE PAID
    // =====================================================

    if (
      (
        prompt.includes(
          "mark"
        ) ||
        prompt.includes(
          "update"
        )
      ) &&
      prompt.includes(
        "invoice"
      ) &&
      prompt.includes(
        "paid"
      )
    ) {
      if (
        !permissions
          .invoices
          .canEdit
      ) {
        return forbidden(
          "You do not have permission to update invoices."
        );
      }

      const result =
        await markInvoiceAsPaid({
          prompt:
            originalPrompt,

          invoices,

          quotes,

          organizationId,

          employeeId,
        });

      if (
        result.notFound
      ) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find an accessible invoice matching that request. Please mention the invoice number, client name or contact name.",
        });
      }

      if (
        result.alreadyPaid
      ) {
        return NextResponse.json({
          answer: `⚠️ Invoice is already marked as paid.

Invoice Number: ${result.invoice.invoice_number}
Client: ${result.invoice.client}
Amount: ${
            result.invoice
              .total_amount ||
            result.invoice
              .amount
          }
Status: ${result.invoice.status}`,
        });
      }

      return NextResponse.json({
        answer: `✅ Invoice marked as paid.

Invoice Number: ${result.invoice.invoice_number}
Client: ${result.invoice.client}
Amount: ${
          result.invoice
            .total_amount ||
          result.invoice
            .amount
        }
Status: ${result.invoice.status}`,
      });
    }

    // =====================================================
    // QUOTE -> INVOICE
    // =====================================================

    if (
      (
        prompt.includes(
          "convert"
        ) ||
        prompt.includes(
          "create invoice"
        )
      ) &&
      (
        prompt.includes(
          "quote"
        ) ||
        prompt.includes(
          "invoice"
        )
      )
    ) {
      if (
        !permissions
          .invoices
          .canCreate
      ) {
        return forbidden(
          "You do not have permission to create invoices."
        );
      }

      if (
        !permissions
          .quotes
          .canEdit
      ) {
        return forbidden(
          "You do not have permission to update the source quote."
        );
      }

      const result =
        await convertQuoteToInvoice({
          prompt:
            originalPrompt,

          quotes,

          invoices,

          profile,

          organizationId,

          employeeId,
        });

      if (
        result.notFound
      ) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find an accessible quote matching that request. Please mention the quote number, client name or contact name.",
        });
      }

      if (
        result.alreadyExists
      ) {
        return NextResponse.json({
          answer: `⚠️ Invoice already exists.

Invoice Number: ${result.existing.invoice_number}
Client: ${result.existing.client}
Amount: ${
            result.existing
              .total_amount ||
            result.existing
              .amount
          }
Status: ${result.existing.status}

No duplicate invoice was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Invoice created successfully from quote.

Quote: ${result.quote.quote_number}
Invoice Number: ${result.created.invoice_number}
Client: ${result.created.client}
Service: ${result.created.service}
Amount: ${
          result.created
            .total_amount ||
          result.created
            .amount
        }
Invoice Status: ${result.created.status}

Quote status updated to Accepted.`,
      });
    }

    // =====================================================
    // CREATE QUOTE
    // =====================================================

    if (
      (
        prompt.includes(
          "create quote"
        ) ||
        prompt.includes(
          "add quote"
        )
      ) &&
      !prompt.includes(
        "convert"
      )
    ) {
      if (
        !permissions
          .quotes
          .canCreate
      ) {
        return forbidden(
          "You do not have permission to create quotes."
        );
      }

      const result =
        await createQuoteFromPrompt({
          prompt:
            originalPrompt,

          leads,

          customers,

          quotes,

          profile,

          organizationId,

          employeeId,
        });

      if (
        result.notFound
      ) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find an accessible lead or customer matching that request. Please mention the exact lead or customer name.",
        });
      }

      if (
        result.alreadyExists
      ) {
        return NextResponse.json({
          answer: `⚠️ Draft quote already exists.

Quote Number: ${result.existing.quote_number}
Client: ${result.existing.client}
Amount: ${result.existing.amount}
Status: ${result.existing.status}

No duplicate quote was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Quote created successfully.

Quote Number: ${result.created.quote_number}
Client: ${result.created.client}
Contact: ${result.created.contact}
Service: ${result.created.service}
Amount: ${
          result.created
            .amount ||
          "To be confirmed"
        }
Status: ${result.created.status}`,
      });
    }

    // =====================================================
    // LEAD -> CUSTOMER + PROJECT
    // =====================================================

    if (
      prompt.includes(
        "convert"
      ) &&
      prompt.includes(
        "lead"
      ) &&
      (
        prompt.includes(
          "customer"
        ) ||
        prompt.includes(
          "project"
        )
      )
    ) {
      if (
        !permissions
          .leads
          .canEdit
      ) {
        return forbidden(
          "You do not have permission to update leads."
        );
      }

      if (
        !permissions
          .customers
          .canCreate
      ) {
        return forbidden(
          "You do not have permission to create customers."
        );
      }

      if (
        !permissions
          .projects
          .canCreate
      ) {
        return forbidden(
          "You do not have permission to create projects."
        );
      }

      const result =
        await convertLeadToCustomerAndProject({
          prompt:
            originalPrompt,

          leads,

          customers,

          projects,

          organizationId,

          employeeId,
        });

      if (
        result.notFound
      ) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find an accessible lead matching that request. Please mention the exact lead name.",
        });
      }

      return NextResponse.json({
        answer: `✅ Lead converted successfully.

Lead: ${result.lead.name}
Customer: ${result.customer.customer_name}
Company: ${result.customer.company}
Project: ${result.project.project_name}
Project Status: ${result.project.status}

Customer already existed: ${
          result.customerAlreadyExists
            ? "Yes"
            : "No"
        }
Project already existed: ${
          result.projectAlreadyExists
            ? "Yes"
            : "No"
        }

Lead status updated to Won.`,
      });
    }

    // =====================================================
    // CREATE FOLLOW-UP
    // =====================================================

    if (
      prompt.includes(
        "create follow-up"
      ) ||
      prompt.includes(
        "create follow up"
      ) ||
      prompt.includes(
        "add follow-up"
      ) ||
      prompt.includes(
        "add follow up"
      )
    ) {
      if (
        !permissions
          .followUps
          .canCreate
      ) {
        return forbidden(
          "You do not have permission to create follow-ups."
        );
      }

      const result =
        await createFollowUpFromPrompt({
          prompt:
            originalPrompt,

          leads,

          organizationId,

          employeeId,
        });

      if (
        result.notFound
      ) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find an accessible lead matching that request. Please mention the exact lead name, company or email address.",
        });
      }

      if (
        result.alreadyExists
      ) {
        return NextResponse.json({
          answer: `⚠️ Follow-up already exists.

Title: ${result.existing.title}
Status: ${result.existing.status}
Due Date: ${
            result.existing
              .due_date ||
            "No date"
          }

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Follow-up created successfully.

Title: ${result.created.title}
Status: ${result.created.status}
Due Date: ${
          result.created
            .due_date ||
          "No date"
        }
Note: ${result.created.note}`,
      });
    }

    // =====================================================
    // CREATE TASK
    // =====================================================

    if (
      prompt.includes(
        "create task"
      ) ||
      prompt.includes(
        "add task"
      )
    ) {
      if (
        !permissions
          .tasks
          .canCreate
      ) {
        return forbidden(
          "You do not have permission to create tasks."
        );
      }

      const result =
        await createTaskFromPrompt({
          prompt:
            originalPrompt,

          projects,

          organizationId,

          employeeId,
        });

      if (
        result.notFound
      ) {
        return NextResponse.json({
          answer:
            "⚠️ I could not find an accessible project matching that request.",
        });
      }

      if (
        result.alreadyExists
      ) {
        return NextResponse.json({
          answer: `⚠️ Task already exists.

Task: ${result.existing.task_name}
Status: ${result.existing.status}
Due Date: ${
            result.existing
              .due_date ||
            "No date"
          }

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Task created successfully.

Task: ${result.created.task_name}
Project: ${
          result.project
            ?.project_name ||
          "No project linked"
        }
Status: ${result.created.status}
Due Date: ${
          result.created
            .due_date ||
          "No date"
        }`,
      });
    }

    // =====================================================
    // CREATE LEAD
    // =====================================================

    if (
      prompt.includes(
        "create lead"
      ) ||
      prompt.includes(
        "add lead"
      )
    ) {
      if (
        !permissions
          .leads
          .canCreate
      ) {
        return forbidden(
          "You do not have permission to create leads."
        );
      }

      const result =
        await createLeadFromPrompt({
          prompt:
            originalPrompt,

          profile,

          organizationId,

          employeeId,

          openai,
        });

      if (
        result.alreadyExists
      ) {
        return NextResponse.json({
          answer: `⚠️ Lead already exists.

Name: ${result.existing.name}
Company: ${result.existing.company}
Email: ${
            result.existing
              .email ||
            "Not provided"
          }

No duplicate was created.`,
        });
      }

      return NextResponse.json({
        answer: `✅ Lead created successfully.

Name: ${result.created.name}
Company: ${result.created.company}
Email: ${
          result.created
            .email ||
          "Not provided"
        }
Phone: ${
          result.created
            .phone ||
          "Not provided"
        }
Value: ${
          result.created
            .value ||
          "Not provided"
        }
Status: ${result.created.status}
AI Score: ${result.created.ai_score}
AI Summary: ${result.created.ai_summary}
Next Action: ${result.created.ai_next_action}`,
      });
    }

    // =====================================================
    // GENERAL AI ANALYSIS
    // =====================================================

    const answer =
      await answerGeneralQuestion({
        prompt:
          originalPrompt,

        profile,

        leads,

        quotes,

        proposals,

        customers,

        projects,

        tasks,

        invoices,

        followUps,
      });

    return NextResponse.json({
      answer,
    });
  } catch (error) {
    console.error(
      "AI Assistant error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "AI Assistant failed",
      },
      {
        status: 500,
      }
    );
  }
}
