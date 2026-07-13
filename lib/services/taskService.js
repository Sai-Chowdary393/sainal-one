import { supabase } from "../supabase";

import {
  parseDueDateFromPrompt,
  removeDatePhraseFromText,
} from "../utils/dates";

import { findMatchingRecord } from "../utils/matching";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanTaskName(prompt, matchedProject) {
  let taskName = String(prompt || "")
    .replace(/create task/gi, "")
    .replace(/add task/gi, "")
    .replace(/\bfor project\b/gi, "")
    .trim();

  taskName = removeDatePhraseFromText(taskName);

  if (matchedProject?.project_name) {
    const escapedProjectName = escapeRegExp(
      matchedProject.project_name
    );

    taskName = taskName.replace(
      new RegExp(`\\s*for\\s+${escapedProjectName}\\s*$`, "i"),
      ""
    );

    taskName = taskName.replace(
      new RegExp(`\\s*${escapedProjectName}\\s*$`, "i"),
      ""
    );
  }

  taskName = taskName
    .replace(/\s+-\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!taskName) {
    return "AI Created Task";
  }

  return taskName.charAt(0).toUpperCase() + taskName.slice(1);
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

  const finalTaskName = cleanTaskName(prompt, matchedProject);
  const dueDate = parseDueDateFromPrompt(prompt);

  let existingQuery = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .ilike("task_name", finalTaskName)
    .eq("status", "Pending");

  if (matchedProject?.id) {
    existingQuery = existingQuery.eq(
      "project_id",
      matchedProject.id
    );
  } else {
    existingQuery = existingQuery.is("project_id", null);
  }

  if (dueDate) {
    existingQuery = existingQuery.eq("due_date", dueDate);
  }

  const {
    data: existingTasks,
    error: existingError,
  } = await existingQuery;

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingTasks?.length > 0) {
    return {
      alreadyExists: true,
      existing: existingTasks[0],
      project: matchedProject || null,
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
        due_date: dueDate,
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
