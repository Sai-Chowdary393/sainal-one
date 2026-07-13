import { supabase } from "../supabase";
import { getTomorrowDate } from "../utils/dates";
import { findMatchingRecord } from "../utils/matching";

export async function createFollowUpFromPrompt({
  prompt,
  leads,
  organizationId,
}) {
  const matchedLead = findMatchingRecord(prompt, leads, [
    "name",
    "company",
    "email",
  ]);

  if (!matchedLead) {
    return {
      notFound: true,
    };
  }

  const dueDate = prompt.toLowerCase().includes("tomorrow")
    ? getTomorrowDate()
    : null;

  const { data: existingFollowUps, error: existingError } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("related_type", "Lead")
    .eq("related_id", matchedLead.id)
    .eq("status", "Pending");

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingFollowUps?.length > 0) {
    return {
      alreadyExists: true,
      existing: existingFollowUps[0],
    };
  }

  const { data, error } = await supabase
    .from("follow_ups")
    .insert([
      {
        organization_id: organizationId,
        related_type: "Lead",
        related_id: matchedLead.id,
        title: `Follow up with ${matchedLead.name}`,
        note: `AI created follow-up from request: ${prompt}`,
        due_date: dueDate,
        status: "Pending",
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return {
    notFound: false,
    alreadyExists: false,
    created: data?.[0],
  };
}
