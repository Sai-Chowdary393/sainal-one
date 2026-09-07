import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerAccess } from "../../../lib/serverAccess";
import { getRecordPermissions, getTeamEmployeeIds, loadAssignableEmployees } from "../../../lib/recordAccess";
import { createAdminSupabaseClient } from "../../../lib/supabaseAdmin";
import { getBusinessProfile, businessProfilePrompt } from "../../../lib/ai/businessProfile";
import { planRequest, sanitisePlan, confirmationForPlan, clientPlan, executePlan } from "../../../lib/ai/agentEngine";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODULES = {
  leads: { table: "leads", prefix: "leads", module: "Leads", ownerField: "owner_employee_id" },
  quotes: { table: "quotes", prefix: "quotes", module: "Quotes", ownerField: "owner_employee_id" },
  proposals: { table: "proposals", prefix: "proposals", module: "Proposals", ownerField: "owner_employee_id" },
  customers: { table: "customers", prefix: "customers", module: "Customers", ownerField: "owner_employee_id" },
  projects: { table: "projects", prefix: "projects", module: "Projects", ownerField: "owner_employee_id" },
  tasks: { table: "tasks", prefix: "tasks", module: "Tasks", ownerField: "assigned_employee_id" },
  invoices: { table: "invoices", prefix: "invoices", module: "Invoices", ownerField: "owner_employee_id" },
  followUps: { table: "follow_ups", prefix: "followups", module: "Follow-ups", ownerField: "assigned_employee_id" },
};

function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function normalise(value) { return String(value || "").trim().toLowerCase(); }
function canView(perms) { return Boolean(perms.canViewAll || perms.canViewTeam || perms.canViewOwn); }
function safeConversation(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && ["user", "assistant"].includes(item.role) && clean(item.content)).slice(-10).map((item) => ({ role: item.role, content: clean(item.content).slice(0, 5000) }));
}
function pick(record, fields) {
  const out = {};
  for (const field of fields) {
    const value = record?.[field];
    if (value !== undefined && value !== null && value !== "") out[field] = value;
  }
  return out;
}
function compact(records, fields, max = 100) { return (records || []).slice(0, max).map((record) => pick(record, fields)); }
function ids(records) { return new Set((records || []).map((item) => item.id).filter(Boolean)); }

async function loadModule(access, config) {
  const permissions = getRecordPermissions(access, { prefix: config.prefix, module: config.module });
  if (!canView(permissions)) return { records: [], permissions };
  let query = access.supabase.from(config.table).select("*").eq("organization_id", access.employee.organization_id);
  if (!permissions.canViewAll && permissions.canViewTeam) {
    const teamIds = await getTeamEmployeeIds({ supabase: access.supabase, employee: access.employee });
    if (!teamIds?.length) return { records: [], permissions };
    query = query.in(config.ownerField, teamIds);
  } else if (!permissions.canViewAll && permissions.canViewOwn) {
    query = query.eq(config.ownerField, access.employee.id);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { records: data || [], permissions };
}

async function loadProfile(access) {
  const { data, error } = await access.supabase.from("company_settings").select("*").eq("organization_id", access.employee.organization_id).limit(1);
  if (error) throw new Error(error.message);
  return getBusinessProfile(data?.[0] || null);
}

async function loadEmails(access, data) {
  const supabase = createAdminSupabaseClient();
  const { data: rows, error } = await supabase.from("email_logs").select("id,recipient,subject,email_type,related_record_id,related_record_number,status,sent_at,created_at,message_body,error_message").eq("organization_id", access.employee.organization_id).order("created_at", { ascending: false }).limit(150);
  if (error) return [];
  if (access.employee.is_organization_owner) return rows || [];
  const allowed = { lead: ids(data.leads), quote: ids(data.quotes), proposal: ids(data.proposals), customer: ids(data.customers), project: ids(data.projects), invoice: ids(data.invoices) };
  return (rows || []).filter((row) => row.related_record_id && allowed[normalise(row.email_type)]?.has(row.related_record_id));
}

async function loadBusinessData(access) {
  const [profile, leadsR, quotesR, proposalsR, customersR, projectsR, tasksR, invoicesR, followUpsR] = await Promise.all([
    loadProfile(access), loadModule(access, MODULES.leads), loadModule(access, MODULES.quotes), loadModule(access, MODULES.proposals), loadModule(access, MODULES.customers), loadModule(access, MODULES.projects), loadModule(access, MODULES.tasks), loadModule(access, MODULES.invoices), loadModule(access, MODULES.followUps),
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
    permissions: { leads: leadsR.permissions, quotes: quotesR.permissions, proposals: proposalsR.permissions, customers: customersR.permissions, projects: projectsR.permissions, tasks: tasksR.permissions, invoices: invoicesR.permissions, followUps: followUpsR.permissions },
  };
  businessData.emails = await loadEmails(access, businessData);
  const canAssign = access.employee.is_organization_owner || Object.values(businessData.permissions).some((permission) => permission.canAssign);
  businessData.employees = canAssign ? await loadAssignableEmployees({ supabase: createAdminSupabaseClient(), organizationId: access.employee.organization_id }) : [];
  return businessData;
}

function compactBusiness(data) {
  return {
    leads: compact(data.leads, ["id","name","company","email","phone","status","value","source","ai_score","ai_summary","ai_next_action"]),
    customers: compact(data.customers, ["id","customer_name","company","email","phone","status","lead_id"]),
    projects: compact(data.projects, ["id","project_name","customer_id","description","status","start_date","due_date","amount"]),
    tasks: compact(data.tasks, ["id","task_name","project_id","status","priority","due_date","assigned_employee_id"], 150),
    quotes: compact(data.quotes, ["id","quote_number","lead_id","customer_id","client","contact","email","service","amount","status"]),
    proposals: compact(data.proposals, ["id","proposal_number","lead_id","customer_id","quote_id","client","contact","email","title","service","amount","status"]),
    invoices: compact(data.invoices, ["id","invoice_number","customer_id","project_id","quote_id","client","service","amount","total_amount","status","due_date"]),
    followUps: compact(data.followUps, ["id","activity_type","related_type","related_id","title","note","due_date","scheduled_at","status","assigned_employee_id"], 150),
    emails: compact(data.emails, ["id","recipient","subject","email_type","related_record_id","related_record_number","status","sent_at","message_body"], 100),
  };
}

async function answerGeneral({ prompt, conversation, profile, businessData, timezone }) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `You are SaiNal One AI Operations Manager.\n\nCurrent server date/time: ${new Date().toISOString()}\nUser timezone: ${timezone}\n\nBusiness profile:\n${businessProfilePrompt(profile)}\n\nUse only supplied current business data. Records are already permission filtered. Never invent hidden records. Conversation history is context only; current records override prior chat statements. Analyse Leads, Customers, Projects, Tasks, Quotes, Proposals, Invoices, Follow-ups/Calendar activities and Email history. Use professional UK business language. Prioritise urgent actions. Do not claim an action was executed unless the system executed it.`,
      },
      { role: "user", content: `CURRENT BUSINESS DATA:\n${JSON.stringify(compactBusiness(businessData))}` },
      ...conversation,
      { role: "user", content: prompt },
    ],
  });
  return response.choices?.[0]?.message?.content || "No response was generated.";
}

export async function POST(request) {
  try {
    const access = await getServerAccess();
    if (!access.employee) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI service is not configured." }, { status: 500 });

    let body = {};
    try { body = await request.json(); } catch {}

    const timezone = clean(body.timezone) || "UTC";
    const conversation = safeConversation(body.conversation);
    const businessData = await loadBusinessData(access);

    if (clean(body.mode) === "execute_plan") {
      const plan = sanitisePlan(body.plan);
      if (plan.mode !== "actions" || !plan.actions.length) return NextResponse.json({ error: "There are no valid AI actions to execute." }, { status: 400 });
      const execution = await executePlan({ plan, access, businessData, permissions: businessData.permissions, employees: businessData.employees, profile: businessData.profile, openai });
      return NextResponse.json({ answer: execution.answer, executed: true, success: execution.success, results: execution.results });
    }

    const prompt = clean(body.prompt);
    if (!prompt) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

    const plan = await planRequest({
      openai,
      prompt,
      conversation,
      businessData: compactBusiness(businessData),
      employees: businessData.employees.map((employee) => ({ id: employee.id, full_name: employee.full_name, email: employee.email, job_title: employee.job_title })),
      timezone,
      currentTime: new Date().toISOString(),
    });

    if (plan.mode === "actions" && plan.actions.length) {
      const confirmation = confirmationForPlan(plan);
      if (confirmation.required) {
        return NextResponse.json({
          answer: plan.summary || "I prepared the requested SaiNal One actions. Please review them before I run them.",
          requires_confirmation: true,
          confirmation_reason: confirmation.reason,
          plan,
          plan_display: clientPlan(plan),
        });
      }
      const execution = await executePlan({ plan, access, businessData, permissions: businessData.permissions, employees: businessData.employees, profile: businessData.profile, openai });
      return NextResponse.json({ answer: execution.answer, executed: true, success: execution.success, results: execution.results });
    }

    const answer = await answerGeneral({ prompt, conversation, profile: businessData.profile, businessData, timezone });
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("AI Assistant error:", error);
    return NextResponse.json({ error: error.message || "AI Assistant failed." }, { status: error.status || 500 });
  }
}
