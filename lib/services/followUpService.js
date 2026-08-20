import {
  createAdminSupabaseClient,
} from "../supabaseAdmin";

import {
  getTomorrowDate,
} from "../utils/dates";

import {
  findMatchingRecord,
} from "../utils/matching";

// =========================================================
// CREATE FOLLOW-UP FROM AI PROMPT
// =========================================================

export async function createFollowUpFromPrompt({
  prompt,
  leads,
  organizationId,
  employeeId,
}) {
  if (
    !organizationId
  ) {
    throw new Error(
      "Organisation is required to create a follow-up."
    );
  }

  if (
    !employeeId
  ) {
    throw new Error(
      "Employee assignment is required to create a follow-up."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  // =======================================================
  // FIND ACCESSIBLE LEAD
  //
  // The AI route already supplies only Leads that the
  // signed-in employee is allowed to access.
  // =======================================================

  const matchedLead =
    findMatchingRecord(
      prompt,
      leads,
      [
        "name",
        "company",
        "email",
      ]
    );

  if (
    !matchedLead
  ) {
    return {
      notFound:
        true,
    };
  }

  // =======================================================
  // DUE DATE
  // =======================================================

  const dueDate =
    prompt
      .toLowerCase()
      .includes(
        "tomorrow"
      )
      ? getTomorrowDate()
      : null;

  // =======================================================
  // DUPLICATE CHECK
  //
  // related_id is TEXT in follow_ups.
  // =======================================================

  const {
    data:
      existingFollowUps,
    error:
      existingError,
  } =
    await supabase
      .from(
        "follow_ups"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "related_type",
        "Lead"
      )
      .eq(
        "related_id",
        String(
          matchedLead.id
        )
      )
      .eq(
        "status",
        "Pending"
      );

  if (
    existingError
  ) {
    throw new Error(
      existingError.message
    );
  }

  if (
    existingFollowUps?.length >
    0
  ) {
    return {
      alreadyExists:
        true,

      existing:
        existingFollowUps[0],

      lead:
        matchedLead,
    };
  }

  const now =
    new Date()
      .toISOString();

  // =======================================================
  // INSERT
  // =======================================================

  const {
    data:
      createdFollowUp,
    error,
  } =
    await supabase
      .from(
        "follow_ups"
      )
      .insert([
        {
          organization_id:
            organizationId,

          assigned_employee_id:
            employeeId,

          related_type:
            "Lead",

          related_id:
            String(
              matchedLead.id
            ),

          title:
            `Follow up with ${matchedLead.name}`,

          note:
            `AI created follow-up from request: ${prompt}`,

          due_date:
            dueDate,

          status:
            "Pending",

          created_at:
            now,

          updated_at:
            now,
        },
      ])
      .select()
      .single();

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return {
    notFound:
      false,

    alreadyExists:
      false,

    created:
      createdFollowUp,

    lead:
      matchedLead,
  };
}
