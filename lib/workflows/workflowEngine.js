const WORKFLOW_STATUSES = [
  "Draft",
  "Active",
  "Inactive",
  "Archived",
];

const STEP_TYPES = [
  "Approval",
  "Condition",
  "Email",
  "Notification",
  "Create Task",
  "Update Record",
  "Wait",
  "AI Action",
];

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanNullableText(value) {
  const cleaned = cleanText(value);

  return cleaned || null;
}

function cleanObject(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return {};
}

function cleanBoolean(
  value,
  defaultValue = true
) {
  if (typeof value === "boolean") {
    return value;
  }

  return defaultValue;
}

function normalizeCode(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeModule(value) {
  return cleanText(value);
}

function normalizeTriggerEvent(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeStep(
  step,
  index
) {
  const name = cleanText(step?.name);

  const stepType =
    cleanText(step?.step_type);

  if (!name) {
    throw new Error(
      `Step ${index + 1} requires a name.`
    );
  }

  if (
    !STEP_TYPES.includes(stepType)
  ) {
    throw new Error(
      `Step ${index + 1} has an invalid step type.`
    );
  }

  const stepOrder =
    Number.isInteger(
      Number(step?.step_order)
    ) &&
    Number(step?.step_order) > 0
      ? Number(step.step_order)
      : index + 1;

  return {
    step_order: stepOrder,
    name,
    step_type: stepType,

    description:
      cleanNullableText(
        step?.description
      ),

    configuration:
      cleanObject(
        step?.configuration
      ),

    condition_configuration:
      cleanObject(
        step?.condition_configuration
      ),

    is_required:
      cleanBoolean(
        step?.is_required,
        true
      ),

    is_active:
      cleanBoolean(
        step?.is_active,
        true
      ),
  };
}

function validateUniqueStepOrders(
  steps
) {
  const stepOrders = steps.map(
    (step) => step.step_order
  );

  if (
    new Set(stepOrders).size !==
    stepOrders.length
  ) {
    throw new Error(
      "Workflow step order values must be unique."
    );
  }
}

export function normalizeWorkflowInput(
  input,
  {
    allowPartial = false,
  } = {}
) {
  const result = {};

  if (
    !allowPartial ||
    Object.prototype.hasOwnProperty.call(
      input,
      "name"
    )
  ) {
    const name = cleanText(
      input?.name
    );

    if (!name) {
      throw new Error(
        "Workflow name is required."
      );
    }

    result.name = name;
  }

  if (
    !allowPartial ||
    Object.prototype.hasOwnProperty.call(
      input,
      "code"
    )
  ) {
    const code = normalizeCode(
      input?.code
    );

    if (!code) {
      throw new Error(
        "Workflow code is required."
      );
    }

    result.code = code;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      input,
      "description"
    )
  ) {
    result.description =
      cleanNullableText(
        input.description
      );
  }

  if (
    !allowPartial ||
    Object.prototype.hasOwnProperty.call(
      input,
      "module"
    )
  ) {
    const module =
      normalizeModule(
        input?.module
      );

    if (!module) {
      throw new Error(
        "Workflow module is required."
      );
    }

    result.module = module;
  }

  if (
    !allowPartial ||
    Object.prototype.hasOwnProperty.call(
      input,
      "trigger_event"
    )
  ) {
    const triggerEvent =
      normalizeTriggerEvent(
        input?.trigger_event
      );

    if (!triggerEvent) {
      throw new Error(
        "Workflow trigger event is required."
      );
    }

    result.trigger_event =
      triggerEvent;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      input,
      "status"
    )
  ) {
    const status = cleanText(
      input.status
    );

    if (
      !WORKFLOW_STATUSES.includes(
        status
      )
    ) {
      throw new Error(
        "Invalid workflow status."
      );
    }

    result.status = status;
  } else if (!allowPartial) {
    result.status = "Draft";
  }

  if (
    Object.prototype.hasOwnProperty.call(
      input,
      "is_active"
    )
  ) {
    result.is_active =
      Boolean(input.is_active);
  } else if (!allowPartial) {
    result.is_active = false;
  }

  if (
    Array.isArray(input?.steps)
  ) {
    const steps = input.steps.map(
      normalizeStep
    );

    validateUniqueStepOrders(
      steps
    );

    result.steps = steps.sort(
      (first, second) =>
        first.step_order -
        second.step_order
    );
  } else if (!allowPartial) {
    result.steps = [];
  }

  return result;
}

export async function loadWorkflowWorkspace({
  supabase,
  organizationId,
}) {
  const [
    workflowsResult,
    stepsResult,
    employeesResult,
    departmentsResult,
    rolesResult,
  ] = await Promise.all([
    supabase
      .from("workflows")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("workflow_steps")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order("step_order", {
        ascending: true,
      }),

    supabase
      .from("employees")
      .select(
        `
          id,
          employee_number,
          full_name,
          email,
          job_title,
          department_id,
          manager_id,
          availability_status,
          employment_status,
          is_active
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("full_name", {
        ascending: true,
      }),

    supabase
      .from("departments")
      .select(
        `
          id,
          name,
          code,
          manager_id,
          status
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("roles")
      .select(
        `
          id,
          name,
          code,
          is_system_role,
          is_active
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("name", {
        ascending: true,
      }),
  ]);

  const errors = [
    workflowsResult.error,
    stepsResult.error,
    employeesResult.error,
    departmentsResult.error,
    rolesResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(
      errors[0].message
    );
  }

  const workflows =
    Array.isArray(
      workflowsResult.data
    )
      ? workflowsResult.data
      : [];

  const steps =
    Array.isArray(
      stepsResult.data
    )
      ? stepsResult.data
      : [];

  const stepsByWorkflow =
    new Map();

  steps.forEach((step) => {
    const currentSteps =
      stepsByWorkflow.get(
        step.workflow_id
      ) || [];

    currentSteps.push(step);

    stepsByWorkflow.set(
      step.workflow_id,
      currentSteps
    );
  });

  const formattedWorkflows =
    workflows.map((workflow) => {
      const workflowSteps =
        stepsByWorkflow.get(
          workflow.id
        ) || [];

      return {
        ...workflow,

        steps: workflowSteps,

        step_count:
          workflowSteps.length,

        approval_step_count:
          workflowSteps.filter(
            (step) =>
              step.step_type ===
              "Approval"
          ).length,
      };
    });

  return {
    workflows:
      formattedWorkflows,

    employees:
      employeesResult.data || [],

    departments:
      departmentsResult.data || [],

    roles:
      rolesResult.data || [],
  };
}

export async function loadWorkflowById({
  supabase,
  organizationId,
  workflowId,
}) {
  const {
    data: workflow,
    error: workflowError,
  } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .eq(
      "organization_id",
      organizationId
    )
    .maybeSingle();

  if (workflowError) {
    throw new Error(
      workflowError.message
    );
  }

  if (!workflow) {
    return null;
  }

  const {
    data: steps,
    error: stepsError,
  } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "workflow_id",
      workflowId
    )
    .order("step_order", {
      ascending: true,
    });

  if (stepsError) {
    throw new Error(
      stepsError.message
    );
  }

  return {
    ...workflow,
    steps:
      Array.isArray(steps)
        ? steps
        : [],
  };
}

export async function createWorkflowDefinition({
  supabase,
  organizationId,
  userId,
  input,
}) {
  const normalized =
    normalizeWorkflowInput(input);

  const {
    steps,
    ...workflowData
  } = normalized;

  if (
    workflowData.status ===
    "Active" &&
    steps.length === 0
  ) {
    throw new Error(
      "An active workflow must contain at least one step."
    );
  }

  const {
    data: createdWorkflow,
    error: workflowError,
  } = await supabase
    .from("workflows")
    .insert([
      {
        organization_id:
          organizationId,

        ...workflowData,

        version: 1,

        created_by: userId,
        updated_by: userId,
      },
    ])
    .select()
    .single();

  if (workflowError) {
    throw new Error(
      workflowError.message
    );
  }

  if (steps.length > 0) {
    const stepRows = steps.map(
      (step) => ({
        organization_id:
          organizationId,

        workflow_id:
          createdWorkflow.id,

        ...step,

        created_by: userId,
        updated_by: userId,
      })
    );

    const {
      error: stepsError,
    } = await supabase
      .from("workflow_steps")
      .insert(stepRows);

    if (stepsError) {
      await supabase
        .from("workflows")
        .delete()
        .eq(
          "id",
          createdWorkflow.id
        )
        .eq(
          "organization_id",
          organizationId
        );

      throw new Error(
        "The workflow could not be assigned steps: " +
          stepsError.message
      );
    }
  }

  return loadWorkflowById({
    supabase,
    organizationId,
    workflowId:
      createdWorkflow.id,
  });
}

export async function updateWorkflowDefinition({
  supabase,
  organizationId,
  workflowId,
  userId,
  input,
}) {
  const existingWorkflow =
    await loadWorkflowById({
      supabase,
      organizationId,
      workflowId,
    });

  if (!existingWorkflow) {
    return null;
  }

  const normalized =
    normalizeWorkflowInput(
      input,
      {
        allowPartial: true,
      }
    );

  const {
    steps,
    ...workflowUpdates
  } = normalized;

  const finalStatus =
    workflowUpdates.status ||
    existingWorkflow.status;

  const finalSteps =
    Array.isArray(steps)
      ? steps
      : existingWorkflow.steps;

  if (
    finalStatus === "Active" &&
    finalSteps.length === 0
  ) {
    throw new Error(
      "An active workflow must contain at least one step."
    );
  }

  const hasWorkflowUpdates =
    Object.keys(
      workflowUpdates
    ).length > 0;

  if (hasWorkflowUpdates) {
    const {
      error: updateError,
    } = await supabase
      .from("workflows")
      .update({
        ...workflowUpdates,

        version:
          Number(
            existingWorkflow.version ||
              1
          ) + 1,

        updated_by: userId,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", workflowId)
      .eq(
        "organization_id",
        organizationId
      );

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }
  }

  if (Array.isArray(steps)) {
    const {
      error: deleteStepsError,
    } = await supabase
      .from("workflow_steps")
      .delete()
      .eq(
        "workflow_id",
        workflowId
      )
      .eq(
        "organization_id",
        organizationId
      );

    if (deleteStepsError) {
      throw new Error(
        "Existing workflow steps could not be replaced: " +
          deleteStepsError.message
      );
    }

    if (steps.length > 0) {
      const stepRows = steps.map(
        (step) => ({
          organization_id:
            organizationId,

          workflow_id: workflowId,

          ...step,

          created_by: userId,
          updated_by: userId,
        })
      );

      const {
        error: insertStepsError,
      } = await supabase
        .from("workflow_steps")
        .insert(stepRows);

      if (insertStepsError) {
        throw new Error(
          "The new workflow steps could not be saved: " +
            insertStepsError.message
        );
      }
    }
  }

  return loadWorkflowById({
    supabase,
    organizationId,
    workflowId,
  });
}

export async function archiveWorkflowDefinition({
  supabase,
  organizationId,
  workflowId,
  userId,
}) {
  const existingWorkflow =
    await loadWorkflowById({
      supabase,
      organizationId,
      workflowId,
    });

  if (!existingWorkflow) {
    return null;
  }

  const {
    count: runningCount,
    error: runningCountError,
  } = await supabase
    .from("workflow_runs")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "workflow_id",
      workflowId
    )
    .in("status", [
      "Pending",
      "Running",
      "Waiting",
    ]);

  if (runningCountError) {
    throw new Error(
      runningCountError.message
    );
  }

  if ((runningCount || 0) > 0) {
    throw new Error(
      "This workflow cannot be archived while workflow runs are still active."
    );
  }

  const {
    error: archiveError,
  } = await supabase
    .from("workflows")
    .update({
      status: "Archived",
      is_active: false,
      updated_by: userId,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", workflowId)
    .eq(
      "organization_id",
      organizationId
    );

  if (archiveError) {
    throw new Error(
      archiveError.message
    );
  }

  return true;
}

export {
  STEP_TYPES,
  WORKFLOW_STATUSES,
};
