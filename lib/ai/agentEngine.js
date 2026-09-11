import { Resend } from "resend";
import { createAdminSupabaseClient } from "../supabaseAdmin";
import { createLeadFromPrompt } from "../services/leadService";
import { createQuoteFromPrompt } from "../services/quoteService";
import { createProposalFromPrompt } from "../services/proposalService";
import { convertQuoteToInvoice } from "../services/invoiceService";
import { convertLeadToCustomerAndProject } from "../services/customerProjectService";
import { canViewOwnedRecord, getRecordPermissions } from "../recordAccess";
import { submitQuoteForApproval } from "../quotes/quoteEngine";
import { resumeApprovalStep } from "../workflow-runtime/runner";
import { canManageWorkflows } from "../serverAccess";

const ACTIONS = new Set([
  "create_lead", "update_lead", "convert_lead", "create_customer",
  "create_project_from_customer", "create_project", "complete_project",
  "reopen_project", "generate_default_project_tasks", "create_invoice_from_project",
  "create_quote", "create_proposal", "update_customer", "update_project",
  "create_task", "update_task", "complete_task", "reopen_task", "start_task", "block_task", "resume_task",
  "create_activity", "update_activity", "start_activity", "complete_activity", "mark_activity_no_answer", "reschedule_activity", "cancel_activity", "reopen_activity", "create_invoice_from_quote",
  "update_quote", "submit_quote_for_approval", "convert_quote_to_customer",
  "decide_quote_approval", "update_proposal", "send_proposal",
  "create_invoice", "update_invoice", "send_invoice", "cancel_invoice",
  "record_invoice_payment", "mark_invoice_paid", "draft_email", "send_email",
]);

const LEAD_STATUSES = ["New", "Contacted", "Proposal Sent", "Follow Up", "Won", "Lost"];
const CUSTOMER_STATUSES = ["Active", "Inactive", "Prospect", "On Hold"];
const QUOTE_STATUSES = ["Draft", "Pending Approval", "Approved", "Rejected", "Accepted", "Expired"];
const PROPOSAL_STATUSES = ["Draft", "Sent", "Accepted", "Rejected"];
const INVOICE_STATUSES = ["Draft Invoice", "Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"];
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

function safeProjectService(value) {
  const service = clean(value).replace(/\s+/g, " ").trim();
  if (!service) return "";

  // Project names must come from short structured service data only.
  // Reject values that look like conversation text, contact details or
  // accidentally concatenated prompts.
  const suspicious =
    service.length > 80 ||
    /@/.test(service) ||
    /\b(?:would you like|doesn't have|does not have|please confirm|create a quote|start a project|customer|email|phone)\b/i.test(service) ||
    /[?]/.test(service);

  if (suspicious) return "";

  return service;
}


function safeCommercialText(value, fallback = "") {
  const text = clean(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;

  const suspicious =
    text.length > 120 ||
    /@/.test(text) ||
    /\b(?:would you like|doesn't have|does not have|please confirm|create a quote|start a project|user request|recent conversation)\b/i.test(text) ||
    /[?]/.test(text);

  return suspicious ? fallback : text;
}


function isQuotedOrDiscussedAction(prompt) {
  const source = String(prompt || "").trim();
  const value = normalise(source);

  if (!value) return false;

  // Common non-execution forms. These are questions/suggestions about an
  // action, not instructions to perform it.
  const patterns = [
    /\bwould\s+you\s+like\s+(?:me\s+)?to\b/i,
    /\bshould\s+(?:i|we|you)\b/i,
    /\bwhat\s+happens\s+if\b/i,
    /\bwhat\s+would\s+happen\s+if\b/i,
    /\bdo\s+you\s+want\s+(?:me\s+)?to\b/i,
    /\bcan\s+i\b/i,
    /\bcould\s+i\b/i,
    /\bmay\s+i\b/i,
  ];

  if (patterns.some((pattern) => pattern.test(source))) {
    return true;
  }

  // A fully quoted sentence is treated as text being discussed, not a CRM
  // command. This prevents pasted suggestions from becoming actions.
  if (
    (/^["“][\s\S]+["”]$/.test(source) ||
      /^'[\s\S]+'$/.test(source))
  ) {
    return true;
  }

  return false;
}

function isClearActionInstruction(prompt) {
  const source = String(prompt || "").trim();

  if (!source || isQuotedOrDiscussedAction(source)) {
    return false;
  }

  // Direct imperatives and explicit requests.
  return Boolean(
    /^(?:please\s+)?(?:create|add|make|update|change|edit|set|mark|convert|submit|approve|reject|start|block|resume|begin|open|schedule|book|arrange|send|draft|write|compose|prepare|record|assign|reassign|complete|finish|cancel|reopen|reschedule|deactivate|activate)\b/i.test(source) ||
    /\b(?:please|go ahead and|i want you to|i'd like you to|i would like you to)\s+(?:create|add|make|update|change|edit|set|mark|convert|submit|approve|reject|start|block|resume|begin|open|schedule|book|arrange|send|draft|write|compose|prepare|record|assign|reassign|complete|finish|cancel|reopen|reschedule|deactivate|activate)\b/i.test(source)
  );
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
  const directLeadCreate = extractCreateLeadFromPrompt(prompt);

  if (directLeadCreate) {
    return sanitisePlan({
      mode: "actions",
      summary: `Creating a new lead for ${directLeadCreate.name} at ${directLeadCreate.company}.`,
      actions: [
        {
          type: "create_lead",
          label: `Create new lead: ${directLeadCreate.name}`,
          reason: "Create the requested lead in SaiNal One.",
          data: {
            name: directLeadCreate.name,
            company: directLeadCreate.company,
            email: directLeadCreate.email,
            prompt: String(prompt || "").trim(),
          },
        },
      ],
    });
  }

  // High-confidence commercial workflow:
  // "Start a project for <customer>" should never be answered as prose when
  // SaiNal One can safely resolve an Accepted/Approved quote. Build this
  // action deterministically so it always reaches the confirmation card.
  /*
   * PROJECT > TASK INTENT PRECEDENCE
   *
   * A task display/summary can contain its parent project name, e.g.
   * "Configure CRM pipeline for the Nova Fitness Ltd - Project".
   * Therefore "Complete the Nova Fitness Ltd - Project" must resolve the
   * explicitly named project before any task resolver is allowed to run.
   */
  const explicitProjectForLifecycle =
    bestProjectMatch(
      prompt,
      null,
      businessData
    );

  const lifecyclePrompt =
    String(prompt || "").trim();

  const lifecycleTaskName =
    taskNameFromActionPrompt(
      lifecyclePrompt
    );

  const exactLifecycleTask =
    lifecycleTaskName
      ? (businessData?.tasks || []).find(
          (task) =>
            normalise(task?.task_name) ===
            normalise(lifecycleTaskName)
        )
      : null;

  /*
   * A legacy task name may itself end with "... Project", for example:
   * "Post completion changes for the Nova Fitness Ltd - Project".
   *
   * If the full text after Complete/Reopen exactly matches a task_name,
   * task intent wins. Otherwise an explicitly named project lifecycle
   * command keeps Project > Task precedence.
   */
  const explicitProjectLifecycleAction =
    !exactLifecycleTask &&
    explicitProjectForLifecycle?.id &&
    /\bproject\b/i.test(lifecyclePrompt) &&
    (
      /^(?:please\s+)?(?:complete|finish|close)\b/i.test(lifecyclePrompt) ||
      /^(?:please\s+)?reopen\b/i.test(lifecyclePrompt)
    );

  if (explicitProjectLifecycleAction) {
    const reopening =
      /^(?:please\s+)?reopen\b/i.test(
        String(prompt || "").trim()
      );

    return sanitisePlan({
      mode: "actions",
      summary:
        reopening
          ? `Reopening project ${explicitProjectForLifecycle.project_name}.`
          : `Completing project ${explicitProjectForLifecycle.project_name}.`,
      actions: [
        {
          type:
            reopening
              ? "reopen_project"
              : "complete_project",
          label:
            reopening
              ? `Reopen project: ${explicitProjectForLifecycle.project_name}`
              : `Complete project: ${explicitProjectForLifecycle.project_name}`,
          reason:
            reopening
              ? "Reopen the explicitly named project."
              : "Complete the explicitly named project after validating its tasks.",
          data: {
            record_id:
              explicitProjectForLifecycle.id,
          },
        },
      ],
    });
  }

  const directTask =
    explicitTaskMatch(
      prompt,
      businessData
    );

  if (
    directTask?.id &&
    isClearActionInstruction(prompt)
  ) {
    const request =
      String(prompt || "");

    const priorityMatch =
      request.match(
        /\bpriority\s+(?:to|as)\s+(low|medium|high|critical|urgent)\b/i
      );

    if (priorityMatch?.[1]) {
      const requestedPriority =
        normalise(priorityMatch[1]) === "urgent"
          ? "Critical"
          : TASK_PRIORITIES.find(
              (priority) =>
                normalise(priority) ===
                normalise(priorityMatch[1])
            );

      if (requestedPriority) {
        return sanitisePlan({
          mode: "actions",
          summary:
            `Updating ${directTask.task_name}.`,
          actions: [
            {
              type: "update_task",
              label:
                `Update task: ${directTask.task_name}`,
              reason:
                `Change priority to ${requestedPriority}.`,
              data: {
                record_id:
                  directTask.id,
                updates: {
                  priority:
                    requestedPriority,
                },
              },
            },
          ],
        });
      }
    }

    const statusAction =
      /^\s*(?:please\s+)?start\b/i.test(request)
        ? "start_task"
        : /^\s*(?:please\s+)?block\b/i.test(request)
          ? "block_task"
          : /^\s*(?:please\s+)?resume\b/i.test(request)
            ? "resume_task"
            : /^\s*(?:please\s+)?(?:complete|finish)\b/i.test(request)
              ? "complete_task"
              : /^\s*(?:please\s+)?reopen\b/i.test(request)
                ? "reopen_task"
                : null;

    if (statusAction) {
      return sanitisePlan({
        mode: "actions",
        summary:
          `Updating ${directTask.task_name}.`,
        actions: [
          {
            type:
              statusAction,
            label:
              `${statusAction.replace(/_/g, " ")}: ${directTask.task_name}`,
            reason:
              "Update the explicitly named task.",
            data: {
              record_id:
                directTask.id,
            },
          },
        ],
      });
    }
  }

  // =====================================================
  // DIRECT INVOICE PAYMENT PREFLIGHT
  //
  // Payment requests are validated BEFORE an action plan is shown.
  // The AI route supplies payment_summary for each visible invoice, so
  // SaiNal can block paid invoices and overpayments without asking the
  // user to confirm an action that cannot safely execute.
  // =====================================================

  const directPaymentRequest =
    isClearActionInstruction(prompt) &&
    /\b(?:record|add|log)\b[\s\S]{0,30}\bpayment\b/i.test(
      String(prompt || "")
    );

  if (directPaymentRequest) {
    const invoice =
      bestInvoiceMatch(
        prompt,
        businessData
      );

    if (!invoice?.id) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          "I understood that you want to record an invoice payment, but I could not uniquely match the invoice.",
        actions: [],
      });
    }

    const status =
      normalise(
        invoice.status
      );

    if (status === "cancelled") {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `${invoice.invoice_number || "This invoice"} is cancelled, so a payment cannot be recorded against it.`,
        actions: [],
      });
    }

    if (
      [
        "draft",
        "draft invoice",
      ].includes(status)
    ) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `${invoice.invoice_number || "This invoice"} has not been sent yet. Send the invoice before recording a payment.`,
        actions: [],
      });
    }

    const outstanding =
      Number(
        invoice.payment_summary
          ?.outstanding
      );

    const safeOutstanding =
      Number.isFinite(
        outstanding
      )
        ? Math.max(
            0,
            Math.round(
              outstanding * 100
            ) / 100
          )
        : null;

    if (
      status === "paid" ||
      safeOutstanding === 0
    ) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `${invoice.invoice_number || "This invoice"} is already paid in full. No additional payment can be recorded.`,
        actions: [],
      });
    }

    const amount =
      extractMoneyFromPrompt(
        prompt
      );

    if (
      !amount ||
      amount <= 0
    ) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `I found ${invoice.invoice_number || "the invoice"}, but I need a payment amount greater than zero before recording a payment.`,
        actions: [],
      });
    }

    if (
      safeOutstanding !== null &&
      amount > safeOutstanding
    ) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `The requested payment of £${amount.toFixed(2)} exceeds the outstanding balance of £${safeOutstanding.toFixed(2)} for ${invoice.invoice_number || "this invoice"}.`,
        actions: [],
      });
    }

    return sanitisePlan({
      mode: "actions",
      summary:
        `Recording a payment of £${amount.toFixed(2)} for invoice ${invoice.invoice_number || ""}.`,
      actions: [
        {
          type:
            "record_invoice_payment",
          label:
            `Record £${amount.toFixed(2)} payment for ${invoice.invoice_number || "invoice"}`,
          reason:
            "Record the requested payment against the matched invoice.",
          data: {
            record_id:
              invoice.id,
            amount,
            notes:
              "Recorded through SaiNal AI after user confirmation.",
          },
        },
      ],
    });
  }

  // =====================================================
  // DIRECT PROPOSAL STATUS WORKFLOW
  // =====================================================

  const directProposal =
    bestProposalMatch(
      prompt,
      businessData
    );

  const directProposalStatus =
    PROPOSAL_STATUSES.find(
      (status) =>
        new RegExp(
          `\\b${status.replace(/\s+/g, "\\\\s+")}\\b`,
          "i"
        ).test(
          String(prompt || "")
        )
    ) || null;

  const directProposalStatusRequest =
    isClearActionInstruction(prompt) &&
    directProposal?.id &&
    directProposalStatus &&
    (
      /\bproposal\b/i.test(String(prompt || "")) ||
      /\bSNP-\d{4}-\d+\b/i.test(String(prompt || ""))
    ) &&
    /\b(?:mark|set|change|update|accept|reject)\b/i.test(
      String(prompt || "")
    );

  if (directProposalStatusRequest) {
    if (directProposalStatus === "Sent") {
      return sanitisePlan({
        mode: "analysis",
        summary:
          "Proposal Sent status is controlled by the Send Proposal action. Ask me to send the proposal instead.",
        actions: [],
      });
    }

    return sanitisePlan({
      mode: "actions",
      summary:
        `Updating proposal ${directProposal.proposal_number || ""} to ${directProposalStatus}.`,
      actions: [
        {
          type: "update_proposal",
          label:
            `Mark ${directProposal.proposal_number || "proposal"} as ${directProposalStatus}`,
          reason:
            `Change the explicitly named proposal status to ${directProposalStatus}.`,
          data: {
            record_id:
              directProposal.id,
            updates: {
              status:
                directProposalStatus,
            },
          },
        },
      ],
    });
  }

  // =====================================================
  // DIRECT ACCEPTED PROPOSAL -> INVOICE WORKFLOW
  //
  // "Create an invoice for proposal SNP-..." must resolve through the
  // proposal itself. The user should not need to repeat the customer name.
  // =====================================================

  const directProposalInvoice =
    isClearActionInstruction(prompt) &&
    /\b(?:create|generate|make)\b[\s\S]{0,35}\binvoice\b/i.test(
      String(prompt || "")
    ) &&
    (
      /\bproposal\b/i.test(String(prompt || "")) ||
      /\bSNP-\d{4}-\d+\b/i.test(String(prompt || ""))
    );

  if (directProposalInvoice) {
    const proposal =
      bestProposalMatch(
        prompt,
        businessData
      );

    if (!proposal?.id) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          "I understood that you want to create an invoice from a proposal, but I could not uniquely match the proposal.",
        actions: [],
      });
    }

    if (
      normalise(
        proposal.status
      ) !== "accepted"
    ) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `${proposal.proposal_number || "This proposal"} is ${proposal.status || "not Accepted"}. Only Accepted proposals can be converted into invoices.`,
        actions: [],
      });
    }

    const linkedQuote =
      proposal.quote_id
        ? byId(
            businessData?.quotes,
            proposal.quote_id
          )
        : null;

    const customer =
      (
        proposal.customer_id
          ? byId(
              businessData?.customers,
              proposal.customer_id
            )
          : null
      ) ||
      (
        linkedQuote?.customer_id
          ? byId(
              businessData?.customers,
              linkedQuote.customer_id
            )
          : null
      ) ||
      (businessData?.customers || []).find(
        (item) =>
          normalise(item?.email) &&
          normalise(item.email) ===
            normalise(proposal.email)
      ) ||
      (businessData?.customers || []).find(
        (item) =>
          normalise(item?.company) &&
          normalise(item.company) ===
            normalise(proposal.client)
      ) ||
      null;

    if (!customer?.id) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `${proposal.proposal_number || "This proposal"} is Accepted, but I could not safely resolve its customer record. Link the proposal to a customer before creating the invoice.`,
        actions: [],
      });
    }

    const existingInvoice =
      proposal.quote_id
        ? (businessData?.invoices || []).find(
            (invoice) =>
              String(invoice?.quote_id || "") ===
                String(proposal.quote_id) &&
              normalise(invoice?.status) !==
                "cancelled"
          )
        : null;

    if (existingInvoice?.id) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `An invoice already exists for the commercial record behind ${proposal.proposal_number || "this proposal"}: ${existingInvoice.invoice_number || "existing invoice"}.`,
        actions: [],
      });
    }

    const proposalAmount =
      moneyValue(
        proposal.amount
      );

    if (
      !proposalAmount ||
      proposalAmount <= 0
    ) {
      return sanitisePlan({
        mode: "analysis",
        summary:
          `${proposal.proposal_number || "This proposal"} does not have a positive invoiceable amount.`,
        actions: [],
      });
    }

    const invoiceService =
      safeCommercialText(
        linkedQuote?.service,
        ""
      ) ||
      safeCommercialText(
        proposal.service,
        ""
      ) ||
      safeCommercialText(
        proposal.title,
        ""
      ) ||
      "Accepted Proposal";

    return sanitisePlan({
      mode: "actions",
      summary:
        `Creating an invoice from accepted proposal ${proposal.proposal_number || ""}.`,
      actions: [
        {
          type: "create_invoice",
          label:
            `Create invoice from ${proposal.proposal_number || "accepted proposal"}`,
          reason:
            "Create a draft invoice from the accepted proposal and its linked customer.",
          data: {
            customer_id:
              customer.id,
            quote_id:
              proposal.quote_id ||
              linkedQuote?.id ||
              null,
            client:
              clean(customer.company) ||
              clean(customer.customer_name) ||
              clean(proposal.client),
            service:
              invoiceService,
            subtotal:
              proposalAmount,
          },
        },
      ],
    });
  }

  const directQuoteWorkflow =
    isClearActionInstruction(prompt) &&
    (
      /\bsubmit\b[\s\S]{0,45}\bquote\b[\s\S]{0,30}\bapproval\b/i.test(String(prompt || "")) ||
      /\bsubmit\b[\s\S]{0,45}\bfor\s+approval\b/i.test(String(prompt || "")) ||
      /\bconvert\b[\s\S]{0,45}\bquote\b[\s\S]{0,30}\bcustomer\b/i.test(String(prompt || "")) ||
      /\b(?:approve|reject)\b[\s\S]{0,45}\b(?:quote|snq-|q-)\b/i.test(String(prompt || ""))
    );

  if (directQuoteWorkflow) {
    const deterministicQuotePlan = buildDeterministicPlan({
      prompt,
      conversation,
      businessData,
      timezone,
    });

    if (
      deterministicQuotePlan?.actions?.some((action) =>
        ["submit_quote_for_approval", "convert_quote_to_customer", "decide_quote_approval"].includes(action.type)
      ) ||
      clean(deterministicQuotePlan?.summary)
    ) {
      return deterministicQuotePlan;
    }
  }



  // Shared deterministic context used by the task/project shortcuts below.
  // These values must exist before any shortcut references them.
  const text = contextText(prompt, conversation);
  const currentPerson = bestPersonMatch(prompt, businessData);
  const person = currentPerson || bestPersonMatch(text, businessData);
  const actions = [];

  const explicitTaskForAction =
    bestTaskMatch(prompt, businessData) ||
    null;

  const taskForAction =
    explicitTaskForAction ||
    bestTaskMatch(text, businessData);

  const taskPrompt = String(prompt || "");

  if (isClearActionInstruction(prompt) && taskForAction?.id) {
    let taskAction = null;

    if (
      /\b(?:complete|finish|mark)\b[\s\S]{0,30}\btask\b/i.test(taskPrompt) ||
      /\btask\b[\s\S]{0,30}\b(?:complete|completed|done|finished)\b/i.test(taskPrompt)
    ) {
      taskAction = "complete_task";
    } else if (/\breopen\b[\s\S]{0,30}\btask\b/i.test(taskPrompt)) {
      taskAction = "reopen_task";
    } else if (/\b(?:start|begin)\b[\s\S]{0,30}\btask\b/i.test(taskPrompt)) {
      taskAction = "start_task";
    } else if (/\b(?:block|pause)\b[\s\S]{0,30}\btask\b/i.test(taskPrompt)) {
      taskAction = "block_task";
    } else if (/\b(?:resume|continue)\b[\s\S]{0,30}\btask\b/i.test(taskPrompt)) {
      taskAction = "resume_task";
    }

    if (taskAction) {
      actions.push({
        type: taskAction,
        label: `${taskAction.replaceAll("_", " ")}: ${taskForAction.task_name || "task"}`,
        reason: "Update the task through the dedicated delivery-status action.",
        data: { record_id: taskForAction.id },
      });
    }
  }

  const explicitProjectForAction =
    bestProjectMatch(prompt, currentPerson, businessData) ||
    null;

  const projectForAction =
    explicitProjectForAction ||
    bestProjectMatch(text, person, businessData);

  const wantsCompleteProject =
    isClearActionInstruction(prompt) &&
    (
      /\b(?:complete|finish|close)\b[\s\S]{0,35}\bproject\b/i.test(String(prompt || "")) ||
      /\bproject\b[\s\S]{0,35}\b(?:complete|completed|finished|closed)\b/i.test(String(prompt || ""))
    );

  if (wantsCompleteProject && projectForAction?.id) {
    actions.push({
      type: "complete_project",
      label: `Complete ${projectForAction.project_name || "project"}`,
      reason: "Close delivery only after all project tasks are completed.",
      data: {
        record_id: projectForAction.id,
      },
    });
  }

  const wantsReopenProject =
    isClearActionInstruction(prompt) &&
    /\breopen\b[\s\S]{0,35}\bproject\b/i.test(String(prompt || ""));

  if (wantsReopenProject && projectForAction?.id) {
    actions.push({
      type: "reopen_project",
      label: `Reopen ${projectForAction.project_name || "project"}`,
      reason: "Unlock a completed project for further delivery work.",
      data: {
        record_id: projectForAction.id,
      },
    });
  }

  const wantsDefaultTasks =
    isClearActionInstruction(prompt) &&
    /\b(?:generate|create|add)\b[\s\S]{0,35}\bdefault\b[\s\S]{0,20}\btasks?\b/i.test(String(prompt || ""));

  if (wantsDefaultTasks && projectForAction?.id) {
    actions.push({
      type: "generate_default_project_tasks",
      label: `Generate default tasks for ${projectForAction.project_name || "project"}`,
      reason: "Create the standard five-task delivery template for the project.",
      data: {
        record_id: projectForAction.id,
      },
    });
  }

  const wantsProjectInvoice =
    isClearActionInstruction(prompt) &&
    /\b(?:generate|create|make)\b[\s\S]{0,35}\binvoice\b[\s\S]{0,35}\b(?:for|from)\b[\s\S]{0,20}\bproject\b/i.test(String(prompt || ""));

  if (wantsProjectInvoice && projectForAction?.id) {
    actions.push({
      type: "create_invoice_from_project",
      label: `Generate invoice for ${projectForAction.project_name || "project"}`,
      reason: "Create a draft invoice from the completed project's commercial value.",
      data: {
        record_id: projectForAction.id,
      },
    });
  }

  if (actions.length) {
    return sanitisePlan({
      mode: "actions",
      summary: "SaiNal One prepared the requested CRM actions.",
      actions,
    });
  }

  const directProjectStart =
    isClearActionInstruction(prompt) &&
    /\b(start|create|begin|open)\b[\s\S]{0,35}\bproject\b/i.test(String(prompt || ""));

  if (directProjectStart) {
    const deterministicProjectPlan = buildDeterministicPlan({
      prompt,
      conversation,
      businessData,
      timezone,
    });

    const hasProjectAction =
      deterministicProjectPlan?.actions?.some(
        (action) => action.type === "create_project_from_customer"
      );

    if (hasProjectAction || clean(deterministicProjectPlan?.summary)) {
      return deterministicProjectPlan;
    }
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the SaiNal One AI Agent Planner.\n\nCurrent server time: ${currentTime}\nUser timezone: ${timezone}\nUser local date/time: ${localTime}\n\nReturn JSON only.\n\nIf the user is only asking for analysis/information, return {"mode":"analysis","summary":"","actions":[]}.\n\nIf the user asks SaiNal One to create, update, schedule, send, convert, complete, cancel, reopen, assign, record or otherwise change CRM data, you MUST return mode actions. Never answer an action request as prose. ${forceActions ? "This request has already been deterministically identified as an action request, so mode MUST be actions with at least one valid action." : ""}\n\nIf the user asks SaiNal One to perform CRM work, return {"mode":"actions","summary":"...","actions":[...]}.\n\nAllowed actions:\ncreate_lead {prompt}\nupdate_lead {record_id, updates}\nconvert_lead {record_id}\ncreate_customer {customer_name, company, email, phone, status, owner_employee_id}\ncreate_project_from_customer {customer_id, quote_id}\ncreate_project {project_name, description, amount, status, start_date, due_date, owner_employee_id}\ncomplete_project {record_id}\nreopen_project {record_id}\ngenerate_default_project_tasks {record_id}\ncreate_invoice_from_project {record_id}\ncreate_quote {record_id, record_type:"Lead|Customer", amount, instructions}\nsubmit_quote_for_approval {record_id}\nconvert_quote_to_customer {record_id}\ndecide_quote_approval {record_id, decision:"Approved|Rejected"}\ncreate_proposal {record_id, record_type:"Lead|Customer|Quote", instructions}\nupdate_proposal {record_id, updates}\nsend_proposal {record_id, to, subject}\nupdate_customer {record_id, updates}\nupdate_project {record_id, updates, reopen}\ncreate_task {project_id, task_name, description, status, priority, due_date, assigned_employee_id}\nupdate_task {record_id, updates}\ncreate_activity {activity_type:"Follow-up|Call|Meeting|Demo|Email", related_type:"General|Lead|Customer|Quote|Proposal|Project|Invoice", related_id, title, note, due_date, scheduled_at, status, outcome, assigned_employee_id}\nupdate_activity {record_id, updates}\nstart_activity {record_id}\ncomplete_activity {record_id, outcome}\nmark_activity_no_answer {record_id, outcome}\nreschedule_activity {record_id, scheduled_at}\ncancel_activity {record_id, outcome}\nreopen_activity {record_id}\ncreate_invoice {customer_id, project_id, quote_id, client, service, subtotal, vat_rate, due_date, payment_terms, owner_employee_id}\ncreate_invoice_from_quote {quote_id}\nupdate_invoice {record_id, updates}\nsend_invoice {record_id, to, subject, message}\ncancel_invoice {record_id}\nrecord_invoice_payment {record_id, amount, payment_date, payment_method, reference, notes}\nmark_invoice_paid {record_id, payment_date, payment_method, reference, notes}\ndraft_email {related_type:"General|Lead|Customer|Project", related_id, to, subject, message, instructions, tone:"Professional|Friendly|Concise|Sales"}\nsend_email {related_type:"General|Lead|Customer|Project", related_id, to, subject, message}\n\nRules:\n- Only use IDs present in supplied business data/employees.\n- Never invent IDs or email addresses.\n- Convert relative dates using the user's timezone.\n- Calls/meetings/demos with a time must have scheduled_at as ISO-8601.\n- For later actions that need a newly created record, use references like $1.customer.id, $1.customer.email, $1.project.id.\n- Keep messages professional UK business language.\n- If the user says draft, prepare, write or compose an email but does NOT explicitly ask to send it, use draft_email, never send_email.\n- Use send_email only when the user explicitly asks to send or deliver the email.\n- Every distinct requested CRM operation must have a corresponding action. Do not silently omit one action from a multi-action request.\n- For update actions include only fields the user actually requested.\n- SAFETY: If the current USER REQUEST explicitly names a CRM record/person/company/email, that current-request match MUST override any record mentioned in RECENT CONVERSATION. Never carry a previous record_id into a new request that explicitly names a different record.\n- SAFETY: Do NOT create actions merely because the user repeats, quotes, discusses or asks about an action phrase. Questions/suggestions such as "Would you like me to create a quote first?", "Should I create a quote?" or "What happens if I create a quote?" are analysis, not execution.\n- SAFETY: Commercial record creation such as quotes, proposals, projects and invoices must only be planned when the user clearly instructs SaiNal One to perform the action.\n- SAFETY: If a quote creation request has no usable amount, do not create the quote; ask the user for the amount/details instead.
- SAFETY: create_project_from_customer may only use a quote whose status is Accepted or Approved. Never start a project from Draft, Sent, Rejected or any other quote status.
- SAFETY: Never set quote workflow statuses (Pending Approval, Approved, Rejected or Accepted) through update_quote. Use submit_quote_for_approval, decide_quote_approval or convert_quote_to_customer instead.
- SAFETY: Approving/rejecting a quote must use decide_quote_approval and only for an approval the signed-in employee is authorised to decide.
- SAFETY: Permanent quote deletion is not an AI action.
- SAFETY: If the user explicitly asks to send a proposal, use send_proposal, not send_email and not update_proposal status=Sent.
- SAFETY: send_proposal must use the proposal's stored recipient unless the user explicitly provides another valid email address.
- SAFETY: Proposal status Accepted or Rejected is commercially significant and must require confirmation.
- SAFETY: Permanent proposal deletion is not an AI action.
- SAFETY: If the user explicitly asks to send an invoice, use send_invoice, never send_email and never update_invoice status=Sent.
- SAFETY: Paid and Partially Paid invoice statuses must only come from recorded payments. Never set them through update_invoice.
- SAFETY: Invoice cancellation must use cancel_invoice and requires confirmation.
- SAFETY: Direct invoice creation requires a matched customer, a clear service and an explicit monetary subtotal/amount.
- SAFETY: When creating an invoice from a quote, only use an Approved or Accepted quote.
- SAFETY: Permanent invoice deletion is not an AI action.
- SAFETY: Completing a project must use complete_project. Do not set status=Completed through update_project.
- SAFETY: complete_project is only valid when the project has at least one task and every visible project task is Completed.
- SAFETY: Reopening a completed project must use reopen_project.
- SAFETY: Completed projects are delivery-locked. Do not edit them until they are reopened.
- SAFETY: Generating default project tasks must use generate_default_project_tasks.
- SAFETY: Creating an invoice from a completed project must use create_invoice_from_project.
- SAFETY: Permanent project deletion is not an AI action.
- SAFETY: Task statuses must use Open, Pending, To Do, In Progress, Completed, Blocked, or Cancelled.
- SAFETY: Task priorities must use Low, Medium, High, or Critical. Treat "Urgent" as Critical for AI actions because the Task API accepts Critical.
- SAFETY: Starting, blocking, resuming, completing, or reopening a task should use the dedicated task action rather than a generic status edit.
- SAFETY: A task belonging to a Completed project is delivery-locked. Do not edit, reassign, change status, or create additional tasks for that project until the project is reopened.
- SAFETY: Workflow-created tasks must never be permanently deleted. Permanent task deletion is not an AI action.
- SAFETY: Calendar and Activity Centre records use the follow_ups table. Calendar is a view of the same activity records, not a separate backend.
- SAFETY: Activity types must be Follow-up, Call, Meeting, Demo, or Email.
- SAFETY: Activity statuses must be Pending, Scheduled, In Progress, Completed, No Answer, Rescheduled, or Cancelled.
- SAFETY: Calls, Meetings and Demos require a scheduled date/time.
- SAFETY: Completing an activity must use complete_activity.
- SAFETY: Marking a call as No Answer must use mark_activity_no_answer and only applies to Call activities.
- SAFETY: Rescheduling must use reschedule_activity and requires a new scheduled date/time.
- SAFETY: Cancelling an activity must use cancel_activity and requires confirmation.
- SAFETY: Reopening a closed activity must use reopen_activity.
- SAFETY: Permanent activity/follow-up deletion is not an AI action.
- SAFETY: Email drafting is non-destructive. If the user asks to draft, write, prepare or compose an email, use draft_email only.
- SAFETY: Never send an email merely because a draft exists or because an earlier assistant suggested sending it.
- SAFETY: send_email is allowed only when the current user request explicitly asks to send/deliver the email and must require confirmation.
- SAFETY: General emails may use a manually supplied recipient. Lead/Customer/Project emails must only link to records visible in supplied business data.
- SAFETY: Do not invent recipient email addresses. If no valid recipient is available, ask for one.
- SAFETY: Apply the authenticated employee signature exactly once: employee name, optional job title, and company name.`,
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

function extractTaskProjectName(prompt) {
  const source = String(prompt || "").trim();

  const match = source.match(
    /\bfor\s+(?:the\s+)?(.+?\bproject)\s*(?=\s+(?:due|by|assigned\s+to)\b|[.!]?\s*$)/i
  );

  return clean(match?.[1]);
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
  if (called?.[1]) {
    const projectName =
      extractTaskProjectName(prompt);

    let taskTitle =
      cleanTaskTitle(called[1]);

    if (projectName) {
      const escapedProject =
        projectName.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

      taskTitle =
        taskTitle.replace(
          new RegExp(
            `\\s+for\\s+(?:the\\s+)?${escapedProject}\\s*$`,
            "i"
          ),
          ""
        ).trim();
    }

    return cleanTaskTitle(taskTitle);
  }

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

  /*
   * Do not treat an email address in another CRM command
   * (for example "create a lead ... with email x@y.com")
   * as an Email calendar activity.
   *
   * Email activities require explicit activity/reminder/scheduling intent.
   */
  if (
    /\b(?:schedule|book|arrange|set up|add|create)\b[\s\S]{0,35}\bemail(?:\s+reminder|\s+activity)?\b/.test(text) ||
    /\bemail\s+(?:reminder|activity)\b/.test(text)
  ) {
    return "Email";
  }

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

function taskNameFromActionPrompt(prompt) {
  const source = String(prompt || "").trim();

  const patterns = [
    /^(?:please\s+)?(?:change|update|set)\s+(.+?)\s+priority\s+(?:to|as)\s+(?:low|medium|high|critical|urgent)\s*[.!]?\s*$/i,
    /^(?:please\s+)?(?:start|block|resume|complete|finish|reopen)\s+(?:task\s+)?(.+?)\s*[.!]?\s*$/i,
    /^(?:please\s+)?(?:change|update|set)\s+(?:task\s+)?(.+?)\s+status\s+(?:to|as)\s+.+$/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }

  return "";
}

function explicitTaskMatch(prompt, businessData) {
  const source = String(prompt || "").trim();

  const requestedName =
    taskNameFromActionPrompt(
      prompt
    );

  const exactNamedTask =
    requestedName
      ? (businessData?.tasks || []).find(
          (task) =>
            normalise(task?.task_name) ===
            normalise(requestedName)
        )
      : null;

  if (
    !exactNamedTask &&
    /\bproject\b/i.test(source) &&
    (
      /^(?:please\s+)?(?:complete|finish|close)\b/i.test(source) ||
      /^(?:please\s+)?reopen\b/i.test(source)
    )
  ) {
    return null;
  }
  if (!requestedName) {
    return bestTaskMatch(prompt, businessData);
  }

  const wanted = normalise(requestedName);

  const exact = (businessData?.tasks || []).filter(
    (task) => normalise(task?.task_name) === wanted
  );

  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const contained = (businessData?.tasks || []).filter((task) => {
    const name = normalise(task?.task_name);
    return name && (wanted.includes(name) || name.includes(wanted));
  });

  return contained.length === 1 ? contained[0] : null;
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

  // Central execution-intent guard. Even if the model planner produced an
  // action, do not allow it to execute when the current message is clearly
  // discussing/quoting an action rather than instructing SaiNal One.
  if (isQuotedOrDiscussedAction(prompt)) {
    return {
      mode: "analysis",
      summary: "I understood that as a question or suggestion, so I did not make any CRM changes.",
      actions: [],
    };
  }

  if (safePlan.mode !== "actions") return safePlan;

  const text = contextText(prompt, conversation);

  // SAFETY: resolve an explicitly named record from the CURRENT user
  // request before looking at recent conversation. Conversation context
  // is only a fallback for follow-up phrases such as "him", "her" or
  // "that customer".
  const currentPerson = bestPersonMatch(prompt, businessData);
  const person = currentPerson || bestPersonMatch(text, businessData);

  const currentProject = bestProjectMatch(prompt, currentPerson, businessData);
  const project = currentProject || bestProjectMatch(text, person, businessData);
  const relativeDate = resolveRelativeDate(prompt, timezone);
  const time = extractTime(prompt);

  const actions = safePlan.actions.map((action) => {
    const data = { ...(action.data || {}) };

    if (action.type === "create_task") {
      const explicitTaskProjectName =
        extractTaskProjectName(
          prompt
        );

      if (
        !data.project_id &&
        project?.id
      ) {
        data.project_id =
          project.id;
      }

      if (
        explicitTaskProjectName
      ) {
        data.project_name =
          explicitTaskProjectName;
      }

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
      const explicitLead =
        resolveRecordByText(
          businessData?.leads,
          prompt,
          ["name", "company", "email"]
        );

      const explicitCustomer =
        resolveRecordByText(
          businessData?.customers,
          prompt,
          ["customer_name", "name", "company", "email"]
        );

      const explicitProject =
        bestProjectMatch(
          prompt,
          currentPerson,
          businessData
        );

      let relatedType =
        "General";

      let relatedRecord =
        null;

      if (explicitCustomer?.id) {
        relatedType =
          "Customer";

        relatedRecord =
          explicitCustomer;
      } else if (explicitLead?.id) {
        relatedType =
          "Lead";

        relatedRecord =
          explicitLead;
      } else if (explicitProject?.id) {
        relatedType =
          "Project";

        relatedRecord =
          explicitProject;
      } else {
        const customer =
          linkedCustomer(
            person,
            businessData
          );

        relatedRecord =
          customer ||
          person?.record ||
          null;

        relatedType =
          customer
            ? "Customer"
            : person?.type === "Lead"
              ? "Lead"
              : person?.type === "Customer"
                ? "Customer"
                : "General";
      }

      /*
       * Explicit CRM records in the current request always win over
       * stale planner IDs carried from recent conversation context.
       */
      if (relatedRecord?.id) {
        data.related_type =
          relatedType;

        data.related_id =
          relatedRecord.id;
      }

      if (!clean(data.to)) {
        let recipient =
          clean(
            relatedRecord?.email
          );

        /*
         * Projects normally do not own a recipient email. Where possible,
         * resolve the linked customer from the visible customer dataset.
         */
        if (
          relatedType === "Project" &&
          relatedRecord
        ) {
          const projectCustomer =
            byId(
              businessData.customers,
              relatedRecord.customer_id
            );

          recipient =
            recipient ||
            clean(
              projectCustomer?.email
            );
        }

        data.to =
          recipient;
      }

      if (
        action.type ===
          "draft_email" &&
        !clean(
          data.instructions
        )
      ) {
        data.instructions =
          clean(prompt);
      }

      if (
        action.type ===
          "draft_email" &&
        ![
          "Professional",
          "Friendly",
          "Concise",
          "Sales",
        ].includes(
          clean(data.tone)
        )
      ) {
        const promptTone =
          normalise(prompt);

        data.tone =
          /\bfriendly\b/.test(promptTone)
            ? "Friendly"
            : /\bconcise|brief|short\b/.test(promptTone)
              ? "Concise"
              : /\bsales|persuasive\b/.test(promptTone)
                ? "Sales"
                : "Professional";
      }
    }

    if (action.type === "convert_lead" && !data.record_id) {
      const lead = person?.type === "Lead" ? person.record : resolveRecordByText(businessData?.leads, text, ["name", "company", "email"]);
      if (lead?.id) data.record_id = lead.id;
    }

    if (["update_project", "complete_project", "reopen_project", "generate_default_project_tasks", "create_invoice_from_project"].includes(action.type)) {
      const explicitProject =
        bestProjectMatch(prompt, currentPerson, businessData);

      const matchedProject =
        explicitProject ||
        project;

      if (explicitProject?.id) {
        data.record_id = explicitProject.id;
      } else if (!data.record_id && matchedProject?.id) {
        data.record_id = matchedProject.id;
      }
    }

    if (action.type === "update_customer") {
      const explicitCustomer = resolveRecordByText(
        businessData?.customers,
        prompt,
        ["customer_name", "company", "email"]
      );

      // If the current request explicitly identifies a customer, it wins
      // even when the model planner supplied a stale record_id from prior
      // conversation context.
      if (explicitCustomer?.id) {
        data.record_id = explicitCustomer.id;
      } else if (!data.record_id) {
        const customer = linkedCustomer(person, businessData);
        if (customer?.id) data.record_id = customer.id;
      }

      data.updates =
        data.updates && typeof data.updates === "object"
          ? { ...data.updates }
          : {};

      const deterministicUpdates = extractDeterministicCustomerUpdates(prompt);
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

    if (action.type === "create_project_from_customer") {
      const explicitCustomer = resolveRecordByText(
        businessData?.customers,
        prompt,
        ["customer_name", "company", "email"]
      );

      const customer =
        explicitCustomer ||
        byId(businessData?.customers, data.customer_id) ||
        linkedCustomer(person, businessData) ||
        (person?.type === "Customer" ? person.record : null);

      if (explicitCustomer?.id) {
        data.customer_id = explicitCustomer.id;
        // A quote chosen for a previous customer must not survive when the
        // current request explicitly names a different customer.
        const suppliedQuote = byId(businessData?.quotes, data.quote_id);
        if (
          suppliedQuote?.customer_id &&
          String(suppliedQuote.customer_id) !== String(explicitCustomer.id)
        ) {
          data.quote_id = null;
        }
      } else if (!data.customer_id && customer?.id) {
        data.customer_id = customer.id;
      }

      if (!data.quote_id && customer?.id) {
        const customerQuotes = (businessData?.quotes || []).filter((quote) =>
          String(quote?.customer_id || "") === String(customer.id) ||
          (normalise(quote?.email) && normalise(quote.email) === normalise(customer?.email)) ||
          (normalise(quote?.client) && normalise(quote.client) === normalise(customer?.company))
        );

        const preferred =
          customerQuotes.find((quote) =>
            ["accepted", "approved"].includes(normalise(quote?.status))
          ) ||
          null;

        if (preferred?.id) {
          data.quote_id = preferred.id;
        } else {
          data.quote_id = null;
        }
      }
    }

    if (action.type === "update_lead") {
      const explicitLead = resolveRecordByText(
        businessData?.leads,
        prompt,
        ["name", "company", "email"]
      );

      if (explicitLead?.id) {
        data.record_id = explicitLead.id;
      } else if (!data.record_id) {
        const lead = person?.type === "Lead"
          ? person.record
          : resolveRecordByText(
              businessData?.leads,
              text,
              ["name", "company", "email"]
            );

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

    if (["update_task", "start_task", "block_task", "resume_task", "complete_task", "reopen_task"].includes(action.type)) {
      const explicitTask = explicitTaskMatch(prompt, businessData);
      const matchedTask = explicitTask || bestTaskMatch(text, businessData);

      if (explicitTask?.id) {
        data.record_id = explicitTask.id;
      } else if (!data.record_id && matchedTask?.id) {
        data.record_id = matchedTask.id;
      }
    }

    if (["update_activity", "start_activity", "complete_activity", "mark_activity_no_answer", "reschedule_activity", "cancel_activity", "reopen_activity"].includes(action.type)) {
      const explicitActivity =
        bestActivityMatch(prompt, businessData);

      const matchedActivity =
        explicitActivity ||
        bestActivityMatch(text, businessData);

      if (explicitActivity?.id) {
        data.record_id =
          explicitActivity.id;
      } else if (
        !data.record_id &&
        matchedActivity?.id
      ) {
        data.record_id =
          matchedActivity.id;
      }
    }

    if (["update_quote", "submit_quote_for_approval", "convert_quote_to_customer", "decide_quote_approval"].includes(action.type)) {
      const explicitQuote = bestQuoteMatch(prompt, businessData);
      const quote = explicitQuote || bestQuoteMatch(text, businessData);

      if (explicitQuote?.id) {
        data.record_id = explicitQuote.id;
      } else if (!data.record_id && quote?.id) {
        data.record_id = quote.id;
      }

      if (action.type === "decide_quote_approval") {
        if (/\breject\b/i.test(String(prompt || ""))) data.decision = "Rejected";
        else if (/\bapprove\b/i.test(String(prompt || ""))) data.decision = "Approved";
      }
    }

    if (["update_proposal", "send_proposal"].includes(action.type)) {
      const explicitProposal = bestProposalMatch(prompt, businessData);
      const proposal = explicitProposal || bestProposalMatch(text, businessData);

      if (explicitProposal?.id) {
        data.record_id = explicitProposal.id;
      } else if (!data.record_id && proposal?.id) {
        data.record_id = proposal.id;
      }

      if (action.type === "send_proposal" && proposal) {
        if (!clean(data.to)) data.to = clean(proposal.email);
        if (!clean(data.subject)) {
          data.subject = `${clean(proposal.title) || "Proposal"} – ${clean(proposal.proposal_number)}`;
        }
      }
    }

    if (action.type === "create_invoice_from_quote") {
      const explicitQuote = bestQuoteMatch(prompt, businessData);
      const quote = explicitQuote || bestQuoteMatch(text, businessData);
      if (explicitQuote?.id) data.quote_id = explicitQuote.id;
      else if (!data.quote_id && quote?.id) data.quote_id = quote.id;
    }

    if (action.type === "create_invoice") {
      const explicitCustomer = bestPersonMatch(prompt, businessData);
      const person = explicitCustomer || bestPersonMatch(text, businessData);
      const customer =
        explicitCustomer?.customer_name ? explicitCustomer :
        person?.customer_name ? person :
        null;

      if (customer?.id && !data.customer_id) data.customer_id = customer.id;
      if (!clean(data.client) && customer) {
        data.client = clean(customer.company) || clean(customer.customer_name);
      }
      if (!moneyValue(data.subtotal)) {
        const requestedAmount = extractMoneyFromPrompt(prompt);
        if (requestedAmount) data.subtotal = requestedAmount;
      }
    }

    if (["update_invoice", "send_invoice", "cancel_invoice", "record_invoice_payment", "mark_invoice_paid"].includes(action.type)) {
      const explicitInvoice = bestInvoiceMatch(prompt, businessData);
      const invoice = explicitInvoice || bestInvoiceMatch(text, businessData);

      if (explicitInvoice?.id) data.record_id = explicitInvoice.id;
      else if (!data.record_id && invoice?.id) data.record_id = invoice.id;

      if (action.type === "send_invoice" && invoice) {
        if (!clean(data.to)) {
          const customer = (businessData.customers || []).find(
            (item) => String(item.id || "") === String(invoice.customer_id || "")
          );
          const quote = (businessData.quotes || []).find(
            (item) => String(item.id || "") === String(invoice.quote_id || "")
          );
          data.to = clean(customer?.email) || clean(quote?.email) || clean(invoice.email);
        }
      }
    }

    if (action.type === "record_invoice_payment" && !moneyValue(data.amount)) {
      const requestedAmount = extractMoneyFromPrompt(prompt);
      if (requestedAmount) data.amount = requestedAmount;
    }

    return { ...action, data };
  });

  return sanitisePlan({ ...safePlan, actions });
}


function extractCreateLeadFromPrompt(prompt) {
  const source = String(prompt || "").trim();

  const match = source.match(
    /^(?:please\s+)?(?:create|add|make)\s+(?:a\s+|new\s+)?lead\s+(?:for\s+)?(.+?)\s+at\s+(.+?)\s+with\s+(?:the\s+)?email(?:\s+address)?\s+([^\s,;]+@[^\s,;]+\.[^\s,;]+)(?:\s|$)/i
  );

  if (!match) return null;

  const name = clean(match[1]);
  const company = clean(match[2]);
  const email = clean(match[3]).toLowerCase();

  if (!name || !company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return { name, company, email };
}

export function buildDeterministicPlan({ prompt, conversation, businessData, timezone }) {
  const explicitNewLead = extractCreateLeadFromPrompt(prompt);

  if (explicitNewLead) {
    return {
      mode: "actions",
      summary: `Creating a new lead for ${explicitNewLead.name} at ${explicitNewLead.company}.`,
      actions: [
        {
          type: "create_lead",
          label: `Create new lead: ${explicitNewLead.name}`,
          reason: "Create the requested lead in SaiNal One.",
          data: {
            name: explicitNewLead.name,
            company: explicitNewLead.company,
            email: explicitNewLead.email,
            prompt: String(prompt || "").trim(),
          },
        },
      ],
    };
  }

  const text = contextText(prompt, conversation);
  const request = normalise(prompt);

  if (isQuotedOrDiscussedAction(prompt)) {
    return {
      mode: "analysis",
      summary: "I understood that as a question or suggestion, so I did not make any CRM changes.",
      actions: [],
    };
  }

  // Same safety rule as the model-plan resolver: current request first,
  // conversation only as a fallback for genuine follow-up references.
  const currentPerson = bestPersonMatch(prompt, businessData);
  const person = currentPerson || bestPersonMatch(text, businessData);

  const currentProject = bestProjectMatch(prompt, currentPerson, businessData);
  const project = currentProject || bestProjectMatch(text, person, businessData);
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

  const explicitLead = resolveRecordByText(
    businessData?.leads,
    prompt,
    ["name", "company", "email"]
  );

  const matchedLead =
    explicitLead ||
    (person?.type === "Lead"
      ? person.record
      : resolveRecordByText(
          businessData?.leads,
          text,
          ["name", "company", "email"]
        ));

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
  // CUSTOMER FALLBACKS
  // =====================================================

  const wantsCustomerCreate =
    /\b(create|add|make)\b[\s\S]{0,30}\b(?:new\s+)?customer\b/i.test(request);

  if (wantsCustomerCreate) {
    const createData = extractCustomerCreateData(prompt);

    if (createData.customer_name) {
      actions.push({
        type: "create_customer",
        label: `Create customer: ${createData.customer_name}`,
        reason: "Create the requested customer in SaiNal One.",
        data: createData,
      });
    }
  }

  const explicitCustomer = resolveRecordByText(
    businessData?.customers,
    prompt,
    ["customer_name", "company", "email"]
  );

  const matchedCustomer =
    explicitCustomer ||
    linkedCustomer(person, businessData) ||
    (person?.type === "Customer" ? person.record : null);

  const wantsCustomerUpdate =
    /\b(update|change|edit|set|mark|deactivate|activate)\b[\s\S]{0,90}\bcustomer\b/i.test(request) ||
    /\bcustomer\b[\s\S]{0,90}\b(update|change|edit|set|mark|deactivate|activate)\b/i.test(request) ||
    /\b(?:customer\s+)?(?:status|email|phone|telephone|mobile|company|customer\s+name)\s+(?:to|as|is)\b/i.test(request);

  if (wantsCustomerUpdate && matchedCustomer?.id) {
    const updates = extractDeterministicCustomerUpdates(prompt);

    if (Object.keys(updates).length) {
      actions.push({
        type: "update_customer",
        label: `Update customer: ${recordDisplayName(matchedCustomer) || "Customer"}`,
        reason: "Apply the requested changes to the matched customer.",
        data: {
          record_id: matchedCustomer.id,
          updates,
        },
      });
    }
  }

  const wantsStartProject =
    isClearActionInstruction(prompt) &&
    /\b(start|create|open|begin)\b[\s\S]{0,35}\bproject\b/i.test(request) &&
    /\bcustomer\b|\bclient\b|\bfor\b/i.test(request);

  if (wantsStartProject && matchedCustomer?.id) {
    const customerQuotes = (businessData?.quotes || []).filter((quote) =>
      String(quote?.customer_id || "") === String(matchedCustomer.id) ||
      (normalise(quote?.email) && normalise(quote.email) === normalise(matchedCustomer?.email)) ||
      (normalise(quote?.client) && normalise(quote.client) === normalise(matchedCustomer?.company))
    );

    const preferredQuote =
      customerQuotes.find((quote) =>
        ["accepted", "approved"].includes(normalise(quote?.status))
      ) ||
      null;

    if (preferredQuote?.id) {
      actions.push({
        type: "create_project_from_customer",
        label: `Start project for ${recordDisplayName(matchedCustomer)}`,
        reason: `Create a project from approved quote ${preferredQuote.quote_number || "the matched quote"}.`,
        data: {
          customer_id: matchedCustomer.id,
          quote_id: preferredQuote.id,
        },
      });
    } else {
      const hasAnyQuote = customerQuotes.length > 0;

      return {
        mode: "analysis",
        summary: hasAnyQuote
          ? `${recordDisplayName(matchedCustomer)} has quote${customerQuotes.length === 1 ? "" : "s"}, but none are Accepted or Approved. Approve/accept a quote first, then I can start the project.`
          : `${recordDisplayName(matchedCustomer)} does not have a quote available to start a project. Create a quote with an amount first, then approve/accept it before starting the project.`,
        actions: [],
      };
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
        project_name: extractTaskProjectName(prompt) || null,
        task_name: extractTaskName(prompt, person),
        status: "Pending",
        priority: "Medium",
        due_date: relativeDate,
      },
    });
  }

  const activityType =
    activityTypeFromPrompt(
      prompt
    );

  const explicitEmailActivityIntent =
    activityType !== "Email" ||
    (
      /\b(?:schedule|book|arrange|set up)\b[\s\S]{0,35}\bemail\b/.test(request) ||
      /\bemail\s+(?:reminder|activity)\b/.test(request)
    );

  const wantsSchedule =
    /\b(schedule|book|arrange|set up|add|create)\b/.test(
      request
    ) &&
    Boolean(
      activityType
    ) &&
    explicitEmailActivityIntent &&
    /\b(call|meeting|demo|follow[- ]?up|email(?:\s+reminder|\s+activity)?)\b/.test(
      request
    );

  if (wantsSchedule) {
    const scheduledType =
      [
        "Call",
        "Meeting",
        "Demo",
      ].includes(
        activityType
      );

    if (
      scheduledType &&
      (!relativeDate || !time)
    ) {
      return {
        mode:
          "analysis",

        summary:
          `I can schedule the ${normalise(activityType)}, but I need both a date and time first.`,

        actions: [],
      };
    }

    actions.push({
      type:
        "create_activity",

      label:
        person?.record?.id
          ? `Schedule ${normalise(activityType)} with ${recordDisplayName(person.record)}`
          : `Create ${normalise(activityType)} activity`,

      reason:
        "Add the activity to the SaiNal One Calendar and Activity Centre.",

      data: {
        activity_type:
          activityType,

        related_type:
          person?.record?.id
            ? person.type
            : "General",

        related_id:
          person?.record?.id ||
          null,

        title:
          makeActivityTitle(
            activityType,
            person
          ),

        due_date:
          scheduledType
            ? null
            : relativeDate,

        scheduled_at:
          scheduledType
            ? zonedLocalDateTimeToUtc(
                relativeDate,
                time,
                timezone
              )
            : null,

        status:
          scheduledType
            ? "Scheduled"
            : "Pending",
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

  const wantsQuote =
    isClearActionInstruction(prompt) &&
    /\b(create|generate|prepare|make)\b[\s\S]{0,30}\bquote\b/.test(request);

  if (wantsQuote) {
    const customer = linkedCustomer(person, businessData);
    const source = customer || person?.record || null;
    const amount = extractMoneyFromPrompt(prompt);

    if (source?.id && amount) {
      actions.push({
        type: "create_quote",
        label: `Create quote for ${recordDisplayName(source)}`,
        reason: "Create a draft quote against the matched CRM record.",
        data: {
          record_id: source.id,
          record_type: customer ? "Customer" : person?.type || "Lead",
          amount,
          instructions: prompt,
        },
      });
    } else if (source?.id && !amount) {
      return {
        mode: "analysis",
        summary: `I found ${recordDisplayName(source)}, but I need a quote amount before I can safely create the quote.`,
        actions: [],
      };
    }
  }


  // =====================================================
  // QUOTE WORKFLOW FALLBACKS
  // =====================================================

  const explicitQuoteForWorkflow =
    bestQuoteMatch(prompt, businessData) ||
    null;

  const quoteForWorkflow =
    explicitQuoteForWorkflow ||
    bestQuoteMatch(text, businessData);

  const wantsSubmitQuoteApproval =
    isClearActionInstruction(prompt) &&
    (
      /\bsubmit\b[\s\S]{0,45}\bquote\b[\s\S]{0,30}\bapproval\b/i.test(String(prompt || "")) ||
      /\bsubmit\b[\s\S]{0,45}\bfor\s+approval\b/i.test(String(prompt || ""))
    );

  if (wantsSubmitQuoteApproval) {
    if (!quoteForWorkflow?.id) {
      return {
        mode: "analysis",
        summary: "I understood that you want to submit a quote for approval, but I could not uniquely match the quote.",
        actions: [],
      };
    }

    if (["pending approval", "approved", "accepted"].includes(normalise(quoteForWorkflow.status))) {
      return {
        mode: "analysis",
        summary: `${quoteForWorkflow.quote_number || "This quote"} is already ${quoteForWorkflow.status}.`,
        actions: [],
      };
    }

    actions.push({
      type: "submit_quote_for_approval",
      label: `Submit ${quoteForWorkflow.quote_number || "quote"} for approval`,
      reason: "Start the configured quote approval workflow.",
      data: {
        record_id: quoteForWorkflow.id,
      },
    });
  }

  const wantsConvertQuoteCustomer =
    isClearActionInstruction(prompt) &&
    /\bconvert\b[\s\S]{0,45}\bquote\b[\s\S]{0,30}\bcustomer\b/i.test(String(prompt || ""));

  if (wantsConvertQuoteCustomer) {
    if (!quoteForWorkflow?.id) {
      return {
        mode: "analysis",
        summary: "I understood that you want to convert a quote to a customer, but I could not uniquely match the quote.",
        actions: [],
      };
    }

    actions.push({
      type: "convert_quote_to_customer",
      label: `Convert ${quoteForWorkflow.quote_number || "quote"} to customer`,
      reason: "Create or link the customer from the quote and mark the quote Accepted.",
      data: {
        record_id: quoteForWorkflow.id,
      },
    });
  }

  const quoteApprovalDecision =
    /\breject\b/i.test(String(prompt || ""))
      ? "Rejected"
      : /\bapprove\b/i.test(String(prompt || ""))
        ? "Approved"
        : null;

  const wantsQuoteApprovalDecision =
    isClearActionInstruction(prompt) &&
    Boolean(quoteApprovalDecision) &&
    /\b(?:quote|snq-|q-)\b/i.test(String(prompt || ""));

  if (wantsQuoteApprovalDecision) {
    if (!quoteForWorkflow?.id) {
      return {
        mode: "analysis",
        summary: `I understood that you want to ${quoteApprovalDecision === "Approved" ? "approve" : "reject"} a quote, but I could not uniquely match the quote.`,
        actions: [],
      };
    }

    actions.push({
      type: "decide_quote_approval",
      label: `${quoteApprovalDecision === "Approved" ? "Approve" : "Reject"} ${quoteForWorkflow.quote_number || "quote"}`,
      reason: "Record the approval decision through the configured workflow.",
      data: {
        record_id: quoteForWorkflow.id,
        decision: quoteApprovalDecision,
      },
    });
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


  const explicitProposalForAction =
    bestProposalMatch(prompt, businessData) ||
    null;

  const proposalForAction =
    explicitProposalForAction ||
    bestProposalMatch(text, businessData);

  const requestedProposalStatus =
    PROPOSAL_STATUSES.find(
      (status) =>
        new RegExp(
          `\\b${status.replace(/\s+/g, "\\\\s+")}\\b`,
          "i"
        ).test(
          String(prompt || "")
        )
    ) || null;

  const wantsProposalStatusUpdate =
    isClearActionInstruction(prompt) &&
    proposalForAction?.id &&
    requestedProposalStatus &&
    (
      /\bproposal\b/i.test(String(prompt || "")) ||
      /\bSNP-\d{4}-\d+\b/i.test(String(prompt || ""))
    ) &&
    /\b(?:mark|set|change|update|accept|reject)\b/i.test(
      String(prompt || "")
    );

  if (wantsProposalStatusUpdate) {
    if (requestedProposalStatus === "Sent") {
      return {
        mode: "analysis",
        summary:
          "Proposal Sent status is controlled by the Send Proposal action. Ask me to send the proposal instead.",
        actions: [],
      };
    }

    actions.push({
      type: "update_proposal",
      label:
        `Mark ${proposalForAction.proposal_number || "proposal"} as ${requestedProposalStatus}`,
      reason:
        `Change the matched proposal status to ${requestedProposalStatus}.`,
      data: {
        record_id:
          proposalForAction.id,
        updates: {
          status:
            requestedProposalStatus,
        },
      },
    });
  }

  const wantsSendProposal =
    isClearActionInstruction(prompt) &&
    (
      /\bsend\b[\s\S]{0,45}\bproposal\b/i.test(String(prompt || "")) ||
      /\bproposal\b[\s\S]{0,30}\b(?:send|deliver)\b/i.test(String(prompt || ""))
    );

  if (wantsSendProposal) {
    if (!proposalForAction?.id) {
      return {
        mode: "analysis",
        summary: "I understood that you want to send a proposal, but I could not uniquely match the proposal.",
        actions: [],
      };
    }

    const recipient = clean(proposalForAction.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return {
        mode: "analysis",
        summary: `${proposalForAction.proposal_number || "This proposal"} does not have a valid customer email address. Add a valid email before sending it.`,
        actions: [],
      };
    }

    actions.push({
      type: "send_proposal",
      label: `Send ${proposalForAction.proposal_number || "proposal"} to ${recipient}`,
      reason: "Send the stored proposal document to the customer and mark it Sent.",
      data: {
        record_id: proposalForAction.id,
        to: recipient,
        subject: `${clean(proposalForAction.title) || "Proposal"} – ${clean(proposalForAction.proposal_number)}`,
      },
    });
  }

  const explicitInvoiceQuote =
    bestQuoteMatch(prompt, businessData) ||
    null;

  const invoiceQuote =
    explicitInvoiceQuote ||
    bestQuoteMatch(text, businessData);

  const wantsInvoiceFromQuote =
    isClearActionInstruction(prompt) &&
    /\b(create|generate|convert|make)\b[\s\S]{0,35}\binvoice\b/.test(request) &&
    /\bquote\b/.test(request);

  if (wantsInvoiceFromQuote) {
    if (!invoiceQuote?.id) {
      return {
        mode: "analysis",
        summary: "I understood that you want to create an invoice from a quote, but I could not uniquely match the quote.",
        actions: [],
      };
    }

    if (!["approved", "accepted"].includes(normalise(invoiceQuote.status))) {
      return {
        mode: "analysis",
        summary: `${invoiceQuote.quote_number || "This quote"} is ${invoiceQuote.status || "not approved"}. Only Approved or Accepted quotes can be converted to invoices.`,
        actions: [],
      };
    }

    actions.push({
      type: "create_invoice_from_quote",
      label: `Create invoice from ${invoiceQuote.quote_number || "quote"}`,
      reason: "Create a draft invoice from the approved/accepted quote.",
      data: { quote_id: invoiceQuote.id },
    });
  }

  const wantsDirectInvoice =
    isClearActionInstruction(prompt) &&
    /\b(create|generate|make)\b[\s\S]{0,35}\binvoice\b/.test(request) &&
    !/\bquote\b/.test(request);

  if (wantsDirectInvoice) {
    const person = bestPersonMatch(prompt, businessData) || bestPersonMatch(text, businessData);
    const customer = person?.customer_name ? person : null;
    const subtotal = extractMoneyFromPrompt(prompt);
    const serviceMatch = String(prompt || "").match(
      /\b(?:for|service(?:\s+is)?|regarding)\s+(.+?)(?=\s+(?:for|worth|at|£|\d)|$)/i
    );
    const service = safeCommercialText(serviceMatch?.[1], "");

    if (!customer?.id) {
      return {
        mode: "analysis",
        summary: "I can create the invoice, but I need an existing customer to link it to.",
        actions: [],
      };
    }

    if (!subtotal) {
      return {
        mode: "analysis",
        summary: `I found ${recordDisplayName(customer)}, but I need the invoice subtotal/amount before I can safely create the invoice.`,
        actions: [],
      };
    }

    if (!service) {
      return {
        mode: "analysis",
        summary: `I found ${recordDisplayName(customer)} and the amount, but I need the service/description before I can safely create the invoice.`,
        actions: [],
      };
    }

    actions.push({
      type: "create_invoice",
      label: `Create £${Number(subtotal).toFixed(2)} invoice for ${recordDisplayName(customer)}`,
      reason: "Create a new draft invoice linked to the matched customer.",
      data: {
        customer_id: customer.id,
        client: clean(customer.company) || clean(customer.customer_name),
        service,
        subtotal,
      },
    });
  }

  const invoice =
    bestInvoiceMatch(prompt, businessData) ||
    bestInvoiceMatch(text, businessData);

  const wantsSendInvoice =
    isClearActionInstruction(prompt) &&
    /\bsend\b[\s\S]{0,45}\binvoice\b/.test(request);

  if (wantsSendInvoice) {
    if (!invoice?.id) {
      return {
        mode: "analysis",
        summary: "I understood that you want to send an invoice, but I could not uniquely match the invoice.",
        actions: [],
      };
    }

    if (normalise(invoice.status) === "cancelled") {
      return {
        mode: "analysis",
        summary: `${invoice.invoice_number || "This invoice"} is cancelled and cannot be sent.`,
        actions: [],
      };
    }

    const customer = (businessData.customers || []).find(
      (item) => String(item.id || "") === String(invoice.customer_id || "")
    );
    const quote = (businessData.quotes || []).find(
      (item) => String(item.id || "") === String(invoice.quote_id || "")
    );
    const recipient = (clean(customer?.email) || clean(quote?.email) || clean(invoice.email)).toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return {
        mode: "analysis",
        summary: `${invoice.invoice_number || "This invoice"} does not have a valid customer email address. Add one before sending it.`,
        actions: [],
      };
    }

    actions.push({
      type: "send_invoice",
      label: `Send ${invoice.invoice_number || "invoice"} to ${recipient}`,
      reason: "Send the actual invoice document and update its sent status.",
      data: {
        record_id: invoice.id,
        to: recipient,
      },
    });
  }

  const wantsCancelInvoice =
    isClearActionInstruction(prompt) &&
    /\bcancel\b[\s\S]{0,30}\binvoice\b/.test(request);

  if (wantsCancelInvoice && invoice?.id) {
    actions.push({
      type: "cancel_invoice",
      label: `Cancel ${invoice.invoice_number || "invoice"}`,
      reason: "Cancel the matched invoice without deleting the financial record.",
      data: { record_id: invoice.id },
    });
  }

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
    } else {
      return {
        mode: "analysis",
        summary: `I found ${invoice.invoice_number || "the invoice"}, but I need the payment amount before recording a payment.`,
        actions: [],
      };
    }
  } else if (invoice?.id && wantsMarkPaid) {
    actions.push({
      type: "mark_invoice_paid",
      label: `Record the remaining balance for ${invoice.invoice_number || "invoice"} as paid`,
      reason: "Record the remaining outstanding balance as a payment. Paid status will be calculated automatically.",
      data: { record_id: invoice.id },
    });
  }

  const explicitActivityForAction =
    bestActivityMatch(
      prompt,
      businessData
    );

  const activity =
    explicitActivityForAction ||
    bestActivityMatch(
      text,
      businessData
    );

  if (
    activity?.id &&
    isClearActionInstruction(
      prompt
    ) &&
    /\b(call|meeting|demo|follow[- ]?up|activity|calendar)\b/.test(
      request
    )
  ) {
    let activityAction =
      null;

    const actionData = {
      record_id:
        activity.id,
    };

    if (
      /\b(?:complete|finish|mark completed)\b/.test(
        request
      )
    ) {
      activityAction =
        "complete_activity";
    } else if (
      /\bno answer\b/.test(
        request
      )
    ) {
      activityAction =
        "mark_activity_no_answer";
    } else if (
      /\bcancel\b/.test(
        request
      )
    ) {
      activityAction =
        "cancel_activity";
    } else if (
      /\breopen\b/.test(
        request
      )
    ) {
      activityAction =
        "reopen_activity";
    } else if (
      /\b(?:start|begin)\b/.test(
        request
      )
    ) {
      activityAction =
        "start_activity";
    } else if (
      /\breschedule\b/.test(
        request
      )
    ) {
      if (
        !relativeDate ||
        !time
      ) {
        return {
          mode:
            "analysis",

          summary:
            `I found ${activity.title || "the activity"}, but I need both the new date and time before rescheduling it.`,

          actions: [],
        };
      }

      activityAction =
        "reschedule_activity";

      actionData.scheduled_at =
        zonedLocalDateTimeToUtc(
          relativeDate,
          time,
          timezone
        );
    }

    if (activityAction) {
      actions.push({
        type:
          activityAction,

        label:
          `${activityAction.replaceAll("_", " ")}: ${activity.title || "activity"}`,

        reason:
          "Update the matched Calendar / Activity Centre record using its dedicated lifecycle action.",

        data:
          actionData,
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
    return `${type}:${clean(data.activity_type).toLowerCase()}:${clean(data.related_id).toLowerCase()}`;
  }

  if (["start_task", "block_task", "resume_task", "complete_task", "reopen_task"].includes(type)) {
    return `task-status:${clean(data.record_id).toLowerCase()}:${type}`;
  }

  if (["start_activity", "complete_activity", "mark_activity_no_answer", "reschedule_activity", "cancel_activity", "reopen_activity"].includes(type)) {
    return `activity-status:${clean(data.record_id).toLowerCase()}:${type}`;
  }

  if (["draft_email", "send_email"].includes(type)) {
    return `${type}:${clean(data.to).toLowerCase()}:${clean(data.related_id).toLowerCase()}`;
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
    if (
      safePlan.mode !== "actions" &&
      clean(fallback.summary)
    ) {
      return fallback;
    }

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
    if (["convert_lead", "create_quote", "create_proposal", "create_project_from_customer", "create_project", "complete_project", "reopen_project", "generate_default_project_tasks", "create_invoice_from_project", "submit_quote_for_approval", "convert_quote_to_customer", "decide_quote_approval", "send_proposal", "create_invoice", "create_invoice_from_quote", "send_invoice", "cancel_invoice", "record_invoice_payment", "mark_invoice_paid", "send_email", "cancel_activity"].includes(action.type)) return true;
    const updates = action.data?.updates || {};
    if (action.type === "update_proposal" && ["Accepted", "Rejected"].includes(updates.status)) return true;
    if (action.type === "update_invoice" && (Object.prototype.hasOwnProperty.call(updates, "subtotal") || Object.prototype.hasOwnProperty.call(updates, "amount") || Object.prototype.hasOwnProperty.call(updates, "vat_rate") || updates.status === "Overdue")) return true;
    if (Object.prototype.hasOwnProperty.call(updates, "owner_employee_id")) return true;
    if (Object.prototype.hasOwnProperty.call(updates, "assigned_employee_id")) return true;
    if (action.type === "update_project" && (["Completed", "Cancelled"].includes(updates.status) || Object.prototype.hasOwnProperty.call(updates, "amount"))) return true;
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

      if (data.customer_name) details.push(`Customer: ${data.customer_name}`);
      if (data.customer_id) details.push(`Customer ID: ${data.customer_id}`);
      if (data.quote_id && action.type === "create_project_from_customer") details.push(`Quote ID: ${data.quote_id}`);
      if (data.record_id && ["submit_quote_for_approval", "convert_quote_to_customer", "decide_quote_approval"].includes(action.type)) details.push(`Quote ID: ${data.record_id}`);
      if (data.decision && action.type === "decide_quote_approval") details.push(`Decision: ${data.decision}`);
      if (data.task_name) details.push(`Task: ${data.task_name}`);
      if (data.due_date) details.push(`Due: ${data.due_date}`);
      if (data.scheduled_at) details.push(`Scheduled: ${data.scheduled_at}`);
      if (data.to) details.push(`Recipient: ${data.to}`);
      if (data.subject) details.push(`Subject: ${data.subject}`);
      if (data.record_id && action.type === "send_proposal") details.push(`Proposal ID: ${data.record_id}`);
      if (data.record_id && ["send_invoice", "cancel_invoice", "record_invoice_payment", "mark_invoice_paid", "update_invoice"].includes(action.type)) details.push(`Invoice ID: ${data.record_id}`);
      if (data.record_id && ["complete_project", "reopen_project", "generate_default_project_tasks", "create_invoice_from_project"].includes(action.type)) details.push(`Project ID: ${data.record_id}`);
      if (data.record_id && ["start_task", "block_task", "resume_task", "complete_task", "reopen_task"].includes(action.type)) details.push(`Task ID: ${data.record_id}`);
      if (data.record_id && ["start_activity", "complete_activity", "mark_activity_no_answer", "reschedule_activity", "cancel_activity", "reopen_activity"].includes(action.type)) details.push(`Activity ID: ${data.record_id}`);
      if (data.project_name && action.type === "create_project") details.push(`Project: ${data.project_name}`);
      if (data.customer_id && action.type === "create_invoice") details.push(`Customer ID: ${data.customer_id}`);
      if (data.subtotal && action.type === "create_invoice") details.push(`Subtotal: £${moneyValue(data.subtotal).toFixed(2)}`);
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


function extractDeterministicCustomerUpdates(prompt) {
  const source = String(prompt || "").trim();
  const updates = {};

  const statusMatch = source.match(
    /\b(?:customer\s+)?status\s+(?:to|as)\s+(Active|Inactive|Prospect|On Hold)\b/i
  );
  if (statusMatch?.[1]) {
    const matched = CUSTOMER_STATUSES.find(
      (status) => normalise(status) === normalise(statusMatch[1])
    );
    if (matched) updates.status = matched;
  } else if (
    /\b(mark|set|change|update|deactivate|activate)\b[\s\S]{0,60}\bcustomer\b/i.test(source)
  ) {
    if (/\bdeactivate\b/i.test(source)) updates.status = "Inactive";
    else if (/\bactivate\b/i.test(source)) updates.status = "Active";
    else {
      const requestedStatus = normaliseRequestedStatus(source, CUSTOMER_STATUSES);
      if (requestedStatus) updates.status = requestedStatus;
    }
  }

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

  const nameMatch = source.match(
    /\bcustomer\s+name\s+(?:to|as|is)\s+(.+?)\s*[.!]?\s*$/i
  );
  if (nameMatch?.[1]) updates.customer_name = nameMatch[1].trim();

  return updates;
}

function extractCustomerCreateData(prompt) {
  const source = String(prompt || "").trim();

  const result = {
    customer_name: "",
    company: "",
    email: "",
    phone: "",
    status: "Active",
  };

  const namedMatch = source.match(
    /\b(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?customer(?:\s+(?:called|named))?\s+(.+?)(?=\s+(?:from|at|for)\s+|\s+with\s+email\b|\s+email\b|\s+phone\b|,|$)/i
  );
  if (namedMatch?.[1]) {
    result.customer_name = namedMatch[1].trim();
  }

  const companyMatch = source.match(
    /\b(?:from|at|for)\s+(.+?)(?=\s+with\s+email\b|\s+email\b|\s+phone\b|,|$)/i
  );
  if (companyMatch?.[1]) {
    result.company = companyMatch[1].trim();
  }

  const emailMatch = source.match(
    /\bemail(?:\s+address)?(?:\s+is|\s+as|\s+to)?\s+([^\s,;]+@[^\s,;]+\.[^\s,;]+)/i
  );
  if (emailMatch?.[1]) {
    result.email = emailMatch[1].trim();
  }

  const phoneMatch = source.match(
    /\b(?:phone|telephone|mobile)(?:\s+number)?(?:\s+is|\s+as|\s+to)?\s+([+()0-9][+()0-9\s-]{5,})\s*[.!]?\s*$/i
  );
  if (phoneMatch?.[1]) {
    result.phone = phoneMatch[1].trim();
  }

  const status = CUSTOMER_STATUSES.find((item) =>
    new RegExp(`\\b${item.replace(/\s+/g, "\\\\s+")}\\b`, "i").test(source)
  );
  if (status) result.status = status;

  return result;
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

async function createCustomer({
  organizationId,
  employeeId,
  data,
  employees,
  canAssign,
}) {
  const customerName = clean(data.customer_name);
  if (!customerName) throw new Error("Customer name is required.");

  const status = clean(data.status) || "Active";
  if (!CUSTOMER_STATUSES.includes(status)) {
    throw new Error("Invalid customer status.");
  }

  let ownerEmployeeId = employeeId;

  if (data.owner_employee_id) {
    if (!canAssign) {
      throw permissionError("You do not have permission to assign customers.");
    }

    const owner = requireEmployee(employees, data.owner_employee_id);
    ownerEmployeeId = owner.id;
  }

  const supabase = createAdminSupabaseClient();

  const email = clean(data.email).toLowerCase();
  const company = clean(data.company);

  let duplicateQuery = supabase
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId);

  if (email) {
    duplicateQuery = duplicateQuery.eq("email", email);
  } else if (company) {
    duplicateQuery = duplicateQuery.eq("company", company).eq("customer_name", customerName);
  } else {
    duplicateQuery = duplicateQuery.eq("customer_name", customerName);
  }

  const { data: existing, error: existingError } = await duplicateQuery.maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    return {
      customer: existing,
      alreadyExists: true,
    };
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .insert([{
      organization_id: organizationId,
      customer_name: customerName,
      company: company || null,
      email: email || null,
      phone: clean(data.phone) || null,
      status,
      owner_employee_id: ownerEmployeeId,
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    customer,
    alreadyExists: false,
  };
}

async function createProjectFromCustomer({
  organizationId,
  employeeId,
  customer,
  quote,
}) {
  const supabase = createAdminSupabaseClient();

  if (
    quote.customer_id &&
    String(quote.customer_id) !== String(customer.id)
  ) {
    throw new Error("The selected quote belongs to a different customer.");
  }

  const { data: existingProjects, error: existingError } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId);

  if (existingError) throw new Error(existingError.message);

  const existingProject = (existingProjects || []).find((project) =>
    String(project.quote_id || "") === String(quote.id) ||
    (
      String(project.customer_id || "") === String(customer.id) &&
      normalise(project.status) !== "cancelled"
    )
  );

  if (existingProject) {
    return {
      project: existingProject,
      alreadyExisted: true,
    };
  }

  const company = clean(customer.company);
  const customerName = clean(customer.customer_name);

  // Only trusted, short structured quote fields may influence project naming.
  // Never allow conversation/prompt text, emails or long concatenated strings
  // to leak into a project name.
  const service =
    safeProjectService(quote.service) ||
    safeProjectService(quote.title) ||
    "";

  const accountName =
    company ||
    customerName ||
    clean(quote.client) ||
    "Customer";

  const projectName = service
    ? `${accountName} - ${service}`.slice(0, 120)
    : `${accountName} Project`.slice(0, 120);

  const ownerEmployeeId =
    customer.owner_employee_id ||
    quote.owner_employee_id ||
    employeeId;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert([{
      organization_id: organizationId,
      customer_id: customer.id,
      quote_id: quote.id,
      project_name: projectName,
      description:
        service ||
        `Delivery project for ${company || customerName || clean(quote.client) || "customer"}`,
      amount: quote.amount || null,
      status: "Planning",
      start_date: null,
      due_date: null,
      owner_employee_id: ownerEmployeeId,
    }])
    .select()
    .single();

  if (projectError) throw new Error(projectError.message);

  if (!quote.customer_id) {
    const { error: quoteUpdateError } = await supabase
      .from("quotes")
      .update({ customer_id: customer.id })
      .eq("id", quote.id)
      .eq("organization_id", organizationId);

    if (quoteUpdateError) {
      console.error(
        "Unable to link quote customer during AI project creation:",
        quoteUpdateError
      );
    }
  }

  return {
    project,
    alreadyExisted: false,
  };
}


async function convertQuoteToCustomerRecord({
  organizationId,
  employeeId,
  quote,
}) {
  const supabase = createAdminSupabaseClient();

  if (quote.customer_id) {
    const { data: linkedCustomer, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", quote.customer_id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (linkedCustomer) {
      return {
        customer: linkedCustomer,
        quote,
        alreadyExisted: true,
        alreadyLinked: true,
      };
    }
  }

  if (!quote.lead_id) {
    throw new Error(
      "This quote is not linked to a lead, so SaiNal AI cannot safely convert it to a customer."
    );
  }

  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId);

  if (customersError) throw new Error(customersError.message);

  const quoteEmail = normalise(quote.email);

  const existingCustomer = (customers || []).find((customer) => {
    const sameLead =
      Boolean(quote.lead_id) &&
      Boolean(customer.lead_id) &&
      String(customer.lead_id) === String(quote.lead_id);

    const sameEmail =
      Boolean(quoteEmail) &&
      Boolean(normalise(customer.email)) &&
      normalise(customer.email) === quoteEmail;

    return sameLead || sameEmail;
  }) || null;

  let customer = existingCustomer;
  let alreadyExisted = Boolean(existingCustomer);

  if (!customer) {
    const ownerEmployeeId =
      quote.owner_employee_id ||
      employeeId;

    const customerName =
      clean(quote.contact) ||
      clean(quote.client) ||
      "Customer";

    const { data: createdCustomer, error: customerCreateError } = await supabase
      .from("customers")
      .insert([{
        lead_id: quote.lead_id,
        customer_name: customerName,
        company: clean(quote.client) || null,
        email: clean(quote.email) || null,
        phone: clean(quote.phone) || null,
        status: "Active",
        organization_id: organizationId,
        owner_employee_id: ownerEmployeeId,
      }])
      .select()
      .single();

    if (customerCreateError) throw new Error(customerCreateError.message);

    customer = createdCustomer;
    alreadyExisted = false;
  }

  const { data: updatedQuote, error: quoteUpdateError } = await supabase
    .from("quotes")
    .update({
      customer_id: customer.id,
      status: "Accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", quote.id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (quoteUpdateError) {
    if (!alreadyExisted && customer?.id) {
      const { error: cleanupError } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id)
        .eq("organization_id", organizationId);

      if (cleanupError) {
        console.error("AI quote conversion rollback error:", cleanupError);
      }
    }

    throw new Error(
      `The customer could not be linked to the quote: ${quoteUpdateError.message}`
    );
  }

  return {
    customer,
    quote: updatedQuote,
    alreadyExisted,
    alreadyLinked: false,
  };
}

async function decideQuoteApproval({
  access,
  quote,
  decision,
}) {
  if (!["Approved", "Rejected"].includes(decision)) {
    throw new Error("Decision must be Approved or Rejected.");
  }

  const supabase = createAdminSupabaseClient();
  const organizationId = access.employee.organization_id;

  const { data: workflowRuns, error: runError } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("record_type", "quote")
    .eq("record_id", quote.id)
    .order("created_at", { ascending: false });

  if (runError) throw new Error(runError.message);

  if (!(workflowRuns || []).length) {
    throw new Error("No approval workflow run was found for this quote.");
  }

  const runIds = workflowRuns.map((run) => run.id).filter(Boolean);

  const { data: stepRuns, error: stepRunError } = await supabase
    .from("workflow_step_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .in("workflow_run_id", runIds)
    .in("status", ["Pending", "Waiting"])
    .order("created_at", { ascending: false });

  if (stepRunError) throw new Error(stepRunError.message);

  if (!(stepRuns || []).length) {
    throw new Error("This quote does not have a pending approval to decide.");
  }

  const workflowStepIds = [
    ...new Set(
      stepRuns
        .map((stepRun) => stepRun.workflow_step_id)
        .filter(Boolean)
    ),
  ];

  const { data: workflowSteps, error: workflowStepError } = await supabase
    .from("workflow_steps")
    .select("id,step_type,name")
    .eq("organization_id", organizationId)
    .in("id", workflowStepIds);

  if (workflowStepError) throw new Error(workflowStepError.message);

  const approvalStepIds = new Set(
    (workflowSteps || [])
      .filter((step) => step.step_type === "Approval")
      .map((step) => step.id)
  );

  const pendingApproval = (stepRuns || []).find(
    (stepRun) => approvalStepIds.has(stepRun.workflow_step_id)
  );

  if (!pendingApproval) {
    throw new Error("No pending approval step was found for this quote.");
  }

  const canManage = canManageWorkflows(access);
  const isAssignedApprover =
    Boolean(pendingApproval.assigned_employee_id) &&
    String(pendingApproval.assigned_employee_id) === String(access.employee.id);

  if (!canManage && !isAssignedApprover) {
    throw permissionError("This approval is assigned to another employee.");
  }

  const result = await resumeApprovalStep({
    supabase,
    organizationId,
    stepRunId: pendingApproval.id,
    decision,
    decidedByEmployeeId: access.employee.id,
  });

  return {
    decision,
    result,
  };
}



function taskParentProject(task, businessData) {
  if (!task?.project_id) return null;
  return byId(businessData.projects, task.project_id);
}

function assertTaskDeliveryUnlocked(task, businessData) {
  const project = taskParentProject(task, businessData);

  if (project && normalise(project.status) === "completed") {
    throw new Error(
      "This task belongs to a completed project and delivery is locked. Reopen the project before changing its tasks."
    );
  }

  return project;
}

function normaliseTaskPriority(value) {
  const priority = clean(value);
  if (normalise(priority) === "urgent") return "Critical";
  return priority || "Medium";
}

async function updateTaskRecord({
  organizationId,
  task,
  updates,
  businessData,
  employees,
  canAssign,
}) {
  assertTaskDeliveryUnlocked(task, businessData);

  const source =
    updates && typeof updates === "object"
      ? { ...updates }
      : {};

  if (Object.prototype.hasOwnProperty.call(source, "task_name")) {
    const taskName = clean(source.task_name);
    if (!taskName) throw new Error("Task name cannot be empty.");
    source.task_name = taskName;
  }

  if (Object.prototype.hasOwnProperty.call(source, "description")) {
    source.description = clean(source.description) || null;
  }

  if (Object.prototype.hasOwnProperty.call(source, "status")) {
    if (!TASK_STATUSES.includes(source.status)) {
      throw new Error("Invalid task status.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "priority")) {
    source.priority = normaliseTaskPriority(source.priority);
    if (!TASK_PRIORITIES.includes(source.priority)) {
      throw new Error("Invalid task priority.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "due_date")) {
    const dueDate = clean(source.due_date) || null;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new Error("Task due date must use YYYY-MM-DD format.");
    }
    source.due_date = dueDate;
  }

  if (Object.prototype.hasOwnProperty.call(source, "assigned_employee_id")) {
    if (!canAssign) {
      throw permissionError("You do not have permission to assign tasks.");
    }

    if (clean(source.assigned_employee_id)) {
      const employee = requireEmployee(employees, source.assigned_employee_id);
      source.assigned_employee_id = employee.id;
    } else {
      source.assigned_employee_id = null;
    }
  }

  const allowed = new Set([
    "task_name", "description", "status", "priority",
    "due_date", "assigned_employee_id",
  ]);

  const payload = Object.fromEntries(
    Object.entries(source).filter(([key]) => allowed.has(key))
  );

  if (!Object.keys(payload).length) {
    throw new Error("No supported task changes were provided.");
  }

  payload.updated_at = new Date().toISOString();

  const supabase = createAdminSupabaseClient();
  const { data: updated, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", task.id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updated;
}

async function changeTaskStatus({
  organizationId,
  task,
  status,
  businessData,
}) {
  assertTaskDeliveryUnlocked(task, businessData);

  if (!TASK_STATUSES.includes(status)) {
    throw new Error("Invalid task status.");
  }

  const supabase = createAdminSupabaseClient();
  const { data: updated, error } = await supabase
    .from("tasks")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updated;
}

async function createStandaloneProject({
  organizationId,
  employeeId,
  data,
  employees,
  canAssign,
}) {
  const projectName =
    safeCommercialText(data.project_name, "");

  if (!projectName) {
    throw new Error("A clear project name is required.");
  }

  const status =
    clean(data.status) ||
    "Planning";

  if (!PROJECT_STATUSES.includes(status)) {
    throw new Error("Invalid project status.");
  }

  if (status === "Completed") {
    throw new Error(
      "New projects cannot start as Completed. Create the project first and complete its delivery tasks."
    );
  }

  const startDate =
    clean(data.start_date) ||
    null;

  const dueDate =
    clean(data.due_date) ||
    null;

  const isDate =
    (value) =>
      !value ||
      /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (!isDate(startDate) || !isDate(dueDate)) {
    throw new Error("Project dates must use YYYY-MM-DD format.");
  }

  if (
    startDate &&
    dueDate &&
    dueDate < startDate
  ) {
    throw new Error(
      "Project due date cannot be before the start date."
    );
  }

  let ownerEmployeeId =
    employeeId;

  if (clean(data.owner_employee_id)) {
    if (!canAssign) {
      throw permissionError(
        "You do not have permission to assign projects."
      );
    }

    const owner =
      requireEmployee(
        employees,
        data.owner_employee_id
      );

    ownerEmployeeId =
      owner.id;
  }

  const supabase =
    createAdminSupabaseClient();

  const { data: created, error } =
    await supabase
      .from("projects")
      .insert([{
        organization_id:
          organizationId,

        customer_id:
          null,

        quote_id:
          null,

        project_name:
          projectName,

        description:
          safeCommercialText(
            data.description,
            ""
          ) ||
          null,

        amount:
          data.amount === null ||
          data.amount === undefined ||
          data.amount === ""
            ? null
            : moneyValue(
                data.amount
              ),

        status,

        start_date:
          startDate,

        due_date:
          dueDate,

        owner_employee_id:
          ownerEmployeeId,
      }])
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return created;
}

async function updateProjectRecord({
  organizationId,
  project,
  updates,
}) {
  const source =
    updates &&
    typeof updates === "object"
      ? { ...updates }
      : {};

  if (
    normalise(project.status) ===
    "completed"
  ) {
    throw new Error(
      "This project is completed and delivery is locked. Reopen it before making changes."
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "status"
    )
  ) {
    if (
      !PROJECT_STATUSES.includes(
        source.status
      )
    ) {
      throw new Error(
        "Invalid project status."
      );
    }

    if (
      source.status ===
      "Completed"
    ) {
      throw new Error(
        "Use the Complete Project action so SaiNal can verify all project tasks first."
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "project_name"
    )
  ) {
    const projectName =
      safeCommercialText(
        source.project_name,
        ""
      );

    if (!projectName) {
      throw new Error(
        "Project name cannot be empty."
      );
    }

    source.project_name =
      projectName;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "description"
    )
  ) {
    source.description =
      clean(source.description) ||
      null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "amount"
    )
  ) {
    source.amount =
      source.amount === null ||
      source.amount === undefined ||
      source.amount === ""
        ? null
        : moneyValue(
            source.amount
          );
  }

  const nextStart =
    Object.prototype.hasOwnProperty.call(
      source,
      "start_date"
    )
      ? clean(source.start_date) || null
      : project.start_date;

  const nextDue =
    Object.prototype.hasOwnProperty.call(
      source,
      "due_date"
    )
      ? clean(source.due_date) || null
      : project.due_date;

  const isDate =
    (value) =>
      !value ||
      /^\d{4}-\d{2}-\d{2}$/.test(
        String(value)
      );

  if (
    !isDate(nextStart) ||
    !isDate(nextDue)
  ) {
    throw new Error(
      "Project dates must use YYYY-MM-DD format."
    );
  }

  if (
    nextStart &&
    nextDue &&
    String(nextDue) <
      String(nextStart)
  ) {
    throw new Error(
      "Project due date cannot be before the start date."
    );
  }

  const allowed =
    new Set([
      "project_name",
      "description",
      "amount",
      "status",
      "start_date",
      "due_date",
      "owner_employee_id",
    ]);

  const payload =
    Object.fromEntries(
      Object.entries(
        source
      ).filter(
        ([key]) =>
          allowed.has(key)
      )
    );

  if (
    !Object.keys(
      payload
    ).length
  ) {
    throw new Error(
      "No supported project changes were provided."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  const {
    data: updated,
    error,
  } =
    await supabase
      .from("projects")
      .update(payload)
      .eq(
        "id",
        project.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return updated;
}

async function completeProjectRecord({
  organizationId,
  project,
  businessData,
}) {
  if (
    normalise(project.status) ===
    "completed"
  ) {
    return {
      project,
      alreadyCompleted:
        true,
    };
  }

  if (
    normalise(project.status) ===
    "cancelled"
  ) {
    throw new Error(
      "A cancelled project cannot be completed."
    );
  }

  const projectTasks =
    (businessData.tasks || [])
      .filter(
        (task) =>
          String(
            task.project_id ||
              ""
          ) ===
          String(
            project.id
          )
      );

  if (
    projectTasks.length ===
    0
  ) {
    throw new Error(
      "Complete all project tasks before closing the project. This project does not currently have any visible tasks."
    );
  }

  const incomplete =
    projectTasks.filter(
      (task) =>
        ![
          "completed",
          "complete",
          "done",
        ].includes(
          normalise(
            task.status
          )
        )
    );

  if (
    incomplete.length >
    0
  ) {
    throw new Error(
      `Complete all project tasks before closing the project. ${incomplete.length} task${incomplete.length === 1 ? " is" : "s are"} still incomplete.`
    );
  }

  const supabase =
    createAdminSupabaseClient();

  const {
    data: updated,
    error,
  } =
    await supabase
      .from("projects")
      .update({
        status:
          "Completed",
      })
      .eq(
        "id",
        project.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return {
    project:
      updated,

    alreadyCompleted:
      false,
  };
}

async function reopenProjectRecord({
  organizationId,
  project,
}) {
  if (
    normalise(project.status) !==
    "completed"
  ) {
    throw new Error(
      "Only completed projects can be reopened."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  const {
    data: updated,
    error,
  } =
    await supabase
      .from("projects")
      .update({
        status:
          "In Progress",
      })
      .eq(
        "id",
        project.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return updated;
}

async function generateDefaultProjectTasks({
  organizationId,
  employeeId,
  project,
  businessData,
}) {
  if (
    normalise(project.status) ===
    "completed"
  ) {
    throw new Error(
      "Tasks cannot be added to a completed project. Reopen it first."
    );
  }

  const existingTasks =
    (businessData.tasks || [])
      .filter(
        (task) =>
          String(
            task.project_id ||
              ""
          ) ===
          String(
            project.id
          )
      );

  const defaults = [
    {
      task_name:
        "Kick-off meeting",

      description:
        "Confirm project scope, delivery expectations and stakeholders.",

      priority:
        "High",
    },
    {
      task_name:
        "Confirm delivery plan",

      description:
        "Agree milestones, delivery dates and responsibilities.",

      priority:
        "High",
    },
    {
      task_name:
        "Complete implementation",

      description:
        "Deliver the agreed project scope.",

      priority:
        "Medium",
    },
    {
      task_name:
        "Customer review",

      description:
        "Complete customer review and resolve outstanding items.",

      priority:
        "Medium",
    },
    {
      task_name:
        "Project handover",

      description:
        "Complete final handover and confirm closure.",

      priority:
        "Medium",
    },
  ];

  const created = [];

  for (
    const item of defaults
  ) {
    const task =
      await createTask({
        organizationId,
        employeeId,
        businessData,
        data: {
          project_id:
            project.id,

          assigned_employee_id:
            project.owner_employee_id ||
            employeeId,

          task_name:
            item.task_name,

          description:
            item.description,

          status:
            "To Do",

          priority:
            item.priority,

          due_date:
            null,
        },
      });

    created.push(
      task
    );
  }

  return {
    tasks:
      created,

    hadExistingTasks:
      existingTasks.length >
      0,

    existingTaskCount:
      existingTasks.length,
  };
}

async function createInvoiceFromProject({
  organizationId,
  employeeId,
  project,
  businessData,
  profile,
}) {
  if (
    normalise(project.status) !==
    "completed"
  ) {
    throw new Error(
      "Only completed projects can generate a project invoice."
    );
  }

  if (
    !project.customer_id
  ) {
    throw new Error(
      "This project is not linked to a customer, so an invoice cannot be generated automatically."
    );
  }

  const existing =
    (businessData.invoices || [])
      .find(
        (invoice) =>
          String(
            invoice.project_id ||
              ""
          ) ===
          String(
            project.id
          ) &&
          normalise(
            invoice.status
          ) !==
          "cancelled"
      );

  if (existing) {
    return {
      invoice:
        existing,

      alreadyExists:
        true,
    };
  }

  const customer =
    requireRecord(
      byId(
        businessData.customers,
        project.customer_id
      ),
      "customer"
    );

  const quote =
    project.quote_id
      ? byId(
          businessData.quotes,
          project.quote_id
        )
      : null;

  const service =
    safeCommercialText(
      quote?.service,
      ""
    ) ||
    safeCommercialText(
      project.description,
      ""
    ) ||
    safeCommercialText(
      project.project_name,
      "Project Service"
    );

  const subtotal =
    moneyValue(
      project.amount
    );

  if (
    subtotal <
    0
  ) {
    throw new Error(
      "Project amount cannot be negative."
    );
  }

  const invoice =
    await createInvoiceRecord({
      organizationId,
      employeeId,
      businessData,
      profile,
      data: {
        customer_id:
          customer.id,

        project_id:
          project.id,

        quote_id:
          quote?.id ||
          null,

        client:
          clean(
            customer.company
          ) ||
          clean(
            customer.customer_name
          ) ||
          project.project_name,

        service,

        subtotal,

        vat_rate:
          0,
      },
    });

  return {
    invoice,

    alreadyExists:
      false,
  };
}

async function resolveTaskProjectForCreate({
  organizationId,
  data,
  businessData,
}) {
  if (data.project_id) {
    const visible =
      byId(
        businessData.projects,
        data.project_id
      );

    if (visible) {
      return visible;
    }

    /*
     * The AI business-data snapshot can omit closed/completed delivery
     * records. Check the organisation record directly only to enforce the
     * delivery lock; never use a hidden active record to bypass visibility.
     */
    const supabase =
      createAdminSupabaseClient();

    const {
      data: databaseProject,
      error,
    } =
      await supabase
        .from("projects")
        .select("id,project_name,status")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "id",
          data.project_id
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (
      databaseProject &&
      normalise(
        databaseProject.status
      ) === "completed"
    ) {
      throw new Error(
        "This project is completed and delivery is locked. Reopen the project before creating new tasks."
      );
    }

    throw permissionError(
      "The selected project is not available with your current permissions."
    );
  }

  const explicitProjectName =
    clean(
      data.project_name
    );

  if (!explicitProjectName) {
    return null;
  }

  const visibleMatches =
    (businessData.projects || [])
      .filter(
        (project) =>
          normalise(
            project.project_name
          ) ===
          normalise(
            explicitProjectName
          )
      );

  if (
    visibleMatches.length === 1
  ) {
    data.project_id =
      visibleMatches[0].id;

    return visibleMatches[0];
  }

  if (
    visibleMatches.length > 1
  ) {
    throw new Error(
      "More than one project matches that project name. Please specify which project you mean."
    );
  }

  /*
   * Important for completed projects: they may not be present in the
   * assistant's active-project snapshot. Query only by exact organisation
   * project name so a completed project cannot accidentally become a
   * standalone task.
   */
  const supabase =
    createAdminSupabaseClient();

  const {
    data: databaseProjects,
    error,
  } =
    await supabase
      .from("projects")
      .select("id,project_name,status")
      .eq(
        "organization_id",
        organizationId
      )
      .ilike(
        "project_name",
        explicitProjectName
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (
    (databaseProjects || []).length >
    1
  ) {
    throw new Error(
      "More than one project matches that project name. Please specify which project you mean."
    );
  }

  const databaseProject =
    databaseProjects?.[0] ||
    null;

  if (!databaseProject) {
    throw new Error(
      `I could not find the project "${explicitProjectName}", so I did not create a standalone task.`
    );
  }

  if (
    normalise(
      databaseProject.status
    ) === "completed"
  ) {
    throw new Error(
      "This project is completed and delivery is locked. Reopen the project before creating new tasks."
    );
  }

  /*
   * If an active project exists in the database but was not in the
   * permission-filtered business data, do not attach the task to it.
   */
  throw permissionError(
    "The selected project is not available with your current permissions."
  );
}

async function createTask({ organizationId, employeeId, data, businessData = {} }) {
  const resolvedProject =
    await resolveTaskProjectForCreate({
      organizationId,
      data,
      businessData,
    });

  if (
    resolvedProject &&
    normalise(
      resolvedProject.status
    ) === "completed"
  ) {
    throw new Error(
      "This project is completed and delivery is locked. Reopen the project before creating new tasks."
    );
  }
  data.priority = normaliseTaskPriority(data.priority);

  if (data.status && !TASK_STATUSES.includes(data.status)) {
    throw new Error("Invalid task status.");
  }

  if (data.priority && !TASK_PRIORITIES.includes(data.priority)) {
    throw new Error("Invalid task priority.");
  }

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

function activityRelatedCollection(
  relatedType,
  businessData
) {
  return {
    Lead:
      businessData.leads,

    Customer:
      businessData.customers,

    Quote:
      businessData.quotes,

    Proposal:
      businessData.proposals,

    Project:
      businessData.projects,

    Invoice:
      businessData.invoices,
  }[relatedType] || null;
}

function validateActivityDate(value, label) {
  if (!value) return null;

  const text = clean(value);

  if (
    label === "due date" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    throw new Error(
      "Activity due date must use YYYY-MM-DD format."
    );
  }

  if (
    label === "scheduled date/time" &&
    Number.isNaN(
      new Date(text).getTime()
    )
  ) {
    throw new Error(
      "Scheduled date and time are not valid."
    );
  }

  return text;
}

function normaliseActivityStatusForType(
  activityType,
  status
) {
  const requested =
    clean(status);

  if (requested) {
    if (
      !ACTIVITY_STATUSES.includes(
        requested
      )
    ) {
      throw new Error(
        "Invalid activity status."
      );
    }

    return requested;
  }

  return [
    "Call",
    "Meeting",
    "Demo",
  ].includes(activityType)
    ? "Scheduled"
    : "Pending";
}

function assertActivityRelatedRecord({
  relatedType,
  relatedId,
  businessData,
  results = [],
}) {
  if (
    !relatedType ||
    relatedType === "General"
  ) {
    return null;
  }

  const collection =
    activityRelatedCollection(
      relatedType,
      businessData
    );

  if (!collection) {
    throw new Error(
      "Invalid related activity record type."
    );
  }

  const previous =
    results
      .flatMap(
        (item) => [
          item.data?.lead,
          item.data?.customer,
          item.data?.project,
          item.data?.quote,
          item.data?.proposal,
          item.data?.invoice,
        ]
      )
      .find(
        (item) =>
          String(item?.id || "") ===
          String(relatedId || "")
      );

  return requireRecord(
    byId(
      collection,
      relatedId
    ) ||
      previous,
    String(
      relatedType
    ).toLowerCase()
  );
}

async function createActivity({
  organizationId,
  employeeId,
  data,
  businessData,
  results = [],
}) {
  const type =
    clean(
      data.activity_type
    ) ||
    "Follow-up";

  if (
    !ACTIVITY_TYPES.includes(
      type
    )
  ) {
    throw new Error(
      "Invalid activity type."
    );
  }

  const scheduledAt =
    validateActivityDate(
      data.scheduled_at,
      "scheduled date/time"
    );

  const dueDate =
    validateActivityDate(
      data.due_date,
      "due date"
    );

  if (
    [
      "Call",
      "Meeting",
      "Demo",
    ].includes(type) &&
    !scheduledAt
  ) {
    throw new Error(
      `${type} date and time are required.`
    );
  }

  const status =
    normaliseActivityStatusForType(
      type,
      data.status
    );

  const relatedType =
    clean(
      data.related_type
    ) ||
    "General";

  const allowedRelatedTypes = [
    "General",
    "Lead",
    "Customer",
    "Quote",
    "Proposal",
    "Project",
    "Invoice",
  ];

  if (
    !allowedRelatedTypes.includes(
      relatedType
    )
  ) {
    throw new Error(
      "Invalid related activity record type."
    );
  }

  const relatedRecord =
    assertActivityRelatedRecord({
      relatedType,
      relatedId:
        data.related_id,
      businessData,
      results,
    });

  const title =
    safeCommercialText(
      data.title,
      ""
    );

  if (!title) {
    throw new Error(
      "Activity title is required."
    );
  }

  const now =
    new Date()
      .toISOString();

  const supabase =
    createAdminSupabaseClient();

  const {
    data: created,
    error,
  } =
    await supabase
      .from("follow_ups")
      .insert([{
        organization_id:
          organizationId,

        activity_type:
          type,

        related_type:
          relatedType,

        related_id:
          relatedRecord?.id ||
          null,

        title,

        note:
          clean(data.note) ||
          null,

        due_date:
          dueDate,

        scheduled_at:
          scheduledAt,

        completed_at:
          status === "Completed"
            ? now
            : null,

        outcome:
          clean(data.outcome) ||
          null,

        status,

        assigned_employee_id:
          data.assigned_employee_id ||
          employeeId,

        created_at:
          now,

        updated_at:
          now,
      }])
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return created;
}

async function updateActivityRecord({
  organizationId,
  activity,
  updates,
  businessData,
  employees,
  canAssign,
  results = [],
}) {
  const source =
    updates &&
    typeof updates === "object"
      ? { ...updates }
      : {};

  const nextActivityType =
    Object.prototype.hasOwnProperty.call(
      source,
      "activity_type"
    )
      ? clean(
          source.activity_type
        )
      : activity.activity_type ||
        "Follow-up";

  if (
    !ACTIVITY_TYPES.includes(
      nextActivityType
    )
  ) {
    throw new Error(
      "Invalid activity type."
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "title"
    )
  ) {
    const title =
      safeCommercialText(
        source.title,
        ""
      );

    if (!title) {
      throw new Error(
        "Activity title cannot be empty."
      );
    }

    source.title =
      title;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "note"
    )
  ) {
    source.note =
      clean(source.note) ||
      null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "outcome"
    )
  ) {
    source.outcome =
      clean(source.outcome) ||
      null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "due_date"
    )
  ) {
    source.due_date =
      validateActivityDate(
        source.due_date,
        "due date"
      );
  }

  const nextScheduledAt =
    Object.prototype.hasOwnProperty.call(
      source,
      "scheduled_at"
    )
      ? validateActivityDate(
          source.scheduled_at,
          "scheduled date/time"
        )
      : activity.scheduled_at ||
        null;

  if (
    [
      "Call",
      "Meeting",
      "Demo",
    ].includes(
      nextActivityType
    ) &&
    !nextScheduledAt
  ) {
    throw new Error(
      `${nextActivityType} date and time are required.`
    );
  }

  const nextStatus =
    Object.prototype.hasOwnProperty.call(
      source,
      "status"
    )
      ? clean(source.status)
      : activity.status ||
        "Pending";

  if (
    !ACTIVITY_STATUSES.includes(
      nextStatus
    )
  ) {
    throw new Error(
      "Invalid activity status."
    );
  }

  if (
    nextStatus ===
      "Rescheduled" &&
    !nextScheduledAt
  ) {
    throw new Error(
      "A new scheduled date and time are required when rescheduling an activity."
    );
  }

  if (
    nextStatus === "Completed" &&
    normalise(
      activity.status
    ) !== "completed" &&
    !Object.prototype.hasOwnProperty.call(
      source,
      "completed_at"
    )
  ) {
    source.completed_at =
      new Date()
        .toISOString();
  }

  if (
    nextStatus !== "Completed" &&
    normalise(
      activity.status
    ) === "completed" &&
    !Object.prototype.hasOwnProperty.call(
      source,
      "completed_at"
    )
  ) {
    source.completed_at =
      null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "completed_at"
    ) &&
    source.completed_at
  ) {
    validateActivityDate(
      source.completed_at,
      "scheduled date/time"
    );
  }

  const wantsRelatedType =
    Object.prototype.hasOwnProperty.call(
      source,
      "related_type"
    );

  const wantsRelatedId =
    Object.prototype.hasOwnProperty.call(
      source,
      "related_id"
    );

  if (
    wantsRelatedType ||
    wantsRelatedId
  ) {
    const nextRelatedType =
      wantsRelatedType
        ? clean(
            source.related_type
          )
        : activity.related_type ||
          "General";

    const allowedRelatedTypes = [
      "General",
      "Lead",
      "Customer",
      "Quote",
      "Proposal",
      "Project",
      "Invoice",
    ];

    if (
      !allowedRelatedTypes.includes(
        nextRelatedType
      )
    ) {
      throw new Error(
        "Invalid related activity record type."
      );
    }

    const nextRelatedId =
      wantsRelatedId
        ? source.related_id
        : activity.related_id;

    if (
      nextRelatedType ===
      "General"
    ) {
      source.related_type =
        "General";

      source.related_id =
        null;
    } else {
      const relatedRecord =
        assertActivityRelatedRecord({
          relatedType:
            nextRelatedType,
          relatedId:
            nextRelatedId,
          businessData,
          results,
        });

      source.related_type =
        nextRelatedType;

      source.related_id =
        relatedRecord.id;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "assigned_employee_id"
    )
  ) {
    if (!canAssign) {
      throw permissionError(
        "You do not have permission to assign activities."
      );
    }

    if (
      clean(
        source.assigned_employee_id
      )
    ) {
      const employee =
        requireEmployee(
          employees,
          source.assigned_employee_id
        );

      source.assigned_employee_id =
        employee.id;
    } else {
      source.assigned_employee_id =
        null;
    }
  }

  const allowed =
    new Set([
      "activity_type",
      "title",
      "note",
      "due_date",
      "scheduled_at",
      "completed_at",
      "outcome",
      "status",
      "related_type",
      "related_id",
      "assigned_employee_id",
    ]);

  const payload =
    Object.fromEntries(
      Object.entries(
        source
      ).filter(
        ([key]) =>
          allowed.has(key)
      )
    );

  if (
    !Object.keys(
      payload
    ).length
  ) {
    throw new Error(
      "No supported activity changes were provided."
    );
  }

  payload.updated_at =
    new Date()
      .toISOString();

  const supabase =
    createAdminSupabaseClient();

  const {
    data: updated,
    error,
  } =
    await supabase
      .from("follow_ups")
      .update(payload)
      .eq(
        "id",
        activity.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return updated;
}

async function changeActivityStatus({
  organizationId,
  activity,
  status,
  outcome,
}) {
  if (
    !ACTIVITY_STATUSES.includes(
      status
    )
  ) {
    throw new Error(
      "Invalid activity status."
    );
  }

  if (
    status === "No Answer" &&
    normalise(
      activity.activity_type
    ) !== "call"
  ) {
    throw new Error(
      "Only Call activities can be marked No Answer."
    );
  }

  const payload = {
    status,
    updated_at:
      new Date()
        .toISOString(),
  };

  if (
    clean(outcome)
  ) {
    payload.outcome =
      clean(outcome);
  }

  if (
    status === "Completed"
  ) {
    payload.completed_at =
      new Date()
        .toISOString();
  } else if (
    normalise(
      activity.status
    ) === "completed"
  ) {
    payload.completed_at =
      null;
  }

  const supabase =
    createAdminSupabaseClient();

  const {
    data: updated,
    error,
  } =
    await supabase
      .from("follow_ups")
      .update(payload)
      .eq(
        "id",
        activity.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return updated;
}

async function rescheduleActivityRecord({
  organizationId,
  activity,
  scheduledAt,
}) {
  if (
    ![
      "Call",
      "Meeting",
      "Demo",
    ].includes(
      activity.activity_type
    )
  ) {
    throw new Error(
      "Only Calls, Meetings and Demos can be rescheduled to a specific date and time."
    );
  }

  const nextScheduledAt =
    validateActivityDate(
      scheduledAt,
      "scheduled date/time"
    );

  if (!nextScheduledAt) {
    throw new Error(
      "A new scheduled date and time are required when rescheduling an activity."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  const {
    data: updated,
    error,
  } =
    await supabase
      .from("follow_ups")
      .update({
        scheduled_at:
          nextScheduledAt,

        due_date:
          null,

        status:
          "Rescheduled",

        completed_at:
          null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        activity.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return updated;
}


function employeeEmailIdentity({
  access,
  companyName,
}) {
  const employeeName =
    clean(
      access?.employee?.name
    ) ||
    clean(
      access?.employee?.full_name
    ) ||
    clean(
      `${access?.employee?.first_name || ""} ${access?.employee?.last_name || ""}`
    ) ||
    "SaiNal One Team";

  const jobTitle =
    clean(
      access?.employee?.job_title
    ) ||
    clean(
      access?.employee?.position
    ) ||
    clean(
      access?.employee?.title
    );

  return {
    employeeName,
    jobTitle,
    companyName:
      clean(companyName) ||
      "SaiNal Technologies Ltd",
  };
}

function stripTrailingEmailSignature(
  value,
  {
    employeeName,
    jobTitle,
    companyName,
  } = {}
) {
  let body =
    clean(value);

  if (!body) return "";

  /*
   * Remove placeholder / bare closings first.
   */
  body =
    body
      .replace(
        /\n{2,}(?:kind|best|warm) regards,?\s*\n+(?:\[your name\]|your name)(?:\s*\n+[^\n]+){0,2}\s*$/i,
        ""
      )
      .replace(
        /\n{2,}(?:kind|best|warm) regards,?\s*$/i,
        ""
      )
      .trim();

  /*
   * If the message already contains the authenticated SaiNal signature,
   * remove only that trailing copy so it can be appended exactly once.
   */
  const lines = [
    "Kind regards,",
    employeeName,
    ...(jobTitle ? [jobTitle] : []),
    companyName,
  ].filter(Boolean);

  const escaped =
    lines.map(
      (line) =>
        String(line).replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )
    );

  if (escaped.length >= 3) {
    const signaturePattern =
      new RegExp(
        `\\n{2,}(?:kind|best|warm) regards,?\\s*\\n+${escaped
          .slice(1)
          .join("\\s*\\n+")}\\s*$`,
        "i"
      );

    body =
      body.replace(
        signaturePattern,
        ""
      ).trim();
  }

  return body;
}

function applyEmployeeEmailSignature({
  message,
  access,
  companyName,
  closing = "Kind regards,",
}) {
  const identity =
    employeeEmailIdentity({
      access,
      companyName,
    });

  const body =
    stripTrailingEmailSignature(
      message,
      identity
    ) ||
    "Hi,\n\nJust following up as discussed.";

  const signature = [
    closing,
    identity.employeeName,
    ...(identity.jobTitle
      ? [identity.jobTitle]
      : []),
    identity.companyName,
  ].join("\n");

  return {
    message:
      `${body}\n\n${signature}`,

    ...identity,
  };
}


async function draftEmail({
  data,
  openai,
  profile,
  access,
}) {
  const recipient =
    clean(
      data.to
    ).toLowerCase();

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
    clean(
      data.subject
    );

  const requestedMessage =
    clean(
      data.message
    );

  const companyName =
    clean(
      profile?.companyName
    ) ||
    "SaiNal Technologies Ltd";

  const tone =
    [
      "Professional",
      "Friendly",
      "Concise",
      "Sales",
    ].includes(
      clean(data.tone)
    )
      ? clean(data.tone)
      : "Professional";

  const closing =
    tone === "Friendly" ||
    tone === "Sales"
      ? "Best regards,"
      : "Kind regards,";

  if (
    requestedSubject &&
    requestedMessage
  ) {
    const signed =
      applyEmployeeEmailSignature({
        message:
          requestedMessage,
        access,
        companyName,
        closing,
      });

    return {
      to:
        recipient,

      subject:
        requestedSubject,

      message:
        signed.message,

      related_type:
        clean(
          data.related_type
        ) ||
        "General",

      related_id:
        data.related_id ||
        null,

      tone,

      draft:
        true,
    };
  }

  const response =
    await openai.chat.completions.create({
      model:
        "gpt-4.1-mini",

      response_format: {
        type:
          "json_object",
      },

      messages: [
        {
          role:
            "system",

          content:
            `You are SaiNal One AI Email Assistant.

Prepare a UK business email draft.
Return JSON only:
{"subject":"...","message":"..."}

Business:
${companyName}

Requested tone:
${tone}

Rules:
- Keep the writing natural and appropriate to the requested tone.
- Professional = polished and businesslike.
- Friendly = warm but still professional.
- Concise = short and direct.
- Sales = persuasive without making unsupported claims.
- Use only details from the supplied instruction.
- Do not invent facts, dates, pricing, commitments or previous conversations.
- Return only the email body in message.
- Do NOT add a closing sign-off, signature, sender name, job title, company name or placeholders such as [Your Name].
- SaiNal One adds the authenticated employee signature automatically.
- The draft remains editable and must not imply that it has already been sent.`,
        },
        {
          role:
            "user",

          content:
            `Recipient: ${recipient}
Related type: ${clean(data.related_type) || "General"}
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
    ) ||
    {};

  const signed =
    applyEmployeeEmailSignature({
      message:
        clean(
          parsed.message
        ) ||
        "Hi,\n\nJust following up as discussed.",

      access,
      companyName,
      closing,
    });

  return {
    to:
      recipient,

    subject:
      clean(
        parsed.subject
      ) ||
      requestedSubject ||
      "Follow-up",

    message:
      signed.message,

    related_type:
      clean(
        data.related_type
      ) ||
      "General",

    related_id:
      data.related_id ||
      null,

    tone,

    draft:
      true,
  };
}


async function sendEmail({
  access,
  data,
}) {
  const recipient =
    clean(
      data.to
    ).toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      recipient
    )
  ) {
    throw new Error(
      "A valid recipient email address is required."
    );
  }

  const subject =
    clean(
      data.subject
    );

  const rawMessage =
    clean(
      data.message
    );

  if (
    !subject ||
    !rawMessage
  ) {
    throw new Error(
      "Email subject and message are required."
    );
  }

  const emailPermissions =
    getRecordPermissions(
      access,
      {
        prefix:
          "emails",
        module:
          "Emails",
      }
    );

  const canSend =
    Boolean(
      access.employee
        .is_organization_owner
    ) ||
    emailPermissions.canCreate ||
    emailPermissions.canSend ||
    access.can(
      "emails.send"
    ) ||
    access.canModuleAction(
      "Emails",
      "send"
    ) ||
    access.canModuleAction(
      "Communication",
      "send"
    );

  if (!canSend) {
    throw permissionError(
      "You do not have permission to send emails."
    );
  }

  const relatedType =
    clean(
      data.related_type
    ) ||
    "General";

  const config = {
    Lead: {
      table:
        "leads",
      prefix:
        "leads",
      module:
        "Leads",
    },

    Customer: {
      table:
        "customers",
      prefix:
        "customers",
      module:
        "Customers",
    },

    Project: {
      table:
        "projects",
      prefix:
        "projects",
      module:
        "Projects",
    },
  }[relatedType];

  const supabase =
    createAdminSupabaseClient();

  let relatedRecord =
    null;

  if (
    relatedType !==
      "General"
  ) {
    if (!config) {
      throw new Error(
        "Invalid related email record type."
      );
    }

    if (
      !data.related_id
    ) {
      throw new Error(
        `A related ${relatedType.toLowerCase()} is required for this email.`
      );
    }

    const {
      data:
        record,
      error,
    } =
      await supabase
        .from(
          config.table
        )
        .select("*")
        .eq(
          "organization_id",
          access.employee
            .organization_id
        )
        .eq(
          "id",
          data.related_id
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (!record) {
      throw new Error(
        "Related record not found."
      );
    }

    const permissions =
      getRecordPermissions(
        access,
        {
          prefix:
            config.prefix,
          module:
            config.module,
        }
      );

    const visible =
      await canViewOwnedRecord({
        supabase,
        access,
        permissions,
        record,
      });

    if (!visible) {
      throw permissionError(
        "You do not have permission to email this record."
      );
    }

    relatedRecord =
      record;
  }

  const {
    data:
      settings,
    error:
      settingsError,
  } =
    await supabase
      .from(
        "company_settings"
      )
      .select(
        "company_name"
      )
      .eq(
        "organization_id",
        access.employee
          .organization_id
      )
      .maybeSingle();

  if (settingsError) {
    throw new Error(
      settingsError.message
    );
  }

  if (
    !process.env
      .RESEND_API_KEY ||
    !process.env
      .EMAIL_FROM
  ) {
    throw new Error(
      "Email service is not configured."
    );
  }

  const companyName =
    settings
      ?.company_name ||
    "SaiNal Technologies Ltd";

  /*
   * A draft may already include the authenticated employee signature.
   * Normalise it here and append exactly one signature before sending.
   */
  const signed =
    applyEmployeeEmailSignature({
      message:
        rawMessage,
      access,
      companyName,
      closing:
        "Kind regards,",
    });

  const finalMessage =
    signed.message;

  const escaped =
    String(
      finalMessage
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      )
      .replace(
        /\r?\n/g,
        "<br />"
      );

  const resend =
    new Resend(
      process.env
        .RESEND_API_KEY
    );

  const {
    data:
      sent,
    error:
      sendError,
  } =
    await resend.emails.send({
      from:
        process.env
          .EMAIL_FROM,

      to: [
        recipient,
      ],

      subject,

      html:
        `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#27241f;max-width:760px;margin:0 auto;">
          <div style="border-bottom:3px solid #d5a51d;padding-bottom:16px;margin-bottom:24px;">
            <div style="font-size:21px;font-weight:700;">${String(companyName)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;")}</div>
          </div>
          <div>${escaped}</div>
        </div>`,
    });

  const now =
    new Date()
      .toISOString();

  const status =
    sendError
      ? "Failed"
      : "Sent";

  const label =
    relatedType === "Lead"
      ? relatedRecord?.name ||
        relatedRecord?.company
      : relatedType === "Customer"
        ? relatedRecord?.customer_name ||
          relatedRecord?.name ||
          relatedRecord?.company
        : relatedType === "Project"
          ? relatedRecord?.project_name ||
            relatedRecord?.name ||
            relatedRecord?.title
          : null;

  const {
    error:
      logError,
  } =
    await supabase
      .from(
        "email_logs"
      )
      .insert([
        {
          organization_id:
            access.employee
              .organization_id,

          recipient,

          subject,

          message_body:
            finalMessage,

          email_type:
            relatedType,

          related_record_id:
            relatedRecord?.id ||
            null,

          related_record_number:
            label ||
            null,

          status,

          provider:
            "Resend",

          provider_email_id:
            sent?.id ||
            null,

          error_message:
            sendError?.message ||
            null,

          sent_at:
            sendError
              ? null
              : now,

          created_at:
            now,
        },
      ]);

  if (logError) {
    console.error(
      "AI email log error:",
      logError
    );
  }

  if (sendError) {
    throw new Error(
      sendError.message ||
      "The email could not be sent."
    );
  }

  return {
    id:
      sent?.id ||
      null,

    to:
      recipient,

    subject,

    message:
      finalMessage,

    related_type:
      relatedType,

    related_id:
      relatedRecord?.id ||
      null,

    history_logged:
      !logError,
  };
}


function proposalToSafeHtml({ proposal, companyName, employeeName, jobTitle }) {
  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const content = escapeHtml(proposal.proposal_text || "").replace(/\n/g, "<br />");
  const contact = escapeHtml(proposal.contact || "there");
  const service = escapeHtml(proposal.service || proposal.title || "the requested service");
  const amount = clean(proposal.amount);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#27241f;max-width:760px;margin:0 auto;">
      <div style="border-bottom:3px solid #d5a51d;padding-bottom:18px;margin-bottom:26px;">
        <div style="font-size:22px;font-weight:700;">${escapeHtml(companyName)}</div>
        <div style="margin-top:4px;color:#77736a;">Proposal ${escapeHtml(proposal.proposal_number || "")}</div>
      </div>
      <p>Hello ${contact},</p>
      <p>Please find our proposal below for <strong>${service}</strong>.</p>
      <div style="margin:26px 0;padding:22px;border:1px solid #e6e1d6;border-radius:12px;background:#faf8f2;">
        ${content}
      </div>
      ${amount ? `<p><strong>Proposal value:</strong> ${escapeHtml(amount)}</p>` : ""}
      <p style="margin-top:30px;">
        Kind regards,<br />
        <strong>${escapeHtml(employeeName)}</strong>
        ${jobTitle ? `<br />${escapeHtml(jobTitle)}` : ""}
        <br />${escapeHtml(companyName)}
      </p>
    </div>
  `;
}

async function sendProposalRecord({ access, proposal, data }) {
  const proposalPermissions = getRecordPermissions(access, {
    prefix: "proposals",
    module: "Proposals",
  });

  const canSend =
    proposalPermissions.canSend ||
    access.can("proposals.send") ||
    access.canModuleAction("Proposals", "send");

  if (!canSend) {
    throw permissionError("You do not have permission to send proposals.");
  }

  const supabase = createAdminSupabaseClient();

  const visible = await canViewOwnedRecord({
    supabase,
    access,
    permissions: proposalPermissions,
    record: proposal,
  });

  if (!visible) {
    throw permissionError("You do not have permission to send this proposal.");
  }

  const recipient = (clean(data.to) || clean(proposal.email)).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("A valid recipient email address is required.");
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Email service is not configured.");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("company_settings")
    .select("company_name")
    .eq("organization_id", access.employee.organization_id)
    .maybeSingle();

  if (settingsError) throw new Error(settingsError.message);

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

  const subject =
    clean(data.subject) ||
    `${clean(proposal.title) || "Proposal"} – ${clean(proposal.proposal_number)}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: emailResult, error: sendError } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: [recipient],
    subject,
    html: proposalToSafeHtml({
      proposal,
      companyName,
      employeeName,
      jobTitle,
    }),
  });

  if (sendError) {
    throw new Error(sendError.message || "The proposal email could not be sent.");
  }

  const nextStatus =
    normalise(proposal.status) === "accepted"
      ? "Accepted"
      : "Sent";

  const { data: updatedProposal, error: updateError } = await supabase
    .from("proposals")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposal.id)
    .eq("organization_id", access.employee.organization_id)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  const now = new Date().toISOString();
  const { error: logError } = await supabase.from("email_logs").insert([{
    organization_id: access.employee.organization_id,
    record_type: "proposal",
    record_id: proposal.id,
    recipient_email: recipient,
    subject,
    status: "Sent",
    provider: "Resend",
    provider_message_id: emailResult?.id || null,
    sent_by_user_id: access.user?.id || null,
    sent_by_employee_id: access.employee.id,
    created_at: now,
  }]);

  if (logError) {
    console.error("AI proposal email log error:", logError);
  }

  return {
    proposal: updatedProposal,
    email: {
      id: emailResult?.id || null,
      to: recipient,
      subject,
    },
  };
}


function formatInvoiceCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatInvoiceVatRate(value) {
  const number = Number(value || 0);
  return `${Number.isInteger(number) ? number : number.toFixed(2)}%`;
}

async function createInvoiceRecord({
  organizationId,
  employeeId,
  businessData,
  profile,
  data,
}) {
  const supabase = createAdminSupabaseClient();

  const customer = requireRecord(
    byId(businessData.customers, data.customer_id),
    "customer"
  );

  const subtotal = moneyValue(data.subtotal ?? data.amount);
  if (subtotal < 0) throw new Error("Invoice subtotal cannot be negative.");
  if (subtotal <= 0) throw new Error("A positive invoice subtotal is required.");

  const service = safeCommercialText(data.service, "");
  if (!service) throw new Error("A clear service description is required.");

  const vatRateRaw =
    data.vat_rate !== undefined && data.vat_rate !== null && data.vat_rate !== ""
      ? Number(String(data.vat_rate).replace("%", "").trim())
      : Number(profile?.vatRate || 0);

  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw : 0;
  if (vatRate < 0 || vatRate > 100) {
    throw new Error("VAT rate must be between 0 and 100.");
  }

  const vatAmount = Math.round((subtotal * vatRate / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  const ownerEmployeeId =
    clean(data.owner_employee_id) ||
    employeeId;

  const createdAt = new Date();
  const dueDate =
    clean(data.due_date) ||
    new Date(createdAt.getTime() + 14 * 86400000).toISOString().slice(0, 10);

  const invoiceNumber =
    `SNI-${createdAt.getFullYear()}-${Date.now().toString().slice(-6)}`;

  const { data: createdInvoice, error } = await supabase
    .from("invoices")
    .insert([{
      organization_id: organizationId,
      customer_id: customer.id,
      project_id: clean(data.project_id) || null,
      quote_id: clean(data.quote_id) || null,
      invoice_number: invoiceNumber,
      client: safeCommercialText(
        data.client,
        clean(customer.company) || clean(customer.customer_name) || "Customer"
      ),
      service,
      amount: formatInvoiceCurrency(total),
      subtotal: formatInvoiceCurrency(subtotal),
      vat_rate: formatInvoiceVatRate(vatRate),
      vat_amount: formatInvoiceCurrency(vatAmount),
      total_amount: formatInvoiceCurrency(total),
      status: "Draft Invoice",
      created_at: createdAt.toISOString(),
      due_date: dueDate,
      payment_terms: clean(data.payment_terms) || clean(profile?.paymentTerms) || "Payment due within 14 days of invoice date.",
      owner_employee_id: ownerEmployeeId,
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return createdInvoice;
}

async function updateInvoiceRecord({
  organizationId,
  invoice,
  updates,
}) {
  const supabase = createAdminSupabaseClient();
  const safeUpdates = { ...(updates || {}) };

  if (safeUpdates.status) {
    if (!INVOICE_STATUSES.includes(safeUpdates.status)) {
      throw new Error("Invalid invoice status.");
    }
    if (["Sent", "Paid", "Partially Paid", "Cancelled"].includes(safeUpdates.status)) {
      throw new Error(
        "This invoice status is controlled by sending, payment or cancellation actions."
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(safeUpdates, "service")) {
    const service = safeCommercialText(safeUpdates.service, "");
    if (!service) throw new Error("Service cannot be empty.");
    safeUpdates.service = service;
  }

  if (Object.prototype.hasOwnProperty.call(safeUpdates, "client")) {
    const client = safeCommercialText(safeUpdates.client, "");
    if (!client) throw new Error("Client cannot be empty.");
    safeUpdates.client = client;
  }

  const hasFinancial =
    Object.prototype.hasOwnProperty.call(safeUpdates, "subtotal") ||
    Object.prototype.hasOwnProperty.call(safeUpdates, "amount") ||
    Object.prototype.hasOwnProperty.call(safeUpdates, "vat_rate");

  if (hasFinancial) {
    const subtotal = moneyValue(
      safeUpdates.subtotal ?? safeUpdates.amount ?? invoice.subtotal ?? invoice.amount
    );
    const vatRate = Number(
      String(safeUpdates.vat_rate ?? invoice.vat_rate ?? 0)
        .replace("%", "")
        .trim()
    );

    if (subtotal < 0) throw new Error("Subtotal cannot be negative.");
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      throw new Error("VAT rate must be between 0 and 100.");
    }

    const vatAmount = Math.round((subtotal * vatRate / 100) * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    safeUpdates.subtotal = formatInvoiceCurrency(subtotal);
    safeUpdates.amount = formatInvoiceCurrency(total);
    safeUpdates.vat_rate = formatInvoiceVatRate(vatRate);
    safeUpdates.vat_amount = formatInvoiceCurrency(vatAmount);
    safeUpdates.total_amount = formatInvoiceCurrency(total);
  }

  const allowed = new Set([
    "client", "service", "status", "due_date", "payment_terms",
    "subtotal", "amount", "vat_rate", "vat_amount", "total_amount",
    "owner_employee_id",
  ]);

  const payload = Object.fromEntries(
    Object.entries(safeUpdates).filter(([key]) => allowed.has(key))
  );

  const { data: updatedInvoice, error } = await supabase
    .from("invoices")
    .update(payload)
    .eq("id", invoice.id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updatedInvoice;
}

function invoiceToSafeHtml({ invoice, settings, message, employeeName, jobTitle }) {
  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const companyName = settings?.company_name || "SaiNal Technologies Ltd";
  const custom = clean(message)
    ? `<div style="margin:20px 0;padding:14px;border-left:4px solid #d5a51d;background:#fbf8ef;">${escapeHtml(message).replace(/\n/g, "<br />")}</div>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#28251f;max-width:760px;margin:0 auto;">
      <div style="border-bottom:3px solid #d5a51d;padding-bottom:18px;margin-bottom:24px;">
        <div style="font-size:22px;font-weight:700;">${escapeHtml(companyName)}</div>
        <div>Invoice ${escapeHtml(invoice.invoice_number || "")}</div>
      </div>
      <p>Hello,</p>
      <p>Please find your invoice details below.</p>
      ${custom}
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <tr><td style="padding:9px;border-bottom:1px solid #eee;"><strong>Client</strong></td><td style="padding:9px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(invoice.client)}</td></tr>
        <tr><td style="padding:9px;border-bottom:1px solid #eee;"><strong>Service</strong></td><td style="padding:9px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(invoice.service)}</td></tr>
        <tr><td style="padding:9px;border-bottom:1px solid #eee;"><strong>Subtotal</strong></td><td style="padding:9px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(invoice.subtotal || invoice.amount)}</td></tr>
        <tr><td style="padding:9px;border-bottom:1px solid #eee;"><strong>VAT</strong></td><td style="padding:9px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(invoice.vat_amount || "£0.00")} ${invoice.vat_rate ? `(${escapeHtml(invoice.vat_rate)})` : ""}</td></tr>
        <tr><td style="padding:12px;"><strong>Total</strong></td><td style="padding:12px;text-align:right;font-size:20px;font-weight:700;">${escapeHtml(invoice.total_amount || invoice.amount || "£0.00")}</td></tr>
      </table>
      ${invoice.due_date ? `<p><strong>Due date:</strong> ${escapeHtml(invoice.due_date)}</p>` : ""}
      ${invoice.payment_terms ? `<p><strong>Payment terms:</strong><br />${escapeHtml(invoice.payment_terms).replace(/\n/g, "<br />")}</p>` : ""}
      <p style="margin-top:30px;">Kind regards,<br /><strong>${escapeHtml(employeeName)}</strong>${jobTitle ? `<br />${escapeHtml(jobTitle)}` : ""}<br />${escapeHtml(companyName)}</p>
    </div>
  `;
}

async function sendInvoiceRecord({ access, invoice, businessData, data }) {
  const permissions = getRecordPermissions(access, {
    prefix: "invoices",
    module: "Invoices",
  });

  const canSend =
    permissions.canSend ||
    access.can("invoices.send") ||
    access.canModuleAction("Invoices", "send");

  if (!canSend) throw permissionError("You do not have permission to send invoices.");
  if (normalise(invoice.status) === "cancelled") {
    throw new Error("Cancelled invoices cannot be sent.");
  }

  const supabase = createAdminSupabaseClient();
  const organizationId = access.employee.organization_id;

  const visible = await canViewOwnedRecord({
    supabase,
    access,
    permissions,
    record: invoice,
  });
  if (!visible) throw permissionError("You do not have permission to send this invoice.");

  const customer = (businessData.customers || []).find(
    (item) => String(item.id || "") === String(invoice.customer_id || "")
  );
  const quote = (businessData.quotes || []).find(
    (item) => String(item.id || "") === String(invoice.quote_id || "")
  );

  const recipient = (
    clean(data.to) ||
    clean(customer?.email) ||
    clean(quote?.email) ||
    clean(invoice.email)
  ).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("A valid recipient email address is required.");
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Email service is not configured.");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("company_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message);

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

  const subject =
    clean(data.subject) ||
    `Invoice ${clean(invoice.invoice_number)} from ${companyName}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: emailResult, error: sendError } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: [recipient],
    subject,
    html: invoiceToSafeHtml({
      invoice,
      settings,
      message: data.message,
      employeeName,
      jobTitle,
    }),
  });

  if (sendError) throw new Error(sendError.message || "The invoice email could not be sent.");

  const currentStatus = normalise(invoice.status);
  const nextStatus = ["paid", "partially paid"].includes(currentStatus)
    ? invoice.status
    : "Sent";

  const { data: updatedInvoice, error: updateError } = await supabase
    .from("invoices")
    .update({ status: nextStatus })
    .eq("id", invoice.id)
    .eq("organization_id", organizationId)
    .select()
    .single();
  if (updateError) throw new Error(updateError.message);

  const { error: logError } = await supabase.from("email_logs").insert([{
    organization_id: organizationId,
    record_type: "invoice",
    record_id: invoice.id,
    recipient_email: recipient,
    subject,
    status: "Sent",
    provider: "Resend",
    provider_message_id: emailResult?.id || null,
    sent_by_user_id: access.user?.id || null,
    sent_by_employee_id: access.employee.id,
    created_at: new Date().toISOString(),
  }]);

  if (logError) console.error("AI invoice email log error:", logError);

  return {
    invoice: updatedInvoice,
    email: {
      id: emailResult?.id || null,
      to: recipient,
      subject,
    },
  };
}

async function recordInvoicePayment({
  organizationId,
  employeeId,
  invoice,
  amount,
  paymentDate,
  paymentMethod,
  reference,
  notes,
}) {
  const supabase = createAdminSupabaseClient();

  const currentStatus = normalise(invoice.status);
  if (currentStatus === "cancelled") {
    throw new Error("Payments cannot be recorded against a cancelled invoice.");
  }
  if (currentStatus === "paid") {
    throw new Error("This invoice is already fully paid.");
  }
  if (["draft", "draft invoice"].includes(currentStatus)) {
    throw new Error("Send the invoice before recording a payment.");
  }

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
      payment_date: clean(paymentDate) || now.slice(0, 10),
      payment_method: clean(paymentMethod) || "Bank Transfer",
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
      if (!permissions.leads.canCreate) {
        throw permissionError(
          "You do not have permission to create leads."
        );
      }

      /*
       * The lead service currently extracts fields from natural language.
       * Deterministic planning now carries structured name/company/email,
       * so always reconstruct a complete prompt when those fields exist.
       * This prevents a short action label such as "Create new lead: Emma Carter"
       * from producing an "Unknown Lead".
       */
      const structuredName =
        clean(data.name);

      const structuredCompany =
        clean(data.company);

      const structuredEmail =
        clean(data.email).toLowerCase();

      const leadPrompt =
        structuredName
          ? [
              `Create a lead for ${structuredName}`,
              structuredCompany
                ? `from ${structuredCompany}`
                : "",
              structuredEmail
                ? `with email ${structuredEmail}`
                : "",
            ]
              .filter(Boolean)
              .join(" ")
          : clean(data.prompt) ||
            action.label;

      const result =
        await createLeadFromPrompt({
          prompt:
            leadPrompt,
          profile,
          organizationId,
          employeeId,
          openai,
        });

      let lead =
        result.created ||
        result.existing;

      if (!lead) {
        throw new Error(
          "Lead creation did not return a lead record."
        );
      }

      /*
       * Earlier AI runs could create a placeholder record with the correct
       * email but "Unknown Lead" / "Unknown Company". Because leadService
       * de-duplicates by email, future correct requests would keep returning
       * that bad placeholder forever. Repair that exact placeholder safely
       * when the current request supplies trusted structured values.
       */
      if (
        result.alreadyExists &&
        lead?.id &&
        structuredName &&
        (
          normalise(lead.name) ===
            "unknown lead" ||
          normalise(lead.company) ===
            "unknown company"
        )
      ) {
        const repair = {};

        if (
          normalise(lead.name) ===
          "unknown lead"
        ) {
          repair.name =
            structuredName;
        }

        if (
          structuredCompany &&
          normalise(lead.company) ===
            "unknown company"
        ) {
          repair.company =
            structuredCompany;
        }

        if (
          structuredEmail &&
          !clean(lead.email)
        ) {
          repair.email =
            structuredEmail;
        }

        if (
          Object.keys(repair).length
        ) {
          const supabase =
            createAdminSupabaseClient();

          const {
            data:
              repairedLead,
            error:
              repairError,
          } =
            await supabase
              .from("leads")
              .update(repair)
              .eq(
                "id",
                lead.id
              )
              .eq(
                "organization_id",
                organizationId
              )
              .select()
              .single();

          if (repairError) {
            throw new Error(
              repairError.message
            );
          }

          lead =
            repairedLead;
        }
      }

      return {
        message:
          result.alreadyExists
            ? `Lead already exists: ${lead.name || structuredName || "Lead"}`
            : `Lead created: ${lead.name || structuredName || "Lead"}`,

        data: {
          lead,
          created:
            lead,
        },
      };
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
      if (!moneyValue(data.amount)) {
        throw new Error("A quote amount is required before SaiNal AI can create the quote.");
      }
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
    case "create_customer": {
      if (!permissions.customers.canCreate) {
        throw permissionError("You do not have permission to create customers.");
      }

      const result = await createCustomer({
        organizationId,
        employeeId,
        data,
        employees,
        canAssign: permissions.customers.canAssign,
      });

      return {
        message: result.alreadyExists
          ? `Customer already exists: ${result.customer.customer_name}`
          : `Customer created: ${result.customer.customer_name}`,
        data: {
          customer: result.customer,
          created: result.customer,
        },
      };
    }

    case "create_project_from_customer": {
      if (!permissions.projects.canCreate) {
        throw permissionError("You do not have permission to create projects.");
      }

      const customer = requireRecord(
        byId(businessData.customers, data.customer_id),
        "customer"
      );

      const quote = requireRecord(
        byId(businessData.quotes, data.quote_id),
        "quote"
      );

      if (
        !["accepted", "approved"].includes(
          normalise(quote.status)
        )
      ) {
        throw new Error(
          `Project creation requires an Accepted or Approved quote. ${quote.quote_number || "The selected quote"} is currently ${quote.status || "not approved"}.`
        );
      }

      const result = await createProjectFromCustomer({
        organizationId,
        employeeId,
        customer,
        quote,
      });

      return {
        message: result.alreadyExisted
          ? `Project already exists: ${result.project.project_name}`
          : `Project created: ${result.project.project_name}`,
        data: {
          customer,
          quote,
          project: result.project,
          created: result.project,
        },
      };
    }

    case "update_customer": {
      const customer = requireRecord(byId(businessData.customers, data.record_id), "customer");
      if (!permissions.customers.canEdit && !ownerChange) throw permissionError("You do not have permission to edit customers.");
      if (ownerChange && !permissions.customers.canAssign) throw permissionError("You do not have permission to assign customers.");
      if (ownerChange) requireEmployee(employees, data.updates.owner_employee_id);
      const updated = await genericUpdate({ table: "customers", organizationId, recordId: customer.id, updates: data.updates, allowed: ["customer_name","company","email","phone","status","owner_employee_id"] });
      return { message: `Customer updated: ${updated.customer_name}`, data: { customer: updated, updated } };
    }
    case "create_project": {
      if (
        !permissions.projects.canCreate
      ) {
        throw permissionError(
          "You do not have permission to create projects."
        );
      }

      const project =
        await createStandaloneProject({
          organizationId,
          employeeId,
          data,
          employees,
          canAssign:
            permissions.projects.canAssign,
        });

      return {
        message:
          `Project created: ${project.project_name}`,

        data: {
          project,
          created:
            project,
        },
      };
    }

    case "complete_project": {
      if (
        !permissions.projects.canEdit
      ) {
        throw permissionError(
          "You do not have permission to complete projects."
        );
      }

      const project =
        requireRecord(
          byId(
            businessData.projects,
            data.record_id
          ),
          "project"
        );

      const result =
        await completeProjectRecord({
          organizationId,
          project,
          businessData,
        });

      return {
        message:
          result.alreadyCompleted
            ? `Project already completed: ${result.project.project_name}`
            : `Project completed: ${result.project.project_name}`,

        data: {
          project:
            result.project,

          updated:
            result.project,
        },
      };
    }

    case "reopen_project": {
      if (
        !permissions.projects.canEdit
      ) {
        throw permissionError(
          "You do not have permission to reopen projects."
        );
      }

      const project =
        requireRecord(
          byId(
            businessData.projects,
            data.record_id
          ),
          "project"
        );

      const updated =
        await reopenProjectRecord({
          organizationId,
          project,
        });

      return {
        message:
          `Project reopened: ${updated.project_name}`,

        data: {
          project:
            updated,

          updated,
        },
      };
    }

    case "generate_default_project_tasks": {
      if (
        !permissions.tasks.canCreate
      ) {
        throw permissionError(
          "You do not have permission to create project tasks."
        );
      }

      const project =
        requireRecord(
          byId(
            businessData.projects,
            data.record_id
          ),
          "project"
        );

      const result =
        await generateDefaultProjectTasks({
          organizationId,
          employeeId,
          project,
          businessData,
        });

      return {
        message:
          result.hadExistingTasks
            ? `Default project tasks created for ${project.project_name}. The project already had ${result.existingTaskCount} task${result.existingTaskCount === 1 ? "" : "s"}.`
            : `Default project tasks created for ${project.project_name}.`,

        data: {
          project,
          tasks:
            result.tasks,
          created:
            result.tasks,
        },
      };
    }

    case "create_invoice_from_project": {
      if (
        !permissions.invoices.canCreate
      ) {
        throw permissionError(
          "You do not have permission to create invoices."
        );
      }

      const project =
        requireRecord(
          byId(
            businessData.projects,
            data.record_id
          ),
          "project"
        );

      const result =
        await createInvoiceFromProject({
          organizationId,
          employeeId,
          project,
          businessData,
          profile,
        });

      return {
        message:
          result.alreadyExists
            ? `Invoice already exists for this project: ${result.invoice.invoice_number}`
            : `Invoice created from project: ${result.invoice.invoice_number}`,

        data: {
          project,
          invoice:
            result.invoice,

          created:
            result.invoice,
        },
      };
    }

    case "update_project": {
      const project = requireRecord(
        byId(
          businessData.projects,
          data.record_id
        ),
        "project"
      );

      if (
        !permissions.projects.canEdit &&
        !ownerChange
      ) {
        throw permissionError(
          "You do not have permission to edit projects."
        );
      }

      if (
        ownerChange &&
        !permissions.projects.canAssign
      ) {
        throw permissionError(
          "You do not have permission to assign projects."
        );
      }

      if (
        ownerChange &&
        data.updates?.owner_employee_id
      ) {
        requireEmployee(
          employees,
          data.updates.owner_employee_id
        );
      }

      const updated =
        await updateProjectRecord({
          organizationId,
          project,
          updates:
            data.updates,
        });

      return {
        message:
          `Project updated: ${updated.project_name}`,

        data: {
          project:
            updated,

          updated,
        },
      };
    }
    case "create_task": {
      if (!permissions.tasks.canCreate) throw permissionError("You do not have permission to create tasks.");
      if (
        data.project_id &&
        !data.project_name
      ) {
        const existing =
          byId(
            businessData.projects,
            data.project_id
          ) ||
          results
            .map(
              (item) =>
                item.data?.project
            )
            .find(
              (item) =>
                String(item?.id || "") ===
                String(data.project_id)
            );

        requireRecord(
          existing,
          "project"
        );
      }
      if (data.assigned_employee_id) {
        if (!permissions.tasks.canAssign) throw permissionError("You do not have permission to assign tasks.");
        requireEmployee(employees, data.assigned_employee_id);
      }
      const task = await createTask({ organizationId, employeeId, data, businessData });
      return { message: `Task created: ${task.task_name}`, data: { task, created: task } };
    }
    case "start_task":
    case "resume_task":
    case "block_task":
    case "complete_task":
    case "reopen_task": {
      if (!permissions.tasks.canEdit) {
        throw permissionError("You do not have permission to update tasks.");
      }

      const task = requireRecord(
        byId(businessData.tasks, data.record_id),
        "task"
      );

      const statusMap = {
        start_task: "In Progress",
        resume_task: "In Progress",
        block_task: "Blocked",
        complete_task: "Completed",
        reopen_task: "To Do",
      };

      const updated = await changeTaskStatus({
        organizationId,
        task,
        status: statusMap[action.type],
        businessData,
      });

      return {
        message: `Task updated: ${updated.task_name} → ${updated.status}`,
        data: { task: updated, updated },
      };
    }

    case "update_task": {
      const task = requireRecord(
        byId(businessData.tasks, data.record_id),
        "task"
      );

      const ownerChange = Object.prototype.hasOwnProperty.call(
        data.updates || {},
        "assigned_employee_id"
      );

      if (!permissions.tasks.canEdit && !ownerChange) {
        throw permissionError("You do not have permission to edit tasks.");
      }

      if (ownerChange && !permissions.tasks.canAssign) {
        throw permissionError("You do not have permission to assign tasks.");
      }

      const updated = await updateTaskRecord({
        organizationId,
        task,
        updates: data.updates,
        businessData,
        employees,
        canAssign: permissions.tasks.canAssign,
      });

      return {
        message: `Task updated: ${updated.task_name}`,
        data: { task: updated, updated },
      };
    }

    case "create_activity": {
      if (!permissions.followUps.canCreate) {
        throw permissionError(
          "You do not have permission to create activities."
        );
      }

      if (data.assigned_employee_id) {
        if (!permissions.followUps.canAssign) {
          throw permissionError(
            "You do not have permission to assign activities."
          );
        }

        requireEmployee(
          employees,
          data.assigned_employee_id
        );
      }

      const activity =
        await createActivity({
          organizationId,
          employeeId,
          data,
          businessData,
          results,
        });

      return {
        message:
          `${activity.activity_type || "Activity"} created: ${activity.title}`,

        data: {
          activity,
          created:
            activity,
        },
      };
    }

    case "update_activity": {
      const activity =
        requireRecord(
          byId(
            businessData.followUps,
            data.record_id
          ),
          "activity"
        );

      const wantsAssignment =
        Object.prototype.hasOwnProperty.call(
          data.updates || {},
          "assigned_employee_id"
        );

      if (
        !permissions.followUps.canEdit &&
        !wantsAssignment
      ) {
        throw permissionError(
          "You do not have permission to edit activities."
        );
      }

      if (
        wantsAssignment &&
        !permissions.followUps.canAssign
      ) {
        throw permissionError(
          "You do not have permission to assign activities."
        );
      }

      const updated =
        await updateActivityRecord({
          organizationId,
          activity,
          updates:
            data.updates,
          businessData,
          employees,
          canAssign:
            permissions.followUps.canAssign,
          results,
        });

      return {
        message:
          `${updated.activity_type || "Activity"} updated: ${updated.title}`,

        data: {
          activity:
            updated,
          updated,
        },
      };
    }

    case "start_activity":
    case "complete_activity":
    case "mark_activity_no_answer":
    case "cancel_activity":
    case "reopen_activity": {
      if (!permissions.followUps.canEdit) {
        throw permissionError(
          "You do not have permission to update activities."
        );
      }

      const activity =
        requireRecord(
          byId(
            businessData.followUps,
            data.record_id
          ),
          "activity"
        );

      const statusMap = {
        start_activity:
          "In Progress",

        complete_activity:
          "Completed",

        mark_activity_no_answer:
          "No Answer",

        cancel_activity:
          "Cancelled",

        reopen_activity:
          [
            "Call",
            "Meeting",
            "Demo",
          ].includes(
            activity.activity_type
          ) &&
          activity.scheduled_at
            ? "Scheduled"
            : "Pending",
      };

      const updated =
        await changeActivityStatus({
          organizationId,
          activity,
          status:
            statusMap[
              action.type
            ],
          outcome:
            data.outcome,
        });

      return {
        message:
          `${updated.activity_type || "Activity"} updated: ${updated.title} → ${updated.status}`,

        data: {
          activity:
            updated,
          updated,
        },
      };
    }

    case "reschedule_activity": {
      if (!permissions.followUps.canEdit) {
        throw permissionError(
          "You do not have permission to reschedule activities."
        );
      }

      const activity =
        requireRecord(
          byId(
            businessData.followUps,
            data.record_id
          ),
          "activity"
        );

      const updated =
        await rescheduleActivityRecord({
          organizationId,
          activity,
          scheduledAt:
            data.scheduled_at,
        });

      return {
        message:
          `${updated.activity_type || "Activity"} rescheduled: ${updated.title}`,

        data: {
          activity:
            updated,
          updated,
        },
      };
    }
    case "submit_quote_for_approval": {
      const quote = requireRecord(
        byId(businessData.quotes, data.record_id),
        "quote"
      );

      if (!permissions.quotes.canEdit && !permissions.quotes.canApprove) {
        throw permissionError(
          "You do not have permission to submit quotes for approval."
        );
      }

      if (!access.user?.id) {
        throw new Error("User identity is required to submit a quote for approval.");
      }

      const supabase = createAdminSupabaseClient();

      const result = await submitQuoteForApproval({
        supabase,
        organizationId,
        userId: access.user.id,
        employee: access.employee,
        quoteId: quote.id,
      });

      return {
        message: `Quote submitted for approval: ${result.quote?.quote_number || quote.quote_number}`,
        data: {
          quote: result.quote || quote,
          workflow: result.workflow,
        },
      };
    }

    case "convert_quote_to_customer": {
      const quote = requireRecord(
        byId(businessData.quotes, data.record_id),
        "quote"
      );

      const canConvertQuote =
        Boolean(permissions.quotes.canConvert || permissions.quotes.canEdit);

      if (!canConvertQuote) {
        throw permissionError("You do not have permission to convert quotes.");
      }

      if (!permissions.customers.canCreate) {
        throw permissionError("You do not have permission to create customers.");
      }

      const result = await convertQuoteToCustomerRecord({
        organizationId,
        employeeId,
        quote,
      });

      return {
        message: result.alreadyLinked
          ? `Quote already linked to customer: ${result.customer.customer_name}`
          : result.alreadyExisted
            ? `Existing customer linked: ${result.customer.customer_name}`
            : `Customer created and linked: ${result.customer.customer_name}`,
        data: {
          quote: result.quote,
          customer: result.customer,
          created: result.customer,
        },
      };
    }

    case "decide_quote_approval": {
      const quote = requireRecord(
        byId(businessData.quotes, data.record_id),
        "quote"
      );

      const decision = clean(data.decision);

      const result = await decideQuoteApproval({
        access,
        quote,
        decision,
      });

      return {
        message:
          decision === "Approved"
            ? `Quote approved: ${quote.quote_number}`
            : `Quote rejected: ${quote.quote_number}`,
        data: {
          quote,
          decision: result.decision,
          approval: result.result,
        },
      };
    }

    case "update_quote": {
      const quote = requireRecord(byId(businessData.quotes, data.record_id), "quote");
      if (!permissions.quotes.canEdit && !ownerChange) throw permissionError("You do not have permission to edit quotes.");

      if (data.updates?.status) {
        if (!QUOTE_STATUSES.includes(data.updates.status)) {
          throw new Error("Invalid quote status.");
        }

        if (["Pending Approval", "Approved", "Rejected", "Accepted"].includes(data.updates.status)) {
          throw new Error(
            "This quote status is controlled by the quote workflow. Use submit, approval/rejection, or quote-to-customer conversion instead."
          );
        }
      }
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
    case "send_proposal": {
      const proposal = requireRecord(
        byId(businessData.proposals, data.record_id),
        "proposal"
      );

      const result = await sendProposalRecord({
        access,
        proposal,
        data,
      });

      return {
        message: `Proposal sent: ${result.proposal.proposal_number} to ${result.email.to}`,
        data: {
          proposal: result.proposal,
          email: result.email,
        },
      };
    }

    case "update_proposal": {
      const proposal = requireRecord(byId(businessData.proposals, data.record_id), "proposal");
      if (!permissions.proposals.canEdit && !ownerChange) throw permissionError("You do not have permission to edit proposals.");

      if (data.updates?.status) {
        if (!PROPOSAL_STATUSES.includes(data.updates.status)) {
          throw new Error("Invalid proposal status.");
        }

        if (data.updates.status === "Sent") {
          throw new Error(
            "To mark a proposal Sent, use the Send Proposal action so the customer actually receives it."
          );
        }
      }
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
    case "create_invoice": {
      if (!permissions.invoices.canCreate) {
        throw permissionError("You do not have permission to create invoices.");
      }

      if (data.owner_employee_id) {
        if (!permissions.invoices.canAssign) {
          throw permissionError("You do not have permission to assign invoices.");
        }
        requireEmployee(employees, data.owner_employee_id);
      }

      const invoice = await createInvoiceRecord({
        organizationId,
        employeeId,
        businessData,
        profile,
        data,
      });

      return {
        message: `Invoice created: ${invoice.invoice_number}`,
        data: { invoice, created: invoice },
      };
    }

    case "update_invoice": {
      const invoice = requireRecord(
        byId(businessData.invoices, data.record_id),
        "invoice"
      );

      if (!permissions.invoices.canEdit && !ownerChange) {
        throw permissionError("You do not have permission to edit invoices.");
      }

      if (ownerChange) {
        if (!permissions.invoices.canAssign) {
          throw permissionError("You do not have permission to assign invoices.");
        }
        if (data.updates.owner_employee_id) {
          requireEmployee(employees, data.updates.owner_employee_id);
        }
      }

      const updated = await updateInvoiceRecord({
        organizationId,
        invoice,
        updates: data.updates,
      });

      return {
        message: `Invoice updated: ${updated.invoice_number}`,
        data: { invoice: updated, updated },
      };
    }

    case "send_invoice": {
      const invoice = requireRecord(
        byId(businessData.invoices, data.record_id),
        "invoice"
      );

      const result = await sendInvoiceRecord({
        access,
        invoice,
        businessData,
        data,
      });

      return {
        message: `Invoice sent: ${result.invoice.invoice_number} to ${result.email.to}`,
        data: {
          invoice: result.invoice,
          email: result.email,
        },
      };
    }

    case "cancel_invoice": {
      if (!permissions.invoices.canEdit) {
        throw permissionError("You do not have permission to cancel invoices.");
      }

      const invoice = requireRecord(
        byId(businessData.invoices, data.record_id),
        "invoice"
      );

      if (normalise(invoice.status) === "cancelled") {
        return {
          message: `Invoice already cancelled: ${invoice.invoice_number}`,
          data: { invoice },
        };
      }

      if (normalise(invoice.status) === "paid") {
        throw new Error("A paid invoice cannot be cancelled through SaiNal AI.");
      }

      const supabase = createAdminSupabaseClient();
      const { data: cancelledInvoice, error } = await supabase
        .from("invoices")
        .update({ status: "Cancelled", updated_at: new Date().toISOString() })
        .eq("id", invoice.id)
        .eq("organization_id", organizationId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return {
        message: `Invoice cancelled: ${cancelledInvoice.invoice_number}`,
        data: { invoice: cancelledInvoice, updated: cancelledInvoice },
      };
    }

    case "record_invoice_payment": {
      if (!permissions.invoices.canEdit) throw permissionError("You do not have permission to record invoice payments.");
      const invoice = requireRecord(byId(businessData.invoices, data.record_id), "invoice");
      const result = await recordInvoicePayment({
        organizationId,
        employeeId,
        invoice,
        amount: data.amount,
        paymentDate: data.payment_date,
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
      if (!["approved", "accepted"].includes(normalise(quote.status))) {
        throw new Error("Only Approved or Accepted quotes can be converted to invoices.");
      }
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
        paymentDate: data.payment_date,
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
      const email =
        await sendEmail({
          access,
          data,
        });

      return {
        message:
          email.history_logged
            ? `Email sent to ${email.to}`
            : `Email sent to ${email.to}, but the email history could not be recorded.`,

        data: {
          email,
        },
      };
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
