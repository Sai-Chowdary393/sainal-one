import {
  getNextWorkflowStep,
  loadWorkflowById,
} from "../workflows/workflowEngine";

import {
  runFromStep,
} from "./runner";

function now() {
  return new Date().toISOString();
}

function normalizeDecision(value) {
  const clean = String(value || "")
    .trim()
    .toLowerCase();

  const map = {
    approve: "Approved",
    approved: "Approved",

    reject: "Rejected",
    rejected: "Rejected",

    request_changes:
      "RequestChanges",
    "request changes":
      "RequestChanges",
    requestchanges:
      "RequestChanges",

    delegate: "Delegate",
    delegated: "Delegate",
  };

  return map[clean] || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

async function getApprovalStepRun({
  supabase,
  organizationId,
  stepRunId,
}) {
  const {
    data,
    error,
  } = await supabase
    .from("workflow_step_runs")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      stepRunId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load approval: ${error.message}`
    );
  }

  return data;
}

async function getWorkflowRun({
  supabase,
  organizationId,
  workflowRunId,
}) {
  const {
    data,
    error,
  } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      workflowRunId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load workflow run: ${error.message}`
    );
  }

  return data;
}

async function validateDelegate({
  supabase,
  organizationId,
  employeeId,
}) {
  if (!isUuid(employeeId)) {
    throw new Error(
      "A valid employee must be selected for delegation."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("employees")
    .select(
      `
        id,
        full_name,
        email,
        employment_status,
        availability_status,
        is_active
      `
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      employeeId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to validate delegated employee: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Selected employee was not found."
    );
  }

  if (
    data.is_active === false ||
    data.employment_status ===
      "Inactive"
  ) {
    throw new Error(
      "Approval cannot be delegated to an inactive employee."
    );
  }

  return data;
}

export async function processApprovalDecision({
  supabase,
  organizationId,
  currentEmployeeId,
  stepRunId,
  decision,
  comment = "",
  delegatedTo = null,
  allowOverride = false,
}) {
  const normalizedDecision =
    normalizeDecision(
      decision
    );

  if (!normalizedDecision) {
    throw new Error(
      "Decision must be Approve, Reject, Request Changes or Delegate."
    );
  }

  const stepRun =
    await getApprovalStepRun({
      supabase,
      organizationId,
      stepRunId,
    });

  if (!stepRun) {
    throw new Error(
      "Approval request not found."
    );
  }

  if (
    stepRun.status !==
      "Pending" &&
    stepRun.status !==
      "Waiting"
  ) {
    throw new Error(
      "This approval has already been processed."
    );
  }

  if (
    !allowOverride &&
    stepRun.assigned_employee_id &&
    stepRun.assigned_employee_id !==
      currentEmployeeId
  ) {
    throw new Error(
      "This approval is assigned to another employee."
    );
  }

  if (
    !allowOverride &&
    !stepRun.assigned_employee_id
  ) {
    throw new Error(
      "This approval has not been assigned to you."
    );
  }

  const workflowRun =
    await getWorkflowRun({
      supabase,
      organizationId,
      workflowRunId:
        stepRun.workflow_run_id,
    });

  if (!workflowRun) {
    throw new Error(
      "Workflow run could not be found."
    );
  }

  const workflow =
    await loadWorkflowById({
      supabase,
      organizationId,

      workflowId:
        workflowRun.workflow_id,
    });

  if (!workflow) {
    throw new Error(
      "Workflow definition could not be found."
    );
  }

  const workflowStep =
    (workflow.steps || []).find(
      (step) =>
        step.id ===
        stepRun.workflow_step_id
    );

  if (!workflowStep) {
    throw new Error(
      "Workflow approval step could not be found."
    );
  }

  if (
    workflowStep.step_type !==
    "Approval"
  ) {
    throw new Error(
      "The selected workflow step is not an approval step."
    );
  }

  // =====================================================
  // DELEGATE
  // =====================================================

  if (
    normalizedDecision ===
    "Delegate"
  ) {
    const delegatedEmployee =
      await validateDelegate({
        supabase,
        organizationId,
        employeeId:
          delegatedTo,
      });

    if (
      delegatedEmployee.id ===
      currentEmployeeId
    ) {
      throw new Error(
        "You cannot delegate this approval to yourself."
      );
    }

    const {
      data: updatedStepRun,
      error,
    } = await supabase
      .from(
        "workflow_step_runs"
      )
      .update({
        assigned_employee_id:
          delegatedEmployee.id,

        delegated_to:
          delegatedEmployee.id,

        decision_comment:
          String(comment || "")
            .trim() ||
          `Delegated to ${delegatedEmployee.full_name}.`,

        updated_at:
          now(),
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        stepRun.id
      )
      .select()
      .single();

    if (error) {
      throw new Error(
        `Unable to delegate approval: ${error.message}`
      );
    }

    return {
      action: "Delegated",

      approval:
        updatedStepRun,

      delegatedEmployee,

      workflowRun,

      workflow,
    };
  }

  // =====================================================
  // COMPLETE CURRENT APPROVAL STEP
  // =====================================================

  const finalDecision =
    normalizedDecision;

  const {
    data: completedStepRun,
    error:
      stepUpdateError,
  } = await supabase
    .from(
      "workflow_step_runs"
    )
    .update({
      status:
        "Completed",

      decision:
        finalDecision,

      decision_comment:
        String(comment || "")
          .trim() ||
        null,

      decided_by:
        currentEmployeeId,

      decided_at:
        now(),

      completed_at:
        now(),

      updated_at:
        now(),
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      stepRun.id
    )
    .select()
    .single();

  if (stepUpdateError) {
    throw new Error(
      `Unable to record approval decision: ${stepUpdateError.message}`
    );
  }

  // =====================================================
  // REJECT
  // =====================================================

  if (
    finalDecision ===
    "Rejected"
  ) {
    const {
      data:
        rejectedWorkflowRun,
      error,
    } = await supabase
      .from("workflow_runs")
      .update({
        status:
          "Rejected",

        current_step_order:
          null,

        output_payload: {
          ...(workflowRun.output_payload ||
            {}),

          approval_decision:
            "Rejected",

          approval_step_id:
            workflowStep.id,

          decided_by:
            currentEmployeeId,

          decision_comment:
            String(
              comment || ""
            ).trim(),
        },

        completed_at:
          now(),

        updated_at:
          now(),
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        workflowRun.id
      )
      .select()
      .single();

    if (error) {
      throw new Error(
        `Unable to reject workflow: ${error.message}`
      );
    }

    return {
      action:
        "Rejected",

      approval:
        completedStepRun,

      workflowRun:
        rejectedWorkflowRun,

      workflow,

      result: {
        state:
          "Rejected",
      },
    };
  }

  // =====================================================
  // REQUEST CHANGES
  // =====================================================

  if (
    finalDecision ===
    "RequestChanges"
  ) {
    const {
      data:
        changedWorkflowRun,
      error,
    } = await supabase
      .from("workflow_runs")
      .update({
        status:
          "NeedsChanges",

        current_step_order:
          workflowStep.step_order,

        output_payload: {
          ...(workflowRun.output_payload ||
            {}),

          approval_decision:
            "RequestChanges",

          approval_step_id:
            workflowStep.id,

          decided_by:
            currentEmployeeId,

          decision_comment:
            String(
              comment || ""
            ).trim(),
        },

        updated_at:
          now(),
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        workflowRun.id
      )
      .select()
      .single();

    if (error) {
      throw new Error(
        `Unable to request workflow changes: ${error.message}`
      );
    }

    return {
      action:
        "RequestChanges",

      approval:
        completedStepRun,

      workflowRun:
        changedWorkflowRun,

      workflow,

      result: {
        state:
          "NeedsChanges",
      },
    };
  }

  // =====================================================
  // APPROVE + RESUME
  // =====================================================

  const nextStep =
    getNextWorkflowStep({
      workflow,

      currentStep:
        workflowStep,
    });

  const {
    data:
      resumedWorkflowRun,
    error:
      resumeUpdateError,
  } = await supabase
    .from("workflow_runs")
    .update({
      status:
        "Running",

      output_payload: {
        ...(workflowRun.output_payload ||
          {}),

        last_approval: {
          decision:
            "Approved",

          workflow_step_id:
            workflowStep.id,

          workflow_step_run_id:
            stepRun.id,

          decided_by:
            currentEmployeeId,

          decided_at:
            now(),

          comment:
            String(
              comment || ""
            ).trim(),
        },
      },

      updated_at:
        now(),
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      workflowRun.id
    )
    .select()
    .single();

  if (resumeUpdateError) {
    throw new Error(
      `Unable to resume workflow: ${resumeUpdateError.message}`
    );
  }

  if (!nextStep) {
    const {
      data:
        completedWorkflowRun,
      error:
        completionError,
    } = await supabase
      .from("workflow_runs")
      .update({
        status:
          "Completed",

        current_step_order:
          null,

        completed_at:
          now(),

        updated_at:
          now(),
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        workflowRun.id
      )
      .select()
      .single();

    if (completionError) {
      throw new Error(
        `Unable to complete workflow: ${completionError.message}`
      );
    }

    return {
      action:
        "Approved",

      approval:
        completedStepRun,

      workflowRun:
        completedWorkflowRun,

      workflow,

      result: {
        state:
          "Completed",
      },
    };
  }

  const runtimeResult =
    await runFromStep({
      supabase,
      organizationId,
      workflow,

      workflowRun:
        resumedWorkflowRun,

      step:
        nextStep,

      payload:
        workflowRun.input_payload ||
        {},
    });

  return {
    action:
      "Approved",

    approval:
      completedStepRun,

    workflowRun:
      resumedWorkflowRun,

    workflow,

    result:
      runtimeResult,
  };
}
