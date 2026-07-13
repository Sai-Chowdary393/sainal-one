import { convertLeadToCustomerAndProject } from "../services/customerProjectService";
import { createTaskFromPrompt } from "../services/taskService";
import {
  convertQuoteToInvoice,
} from "../services/invoiceService";
import { createFollowUpFromPrompt } from "../services/followUpService";
import { findMatchingRecord } from "../utils/matching";

export function isWorkflowRequest(prompt) {
  const text = String(prompt || "").toLowerCase();

  const workflowPhrases = [
    "accepted the quote",
    "accepted our quote",
    "accepted the proposal",
    "start the project",
    "create the project",
    "create onboarding task",
    "create an onboarding task",
    "create the invoice",
    "prepare the invoice",
    "schedule a follow-up",
    "schedule a follow up",
  ];

  const matches = workflowPhrases.filter((phrase) =>
    text.includes(phrase)
  );

  /*
   * Treat the request as a workflow when:
   * 1. It explicitly says a quote/proposal was accepted, or
   * 2. It requests at least two connected business actions.
   */
  return (
    text.includes("accepted the quote") ||
    text.includes("accepted our quote") ||
    text.includes("accepted the proposal") ||
    matches.length >= 2
  );
}

function findWorkflowLead(prompt, leads) {
  return findMatchingRecord(prompt, leads, [
    "name",
    "company",
    "email",
  ]);
}

function findWorkflowQuote(prompt, quotes, lead) {
  const directQuote = findMatchingRecord(prompt, quotes, [
    "quote_number",
    "contact",
    "client",
    "email",
  ]);

  if (directQuote) {
    return directQuote;
  }

  if (!lead) {
    return null;
  }

  const leadQuote = quotes.find(
    (quote) =>
      String(quote.lead_id || "") === String(lead.id)
  );

  if (leadQuote) {
    return leadQuote;
  }

  return quotes.find(
    (quote) =>
      String(quote.contact || "").toLowerCase() ===
        String(lead.name || "").toLowerCase() ||
      String(quote.client || "").toLowerCase() ===
        String(lead.company || "").toLowerCase() ||
      (lead.email &&
        String(quote.email || "").toLowerCase() ===
          String(lead.email).toLowerCase())
  );
}

function getWorkflowTaskDatePhrase(prompt) {
  const text = String(prompt || "").toLowerCase();

  if (text.includes("day after tomorrow")) {
    return "day after tomorrow";
  }

  if (text.includes("tomorrow")) {
    return "tomorrow";
  }

  if (text.includes("next week")) {
    return "next week";
  }

  if (text.includes("after one week")) {
    return "after one week";
  }

  if (text.includes("in one week")) {
    return "in one week";
  }

  if (text.includes("next monday")) {
    return "next Monday";
  }

  if (text.includes("next tuesday")) {
    return "next Tuesday";
  }

  if (text.includes("next wednesday")) {
    return "next Wednesday";
  }

  if (text.includes("next thursday")) {
    return "next Thursday";
  }

  if (text.includes("next friday")) {
    return "next Friday";
  }

  const dateMatch = prompt.match(
    /\b(?:on\s+)?(?:20\d{2}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]20\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2})\b/i
  );

  if (dateMatch) {
    return dateMatch[0];
  }

  return "tomorrow";
}

function wantsTask(prompt) {
  const text = String(prompt || "").toLowerCase();

  return (
    text.includes("task") ||
    text.includes("onboarding") ||
    text.includes("start the project")
  );
}

function wantsInvoice(prompt) {
  const text = String(prompt || "").toLowerCase();

  return (
    text.includes("invoice") ||
    text.includes("accepted the quote") ||
    text.includes("accepted our quote") ||
    text.includes("accepted the proposal")
  );
}

function wantsFollowUp(prompt) {
  const text = String(prompt || "").toLowerCase();

  return (
    text.includes("follow-up") ||
    text.includes("follow up") ||
    text.includes("schedule")
  );
}

export async function executeWorkflow({
  prompt,
  profile,
  leads,
  quotes,
  projects,
  invoices,
  organizationId,
}) {
  const lead = findWorkflowLead(prompt, leads);

  if (!lead) {
    return {
      handled: true,
      success: false,
      answer:
        "⚠️ I could not identify the lead for this workflow. Please include the exact lead name, company name or email address.",
    };
  }

  const quote = findWorkflowQuote(prompt, quotes, lead);

  const completedActions = [];
  const skippedActions = [];
  const warnings = [];

  /*
   * Step 1:
   * Convert the lead into a customer and create/find the project.
   */
  const conversionResult =
    await convertLeadToCustomerAndProject({
      prompt: `${prompt} Convert ${lead.name} lead to customer and create project`,
      leads,
      projects,
      organizationId,
    });

  if (conversionResult.notFound) {
    return {
      handled: true,
      success: false,
      answer:
        "⚠️ The workflow could not continue because the matching lead was not found.",
    };
  }

  const customer = conversionResult.customer;
  const project = conversionResult.project;

  completedActions.push(
    conversionResult.customerAlreadyExists
      ? "Customer already existed"
      : "Customer created"
  );

  completedActions.push(
    conversionResult.projectAlreadyExists
      ? "Project already existed"
      : "Project created"
  );

  completedActions.push("Lead status updated to Won");

  /*
   * Step 2:
   * Create an onboarding task under the created/found project.
   */
  let taskResult = null;

  if (wantsTask(prompt) && project) {
    const datePhrase = getWorkflowTaskDatePhrase(prompt);

    const taskPrompt = `Create task Complete client onboarding for ${project.project_name} ${datePhrase}`;

    taskResult = await createTaskFromPrompt({
      prompt: taskPrompt,
      projects: [project, ...projects],
      organizationId,
    });

    if (taskResult.alreadyExists) {
      skippedActions.push(
        `Task already existed: ${taskResult.existing.task_name}`
      );
    } else {
      completedActions.push(
        `Task created: ${taskResult.created.task_name}`
      );
    }
  }

  /*
   * Step 3:
   * Create the invoice from the matching quote.
   */
  let invoiceResult = null;

  if (wantsInvoice(prompt)) {
    if (!quote) {
      warnings.push(
        "No matching quote was found, so an invoice was not created."
      );
    } else {
      invoiceResult = await convertQuoteToInvoice({
        prompt: `Convert quote ${quote.quote_number} to invoice`,
        quotes,
        invoices,
        profile,
        organizationId,
      });

      if (invoiceResult.alreadyExists) {
        skippedActions.push(
          `Invoice already existed: ${invoiceResult.existing.invoice_number}`
        );
      } else if (invoiceResult.notFound) {
        warnings.push(
          "The matching quote could not be converted into an invoice."
        );
      } else {
        completedActions.push(
          `Invoice created: ${invoiceResult.created.invoice_number}`
        );
        completedActions.push("Quote status updated to Accepted");
      }
    }
  }

  /*
   * Step 4:
   * Create a follow-up when the user requested one.
   */
  let followUpResult = null;

  if (wantsFollowUp(prompt)) {
    const datePhrase = getWorkflowTaskDatePhrase(prompt);

    followUpResult = await createFollowUpFromPrompt({
      prompt: `Create follow-up for ${lead.name} ${datePhrase}`,
      leads,
      organizationId,
    });

    if (followUpResult.alreadyExists) {
      skippedActions.push(
        `Follow-up already existed: ${followUpResult.existing.title}`
      );
    } else if (followUpResult.notFound) {
      warnings.push("The requested follow-up could not be created.");
    } else {
      completedActions.push(
        `Follow-up created: ${followUpResult.created.title}`
      );
    }
  }

  const completedText =
    completedActions.length > 0
      ? completedActions.map((item) => `✓ ${item}`).join("\n")
      : "No new actions were completed.";

  const skippedText =
    skippedActions.length > 0
      ? `\n\nExisting records\n${skippedActions
          .map((item) => `• ${item}`)
          .join("\n")}`
      : "";

  const warningText =
    warnings.length > 0
      ? `\n\nWarnings\n${warnings
          .map((item) => `• ${item}`)
          .join("\n")}`
      : "";

  return {
    handled: true,
    success: true,
    answer: `✅ Workflow completed successfully.

Lead: ${lead.name}
Company: ${lead.company}
Customer: ${customer?.customer_name || "Not available"}
Project: ${project?.project_name || "Not available"}

Completed actions
${completedText}${skippedText}${warningText}`,
    data: {
      lead,
      customer,
      project,
      quote,
      task: taskResult?.created || taskResult?.existing || null,
      invoice:
        invoiceResult?.created ||
        invoiceResult?.existing ||
        null,
      followUp:
        followUpResult?.created ||
        followUpResult?.existing ||
        null,
    },
  };
}
