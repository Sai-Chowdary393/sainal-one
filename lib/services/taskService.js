import { supabase } from "../supabase";
import { getTomorrowDate } from "../utils/dates";
import { findMatchingRecord } from "../utils/matching";

function cleanTaskName(prompt) {
  return (
    prompt
      .replace(/create task/gi, "")
      .replace(/add task/gi, "")
      .replace(/\btomorrow\b/gi, "")
      .replace(/\bfor project\b/gi, "")
      .trim() || "AI Created Task"
  );
}

export async function createTaskFromPrompt({
  prompt,
  projects,
  organizationId,
}) {
  const matchedProject = findMatchingRecord(prompt, projects, [
    "project_name",
    "description",
  ]);

  const finalTaskName = cleanTaskName(prompt);

  let existingQuery = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .ilike("task_name", finalTaskName)
    .eq("status", "Pending");

  if (matchedProject?.id) {
    existingQuery = existingQuery.eq("project_id", matchedProject.id);
  } else {
    existingQuery = existingQuery.is("project_id", null);
  }

  const { data: existingTasks, error: existingError } = await existingQuery;

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingTasks?.length > 0) {
    return {
      alreadyExists: true,
      existing: existingTasks[0],
    };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        organization_id: organizationId,
        project_id: matchedProject?.id || null,
        task_name: finalTaskName,
        description: `AI created task from request: ${prompt}`,
        status: "Pending",
        due_date: prompt.toLowerCase().includes("tomorrow")
          ? getTomorrowDate()
          : null,
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return {
    alreadyExists: false,
    created: data?.[0],
    project: matchedProject || null,
  };
}
