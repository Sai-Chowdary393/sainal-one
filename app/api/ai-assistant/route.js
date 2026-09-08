"use server";

import { NextResponse } from "next/server";
import OpenAI from "openai";

import { getServerAccess } from "../../../lib/serverAccess";
import {
  getRecordPermissions,
  getTeamEmployeeIds,
  loadAssignableEmployees,
} from "../../../lib/recordAccess";
import { createAdminSupabaseClient } from "../../../lib/supabaseAdmin";
import {
  getBusinessProfile,
  businessProfilePrompt,
} from "../../../lib/ai/businessProfile";
import {
  planRequest,
  sanitisePlan,
  resolvePlanAgainstBusinessData,
  buildDeterministicPlan,
  ensureRequestedActionCoverage,
  confirmationForPlan,
  clientPlan,
  executePlan,
} from "../../../lib/ai/agentEngine";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODULES = {
  leads: {
    table: "leads",
    prefix: "leads",
    module: "Leads",
    ownerField: "owner_employee_id",
  },
  quotes: {
    table: "quotes",
    prefix: "quotes",
    module: "Quotes",
    ownerField: "owner_employee_id",
  },
  proposals: {
    table: "proposals",
    prefix: "proposals",
    module: "Proposals",
    ownerField: "owner_employee_id",
  },
  customers: {
    table: "customers",
    prefix: "customers",
    module: "Customers",
    ownerField: "owner_employee_id",
  },
  projects: {
    table: "projects",
    prefix: "projects",
    module: "Projects",
    ownerField: "owner_employee_id",
  },
  tasks: {
    table: "tasks",
    prefix: "tasks",
    module: "Tasks",
    ownerField: "assigned_employee_id",
  },
  invoices: {
    table: "invoices",
    prefix: "invoices",
    module: "Invoices",
    ownerField: "owner_employee_id",
  },
  followUps: {
    table: "follow_ups",
    prefix: "followups",
    module: "Follow-ups",
    ownerField: "assigned_employee_id",
  },
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function canView(perms) {
  return Boolean(
    perms.canViewAll ||
      perms.canViewTeam ||
      perms.canViewOwn
  );
}

function pick(record, fields) {
  const out = {};
  for (const field of fields) {
    const value = record?.[field];
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      out[field] = value;
    }
  }
  return out;
}

function compact(records, fields, max = 100) {
  return (records || [])
    .slice(0, max)
    .map((record) => pick(record, fields));
}

function ids(records) {
  return new Set(
    (records || [])
      .map((item) => item.id)
      .filter(Boolean)
  );
}

function looksLikeActionRequest(prompt) {
  const text = normalise(prompt);
  if (!text) return false;

  const actionPatterns = [
    /\b(create|add|schedule|book|send|email|draft|write|compose|convert|update|change|edit|assign|reassign|complete|finish|cancel|reopen|reschedule|mark|record|generate|prepare|make|accept|approve|reject|submit|log)\b/,
    /\b(set up|follow up with|move .* to|turn .* into)\b/,
  ];

  const analysisPatterns = [
    /^(what|who|when|where|why|how|which|show|tell|give me|summari[sz]e|review|check|list|find|analyse|analyze)\b/,
  ];

  if (
    actionPatterns.some((pattern) =>
      pattern.test(text)
    )
  ) {
    return true;
  }

  if (
    analysisPatterns.some((pattern) =>
      pattern.test(text)
    )
  ) {
    return false;
  }

  return false;
}

function localDateTime(timezone) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "long",
      hour12: false,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      dateStyle: "full",
      timeStyle: "long",
      hour12: false,
    }).format(new Date());
  }
}

function money(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(
    String(value || "").replace(/[^0-9.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

// =========================================================
// AI CONVERSATION PERSISTENCE
// =========================================================

async function findConversation({
  supabase,
  organizationId,
  employeeId,
  conversationId,
}) {
  if (!conversationId) return null;

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function getLatestConversation({
  supabase,
  organizationId,
  employeeId,
}) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

async function createConversation({
  supabase,
  organizationId,
  employeeId,
  title,
}) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert([
      {
        organization_id: organizationId,
        employee_id: employeeId,
        title: clean(title).slice(0, 120) || "AI Conversation",
        status: "active",
        created_at: now,
        updated_at: now,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function ensureConversation({
  supabase,
  organizationId,
  employeeId,
  conversationId,
  title,
}) {
  const requested = await findConversation({
    supabase,
    organizationId,
    employeeId,
    conversationId,
  });

  if (requested) return requested;

  const latest = await getLatestConversation({
    supabase,
    organizationId,
    employeeId,
  });

  if (latest) return latest;

  return createConversation({
    supabase,
    organizationId,
    employeeId,
    title,
  });
}

async function touchConversation({
  supabase,
  conversationId,
  organizationId,
  employeeId,
}) {
  const { error } = await supabase
    .from("ai_conversations")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId);

  if (error) throw new Error(error.message);
}

async function saveMessage({
  supabase,
  conversation,
  access,
  role,
  content,
  plan = null,
  planDisplay = null,
  confirmationReason = null,
  planStatus = null,
}) {
  const { data, error } = await supabase
    .from("ai_messages")
    .insert([
      {
        conversation_id: conversation.id,
        organization_id: access.employee.organization_id,
        employee_id: access.employee.id,
        role,
        content: String(content || ""),
        plan,
        plan_display: planDisplay,
        confirmation_reason: confirmationReason,
        plan_status: planStatus,
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  await touchConversation({
    supabase,
    conversationId: conversation.id,
    organizationId: access.employee.organization_id,
    employeeId: access.employee.id,
  });

  return data;
}

async function updatePersistedPlanStatus({
  supabase,
  access,
  conversationId,
  messageId,
  status,
}) {
  if (!messageId) return;

  const { error } = await supabase
    .from("ai_messages")
    .update({
      plan_status: status,
    })
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .eq("organization_id", access.employee.organization_id)
    .eq("employee_id", access.employee.id);

  if (error) throw new Error(error.message);
}

async function loadConversationMessages({
  supabase,
  access,
  conversationId,
  limit = 100,
}) {
  const { data, error } = await supabase
    .from("ai_messages")
    .select(
      "id,role,content,plan,plan_display,confirmation_reason,plan_status,created_at"
    )
    .eq("conversation_id", conversationId)
    .eq("organization_id", access.employee.organization_id)
    .eq("employee_id", access.employee.id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    plan: row.plan || null,
    planDisplay: row.plan_display || null,
    confirmationReason: row.confirmation_reason || "",
    planStatus: row.plan_status || null,
  }));
}

async function loadConversationContext({
  supabase,
  access,
  conversationId,
}) {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("role,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("organization_id", access.employee.organization_id)
    .eq("employee_id", access.employee.id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw new Error(error.message);

  return (data || [])
    .reverse()
    .filter((item) => clean(item.content))
    .map((item) => ({
      role: item.role,
      content: clean(item.content).slice(0, 5000),
    }));
}

// =========================================================
// BUSINESS DATA
// =========================================================

async function loadModule(access, config) {
  const permissions = getRecordPermissions(access, {
    prefix: config.prefix,
    module: config.module,
  });

  if (!canView(permissions)) {
    return {
      records: [],
      permissions,
    };
  }

  let query = access.supabase
    .from(config.table)
    .select("*")
    .eq(
      "organization_id",
      access.employee.organization_id
    );

  if (
    !permissions.canViewAll &&
    permissions.canViewTeam
  ) {
    const teamIds = await getTeamEmployeeIds({
      supabase: access.supabase,
      employee: access.employee,
    });

    if (!teamIds?.length) {
      return {
        records: [],
        permissions,
      };
    }

    query = query.in(
      config.ownerField,
      teamIds
    );
  } else if (
    !permissions.canViewAll &&
    permissions.canViewOwn
  ) {
    query = query.eq(
      config.ownerField,
      access.employee.id
    );
  }

  const { data, error } = await query.order(
    "created_at",
    {
      ascending: false,
    }
  );

  if (error) throw new Error(error.message);

  return {
    records: data || [],
    permissions,
  };
}

async function loadProfile(access) {
  const { data, error } =
    await access.supabase
      .from("company_settings")
      .select("*")
      .eq(
        "organization_id",
        access.employee.organization_id
      )
      .limit(1);

  if (error) throw new Error(error.message);

  return getBusinessProfile(
    data?.[0] || null
  );
}

async function loadEmails(access, data) {
  const supabase =
    createAdminSupabaseClient();

  const { data: rows, error } =
    await supabase
      .from("email_logs")
      .select(
        "id,recipient,subject,email_type,related_record_id,related_record_number,status,sent_at,created_at,message_body,error_message"
      )
      .eq(
        "organization_id",
        access.employee.organization_id
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(150);

  if (error) return [];

  if (
    access.employee.is_organization_owner
  ) {
    return rows || [];
  }

  const allowed = {
    lead: ids(data.leads),
    quote: ids(data.quotes),
    proposal: ids(data.proposals),
    customer: ids(data.customers),
    project: ids(data.projects),
    invoice: ids(data.invoices),
  };

  return (rows || []).filter(
    (row) =>
      row.related_record_id &&
      allowed[
        normalise(row.email_type)
      ]?.has(row.related_record_id)
  );
}

async function loadInvoicePayments(
  access,
  invoices
) {
  const invoiceIds = (invoices || [])
    .map((item) => item.id)
    .filter(Boolean);

  if (!invoiceIds.length) return [];

  const supabase =
    createAdminSupabaseClient();

  const { data, error } =
    await supabase
      .from("invoice_payments")
      .select(
        "id,invoice_id,amount,payment_date,payment_method,reference,notes,recorded_by_employee_id,created_at"
      )
      .eq(
        "organization_id",
        access.employee.organization_id
      )
      .in("invoice_id", invoiceIds)
      .order("created_at", {
        ascending: false,
      });

  if (error) return [];
  return data || [];
}

async function loadBusinessData(access) {
  const [
    profile,
    leadsR,
    quotesR,
    proposalsR,
    customersR,
    projectsR,
    tasksR,
    invoicesR,
    followUpsR,
  ] = await Promise.all([
    loadProfile(access),
    loadModule(access, MODULES.leads),
    loadModule(access, MODULES.quotes),
    loadModule(access, MODULES.proposals),
    loadModule(access, MODULES.customers),
    loadModule(access, MODULES.projects),
    loadModule(access, MODULES.tasks),
    loadModule(access, MODULES.invoices),
    loadModule(access, MODULES.followUps),
  ]);

  const businessData = {
    profile,
    leads: leadsR.records,
    quotes: quotesR.records,
    proposals: proposalsR.records,
    customers: customersR.records,
    projects: projectsR.records,
    tasks: tasksR.records,
    invoices: invoicesR.records,
    followUps: followUpsR.records,
    permissions: {
      leads: leadsR.permissions,
      quotes: quotesR.permissions,
      proposals: proposalsR.permissions,
      customers: customersR.permissions,
      projects: projectsR.permissions,
      tasks: tasksR.permissions,
      invoices: invoicesR.permissions,
      followUps: followUpsR.permissions,
    },
  };

  businessData.emails =
    await loadEmails(
      access,
      businessData
    );

  businessData.invoicePayments =
    await loadInvoicePayments(
      access,
      businessData.invoices
    );

  const canAssign =
    access.employee.is_organization_owner ||
    Object.values(
      businessData.permissions
    ).some(
      (permission) =>
        permission.canAssign
    );

  businessData.employees = canAssign
    ? await loadAssignableEmployees({
        supabase:
          createAdminSupabaseClient(),
        organizationId:
          access.employee.organization_id,
      })
    : [];

  return businessData;
}

function compactBusiness(data) {
  return {
    leads: compact(data.leads, [
      "id",
      "name",
      "company",
      "email",
      "phone",
      "status",
      "value",
      "source",
      "ai_score",
      "ai_summary",
      "ai_next_action",
      "owner_employee_id",
    ]),

    customers: compact(
      data.customers,
      [
        "id",
        "customer_name",
        "company",
        "email",
        "phone",
        "status",
        "lead_id",
        "owner_employee_id",
      ]
    ),

    projects: compact(
      data.projects,
      [
        "id",
        "project_name",
        "customer_id",
        "description",
        "status",
        "start_date",
        "due_date",
        "amount",
        "owner_employee_id",
      ]
    ),

    tasks: compact(
      data.tasks,
      [
        "id",
        "task_name",
        "project_id",
        "status",
        "priority",
        "due_date",
        "assigned_employee_id",
      ],
      150
    ),

    quotes: compact(
      data.quotes,
      [
        "id",
        "quote_number",
        "lead_id",
        "customer_id",
        "client",
        "contact",
        "email",
        "service",
        "amount",
        "status",
        "owner_employee_id",
      ]
    ),

    proposals: compact(
      data.proposals,
      [
        "id",
        "proposal_number",
        "lead_id",
        "customer_id",
        "quote_id",
        "client",
        "contact",
        "email",
        "title",
        "service",
        "amount",
        "status",
        "owner_employee_id",
      ]
    ),

    invoices: (data.invoices || [])
      .slice(0, 100)
      .map((invoice) => {
        const payments = (
          data.invoicePayments || []
        ).filter(
          (payment) =>
            String(payment.invoice_id) ===
            String(invoice.id)
        );

        const paid = payments.reduce(
          (sum, payment) =>
            sum + money(payment.amount),
          0
        );

        const total = money(
          invoice.total_amount ??
            invoice.amount ??
            invoice.total
        );

        return {
          ...pick(invoice, [
            "id",
            "invoice_number",
            "customer_id",
            "project_id",
            "quote_id",
            "client",
            "service",
            "amount",
            "total_amount",
            "status",
            "due_date",
            "owner_employee_id",
          ]),
          payment_summary: {
            paid,
            outstanding: Math.max(
              0,
              Math.round(
                (total - paid) * 100
              ) / 100
            ),
            payment_count:
              payments.length,
          },
        };
      }),

    invoicePayments: compact(
      data.invoicePayments,
      [
        "id",
        "invoice_id",
        "amount",
        "payment_date",
        "payment_method",
        "reference",
        "created_at",
      ],
      150
    ),

    followUps: compact(
      data.followUps,
      [
        "id",
        "activity_type",
        "related_type",
        "related_id",
        "title",
        "note",
        "due_date",
        "scheduled_at",
        "status",
        "assigned_employee_id",
      ],
      150
    ),

    emails: compact(
      data.emails,
      [
        "id",
        "recipient",
        "subject",
        "email_type",
        "related_record_id",
        "related_record_number",
        "status",
        "sent_at",
        "message_body",
      ],
      100
    ),
  };
}

async function answerGeneral({
  prompt,
  conversation,
  profile,
  businessData,
  timezone,
}) {
  const response =
    await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are SaiNal One AI Operations Manager.

Current server date/time: ${new Date().toISOString()}
User timezone: ${timezone}
User local date/time: ${localDateTime(timezone)}

Business profile:
${businessProfilePrompt(profile)}

Use only supplied current business data. Records are already permission filtered. Never invent hidden records. Conversation history is context only; current records override prior chat statements. Analyse Leads, Customers, Projects, Tasks, Quotes, Proposals, Invoices, Follow-ups/Calendar activities and Email history. Use professional UK business language. Prioritise urgent actions. Do not claim an action was executed unless the system executed it.`,
        },
        {
          role: "user",
          content: `CURRENT BUSINESS DATA:
${JSON.stringify(
  compactBusiness(businessData)
)}`,
        },
        ...conversation,
        {
          role: "user",
          content: prompt,
        },
      ],
    });

  return (
    response.choices?.[0]?.message
      ?.content ||
    "No response was generated."
  );
}

// =========================================================
// GET - RESTORE LATEST CONVERSATION
// =========================================================

export async function GET() {
  try {
    const access =
      await getServerAccess();

    if (!access.employee) {
      return NextResponse.json(
        {
          error: access.error,
        },
        {
          status: access.status,
        }
      );
    }

    const supabase =
      createAdminSupabaseClient();

    const conversation =
      await getLatestConversation({
        supabase,
        organizationId:
          access.employee.organization_id,
        employeeId:
          access.employee.id,
      });

    if (!conversation) {
      return NextResponse.json({
        conversation_id: null,
        messages: [],
      });
    }

    const messages =
      await loadConversationMessages({
        supabase,
        access,
        conversationId:
          conversation.id,
      });

    return NextResponse.json({
      conversation_id:
        conversation.id,
      messages,
    });
  } catch (error) {
    console.error(
      "AI conversation GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to restore AI conversation.",
      },
      {
        status: error.status || 500,
      }
    );
  }
}

// =========================================================
// DELETE - CLEAR CURRENT CONVERSATION
// =========================================================

export async function DELETE(request) {
  try {
    const access =
      await getServerAccess();

    if (!access.employee) {
      return NextResponse.json(
        {
          error: access.error,
        },
        {
          status: access.status,
        }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {}

    const supabase =
      createAdminSupabaseClient();

    const conversationId =
      clean(body.conversation_id);

    const conversation =
      conversationId
        ? await findConversation({
            supabase,
            organizationId:
              access.employee.organization_id,
            employeeId:
              access.employee.id,
            conversationId,
          })
        : await getLatestConversation({
            supabase,
            organizationId:
              access.employee.organization_id,
            employeeId:
              access.employee.id,
          });

    if (conversation) {
      const { error } =
        await supabase
          .from("ai_conversations")
          .update({
            status: "archived",
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            conversation.id
          )
          .eq(
            "organization_id",
            access.employee.organization_id
          )
          .eq(
            "employee_id",
            access.employee.id
          );

      if (error) {
        throw new Error(
          error.message
        );
      }
    }

    return NextResponse.json({
      success: true,
      conversation_id: null,
    });
  } catch (error) {
    console.error(
      "AI conversation DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to clear AI conversation.",
      },
      {
        status: error.status || 500,
      }
    );
  }
}

// =========================================================
// POST - ASK / EXECUTE
// =========================================================

export async function POST(request) {
  try {
    const access =
      await getServerAccess();

    if (!access.employee) {
      return NextResponse.json(
        {
          error: access.error,
        },
        {
          status: access.status,
        }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
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

    let body = {};
    try {
      body = await request.json();
    } catch {}

    const timezone =
      clean(body.timezone) || "UTC";

    const supabase =
      createAdminSupabaseClient();

    const conversation =
      await ensureConversation({
        supabase,
        organizationId:
          access.employee.organization_id,
        employeeId:
          access.employee.id,
        conversationId:
          clean(body.conversation_id),
        title:
          clean(body.prompt) ||
          "AI Conversation",
      });

    const businessData =
      await loadBusinessData(access);

    // =====================================================
    // EXECUTE CONFIRMED PLAN
    // =====================================================

    if (
      clean(body.mode) ===
      "execute_plan"
    ) {
      const plan =
        sanitisePlan(body.plan);

      if (
        plan.mode !== "actions" ||
        !plan.actions.length
      ) {
        return NextResponse.json(
          {
            error:
              "There are no valid AI actions to execute.",
          },
          {
            status: 400,
          }
        );
      }

      await updatePersistedPlanStatus({
        supabase,
        access,
        conversationId:
          conversation.id,
        messageId:
          clean(body.plan_message_id),
        status: "running",
      });

      const execution =
        await executePlan({
          plan,
          access,
          businessData,
          permissions:
            businessData.permissions,
          employees:
            businessData.employees,
          profile:
            businessData.profile,
          openai,
        });

      await updatePersistedPlanStatus({
        supabase,
        access,
        conversationId:
          conversation.id,
        messageId:
          clean(body.plan_message_id),
        status:
          execution.success
            ? "completed"
            : "failed",
      });

      const persisted =
        await saveMessage({
          supabase,
          conversation,
          access,
          role: "assistant",
          content:
            execution.answer ||
            "AI Agent execution completed.",
        });

      return NextResponse.json({
        answer:
          persisted.content,
        executed: true,
        success:
          execution.success,
        results:
          execution.results,
        conversation_id:
          conversation.id,
        message_id:
          persisted.id,
        created_at:
          persisted.created_at,
      });
    }

    // =====================================================
    // ASK
    // =====================================================

    const prompt =
      clean(body.prompt);

    if (!prompt) {
      return NextResponse.json(
        {
          error:
            "Prompt is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Load the conversation context BEFORE writing this
     * prompt so the current user message is not duplicated
     * in the LLM input.
     */
    const conversationContext =
      await loadConversationContext({
        supabase,
        access,
        conversationId:
          conversation.id,
      });

    const persistedUser =
      await saveMessage({
        supabase,
        conversation,
        access,
        role: "user",
        content: prompt,
      });

    const actionIntent =
      looksLikeActionRequest(
        prompt
      );

    const plannerArgs = {
      openai,
      prompt,
      conversation:
        conversationContext,
      businessData:
        compactBusiness(
          businessData
        ),
      employees:
        businessData.employees.map(
          (employee) => ({
            id: employee.id,
            full_name:
              employee.full_name,
            email:
              employee.email,
            job_title:
              employee.job_title,
          })
        ),
      timezone,
      currentTime:
        new Date().toISOString(),
      localTime:
        localDateTime(timezone),
      forceActions:
        actionIntent,
    };

    let plan =
      await planRequest(
        plannerArgs
      );

    plan =
      resolvePlanAgainstBusinessData({
        plan,
        prompt,
        conversation:
          conversationContext,
        businessData:
          compactBusiness(
            businessData
          ),
        employees:
          plannerArgs.employees,
        timezone,
      });

    /*
     * Multi-action completeness guard:
     * merge deterministic actions that are clearly requested
     * but were omitted by the LLM planner.
     */
    if (actionIntent) {
      plan =
        ensureRequestedActionCoverage({
          plan,
          prompt,
          conversation:
            conversationContext,
          businessData:
            compactBusiness(
              businessData
            ),
          timezone,
        });
    }

    if (
      actionIntent &&
      (
        plan.mode !== "actions" ||
        !plan.actions.length
      )
    ) {
      plan =
        buildDeterministicPlan({
          prompt,
          conversation:
            conversationContext,
          businessData:
            compactBusiness(
              businessData
            ),
          timezone,
        });

      if (
        plan.mode !== "actions" ||
        !plan.actions.length
      ) {
        const persistedError =
          await saveMessage({
            supabase,
            conversation,
            access,
            role: "error",
            content:
              plan.summary ||
              "I understood this as a CRM action request, but I could not uniquely match the record needed to perform it. No changes were made.",
          });

        return NextResponse.json(
          {
            error:
              persistedError.content,
            conversation_id:
              conversation.id,
            user_message_id:
              persistedUser.id,
            error_message_id:
              persistedError.id,
          },
          {
            status: 422,
          }
        );
      }
    }

    if (
      plan.mode === "actions" &&
      plan.actions.length
    ) {
      const confirmation =
        confirmationForPlan(plan);

      if (
        confirmation.required
      ) {
        const planDisplay =
          clientPlan(plan);

        const persistedAssistant =
          await saveMessage({
            supabase,
            conversation,
            access,
            role: "assistant",
            content:
              plan.summary ||
              "I prepared the requested SaiNal One actions. Please review them before I run them.",
            plan,
            planDisplay,
            confirmationReason:
              confirmation.reason,
            planStatus: "pending",
          });

        return NextResponse.json({
          answer:
            persistedAssistant.content,
          requires_confirmation:
            true,
          confirmation_reason:
            confirmation.reason,
          plan,
          plan_display:
            planDisplay,
          conversation_id:
            conversation.id,
          user_message_id:
            persistedUser.id,
          message_id:
            persistedAssistant.id,
          created_at:
            persistedAssistant.created_at,
        });
      }

      const execution =
        await executePlan({
          plan,
          access,
          businessData,
          permissions:
            businessData.permissions,
          employees:
            businessData.employees,
          profile:
            businessData.profile,
          openai,
        });

      const persistedAssistant =
        await saveMessage({
          supabase,
          conversation,
          access,
          role: "assistant",
          content:
            execution.answer ||
            "AI Agent execution completed.",
        });

      return NextResponse.json({
        answer:
          persistedAssistant.content,
        executed: true,
        success:
          execution.success,
        results:
          execution.results,
        conversation_id:
          conversation.id,
        user_message_id:
          persistedUser.id,
        message_id:
          persistedAssistant.id,
        created_at:
          persistedAssistant.created_at,
      });
    }

    const answer =
      await answerGeneral({
        prompt,
        conversation:
          conversationContext,
        profile:
          businessData.profile,
        businessData,
        timezone,
      });

    const persistedAssistant =
      await saveMessage({
        supabase,
        conversation,
        access,
        role: "assistant",
        content: answer,
      });

    return NextResponse.json({
      answer:
        persistedAssistant.content,
      conversation_id:
        conversation.id,
      user_message_id:
        persistedUser.id,
      message_id:
        persistedAssistant.id,
      created_at:
        persistedAssistant.created_at,
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
          "AI Assistant failed.",
      },
      {
        status:
          error.status || 500,
      }
    );
  }
}
