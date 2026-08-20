import {
  convertLeadToCustomerAndProject,
} from "../services/customerProjectService";

import {
  createTaskFromPrompt,
} from "../services/taskService";

import {
  convertQuoteToInvoice,
} from "../services/invoiceService";

import {
  createFollowUpFromPrompt,
} from "../services/followUpService";

import {
  findMatchingRecord,
} from "../utils/matching";

// =========================================================
// WORKFLOW DETECTION
// =========================================================

export function isWorkflowRequest(
  prompt
) {
  const text =
    String(
      prompt ||
        ""
    ).toLowerCase();

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

  const matches =
    workflowPhrases.filter(
      (phrase) =>
        text.includes(
          phrase
        )
    );

  /*
   * Treat the request as a workflow when:
   *
   * 1. It explicitly says that a quote/proposal was accepted.
   *
   * OR
   *
   * 2. It asks for at least two connected business actions.
   */
  return (
    text.includes(
      "accepted the quote"
    ) ||
    text.includes(
      "accepted our quote"
    ) ||
    text.includes(
      "accepted the proposal"
    ) ||
    matches.length >= 2
  );
}

// =========================================================
// FIND LEAD
// =========================================================

function findWorkflowLead(
  prompt,
  leads
) {
  return findMatchingRecord(
    prompt,
    leads,
    [
      "name",
      "company",
      "email",
    ]
  );
}

// =========================================================
// FIND QUOTE
// =========================================================

function findWorkflowQuote(
  prompt,
  quotes,
  lead
) {
  const directQuote =
    findMatchingRecord(
      prompt,
      quotes,
      [
        "quote_number",
        "contact",
        "client",
        "email",
      ]
    );

  if (
    directQuote
  ) {
    return directQuote;
  }

  if (!lead) {
    return null;
  }

  const leadQuote =
    quotes.find(
      (quote) =>
        String(
          quote.lead_id ||
            ""
        ) ===
        String(
          lead.id
        )
    );

  if (
    leadQuote
  ) {
    return leadQuote;
  }

  return (
    quotes.find(
      (quote) =>
        String(
          quote.contact ||
            ""
        ).toLowerCase() ===
          String(
            lead.name ||
              ""
          ).toLowerCase() ||
        String(
          quote.client ||
            ""
        ).toLowerCase() ===
          String(
            lead.company ||
              ""
          ).toLowerCase() ||
        (
          lead.email &&
          String(
            quote.email ||
              ""
          ).toLowerCase() ===
            String(
              lead.email
            ).toLowerCase()
        )
    ) ||
    null
  );
}

// =========================================================
// WORKFLOW DATE PHRASE
// =========================================================

function getWorkflowTaskDatePhrase(
  prompt
) {
  const text =
    String(
      prompt ||
        ""
    ).toLowerCase();

  if (
    text.includes(
      "day after tomorrow"
    )
  ) {
    return "day after tomorrow";
  }

  if (
    text.includes(
      "tomorrow"
    )
  ) {
    return "tomorrow";
  }

  if (
    text.includes(
      "next week"
    )
  ) {
    return "next week";
  }

  if (
    text.includes(
      "after one week"
    )
  ) {
    return "after one week";
  }

  if (
    text.includes(
      "in one week"
    )
  ) {
    return "in one week";
  }

  if (
    text.includes(
      "next monday"
    )
  ) {
    return "next Monday";
  }

  if (
    text.includes(
      "next tuesday"
    )
  ) {
    return "next Tuesday";
  }

  if (
    text.includes(
      "next wednesday"
    )
  ) {
    return "next Wednesday";
  }

  if (
    text.includes(
      "next thursday"
    )
  ) {
    return "next Thursday";
  }

  if (
    text.includes(
      "next friday"
    )
  ) {
    return "next Friday";
  }

  const dateMatch =
    String(
      prompt ||
        ""
    ).match(
      /\b(?:on\s+)?(?:20\d{2}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]20\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2})\b/i
    );

  if (
    dateMatch
  ) {
    return dateMatch[0];
  }

  return "tomorrow";
}

// =========================================================
// INTENT HELPERS
// =========================================================

function wantsTask(
  prompt
) {
  const text =
    String(
      prompt ||
        ""
    ).toLowerCase();

  return (
    text.includes(
      "task"
    ) ||
    text.includes(
      "onboarding"
    ) ||
    text.includes(
      "start the project"
    )
  );
}

function wantsInvoice(
  prompt
) {
  const text =
    String(
      prompt ||
        ""
    ).toLowerCase();

  return (
    text.includes(
      "invoice"
    ) ||
    text.includes(
      "accepted the quote"
    ) ||
    text.includes(
      "accepted our quote"
    ) ||
    text.includes(
      "accepted the proposal"
    )
  );
}

function wantsFollowUp(
  prompt
) {
  const text =
    String(
      prompt ||
        ""
    ).toLowerCase();

  return (
    text.includes(
      "follow-up"
    ) ||
    text.includes(
      "follow up"
    ) ||
    text.includes(
      "schedule"
    )
  );
}

// =========================================================
// EXECUTE WORKFLOW
// =========================================================

export async function executeWorkflow({
  prompt,
  profile,
  leads = [],
  quotes = [],
  customers = [],
  projects = [],
  invoices = [],
  organizationId,
  employeeId,
}) {
  // =======================================================
  // SECURITY CONTEXT
  // =======================================================

  if (
    !organizationId
  ) {
    throw new Error(
      "Organisation context is required to run an AI workflow."
    );
  }

  if (
    !employeeId
  ) {
    throw new Error(
      "Employee context is required to run an AI workflow."
    );
  }

  /*
   * IMPORTANT
   *
   * The collections supplied to this workflow must already
   * have been filtered by the AI Assistant route according
   * to the signed-in employee's RBAC permissions.
   *
   * The workflow never performs its own organisation-wide
   * lookup to discover hidden Lead / Quote / Project records.
   */

  // =======================================================
  // FIND ACCESSIBLE LEAD
  // =======================================================

  const lead =
    findWorkflowLead(
      prompt,
      leads
    );

  if (!lead) {
    return {
      handled:
        true,

      success:
        false,

      answer:
        "⚠️ I could not identify an accessible lead for this workflow. Please include the exact lead name, company name or email address.",
    };
  }

  // =======================================================
  // FIND ACCESSIBLE QUOTE
  // =======================================================

  const quote =
    findWorkflowQuote(
      prompt,
      quotes,
      lead
    );

  const completedActions =
    [];

  const skippedActions =
    [];

  const warnings =
    [];

  // =======================================================
  // STEP 1
  // LEAD -> CUSTOMER + PROJECT
  // =======================================================

  let conversionResult;

  try {
    conversionResult =
      await convertLeadToCustomerAndProject({
        prompt:
          `${prompt} Convert ${lead.name} lead to customer and create project`,

        leads: [
          lead,
        ],

        customers,

        projects,

        organizationId,

        employeeId,
      });
  } catch (error) {
    console.error(
      "Workflow customer/project conversion error:",
      error
    );

    return {
      handled:
        true,

      success:
        false,

      answer:
        `⚠️ The workflow could not convert the lead into a customer/project. ${error.message || ""}`.trim(),
    };
  }

  if (
    conversionResult.notFound
  ) {
    return {
      handled:
        true,

      success:
        false,

      answer:
        "⚠️ The workflow could not continue because the matching lead was not found.",
    };
  }

  const customer =
    conversionResult.customer;

  const project =
    conversionResult.project;

  if (
    conversionResult
      .customerAlreadyExists
  ) {
    skippedActions.push(
      "Customer already existed"
    );
  } else {
    completedActions.push(
      "Customer created"
    );
  }

  if (
    conversionResult
      .projectAlreadyExists
  ) {
    skippedActions.push(
      "Project already existed"
    );
  } else {
    completedActions.push(
      "Project created"
    );
  }

  completedActions.push(
    "Lead status updated to Won"
  );

  // =======================================================
  // STEP 2
  // PROJECT TASK
  // =======================================================

  let taskResult =
    null;

  if (
    wantsTask(
      prompt
    )
  ) {
    if (!project) {
      warnings.push(
        "No project was available, so the onboarding task was not created."
      );
    } else {
      const datePhrase =
        getWorkflowTaskDatePhrase(
          prompt
        );

      const taskPrompt =
        `Create task Complete client onboarding for ${project.project_name} ${datePhrase}`;

      try {
        taskResult =
          await createTaskFromPrompt({
            prompt:
              taskPrompt,

            /*
             * Put the newly created/found Project first.
             *
             * Filter duplicate IDs because the existing
             * projects collection could already include it.
             */
            projects: [
              project,

              ...projects.filter(
                (
                  existingProject
                ) =>
                  String(
                    existingProject.id
                  ) !==
                  String(
                    project.id
                  )
              ),
            ],

            organizationId,

            employeeId,
          });

        if (
          taskResult
            .alreadyExists
        ) {
          skippedActions.push(
            `Task already existed: ${taskResult.existing.task_name}`
          );
        } else if (
          taskResult
            .created
        ) {
          completedActions.push(
            `Task created: ${taskResult.created.task_name}`
          );
        }
      } catch (error) {
        console.error(
          "Workflow task creation error:",
          error
        );

        warnings.push(
          `The onboarding task could not be created${
            error.message
              ? `: ${error.message}`
              : "."
          }`
        );
      }
    }
  }

  // =======================================================
  // STEP 3
  // QUOTE -> INVOICE
  // =======================================================

  let invoiceResult =
    null;

  if (
    wantsInvoice(
      prompt
    )
  ) {
    if (!quote) {
      warnings.push(
        "No accessible matching quote was found, so an invoice was not created."
      );
    } else {
      try {
        invoiceResult =
          await convertQuoteToInvoice({
            prompt:
              `Convert quote ${quote.quote_number} to invoice`,

            /*
             * Only the matched quote needs to be exposed to
             * the conversion service.
             */
            quotes: [
              quote,
            ],

            invoices,

            profile,

            organizationId,

            employeeId,
          });

        if (
          invoiceResult
            .alreadyExists
        ) {
          skippedActions.push(
            `Invoice already existed: ${invoiceResult.existing.invoice_number}`
          );
        } else if (
          invoiceResult
            .notFound
        ) {
          warnings.push(
            "The matching quote could not be converted into an invoice."
          );
        } else if (
          invoiceResult
            .created
        ) {
          completedActions.push(
            `Invoice created: ${invoiceResult.created.invoice_number}`
          );

          completedActions.push(
            "Quote status updated to Accepted"
          );
        }
      } catch (error) {
        console.error(
          "Workflow invoice creation error:",
          error
        );

        warnings.push(
          `The invoice could not be created${
            error.message
              ? `: ${error.message}`
              : "."
          }`
        );
      }
    }
  }

  // =======================================================
  // STEP 4
  // FOLLOW-UP
  // =======================================================

  let followUpResult =
    null;

  if (
    wantsFollowUp(
      prompt
    )
  ) {
    const datePhrase =
      getWorkflowTaskDatePhrase(
        prompt
      );

    try {
      followUpResult =
        await createFollowUpFromPrompt({
          prompt:
            `Create follow-up for ${lead.name} ${datePhrase}`,

          /*
           * Only expose the actual matched Lead.
           */
          leads: [
            lead,
          ],

          organizationId,

          employeeId,
        });

      if (
        followUpResult
          .alreadyExists
      ) {
        skippedActions.push(
          `Follow-up already existed: ${followUpResult.existing.title}`
        );
      } else if (
        followUpResult
          .notFound
      ) {
        warnings.push(
          "The requested follow-up could not be created."
        );
      } else if (
        followUpResult
          .created
      ) {
        completedActions.push(
          `Follow-up created: ${followUpResult.created.title}`
        );
      }
    } catch (error) {
      console.error(
        "Workflow follow-up creation error:",
        error
      );

      warnings.push(
        `The follow-up could not be created${
          error.message
            ? `: ${error.message}`
            : "."
        }`
      );
    }
  }

  // =======================================================
  // RESPONSE
  // =======================================================

  const completedText =
    completedActions.length >
    0
      ? completedActions
          .map(
            (item) =>
              `✓ ${item}`
          )
          .join(
            "\n"
          )
      : "No new actions were completed.";

  const skippedText =
    skippedActions.length >
    0
      ? `

Existing records
${skippedActions
  .map(
    (item) =>
      `• ${item}`
  )
  .join("\n")}`
      : "";

  const warningText =
    warnings.length >
    0
      ? `

Warnings
${warnings
  .map(
    (item) =>
      `• ${item}`
  )
  .join("\n")}`
      : "";

  return {
    handled:
      true,

    success:
      warnings.length ===
        0,

    answer: `✅ Workflow processed.

Lead: ${lead.name}
Company: ${lead.company || "Not available"}
Customer: ${customer?.customer_name || "Not available"}
Project: ${project?.project_name || "Not available"}

Completed actions
${completedText}${skippedText}${warningText}`,

    data: {
      lead,

      customer,

      project,

      quote,

      task:
        taskResult?.created ||
        taskResult?.existing ||
        null,

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
