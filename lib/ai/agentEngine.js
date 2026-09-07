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
  "mark_invoice_paid", "send_email",
]);

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
        content: `You are the SaiNal One AI Agent Planner.\n\nCurrent server time: ${currentTime}\nUser timezone: ${timezone}\nUser local date/time: ${localTime}\n\nReturn JSON only.\n\nIf the user is only asking for analysis/information, return {"mode":"analysis","summary":"","actions":[]}.\n\nIf the user asks SaiNal One to create, update, schedule, send, convert, complete, cancel, reopen, assign, record or otherwise change CRM data, you MUST return mode actions. Never answer an action request as prose. ${forceActions ? "This request has already been deterministically identified as an action request, so mode MUST be actions with at least one valid action." : ""}\n\nIf the user asks SaiNal One to perform CRM work, return {"mode":"actions","summary":"...","actions":[...]}.\n\nAllowed actions:\ncreate_lead {prompt}\nupdate_lead {record_id, updates}\nconvert_lead {record_id}\ncreate_quote {record_id, record_type:"Lead|Customer", amount, instructions}\ncreate_proposal {record_id, record_type:"Lead|Customer|Quote", instructions}\nupdate_customer {record_id, updates}\nupdate_project {record_id, updates, reopen}\ncreate_task {project_id, task_name, description, status, priority, due_date, assigned_employee_id}\nupdate_task {record_id, updates}\ncreate_activity {activity_type:"Follow-up|Call|Meeting|Demo", related_type:"General|Lead|Customer|Quote|Proposal|Project|Invoice", related_id, title, note, due_date, scheduled_at, assigned_employee_id}\nupdate_activity {record_id, updates}\ncreate_invoice_from_quote {quote_id}\nmark_invoice_paid {record_id}\nsend_email {related_type:"General|Lead|Customer|Project", related_id, to, subject, message}\n\nRules:\n- Only use IDs present in supplied business data/employees.\n- Never invent IDs or email addresses.\n- Convert relative dates using the user's timezone.\n- Calls/meetings/demos with a time must have scheduled_at as ISO-8601.\n- For later actions that need a newly created record, use references like $1.customer.id, $1.customer.email, $1.project.id.\n- Keep messages professional UK business language.\n- For update actions include only fields the user actually requested.`,
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

function extractTaskName(prompt, person) {
  const text = String(prompt || "").trim();

  const called = text.match(/\btask\s+(?:called|named)\s+(.+?)(?=\s+for\s+|\s+due\s+|\s+by\s+|$)/i);
  if (called?.[1]) return called[1].trim().replace(/[.]+$/, "");

  const toDo = text.match(/\btask\s+to\s+(.+?)(?=\s+for\s+|\s+due\s+|\s+by\s+|$)/i);
  if (toDo?.[1]) return toDo[1].trim().replace(/[.]+$/, "");

  const simple = text.match(/\bcreate\s+(?:a\s+)?task\s+(.+?)(?=\s+for\s+|\s+due\s+|\s+by\s+|$)/i);
  if (simple?.[1] && !/^for\b/i.test(simple[1].trim())) {
    return simple[1].trim().replace(/[.]+$/, "");
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
      if (!clean(data.task_name)) data.task_name = extractTaskName(prompt, person);
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

    if (action.type === "send_email") {
      const customer = linkedCustomer(person, businessData);
      const related = customer || person?.record || null;
      if (!data.related_id && related?.id) {
        data.related_type = customer ? "Customer" : person?.type || "General";
        data.related_id = related.id;
      }
      if (!clean(data.to)) data.to = clean(customer?.email) || clean(person?.record?.email);
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

    if (action.type === "update_lead" && !data.record_id) {
      const lead = person?.type === "Lead" ? person.record : resolveRecordByText(businessData?.leads, text, ["name", "company", "email"]);
      if (lead?.id) data.record_id = lead.id;
    }

    if (action.type === "create_invoice_from_quote" && !data.quote_id) {
      const quote = resolveRecordByText(businessData?.quotes, text, ["quote_number", "client", "contact", "email"]);
      if (quote?.id) data.quote_id = quote.id;
    }

    if (action.type === "mark_invoice_paid" && !data.record_id) {
      const invoice = resolveRecordByText(businessData?.invoices, text, ["invoice_number", "client", "service"]);
      if (invoice?.id) data.record_id = invoice.id;
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

  const wantsEmail = /\b(send|email)\b[\s\S]{0,30}\bemail\b|\bsend\b[\s\S]{0,50}\bconfirm/i.test(request);
  if (wantsEmail) {
    const customer = linkedCustomer(person, businessData);
    const related = customer || person?.record || null;
    const to = clean(customer?.email) || clean(person?.record?.email);
    if (related?.id && to) {
      const meetingDate = relativeDate ? ` on ${relativeDate}${time ? ` at ${time.slice(0, 5)}` : ""}` : "";
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

  return sanitisePlan({
    mode: actions.length ? "actions" : "analysis",
    summary: actions.length
      ? "SaiNal One prepared the requested CRM actions."
      : "I could not safely resolve the requested CRM action to a unique record.",
    actions,
  });
}

export function confirmationForPlan(plan) {
  const actions = plan?.actions || [];
  const required = actions.length > 1 || actions.some((action) => {
    if (["convert_lead", "create_invoice_from_quote", "mark_invoice_paid", "send_email"].includes(action.type)) return true;
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
    actions: (plan.actions || []).map((action, index) => ({ index: index + 1, type: action.type, label: action.label, reason: action.reason })),
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
  if (["leads", "customers", "tasks", "follow_ups"].includes(table)) values.updated_at = new Date().toISOString();
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
  const escaped = String(message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent, error: sendError } = await resend.emails.send({ from: process.env.EMAIL_FROM, to: [recipient], subject, html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#27241f"><strong>${companyName}</strong><hr/>${escaped}<p>Kind regards,<br/>${companyName}</p></div>` });
  const now = new Date().toISOString();
  const status = sendError ? "Failed" : "Sent";
  const label = relatedType === "Lead" ? relatedRecord?.name : relatedType === "Customer" ? relatedRecord?.customer_name : relatedType === "Project" ? relatedRecord?.project_name : null;
  await supabase.from("email_logs").insert([{ organization_id: access.employee.organization_id, recipient, subject, message_body: message, email_type: relatedType, related_record_id: relatedRecord?.id || null, related_record_number: label || null, status, provider: "Resend", provider_email_id: sent?.id || null, error_message: sendError?.message || null, sent_at: sendError ? null : now, created_at: now }]);
  if (sendError) throw new Error(sendError.message || "The email could not be sent.");
  return { id: sent?.id || null, to: recipient, subject, message };
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
      if (normalise(invoice.status) === "paid") return { message: `Invoice already paid: ${invoice.invoice_number}`, data: { invoice } };

      const supabase = createAdminSupabaseClient();
      const { data: existingPayments, error: paymentReadError } = await supabase
        .from("invoice_payments")
        .select("amount")
        .eq("organization_id", organizationId)
        .eq("invoice_id", invoice.id);
      if (paymentReadError) throw new Error(paymentReadError.message);

      const money = (value) => {
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const total = money(invoice.total_amount ?? invoice.amount ?? invoice.total);
      const alreadyPaid = (existingPayments || []).reduce((sum, row) => sum + money(row.amount), 0);
      const outstanding = Math.max(0, Math.round((total - alreadyPaid) * 100) / 100);
      if (total <= 0) throw new Error("Invoice total could not be determined, so a payment was not recorded.");
      if (outstanding <= 0) throw new Error("This invoice has no outstanding balance to record.");

      const now = new Date().toISOString();
      const { data: payment, error: paymentError } = await supabase.from("invoice_payments").insert([{
        organization_id: organizationId,
        invoice_id: invoice.id,
        amount: outstanding,
        payment_date: now.slice(0, 10),
        payment_method: clean(data.payment_method) || "AI recorded payment",
        reference: clean(data.reference) || null,
        notes: clean(data.notes) || "Recorded through SaiNal AI after user confirmation.",
        recorded_by_employee_id: employeeId,
        created_at: now,
      }]).select().single();
      if (paymentError) throw new Error(paymentError.message);

      const { data: updatedInvoice, error: invoiceError } = await supabase.from("invoices").update({ status: "Paid" }).eq("id", invoice.id).eq("organization_id", organizationId).select().single();
      if (invoiceError) {
        await supabase.from("invoice_payments").delete().eq("id", payment.id).eq("organization_id", organizationId);
        throw new Error(invoiceError.message);
      }
      return { message: `Payment recorded and invoice marked paid: ${updatedInvoice.invoice_number}`, data: { invoice: updatedInvoice, payment } };
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
