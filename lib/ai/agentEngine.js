import { Resend } from "resend";
import { createAdminSupabaseClient } from "../supabaseAdmin";
import { createLeadFromPrompt } from "../services/leadService";
import { createQuoteFromPrompt } from "../services/quoteService";
import { createProposalFromPrompt } from "../services/proposalService";
import { convertQuoteToInvoice } from "../services/invoiceService";
import { convertLeadToCustomerAndProject } from "../services/customerProjectService";
import { canViewOwnedRecord, getRecordPermissions } from "../recordAccess";

const ACTIONS = new Set([
  "create_lead", "update_lead", "convert_lead", "create_quote", "create_proposal",
  "update_customer", "update_project", "create_task", "update_task",
  "create_activity", "update_activity", "create_invoice_from_quote",
  "update_quote", "update_proposal", "record_invoice_payment",
  "mark_invoice_paid", "draft_email", "send_email",
]);

const LEAD_STATUSES = ["New", "Contacted", "Proposal Sent", "Follow Up", "Won", "Lost"];
const PROJECT_STATUSES = ["Planning", "In Progress", "On Hold", "Completed", "Cancelled"];
const TASK_STATUSES = ["Open", "Pending", "To Do", "In Progress", "Completed", "Blocked", "Cancelled"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const ACTIVITY_TYPES = ["Follow-up", "Call", "Meeting", "Demo", "Email"];
const ACTIVITY_STATUSES = ["Pending", "Scheduled", "In Progress", "Completed", "No Answer", "Rescheduled", "Cancelled"];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function byId(records, id) {
  return (records || []).find((item) => String(item?.id || "") === String(id || "")) || null;
}

function permissionError(message) {
  const error = new Error(message);
  error.status = 403;
  return error;
}

function stripFence(value) {
  return clean(value).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function parseJson(value) {
  const text = stripFence(value);
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

export function sanitisePlan(raw) {
  const actions = Array.isArray(raw?.actions)
    ? raw.actions
        .filter((item) => item && ACTIONS.has(clean(item.type)))
        .slice(0, 12)
        .map((item) => ({
          type: clean(item.type),
          label: clean(item.label) || clean(item.type).replace(/_/g, " "),
          reason: clean(item.reason),
          data: item.data && typeof item.data === "object" ? item.data : {},
        }))
    : [];

  return {
    mode: actions.length ? "actions" : "analysis",
    summary: clean(raw?.summary),
    actions,
  };
}

export async function planRequest({ openai, prompt, conversation, businessData, employees, timezone, currentTime, localTime, forceActions = false }) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the SaiNal One AI Agent Planner.\n\nCurrent server time: ${currentTime}\nUser timezone: ${timezone}\nUser local date/time: ${localTime}\n\nReturn JSON only.\n\nIf the user is only asking for analysis/information, return {"mode":"analysis","summary":"","actions":[]}.\n\nIf the user asks SaiNal One to create, update, schedule, send, convert, complete, cancel, reopen, assign, record or otherwise change CRM data, you MUST return mode actions. Never answer an action request as prose. ${forceActions ? "This request has already been deterministically identified as an action request, so mode MUST be actions with at least one valid action." : ""}\n\nIf the user asks SaiNal One to perform CRM work, return {"mode":"actions","summary":"...","actions":[...]}.\n\nAllowed actions:\ncreate_lead {prompt}\nupdate_lead {record_id, updates}\nconvert_lead {record_id}\ncreate_quote {record_id, record_type:"Lead|Customer", amount, instructions}\ncreate_proposal {record_id, record_type:"Lead|Customer|Quote", instructions}\nupdate_customer {record_id, updates}\nupdate_project {record_id, updates, reopen}\ncreate_task {project_id, task_name, description, status, priority, due_date, assigned_employee_id}\nupdate_task {record_id, updates}\ncreate_activity {activity_type:"Follow-up|Call|Meeting|Demo", related_type:"General|Lead|Customer|Quote|Proposal|Project|Invoice", related_id, title, note, due_date, scheduled_at, assigned_employee_id}\nupdate_activity {record_id, updates}\ncreate_invoice_from_quote {quote_id}\nmark_invoice_paid {record_id}\ndraft_email {related_type:"General|Lead|Customer|Project", related_id, to, subject, message, instructions}\nsend_email {related_type:"General|Lead|Customer|Project", related_id, to, subject, message}\n\nRules:\n- Only use IDs present in supplied business data/employees.\n- Never invent IDs or email addresses.\n- Convert relative dates using the user's timezone.\n- Calls/meetings/demos with a time must have scheduled_at as ISO-8601.\n- For later actions that need a newly created record, use references like $1.customer.id, $1.customer.email, $1.project.id.\n- Keep messages professional UK business language.\n- If the user says draft, prepare, write or compose an email but does NOT explicitly ask to send it, use draft_email, never send_email.\n- Use send_email only when the user explicitly asks to send or deliver the email.\n- Every distinct requested CRM operation must have a corresponding action. Do not silently omit one action from a multi-action request.\n- For update actions include only fields the user actually requested.`,
      },
      {
        role: "user",
        content: `BUSINESS DATA:\n${JSON.stringify(businessData)}\n\nEMPLOYEES:\n${JSON.stringify(employees)}\n\nRECENT CONVERSATION:\n${JSON.stringify(conversation)}\n\nUSER REQUEST:\n${prompt}`,
      },
    ],
  });

  return sanitisePlan(parseJson(response.choices?.[0]?.message?.content || "") || {});
}


function textIncludes(haystack, needle) {
  const left = normalise(haystack);
  const right = normalise(needle);
  return Boolean(right && left.includes(right));
}

function contextText(prompt, conversation) {
  return [
    ...(Array.isArray(conversation) ? conversation.slice(-8).map((item) => item?.content || "") : []),
    prompt || "",
  ].join(" ");
}

function recordDisplayName(record) {
  return clean(record?.name) ||
    clean(record?.customer_name) ||
    clean(record?.company) ||
    clean(record?.project_name) ||
    clean(record?.client) ||
    clean(record?.contact) ||
    clean(record?.quote_number) ||
    clean(record?.invoice_number) ||
    "";
}

function scorePerson(record, text) {
  const candidates = [
    record?.name,
    record?.customer_name,
    record?.company,
    record?.email,
  ].filter(Boolean);

  let score = 0;
  for (const candidate of candidates) {
    const value = normalise(candidate);
    if (!value) continue;
    if (textIncludes(text, value)) score += value.includes("@") ? 8 : 10;

    const parts = value.split(/\s+/).filter((part) => part.length >= 3);
    for (const part of parts) {
      if (textIncludes(text, part)) score += 2;
    }
  }
  return score;
}

function bestPersonMatch(text, businessData) {
  const leads = (businessData?.leads || []).map((record) => ({ type: "Lead", record, score: scorePerson(record, text) }));
  const customers = (businessData?.customers || []).map((record) => ({ type: "Customer", record, score: scorePerson(record, text) }));
  const matches = [...leads, ...customers]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) return null;
  const top = matches[0];
  const tied = matches.filter((item) => item.score === top.score);

  if (tied.length > 1) {
    const exactCompany = tied.find((item) => textIncludes(text, item.record?.company));
    if (exactCompany) return exactCompany;
  }
  return top;
}

function linkedCustomer(person, businessData) {
  if (!person) return null;
  if (person.type === "Customer") return person.record;

  const lead = person.record;
  const byLeadId = (businessData?.customers || []).find(
    (customer) => String(customer?.lead_id || "") === String(lead?.id || "")
  );
  if (byLeadId) return byLeadId;

  const byEmail = (businessData?.customers || []).find(
    (customer) => normalise(customer?.email) && normalise(customer.email) === normalise(lead?.email)
  );
  if (byEmail) return byEmail;

  return (businessData?.customers || []).find(
    (customer) =>
      normalise(customer?.company) &&
      normalise(lead?.company) &&
      normalise(customer.company) === normalise(lead.company)
  ) || null;
}

function bestProjectMatch(text, person, businessData) {
  const projects = businessData?.projects || [];
  if (!projects.length) return null;

  const direct = projects
    .map((project) => {
      let score = 0;
      if (textIncludes(text, project?.project_name)) score += 20;
      if (textIncludes(text, project?.description)) score += 4;
      const nameParts = normalise(project?.project_name).split(/\s+/).filter((part) => part.length >= 4);
      for (const part of nameParts) if (textIncludes(text, part)) score += 1;
      return { project, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (direct[0]?.score >= 8) return direct[0].project;

  const customer = linkedCustomer(person, businessData);
  if (customer?.id) {
    const linked = projects.filter(
      (project) => String(project?.customer_id || "") === String(customer.id)
    );
    const active = linked.find((project) => !["completed", "cancelled"].includes(normalise(project?.status)));
    if (active) return active;
    if (linked.length === 1) return linked[0];
    if (linked.length > 1) return linked[0];
  }

  const personRecord = person?.record;
  const terms = [
    personRecord?.name,
    personRecord?.customer_name,
    personRecord?.company,
    customer?.customer_name,
    customer?.company,
  ].filter(Boolean);

  const nameLinked = projects.find((project) =>
    terms.some((term) => textIncludes(project?.project_name, term) || textIncludes(project?.description, term))
  );
  if (nameLinked) return nameLinked;

  if (projects.length === 1) return projects[0];
  return null;
}

function timezoneDateParts(timezone, date = new Date()) {
  const safeTimezone = clean(timezone) || "UTC";
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function addDaysToDateOnly(parts, amount) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return utc.toISOString().slice(0, 10);
}

function resolveRelativeDate(text, timezone) {
  const value = normalise(text);
  const today = timezoneDateParts(timezone);

  if (/\btoday\b/.test(value)) return addDaysToDateOnly(today, 0);
  if (/\btomorrow\b/.test(value)) return addDaysToDateOnly(today, 1);

  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const requested = weekdayNames.findIndex((name) => new RegExp(`\\b(?:next\\s+)?${name}\\b`).test(value));
  if (requested >= 0) {
    const base = new Date(Date.UTC(today.year, today.month - 1, today.day));
    const current = base.getUTCDay();
    let delta = (requested - current + 7) % 7;
    if (delta === 0) delta = 7;
    if (new RegExp(`\\bnext\\s+${weekdayNames[requested]}\\b`).test(value) && delta < 7) {
      // "next Friday" means the next occurrence; this intentionally avoids jumping two weeks.
    }
    return addDaysToDateOnly(today, delta);
  }

  const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  return null;
}

function extractTime(text) {
  const match = String(text || "").match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = normalise(match[3]);

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}


function zonedLocalDateTimeToUtc(dateOnly, timeOnly, timezone) {
  const dateMatch = String(dateOnly || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(timeOnly || "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] || 0);
  const safeTimezone = clean(timezone) || "UTC";

  // Start by treating the requested wall-clock components as UTC, then
  // iteratively correct by the difference between that instant as displayed
  // in the requested IANA timezone and the requested local wall-clock time.
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  }

  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(guess)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

    const displayedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );

    const correction = targetAsUtc - displayedAsUtc;
    if (correction === 0) break;
    guess = new Date(guess.getTime() + correction);
  }

  return guess.toISOString();
}

function cleanTaskTitle(value) {
  let title = String(value || "").trim().replace(/[.]+$/, "");

  // Remove only a trailing relationship clause such as:
  // "for Daniel's project" / "for Daniel Reed's project".
  // Do NOT remove ordinary title text such as "Prepare for Daniel project meeting".
  title = title.replace(
    /\s+for\s+.+?(?:'s|'s)\s+project\s*$/i,
    ""
  ).trim();

  return title;
}

function extractTaskName(prompt, person) {
  const text = String(prompt || "").trim();

  // Handles:
  // "Create a task for Emma's project called Prepare onboarding documents due tomorrow"
  // "Add task for Daniel's project named Prepare kickoff pack"
  const projectCalled = text.match(
    /\btask\s+for\s+.+?(?:'s|'s)?\s*project\s+(?:called|named)\s+(.+?)(?=\s+due\s+|\s+by\s+|\s+assigned\s+to\s+|$)/i
  );
  if (projectCalled?.[1]) return cleanTaskTitle(projectCalled[1]);

  // For an explicitly named task, keep everything up to date/assignment
  // language. "for" may be a legitimate part of the task title.
  const called = text.match(
    /\btask\s+(?:called|named)\s+(.+?)(?=\s+due\s+|\s+by\s+|\s+assigned\s+to\s+|$)/i
  );
  if (called?.[1]) return cleanTaskTitle(called[1]);

  const toDo = text.match(
    /\btask\s+to\s+(.+?)(?=\s+due\s+|\s+by\s+|\s+assigned\s+to\s+|$)/i
  );
  if (toDo?.[1]) return cleanTaskTitle(toDo[1]);

  const simple = text.match(
    /\bcreate\s+(?:a\s+)?task\s+(.+?)(?=\s+due\s+|\s+by\s+|\s+assigned\s+to\s+|$)/i
  );
  if (simple?.[1] && !/^for\b/i.test(simple[1].trim())) {
    return cleanTaskTitle(simple[1]);
  }

  const name = recordDisplayName(person?.record);
  return name ? `Task for ${name}` : "New task";
}

function activityTypeFromPrompt(prompt) {
  const text = normalise(prompt);
  if (/\bmeeting\b/.test(text)) return "Meeting";
  if (/\bdemo\b/.test(text)) return "Demo";
  if (/\bcall\b/.test(text)) return "Call";
  if (/\bfollow[- ]?up\b/.test(text)) return "Follow-up";
  return null;
}

function makeActivityTitle(type, person) {
  const name = recordDisplayName(person?.record);
  return name ? `${type} with ${name}` : type;
}

function resolveRecordByText(collection, text, fields) {
  const scored = (collection || []).map((record) => {
    let score = 0;
    for (const field of fields) {
      const value = record?.[field];
      if (!value) continue;
      if (textIncludes(text, value)) score += 10;
    }
    return { record, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

  return scored[0]?.record || null;
}


function moneyValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractMoneyFromPrompt(prompt) {
  const match = String(prompt || "").match(/(?:£\s*|gbp\s*)([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function bestTaskMatch(text, businessData) {
  return resolveRecordByText(
    businessData?.tasks,
    text,
    ["task_name", "description"]
  );
}

function bestActivityMatch(text, businessData) {
  return resolveRecordByText(
    businessData?.followUps,
    text,
    ["title", "note"]
  );
}

function bestQuoteMatch(text, businessData) {
  return resolveRecordByText(
    businessData?.quotes,
    text,
    ["quote_number", "client", "contact", "email", "service"]
  );
}

function bestProposalMatch(text, businessData) {
  return resolveRecordByText(
    businessData?.proposals,
    text,
    ["proposal_number", "client", "contact", "email", "title", "service"]
  );
}

function bestInvoiceMatch(text, businessData) {
  return resolveRecordByText(
    businessData?.invoices,
    text,
    ["invoice_number", "client", "service"]
  );
}

function normaliseRequestedStatus(prompt, allowedStatuses) {
  const text = normalise(prompt);
  return allowedStatuses.find((status) => {
    const value = normalise(status);
    return text.includes(value);
  }) || null;
}

function extractDeterministicLeadUpdates(prompt) {
  const source = String(prompt || "").trim();
  const updates = {};

  const statusMatch = source.match(
    /\b(?:lead\s+)?status\s+(?:to|as)\s+(New|Contacted|Proposal Sent|Follow Up|Won|Lost)\b/i
  );
  if (statusMatch?.[1]) {
    const matched = LEAD_STATUSES.find(
      (status) => normalise(status) === normalise(statusMatch[1])
    );
    if (matched) updates.status = matched;
  } else if (
    /\b(mark|set|change|update)\b[\s\S]{0,60}\blead\b/i.test(source)
  ) {
    const requestedStatus = normaliseRequestedStatus(source, LEAD_STATUSES);
    if (requestedStatus) updates.status = requestedStatus;
  }

  const valueMatch = source.match(
    /\b(?:estimated\s+)?value\s+(?:to|as|is)\s+((?:£\s*|gbp\s*)?[\d,]+(?:\.\d{1,2})?)/i
  );
  if (valueMatch?.[1]) updates.value = valueMatch[1].trim();

  const emailMatch = source.match(
    /\bemail(?:\s+address)?\s+(?:to|as|is)\s+([^\s,;]+@[^\s,;]+\.[^\s,;]+)/i
  );
  if (emailMatch?.[1]) updates.email = emailMatch[1].trim();

  const phoneMatch = source.match(
    /\b(?:phone|telephone|mobile)(?:\s+number)?\s+(?:to|as|is)\s+([+()0-9][+()0-9\s-]{5,})\s*[.!]?\s*$/i
  );
  if (phoneMatch?.[1]) updates.phone = phoneMatch[1].trim();

  const companyMatch = source.match(
    /\bcompany\s+(?:to|as|is)\s+(.+?)\s*[.!]?\s*$/i
  );
  if (companyMatch?.[1]) updates.company = companyMatch[1].trim();

  const notesMatch = source.match(
    /\b(?:lead\s+)?notes?\s+(?:to|as)\s+(.+?)\s*[.!]?\s*$/i
  );
  if (notesMatch?.[1]) updates.notes = notesMatch[1].trim();

  const sourceMatch = source.match(
    /\b(?:lead\s+)?source\s+(?:to|as)\s+(.+?)\s*[.!]?\s*$/i
  );
  if (sourceMatch?.[1]) updates.source = sourceMatch[1].trim();

  return updates;
}

export function resolvePlanAgainstBusinessData({ plan, prompt, conversation, businessData, employees, timezone }) {
  const safePlan = sanitisePlan(plan);
  if (safePlan.mode !== "actions") return safePlan;

  const text = contextText(prompt, conversation);
  const person = bestPersonMatch(text, businessData);
  const project = bestProjectMatch(text, person, businessData);
  const relativeDate = resolveRelativeDate(prompt, timezone);
  const time = extractTime(prompt);

  const actions = safePlan.actions.map((action) => {
    const data = { ...(action.data || {}) };

    if (action.type === "create_task") {
      if (!data.project_id && project?.id) data.project_id = project.id;

      const requestedTaskName = extractTaskName(prompt, person);
      const hasExplicitTaskName =
        /\btask\s+(?:called|named)\s+/i.test(String(prompt || "")) ||
        /\btask\s+for\s+.+?(?:'s|'s)?\s*project\s+(?:called|named)\s+/i.test(String(prompt || "")) ||
        /\btask\s+to\s+/i.test(String(prompt || ""));

      // When the user explicitly names the task, their wording wins over
      // a shortened planner title (for example "Prepare" instead of
      // "Prepare for Daniel project meeting").
      if (hasExplicitTaskName && requestedTaskName) {
        data.task_name = requestedTaskName;
      } else if (!clean(data.task_name)) {
        data.task_name = requestedTaskName;
      }

      if (!data.due_date && relativeDate) data.due_date = relativeDate;
    }

    if (action.type === "create_activity") {
      const activityType = clean(data.activity_type) || activityTypeFromPrompt(prompt) || "Follow-up";
      data.activity_type = activityType;

      // Planner output may contain a timezone-less ISO local datetime.
      // Convert that wall-clock time using the user's IANA timezone before
      // writing it to the timestamptz column.
      const plannerLocal = clean(data.scheduled_at).match(
        /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/
      );
      if (plannerLocal) {
        data.scheduled_at = zonedLocalDateTimeToUtc(
          plannerLocal[1],
          plannerLocal[2],
          timezone
        );
      }

      if (!data.related_id && person?.record?.id) {
        data.related_type = person.type;
        data.related_id = person.record.id;
      }

      if (!clean(data.title)) data.title = makeActivityTitle(activityType, person);
      if (!data.due_date && relativeDate) data.due_date = relativeDate;
      if (!data.scheduled_at && relativeDate && time) {
        data.scheduled_at = zonedLocalDateTimeToUtc(relativeDate, time, timezone);
      }
    }

    if (["draft_email", "send_email"].includes(action.type)) {
      const customer = linkedCustomer(person, businessData);
      const related = customer || person?.record || null;
      if (!data.related_id && related?.id) {
        data.related_type = customer ? "Customer" : person?.type || "General";
        data.related_id = related.id;
      }
      if (!clean(data.to)) data.to = clean(customer?.email) || clean(person?.record?.email);
      if (action.type === "draft_email" && !clean(data.instructions)) {
        data.instructions = clean(prompt);
      }
    }

    if (action.type === "convert_lead" && !data.record_id) {
      const lead = person?.type === "Lead" ? person.record : resolveRecordByText(businessData?.leads, text, ["name", "company", "email"]);
      if (lead?.id) data.record_id = lead.id;
    }

    if (action.type === "update_project" && !data.record_id && project?.id) data.record_id = project.id;

    if (action.type === "update_customer" && !data.record_id) {
      const customer = linkedCustomer(person, businessData);
      if (customer?.id) data.record_id = customer.id;
    }

    if (action.type === "update_lead") {
      if (!data.record_id) {
        const lead = person?.type === "Lead" ? person.record : resolveRecordByText(businessData?.leads, text, ["name", "company", "email"]);
        if (lead?.id) data.record_id = lead.id;
      }

      data.updates =
        data.updates && typeof data.updates === "object"
          ? { ...data.updates }
          : {};

      const deterministicUpdates = extractDeterministicLeadUpdates(prompt);
      for (const [field, value] of Object.entries(deterministicUpdates)) {
        if (!Object.prototype.hasOwnProperty.call(data.updates, field)) {
          data.updates[field] = value;
        }
      }

      const wantsAssignment =
        /\b(assign|reassign|owner)\b/i.test(String(prompt || ""));

      if (
        wantsAssignment &&
        !Object.prototype.hasOwnProperty.call(data.updates, "owner_employee_id")
      ) {
        const employeeMatches = (employees || [])
          .map((employee) => ({
            employee,
            name: clean(employee?.full_name) || clean(employee?.name),
          }))
          .filter((item) => item.name && textIncludes(prompt, item.name));

        if (employeeMatches.length === 1) {
          data.updates.owner_employee_id = employeeMatches[0].employee.id;
        }
      }
    }

    if (action.type === "create_quote" && !data.record_id) {
      const customer = linkedCustomer(person, businessData);
      const source = customer || person?.record || null;
      if (source?.id) {
        data.record_id = source.id;
        data.record_type = customer ? "Customer" : person?.type || "Lead";
      }
    }

    if (action.type === "create_proposal" && !data.record_id) {
      const quote = bestQuoteMatch(text, businessData);
      const customer = linkedCustomer(person, businessData);
      const source = quote || customer || person?.record || null;
      if (source?.id) {
        data.record_id = source.id;
        data.record_type = quote ? "Quote" : customer ? "Customer" : person?.type || "Lead";
      }
    }

    if (action.type === "update_task" && !data.record_id) {
      const task = bestTaskMatch(text, businessData);
      if (task?.id) data.record_id = task.id;
    }

    if (action.type === "update_activity" && !data.record_id) {
      const activity = bestActivityMatch(text, businessData);
      if (activity?.id) data.record_id = activity.id;
    }

    if (action.type === "update_quote" && !data.record_id) {
      const quote = bestQuoteMatch(text, businessData);
      if (quote?.id) data.record_id = quote.id;
    }

    if (action.type === "update_proposal" && !data.record_id) {
      const proposal = bestProposalMatch(text, businessData);
      if (proposal?.id) data.record_id = proposal.id;
    }

    if (action.type === "create_invoice_from_quote" && !data.quote_id) {
      const quote = bestQuoteMatch(text, businessData);
      if (quote?.id) data.quote_id = quote.id;
    }

    if (["record_invoice_payment", "mark_invoice_paid"].includes(action.type) && !data.record_id) {
      const invoice = bestInvoiceMatch(text, businessData);
      if (invoice?.id) data.record_id = invoice.id;
    }

    if (action.type === "record_invoice_payment" && !moneyValue(data.amount)) {
      const requestedAmount = extractMoneyFromPrompt(prompt);
      if (requestedAmount) data.amount = requestedAmount;
    }

    return { ...action, data };
  });

  return sanitisePlan({ ...safePlan, actions });
}

export function buildDeterministicPlan({ prompt, conversation, businessData, timezone }) {
  const text = contextText(prompt, conversation);
  const request = normalise(prompt);
  const person = bestPersonMatch(text, businessData);
  const project = bestProjectMatch(text, person, businessData);
  const relativeDate = resolveRelativeDate(prompt, timezone);
  const time = extractTime(prompt);
  const actions = [];

  // =====================================================
  // CREATE LEAD FALLBACK
  //
  // A brand-new Lead does not need an existing CRM record
  // to resolve against. If the LLM planner fails to return
  // a valid create_lead action, preserve the user's original
  // prompt and let leadService safely extract/create it.
  // =====================================================

  const wantsLead =
    /\b(create|add|make)\b[\s\S]{0,30}\b(?:new\s+)?lead\b/i.test(request) ||
    /\bnew\s+lead\b/i.test(request);

  if (wantsLead) {
    actions.push({
      type: "create_lead",
      label: "Create new lead",
      reason: "Create the requested lead in SaiNal One.",
      data: {
        prompt: String(prompt || "").trim(),
      },
    });
  }

  // =====================================================
  // UPDATE LEAD FALLBACK
  //
  // Keeps common lead edits reliable even when the model planner misses
  // an action. Destructive deletion is intentionally NOT supported here.
  // =====================================================

  const matchedLead =
    person?.type === "Lead"
      ? person.record
      : resolveRecordByText(
          businessData?.leads,
          text,
          ["name", "company", "email"]
        );

  const wantsLeadUpdate =
    /\b(update|change|edit|set|mark)\b[\s\S]{0,90}\blead\b/i.test(request) ||
    /\blead\b[\s\S]{0,90}\b(update|change|edit|set|mark)\b/i.test(request) ||
    /\b(?:lead\s+)?(?:status|value|email|phone|telephone|mobile|company|notes?|source)\s+(?:to|as|is)\b/i.test(request);

  if (wantsLeadUpdate && matchedLead?.id) {
    const updates = extractDeterministicLeadUpdates(prompt);

    if (Object.keys(updates).length) {
      actions.push({
        type: "update_lead",
        label: `Update lead: ${recordDisplayName(matchedLead) || "Lead"}`,
        reason: "Apply the requested changes to the matched lead.",
        data: {
          record_id: matchedLead.id,
          updates,
        },
      });
    }
  }


  // =====================================================
  // UPDATE PROJECT FALLBACK
  //
  // Supports natural-language requests such as:
  // "Update Emma Wilson's project description to CRM setup and business automation"
  // when the LLM planner does not return a usable action.
  // =====================================================

  const wantsProjectUpdate =
    /\b(update|change|edit|set)\b[\s\S]{0,80}\bproject\b/i.test(request);

  if (wantsProjectUpdate && project?.id) {
    const updates = {};

    const descriptionMatch = String(prompt || "").match(
      /\bproject\s+description\s+(?:to|as)\s+(.+?)\s*[.!]?\s*$/i
    );

    if (descriptionMatch?.[1]) {
      updates.description = descriptionMatch[1].trim();
    }

    const nameMatch = String(prompt || "").match(
      /\bproject\s+name\s+(?:to|as)\s+(.+?)\s*[.!]?\s*$/i
    );

    if (nameMatch?.[1]) {
      updates.project_name = nameMatch[1].trim();
    }

    const statusMatch = String(prompt || "").match(
      /\b(?:project\s+)?status\s+(?:to|as)\s+(Planning|In Progress|On Hold|Completed|Cancelled)\b/i
    );

    if (statusMatch?.[1]) {
      updates.status = statusMatch[1];
    }

    const dueDateForProject = resolveRelativeDate(prompt, timezone);
    if (/\bdue\b/i.test(request) && dueDateForProject) {
      updates.due_date = dueDateForProject;
    }

    if (Object.keys(updates).length) {
      actions.push({
        type: "update_project",
        label: `Update project: ${project.project_name || "Project"}`,
        reason: "Apply the requested changes to the matched project.",
        data: {
          record_id: project.id,
          updates,
        },
      });
    }
  }

  const wantsTask = /\b(create|add|make)\b[\s\S]{0,20}\btask\b|\btask\s+to\b/i.test(request);
  if (wantsTask) {
    if (!project?.id && /\bproject\b/.test(request)) {
      return {
        mode: "analysis",
        summary: "I found the task request, but I could not uniquely match the project.",
        actions: [],
      };
    }

    actions.push({
      type: "create_task",
      label: `Create task: ${extractTaskName(prompt, person)}`,
      reason: project ? `Create the task against ${project.project_name}.` : "Create the requested task.",
      data: {
        project_id: project?.id || null,
        task_name: extractTaskName(prompt, person),
        status: "Pending",
        priority: "Medium",
        due_date: relativeDate,
      },
    });
  }

  const activityType = activityTypeFromPrompt(prompt);
  const wantsSchedule = /\b(schedule|book|arrange|set up)\b/.test(request) && Boolean(activityType);
  if (wantsSchedule) {
    if (!person?.record?.id) {
      return {
        mode: "analysis",
        summary: `I understood that you want to schedule a ${normalise(activityType)}, but I could not uniquely match the related CRM record.`,
        actions: [],
      };
    }

    actions.push({
      type: "create_activity",
      label: `Schedule ${normalise(activityType)} with ${recordDisplayName(person.record)}`,
      reason: "Add the activity to the SaiNal One calendar/activity centre.",
      data: {
        activity_type: activityType,
        related_type: person.type,
        related_id: person.record.id,
        title: makeActivityTitle(activityType, person),
        due_date: relativeDate,
        scheduled_at: relativeDate && time
          ? zonedLocalDateTimeToUtc(relativeDate, time, timezone)
          : null,
        status: time ? "Scheduled" : "Pending",
      },
    });
  }

  const emailDraftRequested =
    /\b(draft|write|compose|prepare)\b[\s\S]{0,45}\bemail\b/i.test(String(prompt || ""));

  const emailSendRequested =
    /\bsend\b[\s\S]{0,45}\bemail\b/i.test(String(prompt || "")) ||
    /\bemail\b[\s\S]{0,25}\b(?:send|deliver)\b/i.test(String(prompt || ""));

  if (emailDraftRequested || emailSendRequested) {
    const customer = linkedCustomer(person, businessData);
    const related = customer || person?.record || null;
    const to = clean(customer?.email) || clean(person?.record?.email);

    if (related?.id && to) {
      const meetingDate = relativeDate
        ? ` on ${relativeDate}${time ? ` at ${time.slice(0, 5)}` : ""}`
        : "";

      if (emailDraftRequested && !emailSendRequested) {
        actions.push({
          type: "draft_email",
          label: `Draft email to ${recordDisplayName(person?.record) || to}`,
          reason: "Prepare an editable CRM-linked email draft without sending it.",
          data: {
            related_type: customer ? "Customer" : person?.type || "General",
            related_id: related.id,
            to,
            subject: activityType ? `${activityType} follow-up` : "Follow-up",
            message: "",
            instructions: String(prompt || "").trim(),
          },
        });
      } else {
        actions.push({
          type: "send_email",
          label: `Send email to ${to}`,
          reason: "Send the requested CRM-linked email.",
          data: {
            related_type: customer ? "Customer" : person?.type || "General",
            related_id: related.id,
            to,
            subject: activityType ? `${activityType} confirmation` : "Follow-up",
            message: activityType
              ? `Hi ${recordDisplayName(person?.record) || "there"},\n\nThis is to confirm our ${normalise(activityType)}${meetingDate}.\n\nKind regards`
              : "Hi,\n\nJust following up as discussed.\n\nKind regards",
          },
        });
      }
    }
  }

  if (/\bconvert\b/.test(request) && /\b(customer|client)\b/.test(request)) {
    const lead = person?.type === "Lead"
      ? person.record
      : resolveRecordByText(businessData?.leads, text, ["name", "company", "email"]);
    if (lead?.id) {
      actions.push({
        type: "convert_lead",
        label: `Convert ${recordDisplayName(lead)} to customer`,
        reason: "Convert the matched lead into a customer and related project.",
        data: { record_id: lead.id },
      });
    }
  }

  const wantsQuote = /\b(create|generate|prepare|make)\b[\s\S]{0,30}\bquote\b/.test(request);
  if (wantsQuote) {
    const customer = linkedCustomer(person, businessData);
    const source = customer || person?.record || null;
    if (source?.id) {
      actions.push({
        type: "create_quote",
        label: `Create quote for ${recordDisplayName(source)}`,
        reason: "Create a draft quote against the matched CRM record.",
        data: {
          record_id: source.id,
          record_type: customer ? "Customer" : person?.type || "Lead",
          amount: extractMoneyFromPrompt(prompt),
          instructions: prompt,
        },
      });
    }
  }

  const wantsProposal = /\b(create|generate|prepare|make)\b[\s\S]{0,30}\bproposal\b/.test(request);
  if (wantsProposal) {
    const quote = bestQuoteMatch(text, businessData);
    const customer = linkedCustomer(person, businessData);
    const source = quote || customer || person?.record || null;
    if (source?.id) {
      actions.push({
        type: "create_proposal",
        label: `Create proposal for ${recordDisplayName(source)}`,
        reason: "Create a draft proposal against the matched CRM record.",
        data: {
          record_id: source.id,
          record_type: quote ? "Quote" : customer ? "Customer" : person?.type || "Lead",
          instructions: prompt,
        },
      });
    }
  }

  const wantsInvoiceFromQuote =
    /\b(create|generate|convert|make)\b[\s\S]{0,35}\binvoice\b/.test(request) &&
    /\bquote\b/.test(request);
  if (wantsInvoiceFromQuote) {
    const quote = bestQuoteMatch(text, businessData);
    if (quote?.id) {
      actions.push({
        type: "create_invoice_from_quote",
        label: `Create invoice from ${quote.quote_number || "quote"}`,
        reason: "Convert the matched quote into an invoice.",
        data: { quote_id: quote.id },
      });
    }
  }

  const invoice = bestInvoiceMatch(text, businessData);
  const wantsMarkPaid =
    /\b(mark|set)\b[\s\S]{0,25}\b(invoice\s+)?paid\b/.test(request) ||
    /\binvoice\b[\s\S]{0,20}\bfully paid\b/.test(request);
  const wantsRecordPayment =
    /\b(record|add|log)\b[\s\S]{0,25}\bpayment\b/.test(request);

  if (invoice?.id && wantsRecordPayment) {
    const amount = extractMoneyFromPrompt(prompt);
    if (amount) {
      actions.push({
        type: "record_invoice_payment",
        label: `Record £${amount.toFixed(2)} payment for ${invoice.invoice_number || "invoice"}`,
        reason: "Record the requested payment against the matched invoice.",
        data: {
          record_id: invoice.id,
          amount,
          notes: "Recorded through SaiNal AI after user confirmation.",
        },
      });
    }
  } else if (invoice?.id && wantsMarkPaid) {
    actions.push({
      type: "mark_invoice_paid",
      label: `Mark ${invoice.invoice_number || "invoice"} as paid`,
      reason: "Record the remaining outstanding balance and mark the invoice as paid.",
      data: { record_id: invoice.id },
    });
  }

  const task = bestTaskMatch(text, businessData);
  if (task?.id && /\b(complete|finish|cancel|block|reopen)\b/.test(request) && /\btask\b/.test(request)) {
    let status = normaliseRequestedStatus(prompt, TASK_STATUSES);
    if (!status) {
      if (/\bcomplete|finish\b/.test(request)) status = "Completed";
      else if (/\bcancel\b/.test(request)) status = "Cancelled";
      else if (/\bblock\b/.test(request)) status = "Blocked";
      else if (/\breopen\b/.test(request)) status = "In Progress";
    }
    if (status) {
      actions.push({
        type: "update_task",
        label: `${status} task: ${task.task_name}`,
        reason: "Update the matched task status.",
        data: { record_id: task.id, updates: { status } },
      });
    }
  }

  const activity = bestActivityMatch(text, businessData);
  if (activity?.id && /\b(complete|cancel|reschedule|no answer)\b/.test(request) && /\b(call|meeting|demo|follow[- ]?up|activity)\b/.test(request)) {
    let status = null;
    if (/\bcomplete\b/.test(request)) status = "Completed";
    else if (/\bcancel\b/.test(request)) status = "Cancelled";
    else if (/\bno answer\b/.test(request)) status = "No Answer";
    else if (/\breschedule\b/.test(request)) status = "Rescheduled";

    const updates = {};
    if (status) updates.status = status;
    if (/\breschedule\b/.test(request) && relativeDate && time) {
      updates.scheduled_at = zonedLocalDateTimeToUtc(relativeDate, time, timezone);
      updates.due_date = relativeDate;
    }

    if (Object.keys(updates).length) {
      actions.push({
        type: "update_activity",
        label: `${status || "Update"}: ${activity.title}`,
        reason: "Update the matched calendar/activity record.",
        data: { record_id: activity.id, updates },
      });
    }
  }

  return sanitisePlan({
    mode: actions.length ? "actions" : "analysis",
    summary: actions.length
      ? "SaiNal One prepared the requested CRM actions."
      : "I could not safely resolve the requested CRM action to a unique record.",
    actions,
  });
}


function actionCoverageKey(action) {
  const type = clean(action?.type);
  if (!type) return "";

  const data = action?.data || {};

  if (type === "create_task") {
    return `${type}:${clean(data.task_name).toLowerCase()}`;
  }

  if (type === "create_activity") {
    return `${type}:${clean(data.activity_type).toLowerCase()}`;
  }

  if (type === "draft_email" || type === "send_email") {
    return `${type}:${clean(data.to).toLowerCase()}`;
  }

  return type;
}

export function ensureRequestedActionCoverage({
  plan,
  prompt,
  conversation,
  businessData,
  timezone,
}) {
  const safePlan = sanitisePlan(plan);

  const fallback = buildDeterministicPlan({
    prompt,
    conversation,
    businessData,
    timezone,
  });

  if (
    fallback.mode !== "actions" ||
    !fallback.actions.length
  ) {
    return safePlan;
  }

  const merged = [
    ...(safePlan.mode === "actions"
      ? safePlan.actions
      : []),
  ];

  const existing = new Set(
    merged.map(actionCoverageKey)
  );

  for (const action of fallback.actions) {
    const key = actionCoverageKey(action);

    if (!key || existing.has(key)) {
      continue;
    }

    merged.push(action);
    existing.add(key);
  }

  return sanitisePlan({
    mode: merged.length
      ? "actions"
      : safePlan.mode,
    summary:
      safePlan.summary ||
      fallback.summary,
    actions: merged,
  });
}

export function confirmationForPlan(plan) {
  const actions = plan?.actions || [];
  const required = actions.length > 1 || actions.some((action) => {
    if (["convert_lead", "create_invoice_from_quote", "record_invoice_payment", "mark_invoice_paid", "send_email"].includes(action.type)) return true;
    const updates = action.data?.updates || {};
    if (Object.prototype.hasOwnProperty.call(updates, "owner_employee_id")) return true;
    if (Object.prototype.hasOwnProperty.call(updates, "assigned_employee_id")) return true;
    if (action.type === "update_project" && ["Completed", "Cancelled"].includes(updates.status)) return true;
    if ((action.type === "update_task" || action.type === "update_activity") && updates.status === "Cancelled") return true;
    return false;
  });
  return { required, reason: required ? (actions.length > 1 ? "This request will perform multiple CRM actions." : "This action changes an important business record or sends external communication.") : "" };
}

export function clientPlan(plan) {
  return {
    summary: plan.summary || "SaiNal One prepared the following actions.",
    actions: (plan.actions || []).map((action, index) => {
      const data = action.data || {};
      const updates = data.updates || {};
      const details = [];

      if (data.task_name) details.push(`Task: ${data.task_name}`);
      if (data.due_date) details.push(`Due: ${data.due_date}`);
      if (data.scheduled_at) details.push(`Scheduled: ${data.scheduled_at}`);
      if (data.to) details.push(`Recipient: ${data.to}`);
      if (data.subject) details.push(`Subject: ${data.subject}`);
      if (action.type === "draft_email") details.push("Draft only - will not be sent");
      if (data.amount !== undefined && data.amount !== null && data.amount !== "") details.push(`Amount: ${data.amount}`);
      if (data.payment_method) details.push(`Payment method: ${data.payment_method}`);
      if (updates.status) details.push(`New status: ${updates.status}`);
      if (updates.due_date) details.push(`New due date: ${updates.due_date}`);

      return {
        index: index + 1,
        type: action.type,
        label: action.label,
        reason: action.reason,
        details,
      };
    }),
  };
}

function resolvePath(object, path) {
  return String(path || "").split(".").reduce((current, key) => current?.[key], object);
}

function resolveValue(value, results) {
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, results));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValue(item, results)]));
  if (typeof value !== "string") return value;
  const match = value.match(/^\$(\d+)\.(.+)$/);
  if (!match) return value;
  const data = results[Number(match[1]) - 1]?.data;
  const resolved = resolvePath(data, match[2]);
  if (resolved === undefined || resolved === null) throw new Error(`Unable to resolve workflow reference ${value}.`);
  return resolved;
}

function requireRecord(record, label) {
  if (!record) throw permissionError(`The selected ${label} is not available with your current permissions.`);
  return record;
}

function requireEmployee(employees, id) {
  if (!id) return null;
  const employee = byId(employees, id);
  if (!employee) throw permissionError("The requested employee is not available for assignment.");
  return employee;
}

async function genericUpdate({ table, organizationId, recordId, updates, allowed }) {
  const values = {};
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates || {}, field)) values[field] = updates[field];
  }
  if (!Object.keys(values).length) throw new Error("No supported changes were provided.");
  if (["tasks", "follow_ups"].includes(table)) values.updated_at = new Date().toISOString();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from(table).update(values).eq("id", recordId).eq("organization_id", organizationId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function createTask({ organizationId, employeeId, data }) {
  const supabase = createAdminSupabaseClient();
  const taskName = clean(data.task_name);
  if (!taskName) throw new Error("Task name is required.");
  const status = clean(data.status) || "Pending";
  const priority = clean(data.priority) || "Medium";
  if (!TASK_STATUSES.includes(status)) throw new Error("Invalid task status.");
  if (!TASK_PRIORITIES.includes(priority)) throw new Error("Invalid task priority.");
  if (data.project_id) {
    const { data: project, error } = await supabase.from("projects").select("id,status").eq("id", data.project_id).eq("organization_id", organizationId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found.");
    if (normalise(project.status) === "completed") throw new Error("Tasks cannot be added to a completed project.");
  }
  const now = new Date().toISOString();
  const { data: created, error } = await supabase.from("tasks").insert([{ organization_id: organizationId, project_id: data.project_id || null, assigned_employee_id: data.assigned_employee_id || employeeId, task_name: taskName, description: clean(data.description) || null, status, priority, due_date: data.due_date || null, record_type: data.project_id ? "Project" : null, record_id: data.project_id || null, created_at: now, updated_at: now }]).select().single();
  if (error) throw new Error(error.message);
  return created;
}

async function createActivity({ organizationId, employeeId, data }) {
  const type = clean(data.activity_type) || "Follow-up";
  if (!ACTIVITY_TYPES.includes(type)) throw new Error("Invalid activity type.");
  const scheduledAt = clean(data.scheduled_at) || null;
  if (["Call", "Meeting", "Demo"].includes(type) && !scheduledAt) throw new Error(`${type} date and time are required.`);
  const status = clean(data.status) || (["Call", "Meeting", "Demo"].includes(type) ? "Scheduled" : "Pending");
  if (!ACTIVITY_STATUSES.includes(status)) throw new Error("Invalid activity status.");
  const now = new Date().toISOString();
  const supabase = createAdminSupabaseClient();
  const { data: created, error } = await supabase.from("follow_ups").insert([{ organization_id: organizationId, activity_type: type, related_type: clean(data.related_type) || "General", related_id: clean(data.related_type) === "General" ? null : data.related_id || null, title: clean(data.title) || `${type} activity`, note: clean(data.note) || null, due_date: data.due_date || null, scheduled_at: scheduledAt, completed_at: status === "Completed" ? now : null, outcome: clean(data.outcome) || null, status, assigned_employee_id: data.assigned_employee_id || employeeId, created_at: now, updated_at: now }]).select().single();
  if (error) throw new Error(error.message);
  return created;
}


async function draftEmail({
  data,
  openai,
  profile,
  access,
}) {
  const recipient =
    clean(data.to).toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      recipient
    )
  ) {
    throw new Error(
      "A valid recipient email address is required to prepare the draft."
    );
  }

  const requestedSubject =
    clean(data.subject);

  const requestedMessage =
    clean(data.message);

  const companyName =
    clean(profile?.companyName) ||
    "SaiNal Technologies Ltd";

  const employeeName =
    clean(access?.employee?.name) ||
    clean(access?.employee?.full_name) ||
    clean(
      `${access?.employee?.first_name || ""} ${access?.employee?.last_name || ""}`
    ) ||
    "SaiNal One Team";

  const jobTitle =
    clean(access?.employee?.job_title) ||
    clean(access?.employee?.position) ||
    clean(access?.employee?.title);

  const signature = [
    "Kind regards,",
    employeeName,
    ...(jobTitle ? [jobTitle] : []),
    companyName,
  ].join("\n");

  const withSignature = (value) => {
    let body = clean(value);

    // Remove common AI-generated placeholder signatures so the CRM can
    // consistently apply the authenticated employee's real signature.
    body = body
      // Remove placeholder signatures such as:
      // "Best regards,\n[Your Name]"
      .replace(
        /\n{2,}(?:kind|best) regards,?\s*\n+(?:\[your name\]|your name)(?:\s*\n+[^\n]+)?\s*$/i,
        ""
      )
      // The model can occasionally return only a closing phrase even when
      // instructed not to add a signature. Remove that as well before the
      // authenticated employee signature is appended.
      .replace(
        /\n{2,}(?:kind|best|warm) regards,?\s*$/i,
        ""
      )
      .trim();

    return `${body || "Hi,\n\nJust following up as discussed."}\n\n${signature}`;
  };

  if (
    requestedSubject &&
    requestedMessage
  ) {
    return {
      to: recipient,
      subject:
        requestedSubject,
      message:
        withSignature(requestedMessage),
      draft: true,
    };
  }

  const response =
    await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: `You are SaiNal One AI Email Assistant.

Prepare a professional UK business email draft only.
Do not say the email was sent.
Return JSON only:
{"subject":"...","message":"..."}

Business:
${companyName}

Rules:
- Keep it concise, professional and natural.
- Use only details from the supplied instruction.
- Do not invent facts, dates or commitments.
- Return only the email body in message.
- Do NOT add a closing sign-off, signature, sender name, job title, company name or placeholders such as [Your Name]. SaiNal One adds the authenticated employee signature automatically.
- The message must remain editable before any later send action.`,
        },
        {
          role: "user",
          content: `Recipient: ${recipient}
Requested subject/context: ${requestedSubject || "Follow-up"}
Instruction:
${clean(data.instructions) || "Prepare a professional follow-up email."}`,
        },
      ],
    });

  const parsed =
    parseJson(
      response.choices?.[0]
        ?.message?.content ||
        ""
    ) || {};

  return {
    to: recipient,
    subject:
      clean(parsed.subject) ||
      requestedSubject ||
      "Follow-up",
    message:
      withSignature(
        clean(parsed.message) ||
        "Hi,\n\nJust following up as discussed."
      ),
    draft: true,
  };
}


async function sendEmail({ access, data }) {
  const recipient = clean(data.to).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("A valid recipient email address is required.");
  const subject = clean(data.subject);
  const message = clean(data.message);
  if (!subject || !message) throw new Error("Email subject and message are required.");

  const emailPermissions = getRecordPermissions(access, { prefix: "emails", module: "Emails" });
  const canSend = Boolean(access.employee.is_organization_owner) || emailPermissions.canCreate || emailPermissions.canSend || access.can("emails.send") || access.canModuleAction("Emails", "send") || access.canModuleAction("Communication", "send");
  if (!canSend) throw permissionError("You do not have permission to send emails.");

  const relatedType = clean(data.related_type) || "General";
  const config = {
    Lead: { table: "leads", prefix: "leads", module: "Leads" },
    Customer: { table: "customers", prefix: "customers", module: "Customers" },
    Project: { table: "projects", prefix: "projects", module: "Projects" },
  }[relatedType];

  const supabase = createAdminSupabaseClient();
  let relatedRecord = null;
  if (relatedType !== "General") {
    if (!config) throw new Error("Invalid related email record type.");
    const { data: record, error } = await supabase.from(config.table).select("*").eq("organization_id", access.employee.organization_id).eq("id", data.related_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!record) throw new Error("Related record not found.");
    const perms = getRecordPermissions(access, { prefix: config.prefix, module: config.module });
    const visible = await canViewOwnedRecord({ supabase, access, permissions: perms, record });
    if (!visible) throw permissionError("You do not have permission to email this record.");
    relatedRecord = record;
  }

  const { data: settings, error: settingsError } = await supabase.from("company_settings").select("company_name").eq("organization_id", access.employee.organization_id).maybeSingle();
  if (settingsError) throw new Error(settingsError.message);
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error("Email service is not configured.");
  const companyName = settings?.company_name || "SaiNal Technologies Ltd";

  const employeeName =
    clean(access.employee?.name) ||
    clean(access.employee?.full_name) ||
    clean(`${access.employee?.first_name || ""} ${access.employee?.last_name || ""}`) ||
    "SaiNal One Team";

  const jobTitle =
    clean(access.employee?.job_title) ||
    clean(access.employee?.position) ||
    clean(access.employee?.title);

  const escaped = String(message)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  const signature = `
    <p style="margin-top:24px">
      Kind regards,<br/>
      <strong>${employeeName}</strong>
      ${jobTitle ? `<br/>${jobTitle}` : ""}
      <br/>${companyName}
    </p>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent, error: sendError } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: [recipient],
    subject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#27241f"><strong>${companyName}</strong><hr/>${escaped}${signature}</div>`,
  });
  const now = new Date().toISOString();
  const status = sendError ? "Failed" : "Sent";
  const label = relatedType === "Lead" ? relatedRecord?.name : relatedType === "Customer" ? relatedRecord?.customer_name : relatedType === "Project" ? relatedRecord?.project_name : null;
  await supabase.from("email_logs").insert([{ organization_id: access.employee.organization_id, recipient, subject, message_body: message, email_type: relatedType, related_record_id: relatedRecord?.id || null, related_record_number: label || null, status, provider: "Resend", provider_email_id: sent?.id || null, error_message: sendError?.message || null, sent_at: sendError ? null : now, created_at: now }]);
  if (sendError) throw new Error(sendError.message || "The email could not be sent.");
  return { id: sent?.id || null, to: recipient, subject, message };
}


async function recordInvoicePayment({
  organizationId,
  employeeId,
  invoice,
  amount,
  paymentMethod,
  reference,
  notes,
}) {
  const supabase = createAdminSupabaseClient();

  const { data: existingPayments, error: paymentReadError } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoice.id);

  if (paymentReadError) throw new Error(paymentReadError.message);

  const total = moneyValue(invoice.total_amount ?? invoice.amount ?? invoice.total);
  const alreadyPaid = (existingPayments || []).reduce(
    (sum, row) => sum + moneyValue(row.amount),
    0
  );
  const outstanding = Math.max(
    0,
    Math.round((total - alreadyPaid) * 100) / 100
  );
  const requestedAmount = Math.round(moneyValue(amount) * 100) / 100;

  if (total <= 0) {
    throw new Error("Invoice total could not be determined, so a payment was not recorded.");
  }
  if (outstanding <= 0) {
    throw new Error("This invoice has no outstanding balance to record.");
  }
  if (requestedAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  if (requestedAmount > outstanding) {
    throw new Error(`Payment exceeds the outstanding balance of £${outstanding.toFixed(2)}.`);
  }

  const now = new Date().toISOString();
  const { data: payment, error: paymentError } = await supabase
    .from("invoice_payments")
    .insert([{
      organization_id: organizationId,
      invoice_id: invoice.id,
      amount: requestedAmount,
      payment_date: now.slice(0, 10),
      payment_method: clean(paymentMethod) || "AI recorded payment",
      reference: clean(reference) || null,
      notes: clean(notes) || "Recorded through SaiNal AI after user confirmation.",
      recorded_by_employee_id: employeeId,
      created_at: now,
    }])
    .select()
    .single();

  if (paymentError) throw new Error(paymentError.message);

  const remaining = Math.max(
    0,
    Math.round((outstanding - requestedAmount) * 100) / 100
  );
  const nextStatus = remaining <= 0 ? "Paid" : "Partially Paid";

  const { data: updatedInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .update({ status: nextStatus })
    .eq("id", invoice.id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (invoiceError) {
    await supabase
      .from("invoice_payments")
      .delete()
      .eq("id", payment.id)
      .eq("organization_id", organizationId);
    throw new Error(invoiceError.message);
  }

  return {
    invoice: updatedInvoice,
    payment,
    remaining,
  };
}

async function executeOne({ action, access, businessData, permissions, employees, profile, openai, results }) {
  const organizationId = access.employee.organization_id;
  const employeeId = access.employee.id;
  const data = resolveValue(action.data || {}, results);
  const ownerChange = Object.prototype.hasOwnProperty.call(data.updates || {}, "owner_employee_id");
  const assigneeChange = Object.prototype.hasOwnProperty.call(data.updates || {}, "assigned_employee_id") || Boolean(data.assigned_employee_id);

  switch (action.type) {
    case "create_lead": {
      if (!permissions.leads.canCreate) throw permissionError("You do not have permission to create leads.");
      const result = await createLeadFromPrompt({ prompt: clean(data.prompt) || action.label, profile, organizationId, employeeId, openai });
      const lead = result.created || result.existing;
      return { message: result.alreadyExists ? `Lead already exists: ${lead.name}` : `Lead created: ${lead.name}`, data: { lead, created: lead } };
    }
    case "update_lead": {
      const lead = requireRecord(byId(businessData.leads, data.record_id), "lead");
      if (!permissions.leads.canEdit && !ownerChange) throw permissionError("You do not have permission to edit leads.");
      if (ownerChange && !permissions.leads.canAssign) throw permissionError("You do not have permission to assign leads.");
      if (ownerChange) requireEmployee(employees, data.updates.owner_employee_id);
      const updated = await genericUpdate({ table: "leads", organizationId, recordId: lead.id, updates: data.updates, allowed: ["name","company","email","phone","status","value","notes","source","ai_score","ai_summary","ai_next_action","owner_employee_id"] });
      return { message: `Lead updated: ${updated.name}`, data: { lead: updated, updated } };
    }
    case "convert_lead": {
      if (!permissions.leads.canEdit || !permissions.customers.canCreate || !permissions.projects.canCreate) throw permissionError("You do not have permission to convert this lead.");
      const lead = requireRecord(byId(businessData.leads, data.record_id), "lead");
      const result = await convertLeadToCustomerAndProject({ prompt: `Convert ${lead.name} ${lead.company || ""} ${lead.email || ""} lead to customer and create project`, leads: [lead], customers: businessData.customers, projects: businessData.projects, organizationId, employeeId });
      if (result.blockedByExistingCustomer) throw permissionError("A customer already exists but is not available with your current permissions.");
      if (!result.customer || !result.project) throw new Error("Lead conversion could not be completed.");
      return { message: `Lead converted: ${lead.name}; customer ${result.customer.customer_name}; project ${result.project.project_name}`, data: { lead: result.lead, customer: result.customer, project: result.project } };
    }
    case "create_quote": {
      if (!permissions.quotes.canCreate) throw permissionError("You do not have permission to create quotes.");
      const source = data.record_type === "Customer" ? requireRecord(byId(businessData.customers, data.record_id), "customer") : requireRecord(byId(businessData.leads, data.record_id), "lead");
      const identifier = source.name || source.customer_name || source.company || source.email;
      const result = await createQuoteFromPrompt({ prompt: `Create quote for ${identifier} ${source.company || ""} ${source.email || ""} ${clean(data.amount)} ${clean(data.instructions)}`, leads: businessData.leads, customers: businessData.customers, quotes: businessData.quotes, profile, organizationId, employeeId });
      if (result.notFound) throw new Error("Quote source record could not be matched.");
      const quote = result.created || result.existing;
      return { message: result.alreadyExists ? `Draft quote already exists: ${quote.quote_number}` : `Quote created: ${quote.quote_number}`, data: { quote, created: quote } };
    }
    case "create_proposal": {
      if (!permissions.proposals.canCreate) throw permissionError("You do not have permission to create proposals.");
      const source = data.record_type === "Quote" ? requireRecord(byId(businessData.quotes, data.record_id), "quote") : data.record_type === "Customer" ? requireRecord(byId(businessData.customers, data.record_id), "customer") : requireRecord(byId(businessData.leads, data.record_id), "lead");
      const identifier = source.quote_number || source.customer_name || source.name || source.company || source.email;
      const result = await createProposalFromPrompt({ prompt: `Create proposal for ${identifier}. ${clean(data.instructions)}`, profile, leads: businessData.leads, customers: businessData.customers, quotes: businessData.quotes, openai, organizationId, employeeId });
      if (result.notFound) throw new Error("Proposal source record could not be matched.");
      const proposal = result.created || result.existing;
      return { message: result.alreadyExists ? `Draft proposal already exists: ${proposal.proposal_number}` : `Proposal created: ${proposal.proposal_number}`, data: { proposal, created: proposal } };
    }
    case "update_customer": {
      const customer = requireRecord(byId(businessData.customers, data.record_id), "customer");
      if (!permissions.customers.canEdit && !ownerChange) throw permissionError("You do not have permission to edit customers.");
      if (ownerChange && !permissions.customers.canAssign) throw permissionError("You do not have permission to assign customers.");
      if (ownerChange) requireEmployee(employees, data.updates.owner_employee_id);
      const updated = await genericUpdate({ table: "customers", organizationId, recordId: customer.id, updates: data.updates, allowed: ["customer_name","company","email","phone","status","owner_employee_id"] });
      return { message: `Customer updated: ${updated.customer_name}`, data: { customer: updated, updated } };
    }
    case "update_project": {
      const project = requireRecord(byId(businessData.projects, data.record_id), "project");
      if (!permissions.projects.canEdit && !ownerChange) throw permissionError("You do not have permission to edit projects.");
      if (ownerChange && !permissions.projects.canAssign) throw permissionError("You do not have permission to assign projects.");
      if (ownerChange) requireEmployee(employees, data.updates.owner_employee_id);
      if (normalise(project.status) === "completed") {
        if (!data.reopen) throw new Error("This project is completed and locked. Reopen it first.");
        const updated = await genericUpdate({ table: "projects", organizationId, recordId: project.id, updates: { status: "In Progress" }, allowed: ["status"] });
        return { message: `Project reopened: ${updated.project_name}`, data: { project: updated, updated } };
      }
      if (data.updates?.status && !PROJECT_STATUSES.includes(data.updates.status)) throw new Error("Invalid project status.");
      const updated = await genericUpdate({ table: "projects", organizationId, recordId: project.id, updates: data.updates, allowed: ["project_name","description","amount","status","start_date","due_date","owner_employee_id"] });
      return { message: `Project updated: ${updated.project_name}`, data: { project: updated, updated } };
    }
    case "create_task": {
      if (!permissions.tasks.canCreate) throw permissionError("You do not have permission to create tasks.");
      if (data.project_id) {
        const existing = byId(businessData.projects, data.project_id) || results.map((item) => item.data?.project).find((item) => String(item?.id || "") === String(data.project_id));
        requireRecord(existing, "project");
      }
      if (data.assigned_employee_id) {
        if (!permissions.tasks.canAssign) throw permissionError("You do not have permission to assign tasks.");
        requireEmployee(employees, data.assigned_employee_id);
      }
      const task = await createTask({ organizationId, employeeId, data });
      return { message: `Task created: ${task.task_name}`, data: { task, created: task } };
    }
    case "update_task": {
      const task = requireRecord(byId(businessData.tasks, data.record_id), "task");
      if (!permissions.tasks.canEdit && !assigneeChange) throw permissionError("You do not have permission to edit tasks.");
      if (assigneeChange && !permissions.tasks.canAssign) throw permissionError("You do not have permission to assign tasks.");
      if (data.updates?.assigned_employee_id) requireEmployee(employees, data.updates.assigned_employee_id);
      if (data.updates?.status && !TASK_STATUSES.includes(data.updates.status)) throw new Error("Invalid task status.");
      if (data.updates?.priority && !TASK_PRIORITIES.includes(data.updates.priority)) throw new Error("Invalid task priority.");
      const updated = await genericUpdate({ table: "tasks", organizationId, recordId: task.id, updates: data.updates, allowed: ["task_name","description","status","due_date","priority","assigned_employee_id"] });
      return { message: `Task updated: ${updated.task_name}`, data: { task: updated, updated } };
    }
    case "create_activity": {
      if (!permissions.followUps.canCreate) throw permissionError("You do not have permission to create activities.");
      if (data.assigned_employee_id) {
        if (!permissions.followUps.canAssign) throw permissionError("You do not have permission to assign activities.");
        requireEmployee(employees, data.assigned_employee_id);
      }
      const collection = { Lead: businessData.leads, Customer: businessData.customers, Quote: businessData.quotes, Proposal: businessData.proposals, Project: businessData.projects, Invoice: businessData.invoices }[data.related_type];
      if (data.related_type && data.related_type !== "General") {
        const previous = results.flatMap((item) => [item.data?.lead, item.data?.customer, item.data?.project, item.data?.quote, item.data?.proposal, item.data?.invoice]).find((item) => String(item?.id || "") === String(data.related_id || ""));
        requireRecord(byId(collection, data.related_id) || previous, String(data.related_type).toLowerCase());
      }
      const activity = await createActivity({ organizationId, employeeId, data });
      return { message: `${activity.activity_type || "Activity"} created: ${activity.title}`, data: { activity, created: activity } };
    }
    case "update_activity": {
      const activity = requireRecord(byId(businessData.followUps, data.record_id), "activity");
      if (!permissions.followUps.canEdit && !assigneeChange) throw permissionError("You do not have permission to edit activities.");
      if (assigneeChange && !permissions.followUps.canAssign) throw permissionError("You do not have permission to assign activities.");
      if (data.updates?.assigned_employee_id) requireEmployee(employees, data.updates.assigned_employee_id);
      if (data.updates?.status && !ACTIVITY_STATUSES.includes(data.updates.status)) throw new Error("Invalid activity status.");
      const updated = await genericUpdate({ table: "follow_ups", organizationId, recordId: activity.id, updates: data.updates, allowed: ["activity_type","title","note","due_date","scheduled_at","completed_at","outcome","status","related_type","related_id","assigned_employee_id"] });
      return { message: `${updated.activity_type || "Activity"} updated: ${updated.title}`, data: { activity: updated, updated } };
    }
    case "update_quote": {
      const quote = requireRecord(byId(businessData.quotes, data.record_id), "quote");
      if (!permissions.quotes.canEdit && !ownerChange) throw permissionError("You do not have permission to edit quotes.");
      if (ownerChange && !permissions.quotes.canAssign) throw permissionError("You do not have permission to assign quotes.");
      if (ownerChange) requireEmployee(employees, data.updates.owner_employee_id);
      const updated = await genericUpdate({
        table: "quotes",
        organizationId,
        recordId: quote.id,
        updates: data.updates,
        allowed: ["client","contact","email","phone","service","amount","status","quote_text","owner_employee_id"],
      });
      return { message: `Quote updated: ${updated.quote_number}`, data: { quote: updated, updated } };
    }
    case "update_proposal": {
      const proposal = requireRecord(byId(businessData.proposals, data.record_id), "proposal");
      if (!permissions.proposals.canEdit && !ownerChange) throw permissionError("You do not have permission to edit proposals.");
      if (ownerChange && !permissions.proposals.canAssign) throw permissionError("You do not have permission to assign proposals.");
      if (ownerChange) requireEmployee(employees, data.updates.owner_employee_id);
      const updated = await genericUpdate({
        table: "proposals",
        organizationId,
        recordId: proposal.id,
        updates: data.updates,
        allowed: ["client","contact","email","title","service","amount","status","proposal_text","owner_employee_id"],
      });
      return { message: `Proposal updated: ${updated.proposal_number}`, data: { proposal: updated, updated } };
    }
    case "record_invoice_payment": {
      if (!permissions.invoices.canEdit) throw permissionError("You do not have permission to record invoice payments.");
      const invoice = requireRecord(byId(businessData.invoices, data.record_id), "invoice");
      const result = await recordInvoicePayment({
        organizationId,
        employeeId,
        invoice,
        amount: data.amount,
        paymentMethod: data.payment_method,
        reference: data.reference,
        notes: data.notes,
      });
      return {
        message: `Payment of £${moneyValue(result.payment.amount).toFixed(2)} recorded for ${result.invoice.invoice_number}; £${result.remaining.toFixed(2)} outstanding.`,
        data: { invoice: result.invoice, payment: result.payment },
      };
    }
    case "create_invoice_from_quote": {
      if (!permissions.invoices.canCreate || !permissions.quotes.canEdit) throw permissionError("You do not have permission to create an invoice from this quote.");
      const quote = requireRecord(byId(businessData.quotes, data.quote_id), "quote");
      const result = await convertQuoteToInvoice({ prompt: `Convert quote ${quote.quote_number} to invoice`, quotes: [quote], invoices: businessData.invoices, profile, organizationId, employeeId });
      const invoice = result.created || result.existing;
      return { message: result.alreadyExists ? `Invoice already exists: ${invoice.invoice_number}` : `Invoice created: ${invoice.invoice_number}`, data: { invoice, quote: result.quote, created: invoice } };
    }
    case "mark_invoice_paid": {
      if (!permissions.invoices.canEdit) throw permissionError("You do not have permission to update invoices.");
      const invoice = requireRecord(byId(businessData.invoices, data.record_id), "invoice");
      if (normalise(invoice.status) === "paid") {
        return { message: `Invoice already paid: ${invoice.invoice_number}`, data: { invoice } };
      }

      const supabase = createAdminSupabaseClient();
      const { data: existingPayments, error: paymentReadError } = await supabase
        .from("invoice_payments")
        .select("amount")
        .eq("organization_id", organizationId)
        .eq("invoice_id", invoice.id);
      if (paymentReadError) throw new Error(paymentReadError.message);

      const total = moneyValue(invoice.total_amount ?? invoice.amount ?? invoice.total);
      const alreadyPaid = (existingPayments || []).reduce(
        (sum, row) => sum + moneyValue(row.amount),
        0
      );
      const outstanding = Math.max(
        0,
        Math.round((total - alreadyPaid) * 100) / 100
      );

      const result = await recordInvoicePayment({
        organizationId,
        employeeId,
        invoice,
        amount: outstanding,
        paymentMethod: data.payment_method,
        reference: data.reference,
        notes: data.notes || "Recorded through SaiNal AI after user confirmation.",
      });

      return {
        message: `Payment recorded and invoice marked paid: ${result.invoice.invoice_number}`,
        data: { invoice: result.invoice, payment: result.payment },
      };
    }
    case "draft_email": {
      const email = await draftEmail({
        data,
        openai,
        profile,
        access,
      });

      return {
        message: `Email draft prepared for ${email.to}\nSubject: ${email.subject}\n\n${email.message}`,
        data: {
          email,
          draft: email,
        },
      };
    }
    case "send_email": {
      const email = await sendEmail({ access, data });
      return { message: `Email sent to ${email.to}`, data: { email } };
    }
    default:
      throw new Error(`Unsupported AI action: ${action.type}`);
  }
}

export async function executePlan({ plan, access, businessData, permissions, employees, profile, openai }) {
  const results = [];
  for (let index = 0; index < (plan.actions || []).length; index += 1) {
    const action = plan.actions[index];
    try {
      const result = await executeOne({ action, access, businessData, permissions, employees, profile, openai, results });
      results.push({ index: index + 1, type: action.type, label: action.label, success: true, message: result.message, data: result.data });
    } catch (error) {
      results.push({ index: index + 1, type: action.type, label: action.label, success: false, message: error.message || "Action failed.", data: null });
      break;
    }
  }
  const failed = results.filter((item) => !item.success);
  const answer = [failed.length ? "⚠️ AI Agent stopped because one action could not be completed." : "✅ AI Agent completed the requested actions.", "", ...results.map((item) => `${item.success ? "✓" : "✕"} ${item.message}`)].join("\n");
  return { success: failed.length === 0, answer, results };
}
