// =========================================================
// SAINAL ONE
// WORKFLOW DEFINITION ENGINE
// =========================================================
//
// Responsibilities:
//
// 1. Validate workflow definitions.
// 2. Validate workflow steps.
// 3. Save normal ordered workflows.
// 4. Save visual node positions.
// 5. Support explicit next-step connections.
// 6. Support TRUE / FALSE condition branches.
// 7. Preserve existing step IDs when editing.
// 8. Load workflows in a UI-friendly structure.
// 9. Prepare workflow definitions for future execution.
//
// IMPORTANT:
// This file manages workflow DEFINITIONS.
// Actual workflow execution will be built separately.
// =========================================================

export const WORKFLOW_STATUSES = [
  "Draft",
  "Active",
  "Inactive",
  "Archived",
];

export const STEP_TYPES = [
  "Approval",
  "Condition",
  "Email",
  "Notification",
  "Create Task",
  "Update Record",
  "Wait",
  "AI Action",
];

// =========================================================
// CONDITION SUPPORT
// =========================================================

export const CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "in",
  "not_in",
];

export const CONDITION_TYPES = [
  "Field",
  "Formula",
  "AI",
];

// =========================================================
// GENERIC HELPERS
// =========================================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanNullableText(value) {
  const cleaned = cleanText(value);

  return cleaned || null;
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

function cleanNumber(
  value,
  defaultValue = 0
) {
  const number = Number(value);

  if (
    Number.isFinite(number)
  ) {
    return number;
  }

  return defaultValue;
}

function cleanPositiveInteger(
  value,
  defaultValue
) {
  const number = Number(value);

  if (
    Number.isInteger(number) &&
    number > 0
  ) {
    return number;
  }

  return defaultValue;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function uniqueValues(
  values = []
) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

// =========================================================
// NORMALISATION HELPERS
// =========================================================

function normalizeCode(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(
      /[^A-Z0-9_]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    );
}

function normalizeModule(value) {
  return cleanText(value);
}

function normalizeTriggerEvent(
  value
) {
  return cleanText(value)
    .toLowerCase()
    .replace(
      /\s+/g,
      "_"
    );
}

function normalizeStatus(value) {
  const status =
    cleanText(value);

  if (
    !WORKFLOW_STATUSES.includes(
      status
    )
  ) {
    throw new Error(
      "Invalid workflow status."
    );
  }

  return status;
}

function normalizeStepType(value) {
  const stepType =
    cleanText(value);

  if (
    !STEP_TYPES.includes(
      stepType
    )
  ) {
    throw new Error(
      `Invalid workflow step type: ${stepType || "empty"}.`
    );
  }

  return stepType;
}

function normalizeConditionOperator(
  value
) {
  const operator =
    cleanNullableText(value);

  if (!operator) {
    return null;
  }

  if (
    !CONDITION_OPERATORS.includes(
      operator
    )
  ) {
    throw new Error(
      `Invalid condition operator: ${operator}.`
    );
  }

  return operator;
}

function normalizeConditionType(
  value
) {
  const conditionType =
    cleanNullableText(value);

  if (!conditionType) {
    return null;
  }

  if (
    !CONDITION_TYPES.includes(
      conditionType
    )
  ) {
    throw new Error(
      `Invalid condition type: ${conditionType}.`
    );
  }

  return conditionType;
}

// =========================================================
// STEP NORMALISATION
// =========================================================

function normalizeStep(
  step,
  index
) {
  const name =
    cleanText(step?.name);

  if (!name) {
    throw new Error(
      `Step ${index + 1} requires a name.`
    );
  }

  const stepType =
    normalizeStepType(
      step?.step_type
    );

  const stepOrder =
    cleanPositiveInteger(
      step?.step_order,
      index + 1
    );

  const conditionType =
    normalizeConditionType(
      step?.condition_type
    );

  const conditionOperator =
    normalizeConditionOperator(
      step?.condition_operator
    );

  /*
   * configuration is retained because your
   * current Workflow Builder already uses it.
   *
   * action_config is the newer generic action
   * configuration for the visual designer.
   *
   * For backwards compatibility we copy
   * configuration into action_config when
   * action_config has not been supplied.
   */
  const configuration =
    cleanObject(
      step?.configuration
    );

  const actionConfig =
    Object.keys(
      cleanObject(
        step?.action_config
      )
    ).length > 0
      ? cleanObject(
          step?.action_config
        )
      : configuration;

  const conditionConfiguration =
    cleanObject(
      step?.condition_configuration
    );

  return {
    /*
     * Existing database ID.
     *
     * When supplied during editing,
     * we preserve the same row instead
     * of deleting and recreating it.
     */
    id: isUuid(step?.id)
      ? step.id
      : null,

    /*
     * client_key is transient.
     *
     * It is NOT stored in Supabase.
     * Later the drag-and-drop UI can use it
     * to reference nodes before they have UUIDs.
     */
    client_key:
      cleanNullableText(
        step?.client_key ||
          step?.local_id
      ),

    step_order: stepOrder,

    name,

    step_type: stepType,

    description:
      cleanNullableText(
        step?.description
      ),

    configuration,

    condition_configuration:
      conditionConfiguration,

    action_config:
      actionConfig,

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

    // Visual canvas position
    position_x:
      cleanNumber(
        step?.position_x,
        0
      ),

    position_y:
      cleanNumber(
        step?.position_y,
        stepOrder * 140
      ),

    // Condition information
    condition_type:
      conditionType,

    condition_field:
      cleanNullableText(
        step?.condition_field
      ),

    condition_operator:
      conditionOperator,

    /*
     * condition_value can be text,
     * number, boolean, object, array,
     * etc. because the database column
     * is JSONB.
     */
    condition_value:
      step?.condition_value ===
      undefined
        ? null
        : step.condition_value,

    /*
     * Direct UUID connections.
     */
    next_step_id:
      isUuid(
        step?.next_step_id
      )
        ? step.next_step_id
        : null,

    true_step_id:
      isUuid(
        step?.true_step_id
      )
        ? step.true_step_id
        : null,

    false_step_id:
      isUuid(
        step?.false_step_id
      )
        ? step.false_step_id
        : null,

    /*
     * Temporary references supported by
     * the visual designer.
     *
     * These are resolved AFTER all steps
     * have been inserted/updated.
     */
    next_step_ref:
      cleanNullableText(
        step?.next_step_ref
      ),

    true_step_ref:
      cleanNullableText(
        step?.true_step_ref
      ),

    false_step_ref:
      cleanNullableText(
        step?.false_step_ref
      ),

    /*
     * Alternative connection method.
     *
     * This lets the current ordered builder
     * refer to step numbers rather than UUIDs.
     */
    next_step_order:
      step?.next_step_order
        ? cleanPositiveInteger(
            step.next_step_order,
            null
          )
        : null,

    true_step_order:
      step?.true_step_order
        ? cleanPositiveInteger(
            step.true_step_order,
            null
          )
        : null,

    false_step_order:
      step?.false_step_order
        ? cleanPositiveInteger(
            step.false_step_order,
            null
          )
        : null,
  };
}

// =========================================================
// STEP VALIDATION
// =========================================================

function validateUniqueStepOrders(
  steps
) {
  const orders =
    steps.map(
      (step) =>
        step.step_order
    );

  if (
    new Set(orders).size !==
    orders.length
  ) {
    throw new Error(
      "Workflow step order values must be unique."
    );
  }
}

function validateUniqueClientKeys(
  steps
) {
  const keys =
    steps
      .map(
        (step) =>
          step.client_key
      )
      .filter(Boolean);

  if (
    new Set(keys).size !==
    keys.length
  ) {
    throw new Error(
      "Workflow step client references must be unique."
    );
  }
}

function validateConditionStep(
  step
) {
  if (
    step.step_type !==
    "Condition"
  ) {
    return;
  }

  /*
   * We intentionally allow incomplete condition
   * configuration while the workflow is Draft.
   *
   * Full validation happens when activating.
   */
}

function validateSteps(steps) {
  validateUniqueStepOrders(
    steps
  );

  validateUniqueClientKeys(
    steps
  );

  steps.forEach(
    validateConditionStep
  );
}

// =========================================================
// ACTIVE WORKFLOW VALIDATION
// =========================================================

function validateActiveWorkflow(
  workflow
) {
  if (
    workflow.status !==
    "Active"
  ) {
    return;
  }

  if (
    !Array.isArray(
      workflow.steps
    ) ||
    workflow.steps.length ===
      0
  ) {
    throw new Error(
      "An active workflow must contain at least one step."
    );
  }

  const activeSteps =
    workflow.steps.filter(
      (step) =>
        step.is_active !==
        false
    );

  if (
    activeSteps.length === 0
  ) {
    throw new Error(
      "An active workflow must contain at least one active step."
    );
  }

  for (
    const step of activeSteps
  ) {
    if (
      step.step_type ===
      "Condition"
    ) {
      if (
        !step.condition_type
      ) {
        throw new Error(
          `Condition step "${step.name}" requires a condition type before the workflow can be activated.`
        );
      }

      if (
        step.condition_type ===
          "Field" &&
        !step.condition_field
      ) {
        throw new Error(
          `Condition step "${step.name}" requires a field before the workflow can be activated.`
        );
      }

      if (
        step.condition_type ===
          "Field" &&
        !step.condition_operator
      ) {
        throw new Error(
          `Condition step "${step.name}" requires an operator before the workflow can be activated.`
        );
      }
    }

    if (
      step.step_type ===
        "Approval"
    ) {
      const config =
        step.action_config ||
        step.configuration ||
        {};

      const approverType =
        cleanText(
          config.approver_type
        );

      /*
       * Empty approver_type remains valid for
       * backwards compatibility because the
       * current UI treats Manager as the default.
       */
      if (
        approverType ===
          "Employee" &&
        !isUuid(
          config.employee_id
        )
      ) {
        throw new Error(
          `Approval step "${step.name}" requires an approver employee.`
        );
      }

      if (
        approverType ===
          "Department" &&
        !isUuid(
          config.department_id
        )
      ) {
        throw new Error(
          `Approval step "${step.name}" requires an approver department.`
        );
      }

      if (
        approverType ===
          "Role" &&
        !isUuid(
          config.role_id
        )
      ) {
        throw new Error(
          `Approval step "${step.name}" requires an approver role.`
        );
      }
    }
  }
}

// =========================================================
// WORKFLOW INPUT NORMALISATION
// =========================================================

export function normalizeWorkflowInput(
  input = {},
  {
    allowPartial = false,
  } = {}
) {
  const result = {};

  // -------------------------------------------------------
  // NAME
  // -------------------------------------------------------

  if (
    !allowPartial ||
    Object.prototype.hasOwnProperty.call(
      input,
      "name"
    )
  ) {
    const name =
      cleanText(input.name);

    if (!name) {
      throw new Error(
        "Workflow name is required."
      );
    }

    result.name = name;
  }

  // -------------------------------------------------------
  // CODE
  // -------------------------------------------------------

  if (
    !allowPartial ||
    Object.prototype.hasOwnProperty.call(
      input,
      "code"
    )
  ) {
    const code =
      normalizeCode(
        input.code
      );

    if (!code) {
      throw new Error(
        "Workflow code is required."
      );
    }

    result.code = code;
  }

  // -------------------------------------------------------
  // DESCRIPTION
  // -------------------------------------------------------

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

  // -------------------------------------------------------
  // MODULE
  // -------------------------------------------------------

  if (
    !allowPartial ||
    Object.prototype.hasOwnProperty.call(
      input,
      "module"
    )
  ) {
    const module =
      normalizeModule(
        input.module
      );

    if (!module) {
      throw new Error(
        "Workflow module is required."
      );
    }

    result.module = module;
  }

  // -------------------------------------------------------
  // TRIGGER
  // -------------------------------------------------------

  if (
    !allowPartial ||
    Object.prototype.hasOwnProperty.call(
      input,
      "trigger_event"
    )
  ) {
    const triggerEvent =
      normalizeTriggerEvent(
        input.trigger_event
      );

    if (!triggerEvent) {
      throw new Error(
        "Workflow trigger event is required."
      );
    }

    result.trigger_event =
      triggerEvent;
  }

  // -------------------------------------------------------
  // STATUS
  // -------------------------------------------------------

  if (
    Object.prototype.hasOwnProperty.call(
      input,
      "status"
    )
  ) {
    result.status =
      normalizeStatus(
        input.status
      );
  } else if (!allowPartial) {
    result.status = "Draft";
  }

  // -------------------------------------------------------
  // ACTIVE FLAG
  // -------------------------------------------------------

  if (
    Object.prototype.hasOwnProperty.call(
      input,
      "is_active"
    )
  ) {
    result.is_active =
      Boolean(
        input.is_active
      );
  } else if (!allowPartial) {
    result.is_active = false;
  }

  // -------------------------------------------------------
  // STEPS
  // -------------------------------------------------------

  if (
    Array.isArray(
      input.steps
    )
  ) {
    const steps =
      input.steps.map(
        normalizeStep
      );

    validateSteps(steps);

    result.steps =
      steps.sort(
        (first, second) =>
          first.step_order -
          second.step_order
      );
  } else if (!allowPartial) {
    result.steps = [];
  }

  return result;
}

// =========================================================
// DATABASE STEP SERIALISATION
// =========================================================

function buildStepDatabaseRow({
  step,
  organizationId,
  workflowId,
  userId,
  includeId = false,
}) {
  const row = {
    organization_id:
      organizationId,

    workflow_id:
      workflowId,

    step_order:
      step.step_order,

    name:
      step.name,

    step_type:
      step.step_type,

    description:
      step.description,

    configuration:
      step.configuration || {},

    condition_configuration:
      step.condition_configuration ||
      {},

    action_config:
      step.action_config || {},

    is_required:
      step.is_required,

    is_active:
      step.is_active,

    position_x:
      step.position_x,

    position_y:
      step.position_y,

    condition_type:
      step.condition_type,

    condition_field:
      step.condition_field,

    condition_operator:
      step.condition_operator,

    condition_value:
      step.condition_value,

    updated_by:
      userId,

    updated_at:
      new Date().toISOString(),
  };

  if (includeId && step.id) {
    row.id = step.id;
  }

  return row;
}

// =========================================================
// CONNECTION RESOLUTION
// =========================================================

function resolveStepReference({
  rawId,
  reference,
  order,
  byId,
  byClientKey,
  byOrder,
}) {
  /*
   * Priority:
   *
   * 1. Existing UUID
   * 2. client_key reference
   * 3. step_order reference
   */

  if (
    rawId &&
    byId.has(rawId)
  ) {
    return rawId;
  }

  if (
    reference &&
    byClientKey.has(
      reference
    )
  ) {
    return byClientKey.get(
      reference
    ).id;
  }

  if (
    order &&
    byOrder.has(order)
  ) {
    return byOrder.get(
      order
    ).id;
  }

  return null;
}

async function applyStepConnections({
  supabase,
  organizationId,
  workflowId,
  normalizedSteps,
  savedSteps,
}) {
  const byId = new Map();

  const byOrder =
    new Map();

  const byClientKey =
    new Map();

  savedSteps.forEach(
    (savedStep) => {
      byId.set(
        savedStep.id,
        savedStep
      );

      byOrder.set(
        savedStep.step_order,
        savedStep
      );
    }
  );

  normalizedSteps.forEach(
    (normalizedStep) => {
      if (
        normalizedStep.client_key
      ) {
        const savedStep =
          byOrder.get(
            normalizedStep.step_order
          );

        if (savedStep) {
          byClientKey.set(
            normalizedStep.client_key,
            savedStep
          );
        }
      }
    }
  );

  for (
    const normalizedStep of
      normalizedSteps
  ) {
    const savedStep =
      byOrder.get(
        normalizedStep.step_order
      );

    if (!savedStep) {
      continue;
    }

    const nextStepId =
      resolveStepReference({
        rawId:
          normalizedStep.next_step_id,

        reference:
          normalizedStep.next_step_ref,

        order:
          normalizedStep.next_step_order,

        byId,
        byClientKey,
        byOrder,
      });

    const trueStepId =
      resolveStepReference({
        rawId:
          normalizedStep.true_step_id,

        reference:
          normalizedStep.true_step_ref,

        order:
          normalizedStep.true_step_order,

        byId,
        byClientKey,
        byOrder,
      });

    const falseStepId =
      resolveStepReference({
        rawId:
          normalizedStep.false_step_id,

        reference:
          normalizedStep.false_step_ref,

        order:
          normalizedStep.false_step_order,

        byId,
        byClientKey,
        byOrder,
      });

    /*
     * Ordered workflows do not have to explicitly
     * define next_step_id.
     *
     * If none exists, automatically connect the
     * current step to the following ordered step.
     */
    let automaticNextStepId =
      nextStepId;

    if (
      !automaticNextStepId &&
      normalizedStep.step_type !==
        "Condition"
    ) {
      const followingStep =
        byOrder.get(
          normalizedStep.step_order +
            1
        );

      automaticNextStepId =
        followingStep?.id || null;
    }

    const {
      error: connectionError,
    } = await supabase
      .from("workflow_steps")
      .update({
        next_step_id:
          automaticNextStepId,

        true_step_id:
          trueStepId,

        false_step_id:
          falseStepId,
      })
      .eq(
        "id",
        savedStep.id
      )
      .eq(
        "workflow_id",
        workflowId
      )
      .eq(
        "organization_id",
        organizationId
      );

    if (connectionError) {
      throw new Error(
        `Unable to connect workflow step "${normalizedStep.name}": ${connectionError.message}`
      );
    }
  }
}

// =========================================================
// SAVE WORKFLOW STEPS
// =========================================================

async function saveWorkflowSteps({
  supabase,
  organizationId,
  workflowId,
  userId,
  steps,
}) {
  validateSteps(steps);

  /*
   * Load existing rows.
   */
  const {
    data: existingRows,
    error: existingError,
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
    );

  if (existingError) {
    throw new Error(
      existingError.message
    );
  }

  const existingSteps =
    Array.isArray(
      existingRows
    )
      ? existingRows
      : [];

  const existingMap =
    new Map(
      existingSteps.map(
        (step) => [
          step.id,
          step,
        ]
      )
    );

  /*
   * IDs supplied by the incoming workflow.
   */
  const incomingExistingIds =
    uniqueValues(
      steps
        .map(
          (step) =>
            step.id
        )
        .filter((id) =>
          existingMap.has(id)
        )
    );

  /*
   * First clear connections.
   *
   * This avoids self-referencing foreign keys
   * interfering when nodes are removed.
   */
  if (
    existingSteps.length > 0
  ) {
    const {
      error:
        clearConnectionsError,
    } = await supabase
      .from("workflow_steps")
      .update({
        next_step_id: null,
        true_step_id: null,
        false_step_id: null,
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "workflow_id",
        workflowId
      );

    if (
      clearConnectionsError
    ) {
      throw new Error(
        "Unable to reset workflow connections: " +
          clearConnectionsError.message
      );
    }
  }

  /*
   * Update steps whose IDs already exist.
   */
  for (const step of steps) {
    if (
      !step.id ||
      !existingMap.has(step.id)
    ) {
      continue;
    }

    const row =
      buildStepDatabaseRow({
        step,
        organizationId,
        workflowId,
        userId,
      });

    const {
      error: updateError,
    } = await supabase
      .from("workflow_steps")
      .update(row)
      .eq("id", step.id)
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "workflow_id",
        workflowId
      );

    if (updateError) {
      throw new Error(
        `Unable to update workflow step "${step.name}": ${updateError.message}`
      );
    }
  }

  /*
   * Insert completely new steps.
   */
  const newSteps =
    steps.filter(
      (step) =>
        !step.id ||
        !existingMap.has(
          step.id
        )
    );

  if (
    newSteps.length > 0
  ) {
    const rows =
      newSteps.map((step) => ({
        ...buildStepDatabaseRow({
          step,
          organizationId,
          workflowId,
          userId,
        }),

        created_by:
          userId,
      }));

    const {
      error: insertError,
    } = await supabase
      .from("workflow_steps")
      .insert(rows);

    if (insertError) {
      throw new Error(
        "Unable to create workflow steps: " +
          insertError.message
      );
    }
  }

  /*
   * Delete steps removed from the designer.
   *
   * Important:
   * If the current UI sends no IDs at all,
   * this effectively replaces all existing
   * steps, preserving compatibility with
   * the builder you already have.
   */
  const idsToDelete =
    existingSteps
      .map((step) => step.id)
      .filter(
        (id) =>
          !incomingExistingIds.includes(
            id
          )
      );

  if (
    idsToDelete.length > 0
  ) {
    const {
      error: deleteError,
    } = await supabase
      .from("workflow_steps")
      .delete()
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "workflow_id",
        workflowId
      )
      .in(
        "id",
        idsToDelete
      );

    if (deleteError) {
      throw new Error(
        "Unable to remove old workflow steps: " +
          deleteError.message
      );
    }
  }

  /*
   * Reload the final rows so we have UUIDs
   * for all newly-created nodes.
   */
  const {
    data: savedRows,
    error: reloadError,
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
    .order(
      "step_order",
      {
        ascending: true,
      }
    );

  if (reloadError) {
    throw new Error(
      reloadError.message
    );
  }

  const savedSteps =
    Array.isArray(savedRows)
      ? savedRows
      : [];

  /*
   * Now that every node has an ID,
   * resolve connections.
   */
  await applyStepConnections({
    supabase,
    organizationId,
    workflowId,
    normalizedSteps: steps,
    savedSteps,
  });

  return true;
}

// =========================================================
// LOAD ONE WORKFLOW
// =========================================================

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
    .eq(
      "id",
      workflowId
    )
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
    data: stepRows,
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
    .order(
      "step_order",
      {
        ascending: true,
      }
    );

  if (stepsError) {
    throw new Error(
      stepsError.message
    );
  }

  const steps =
    Array.isArray(
      stepRows
    )
      ? stepRows
      : [];

  return enrichWorkflow({
    ...workflow,
    steps,
  });
}

// =========================================================
// ENRICH WORKFLOW FOR UI
// =========================================================

function enrichWorkflow(workflow) {
  const steps =
    Array.isArray(
      workflow.steps
    )
      ? workflow.steps
      : [];

  const activeSteps =
    steps.filter(
      (step) =>
        step.is_active !==
        false
    );

  const approvalSteps =
    steps.filter(
      (step) =>
        step.step_type ===
        "Approval"
    );

  const conditionSteps =
    steps.filter(
      (step) =>
        step.step_type ===
        "Condition"
    );

  const automationSteps =
    steps.filter((step) =>
      [
        "Email",
        "Notification",
        "Create Task",
        "Update Record",
        "Wait",
        "AI Action",
      ].includes(
        step.step_type
      )
    );

  return {
    ...workflow,

    steps,

    step_count:
      steps.length,

    active_step_count:
      activeSteps.length,

    approval_step_count:
      approvalSteps.length,

    condition_step_count:
      conditionSteps.length,

    automation_step_count:
      automationSteps.length,

    has_branching:
      conditionSteps.some(
        (step) =>
          Boolean(
            step.true_step_id ||
              step.false_step_id
          )
      ),

    has_visual_positions:
      steps.some(
        (step) =>
          Number(
            step.position_x
          ) !== 0 ||
          Number(
            step.position_y
          ) !== 0
      ),
  };
}

// =========================================================
// LOAD WORKFLOW WORKSPACE
// =========================================================

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
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from("workflow_steps")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "step_order",
        {
          ascending: true,
        }
      ),

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
          backup_employee_id,
          availability_status,
          employment_status,
          is_active
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "full_name",
        {
          ascending: true,
        }
      ),

    supabase
      .from("departments")
      .select(
        `
          id,
          name,
          code,
          description,
          manager_id,
          parent_department_id,
          status
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "name",
        {
          ascending: true,
        }
      ),

    supabase
      .from("roles")
      .select(
        `
          id,
          name,
          code,
          description,
          is_system_role,
          is_active
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "name",
        {
          ascending: true,
        }
      ),
  ]);

  const errors = [
    workflowsResult.error,
    stepsResult.error,
    employeesResult.error,
    departmentsResult.error,
    rolesResult.error,
  ].filter(Boolean);

  if (
    errors.length > 0
  ) {
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
    const current =
      stepsByWorkflow.get(
        step.workflow_id
      ) || [];

    current.push(step);

    stepsByWorkflow.set(
      step.workflow_id,
      current
    );
  });

  const enrichedWorkflows =
    workflows.map(
      (workflow) =>
        enrichWorkflow({
          ...workflow,

          steps:
            stepsByWorkflow.get(
              workflow.id
            ) || [],
        })
    );

  return {
    workflows:
      enrichedWorkflows,

    employees:
      Array.isArray(
        employeesResult.data
      )
        ? employeesResult.data
        : [],

    departments:
      Array.isArray(
        departmentsResult.data
      )
        ? departmentsResult.data
        : [],

    roles:
      Array.isArray(
        rolesResult.data
      )
        ? rolesResult.data
        : [],
  };
}

// =========================================================
// CREATE WORKFLOW
// =========================================================

export async function createWorkflowDefinition({
  supabase,
  organizationId,
  userId,
  input,
}) {
  const normalized =
    normalizeWorkflowInput(
      input
    );

  const {
    steps,
    ...workflowData
  } = normalized;

  validateActiveWorkflow({
    ...workflowData,
    steps,
  });

  /*
   * Keep status and active flag consistent.
   */
  workflowData.is_active =
    workflowData.status ===
    "Active";

  const {
    data: createdWorkflow,
    error: createError,
  } = await supabase
    .from("workflows")
    .insert([
      {
        organization_id:
          organizationId,

        ...workflowData,

        version: 1,

        created_by:
          userId,

        updated_by:
          userId,
      },
    ])
    .select()
    .single();

  if (createError) {
    throw new Error(
      createError.message
    );
  }

  try {
    if (
      steps.length > 0
    ) {
      await saveWorkflowSteps({
        supabase,
        organizationId,
        workflowId:
          createdWorkflow.id,
        userId,
        steps,
      });
    }

    return await loadWorkflowById({
      supabase,
      organizationId,
      workflowId:
        createdWorkflow.id,
    });
  } catch (error) {
    /*
     * If step creation fails during initial
     * creation, remove the workflow so we
     * don't leave a broken definition.
     */
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

    throw error;
  }
}

// =========================================================
// UPDATE WORKFLOW
// =========================================================

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

  const finalWorkflow = {
    ...existingWorkflow,
    ...workflowUpdates,

    steps:
      Array.isArray(steps)
        ? steps
        : existingWorkflow.steps,
  };

  /*
   * Ensure status controls active state.
   */
  if (
    Object.prototype.hasOwnProperty.call(
      workflowUpdates,
      "status"
    )
  ) {
    finalWorkflow.is_active =
      workflowUpdates.status ===
      "Active";

    workflowUpdates.is_active =
      finalWorkflow.is_active;
  } else if (
    Object.prototype.hasOwnProperty.call(
      workflowUpdates,
      "is_active"
    )
  ) {
    /*
     * If only is_active is explicitly supplied,
     * maintain sensible status consistency.
     */
    if (
      workflowUpdates.is_active ===
      true
    ) {
      finalWorkflow.status =
        "Active";

      workflowUpdates.status =
        "Active";
    } else if (
      existingWorkflow.status ===
      "Active"
    ) {
      finalWorkflow.status =
        "Inactive";

      workflowUpdates.status =
        "Inactive";
    }
  }

  validateActiveWorkflow(
    finalWorkflow
  );

  const hasDefinitionUpdates =
    Object.keys(
      workflowUpdates
    ).length > 0;

  const stepsChanged =
    Array.isArray(steps);

  /*
   * Increment the version whenever either the
   * definition or steps are changed.
   */
  if (
    hasDefinitionUpdates ||
    stepsChanged
  ) {
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

        updated_by:
          userId,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        workflowId
      )
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

  if (
    Array.isArray(steps)
  ) {
    await saveWorkflowSteps({
      supabase,
      organizationId,
      workflowId,
      userId,
      steps,
    });
  }

  return loadWorkflowById({
    supabase,
    organizationId,
    workflowId,
  });
}

// =========================================================
// ARCHIVE WORKFLOW
// =========================================================

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

  /*
   * Never archive a workflow while an execution
   * is still pending/running/waiting.
   */
  const {
    count: activeRunCount,
    error: activeRunError,
  } = await supabase
    .from("workflow_runs")
    .select(
      "id",
      {
        count: "exact",
        head: true,
      }
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "workflow_id",
      workflowId
    )
    .in(
      "status",
      [
        "Pending",
        "Running",
        "Waiting",
      ]
    );

  if (activeRunError) {
    throw new Error(
      activeRunError.message
    );
  }

  if (
    (activeRunCount || 0) >
    0
  ) {
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

      updated_by:
        userId,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      workflowId
    )
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

// =========================================================
// FIND ACTIVE WORKFLOWS FOR AN EVENT
// =========================================================
//
// We are adding this now because the future execution
// engine will need exactly this function.
//
// Example:
//
// module = "Quotes"
// triggerEvent = "quote_submitted"
//
// It returns every active workflow configured to react
// to that event for this company.
// =========================================================

export async function findActiveWorkflowsForEvent({
  supabase,
  organizationId,
  module,
  triggerEvent,
}) {
  const normalizedModule =
    normalizeModule(module);

  const normalizedTrigger =
    normalizeTriggerEvent(
      triggerEvent
    );

  if (
    !normalizedModule ||
    !normalizedTrigger
  ) {
    return [];
  }

  const {
    data: workflows,
    error,
  } = await supabase
    .from("workflows")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "module",
      normalizedModule
    )
    .eq(
      "trigger_event",
      normalizedTrigger
    )
    .eq(
      "status",
      "Active"
    )
    .eq(
      "is_active",
      true
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  const results = [];

  for (
    const workflow of
      workflows || []
  ) {
    const loaded =
      await loadWorkflowById({
        supabase,
        organizationId,
        workflowId:
          workflow.id,
      });

    if (loaded) {
      results.push(loaded);
    }
  }

  return results;
}

// =========================================================
// GET ENTRY STEP
// =========================================================
//
// Used later by the execution engine.
//
// If the workflow uses normal ordered steps,
// the first active step is the entry step.
// =========================================================

export function getWorkflowEntryStep(
  workflow
) {
  const steps =
    Array.isArray(
      workflow?.steps
    )
      ? workflow.steps
      : [];

  return (
    steps
      .filter(
        (step) =>
          step.is_active !==
          false
      )
      .sort(
        (first, second) =>
          Number(
            first.step_order
          ) -
          Number(
            second.step_order
          )
      )[0] || null
  );
}

// =========================================================
// GET NEXT STEP
// =========================================================
//
// This does NOT execute anything.
//
// It only answers:
//
// "Given this node and optional condition result,
// where should the workflow go next?"
// =========================================================

export function getNextWorkflowStep({
  workflow,
  currentStep,
  conditionResult = null,
}) {
  if (
    !workflow ||
    !currentStep
  ) {
    return null;
  }

  const steps =
    Array.isArray(
      workflow.steps
    )
      ? workflow.steps
      : [];

  const byId =
    new Map(
      steps.map(
        (step) => [
          step.id,
          step,
        ]
      )
    );

  /*
   * Conditional branch.
   */
  if (
    currentStep.step_type ===
      "Condition"
  ) {
    if (
      conditionResult ===
      true &&
      currentStep.true_step_id
    ) {
      return (
        byId.get(
          currentStep.true_step_id
        ) || null
      );
    }

    if (
      conditionResult ===
      false &&
      currentStep.false_step_id
    ) {
      return (
        byId.get(
          currentStep.false_step_id
        ) || null
      );
    }

    return null;
  }

  /*
   * Explicit visual connection.
   */
  if (
    currentStep.next_step_id
  ) {
    return (
      byId.get(
        currentStep.next_step_id
      ) || null
    );
  }

  /*
   * Backwards-compatible ordered workflow.
   */
  const currentOrder =
    Number(
      currentStep.step_order
    );

  return (
    steps
      .filter(
        (step) =>
          step.is_active !==
            false &&
          Number(
            step.step_order
          ) > currentOrder
      )
      .sort(
        (first, second) =>
          Number(
            first.step_order
          ) -
          Number(
            second.step_order
          )
      )[0] || null
  );
}

// =========================================================
// WORKFLOW DEFINITION GRAPH
// =========================================================
//
// Gives the future visual editor a simple graph payload:
//
// {
//   nodes: [...],
//   edges: [...]
// }
//
// We can later consume this directly in the visual canvas.
// =========================================================

export function buildWorkflowGraph(
  workflow
) {
  const steps =
    Array.isArray(
      workflow?.steps
    )
      ? workflow.steps
      : [];

  const nodes =
    steps.map(
      (step) => ({
        id: step.id,

        type:
          step.step_type,

        label:
          step.name,

        step_order:
          step.step_order,

        position: {
          x:
            Number(
              step.position_x ||
                0
            ),

          y:
            Number(
              step.position_y ||
                0
            ),
        },

        data: step,
      })
    );

  const edges = [];

  for (
    const step of steps
  ) {
    if (
      step.next_step_id
    ) {
      edges.push({
        id:
          `${step.id}-next-${step.next_step_id}`,

        source:
          step.id,

        target:
          step.next_step_id,

        branch:
          "next",
      });
    }

    if (
      step.true_step_id
    ) {
      edges.push({
        id:
          `${step.id}-true-${step.true_step_id}`,

        source:
          step.id,

        target:
          step.true_step_id,

        branch:
          "true",

        label:
          "Yes",
      });
    }

    if (
      step.false_step_id
    ) {
      edges.push({
        id:
          `${step.id}-false-${step.false_step_id}`,

        source:
          step.id,

        target:
          step.false_step_id,

        branch:
          "false",

        label:
          "No",
      });
    }
  }

  return {
    nodes,
    edges,
  };
}
