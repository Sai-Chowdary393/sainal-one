import {
  createAdminSupabaseClient,
} from "../supabaseAdmin";

import {
  parseDueDateFromPrompt,
  removeDatePhraseFromText,
} from "../utils/dates";

import {
  findMatchingRecord,
} from "../utils/matching";

// =========================================================
// HELPERS
// =========================================================

function escapeRegExp(
  value
) {
  return String(
    value ||
      ""
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function cleanTaskName(
  prompt,
  matchedProject
) {
  let taskName =
    String(
      prompt ||
        ""
    )
      .replace(
        /create task/gi,
        ""
      )
      .replace(
        /add task/gi,
        ""
      )
      .replace(
        /\bfor project\b/gi,
        ""
      )
      .trim();

  taskName =
    removeDatePhraseFromText(
      taskName
    );

  if (
    matchedProject
      ?.project_name
  ) {
    const escapedProjectName =
      escapeRegExp(
        matchedProject.project_name
      );

    taskName =
      taskName.replace(
        new RegExp(
          `\\s*for\\s+${escapedProjectName}\\s*$`,
          "i"
        ),
        ""
      );

    taskName =
      taskName.replace(
        new RegExp(
          `\\s*${escapedProjectName}\\s*$`,
          "i"
        ),
        ""
      );
  }

  taskName =
    taskName
      .replace(
        /\s+-\s*$/g,
        ""
      )
      .replace(
        /\s{2,}/g,
        " "
      )
      .trim();

  if (
    !taskName
  ) {
    return "AI Created Task";
  }

  return (
    taskName
      .charAt(0)
      .toUpperCase() +
    taskName.slice(1)
  );
}

// =========================================================
// CREATE TASK FROM AI PROMPT
// =========================================================

export async function createTaskFromPrompt({
  prompt,
  projects,
  organizationId,
  employeeId,
}) {
  if (
    !organizationId
  ) {
    throw new Error(
      "Organisation is required to create a task."
    );
  }

  if (
    !employeeId
  ) {
    throw new Error(
      "Employee assignment is required to create a task."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  // =======================================================
  // FIND PROJECT
  //
  // The supplied Projects collection is already filtered
  // by the AI route according to Projects permissions.
  // =======================================================

  const matchedProject =
    findMatchingRecord(
      prompt,
      projects,
      [
        "project_name",
        "description",
      ]
    );

  const finalTaskName =
    cleanTaskName(
      prompt,
      matchedProject
    );

  const dueDate =
    parseDueDateFromPrompt(
      prompt
    );

  // =======================================================
  // ASSIGNEE
  //
  // For a task linked to a Project:
  //   Project Owner is preferred.
  //
  // For a standalone Task:
  //   Signed-in employee becomes the assignee.
  // =======================================================

  const assignedEmployeeId =
    matchedProject
      ?.owner_employee_id ||
    employeeId;

  // =======================================================
  // DUPLICATE CHECK
  // =======================================================

  let existingQuery =
    supabase
      .from(
        "tasks"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .ilike(
        "task_name",
        finalTaskName
      );

  if (
    matchedProject?.id
  ) {
    existingQuery =
      existingQuery.eq(
        "project_id",
        matchedProject.id
      );
  } else {
    existingQuery =
      existingQuery.is(
        "project_id",
        null
      );
  }

  /*
   * A completed or cancelled task should not block creation
   * of a genuinely new future task with the same title.
   */
  existingQuery =
    existingQuery.in(
      "status",
      [
        "Open",
        "Pending",
        "To Do",
        "In Progress",
        "Blocked",
      ]
    );

  if (
    dueDate
  ) {
    existingQuery =
      existingQuery.eq(
        "due_date",
        dueDate
      );
  }

  const {
    data:
      existingTasks,
    error:
      existingError,
  } =
    await existingQuery;

  if (
    existingError
  ) {
    throw new Error(
      existingError.message
    );
  }

  if (
    existingTasks?.length >
    0
  ) {
    return {
      alreadyExists:
        true,

      existing:
        existingTasks[0],

      project:
        matchedProject ||
        null,
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
      createdTask,
    error,
  } =
    await supabase
      .from(
        "tasks"
      )
      .insert([
        {
          organization_id:
            organizationId,

          project_id:
            matchedProject?.id ||
            null,

          assigned_employee_id:
            assignedEmployeeId,

          task_name:
            finalTaskName,

          description:
            `AI created task from request: ${prompt}`,

          status:
            "Pending",

          priority:
            "Medium",

          due_date:
            dueDate,

          record_type:
            matchedProject?.id
              ? "Project"
              : null,

          record_id:
            matchedProject?.id ||
            null,

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
    alreadyExists:
      false,

    created:
      createdTask,

    project:
      matchedProject ||
      null,
  };
}
