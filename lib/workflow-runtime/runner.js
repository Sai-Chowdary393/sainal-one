// =========================================================
// SAINAL ONE
// WORKFLOW RUNTIME - RUNNER
// =========================================================
//
// Responsibilities:
//
// - Start a workflow run.
// - Determine the entry step.
// - Execute automatic routing.
// - Execute real workflow actions.
// - Create workflow_step_runs.
// - Pause at human approvals.
// - Resume after approval decisions.
// - Continue after automatic actions.
// - Complete workflows.
//
// VERSION 3
// =========================================================

import {
  getNextWorkflowStep,
  getWorkflowEntryStep,
  loadWorkflowById,
} from "../workflows/workflowEngine";

import {
  executeWorkflowAction,
} from "../workflows/actionExecutor";

import {
  evaluateCondition,
} from "./conditions";

// =========================================================
// HELPERS
// =========================================================

function now() {
  return new Date().toISOString();
}

function cleanText(
  value
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

// =========================================================
// UPDATE WORKFLOW RUN
// =========================================================

async function updateWorkflowRun({
  supabase,
  organizationId,
  workflowRunId,
  updates,
}) {
  const {
    data,
    error,
  } = await supabase
    .from(
      "workflow_runs"
    )
    .update({
      ...updates,

      updated_at:
        now(),
    })
    .eq(
      "id",
      workflowRunId
    )
    .eq(
      "organization_id",
      organizationId
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Unable to update workflow run: ${error.message}`
    );
  }

  return data;
}

// =========================================================
// CREATE STEP RUN
// =========================================================

async function createStepRun({
  supabase,
  organizationId,
  workflowRun,
  step,
  status,
  assignedEmployeeId = null,
  inputPayload = {},
  outputPayload = {},
}) {
  const {
    data,
    error,
  } = await supabase
    .from(
      "workflow_step_runs"
    )
    .insert([
      {
        organization_id:
          organizationId,

        workflow_run_id:
          workflowRun.id,

        workflow_step_id:
          step.id,

        status,

        attempt_count:
          1,

        input_payload:
          inputPayload ||
          {},

        output_payload:
          outputPayload ||
          {},

        error_message:
          null,

        assigned_employee_id:
          assignedEmployeeId,

        started_at:
          now(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(
      `Unable to create workflow step run for "${step.name}": ${error.message}`
    );
  }

  return data;
}

// =========================================================
// COMPLETE STEP RUN
// =========================================================

async function completeStepRun({
  supabase,
  organizationId,
  stepRunId,
  outputPayload = {},
}) {
  const {
    data,
    error,
  } = await supabase
    .from(
      "workflow_step_runs"
    )
    .update({
      status:
        "Completed",

      output_payload:
        outputPayload ||
        {},

      error_message:
        null,

      completed_at:
        now(),

      updated_at:
        now(),
    })
    .eq(
      "id",
      stepRunId
    )
    .eq(
      "organization_id",
      organizationId
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Unable to complete workflow step run: ${error.message}`
    );
  }

  return data;
}

// =========================================================
// FAIL STEP RUN
// =========================================================

async function failStepRun({
  supabase,
  organizationId,
  stepRunId,
  error,
}) {
  try {
    await supabase
      .from(
        "workflow_step_runs"
      )
      .update({
        status:
          "Failed",

        error_message:
          error.message ||
          "Workflow action failed.",

        completed_at:
          now(),

        updated_at:
          now(),
      })
      .eq(
        "id",
        stepRunId
      )
      .eq(
        "organization_id",
        organizationId
      );
  } catch (
    updateError
  ) {
    console.error(
      "Unable to mark workflow step run as failed:",
      updateError
    );
  }
}

// =========================================================
// APPROVER RESOLUTION
// =========================================================

async function resolveApprovalEmployee({
  supabase,
  organizationId,
  step,
  payload,
}) {
  const config = {
    ...(
      step.configuration ||
      {}
    ),

    ...(
      step.action_config ||
      {}
    ),
  };

  const approverType =
    config.approver_type ||
    "Manager";

  // =======================================================
  // SPECIFIC EMPLOYEE
  // =======================================================

  if (
    approverType ===
    "Employee"
  ) {
    return (
      config.employee_id ||
      null
    );
  }

  // =======================================================
  // RECORD OWNER'S MANAGER
  // =======================================================

  if (
    approverType ===
    "Manager"
  ) {
    const ownerEmployeeId =
      payload
        ?.owner_employee_id;

    if (
      !ownerEmployeeId
    ) {
      return null;
    }

    const {
      data:
        owner,
      error,
    } =
      await supabase
        .from(
          "employees"
        )
        .select(
          `
            id,
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
        .eq(
          "id",
          ownerEmployeeId
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to resolve workflow approver: ${error.message}`
      );
    }

    if (!owner) {
      return null;
    }

    return (
      owner.manager_id ||
      null
    );
  }

  return null;
}

// =========================================================
// COMPLETE WORKFLOW
// =========================================================

async function completeWorkflowRun({
  supabase,
  organizationId,
  workflowRun,
  outputPayload = {},
}) {
  return updateWorkflowRun({
    supabase,
    organizationId,

    workflowRunId:
      workflowRun.id,

    updates: {
      status:
        "Completed",

      current_step_order:
        null,

      output_payload:
        outputPayload,

      completed_at:
        now(),

      error_message:
        null,
    },
  });
}

// =========================================================
// FAIL WORKFLOW
// =========================================================

async function failWorkflowRun({
  supabase,
  organizationId,
  workflowRun,
  error,
}) {
  try {
    await updateWorkflowRun({
      supabase,
      organizationId,

      workflowRunId:
        workflowRun.id,

      updates: {
        status:
          "Failed",

        error_message:
          error.message ||
          "Workflow execution failed.",

        completed_at:
          now(),
      },
    });
  } catch (
    updateError
  ) {
    console.error(
      "Unable to mark workflow run as failed:",
      updateError
    );
  }
}

// =========================================================
// REJECT BUSINESS RECORD
// =========================================================
//
// Rejection ends the current approval workflow.
//
// For Quotes we set the business record to Rejected.
// Other modules can be added later.
// =========================================================

async function rejectWorkflowRecord({
  supabase,
  organizationId,
  workflowRun,
}) {
  const recordType =
    String(
      workflowRun
        ?.record_type ||
        ""
    )
      .trim()
      .toLowerCase();

  if (
    recordType !==
      "quote" &&
    recordType !==
      "quotes"
  ) {
    return null;
  }

  if (
    !workflowRun
      ?.record_id
  ) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "quotes"
      )
      .update({
        status:
          "Rejected",

        updated_at:
          now(),
      })
      .eq(
        "id",
        workflowRun.record_id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to reject quote: ${error.message}`
    );
  }

  return data ||
    null;
}

// =========================================================
// RUN FROM STEP
// =========================================================

export async function runFromStep({
  supabase,
  organizationId,
  workflow,
  workflowRun,
  step,
  payload = {},
}) {
  // =======================================================
  // NO NEXT STEP = WORKFLOW COMPLETE
  // =======================================================

  if (!step) {
    return completeWorkflowRun({
      supabase,
      organizationId,
      workflowRun,

      outputPayload: {
        message:
          "Workflow completed because there are no more steps.",
      },
    });
  }

  try {
    const activeWorkflowRun =
      await updateWorkflowRun({
        supabase,
        organizationId,

        workflowRunId:
          workflowRun.id,

        updates: {
          status:
            "Running",

          current_step_order:
            step.step_order,

          error_message:
            null,
        },
      });

    const currentWorkflowRun =
      activeWorkflowRun ||
      workflowRun;

    // =====================================================
    // APPROVAL
    // =====================================================

    if (
      step.step_type ===
      "Approval"
    ) {
      const assignedEmployeeId =
        await resolveApprovalEmployee({
          supabase,
          organizationId,
          step,
          payload,
        });

      const stepRun =
        await createStepRun({
          supabase,
          organizationId,

          workflowRun:
            currentWorkflowRun,

          step,

          status:
            "Pending",

          assignedEmployeeId,

          inputPayload: {
            ...payload,

            runtime: {
              reason:
                "Waiting for human approval.",

              approver_resolved:
                Boolean(
                  assignedEmployeeId
                ),
            },
          },
        });

      await updateWorkflowRun({
        supabase,
        organizationId,

        workflowRunId:
          currentWorkflowRun.id,

        updates: {
          status:
            "Waiting",

          current_step_order:
            step.step_order,

          output_payload: {
            ...(
              currentWorkflowRun
                .output_payload ||
              {}
            ),

            waiting_for:
              "Approval",

            workflow_step_run_id:
              stepRun.id,

            assigned_employee_id:
              assignedEmployeeId,

            waiting_step_id:
              step.id,

            waiting_step_name:
              step.name,
          },
        },
      });

      return {
        state:
          "Waiting",

        reason:
          "Approval",

        workflowRunId:
          currentWorkflowRun.id,

        stepRunId:
          stepRun.id,

        stepId:
          step.id,

        stepName:
          step.name,

        assignedEmployeeId,
      };
    }

    // =====================================================
    // CONDITION
    // =====================================================

    if (
      step.step_type ===
      "Condition"
    ) {
      const stepRun =
        await createStepRun({
          supabase,
          organizationId,

          workflowRun:
            currentWorkflowRun,

          step,

          status:
            "Running",

          inputPayload:
            payload,
        });

      let conditionResult;

      try {
        conditionResult =
          evaluateCondition({
            step,
            payload,
          });

        await completeStepRun({
          supabase,
          organizationId,

          stepRunId:
            stepRun.id,

          outputPayload: {
            result:
              conditionResult,

            branch:
              conditionResult
                ? "true"
                : "false",
          },
        });
      } catch (
        error
      ) {
        await failStepRun({
          supabase,
          organizationId,

          stepRunId:
            stepRun.id,

          error,
        });

        throw error;
      }

      const nextStep =
        getNextWorkflowStep({
          workflow,

          currentStep:
            step,

          conditionResult,
        });

      return runFromStep({
        supabase,
        organizationId,
        workflow,

        workflowRun:
          currentWorkflowRun,

        step:
          nextStep,

        payload,
      });
    }

    // =====================================================
    // AUTOMATIC ACTION
    // =====================================================

    const stepRun =
      await createStepRun({
        supabase,
        organizationId,

        workflowRun:
          currentWorkflowRun,

        step,

        status:
          "Running",

        inputPayload:
          payload,
      });

    let actionResult;

    try {
      actionResult =
        await executeWorkflowAction({
          supabase,
          organizationId,

          workflowRun:
            currentWorkflowRun,

          workflowStep:
            step,

          payload,
        });

      await completeStepRun({
        supabase,
        organizationId,

        stepRunId:
          stepRun.id,

        outputPayload: {
          action:
            step.step_type,

          step_name:
            step.name,

          ...(
            actionResult ||
            {}
          ),
        },
      });
    } catch (
      error
    ) {
      await failStepRun({
        supabase,
        organizationId,

        stepRunId:
          stepRun.id,

        error,
      });

      throw error;
    }

    const nextStep =
      getNextWorkflowStep({
        workflow,

        currentStep:
          step,
      });

    return runFromStep({
      supabase,
      organizationId,
      workflow,

      workflowRun:
        currentWorkflowRun,

      step:
        nextStep,

      payload,
    });
  } catch (
    error
  ) {
    await failWorkflowRun({
      supabase,
      organizationId,
      workflowRun,
      error,
    });

    throw error;
  }
}

// =========================================================
// RESUME WAITING APPROVAL
// =========================================================
//
// Called after a human chooses Approve or Reject.
//
// Approved:
//   Complete Approval step
//   ↓
//   Continue from next workflow step
//
// Rejected:
//   Complete Approval step
//   ↓
//   Mark Quote Rejected
//   ↓
//   Complete workflow
//
// =========================================================

export async function resumeApprovalStep({
  supabase,
  organizationId,
  stepRunId,
  decision,
  decidedByEmployeeId,
}) {
  const cleanDecision =
    cleanText(
      decision
    );

  if (
    ![
      "Approved",
      "Rejected",
    ].includes(
      cleanDecision
    )
  ) {
    throw new Error(
      "Approval decision must be Approved or Rejected."
    );
  }

  // =======================================================
  // LOAD STEP RUN
  // =======================================================

  const {
    data:
      stepRun,
    error:
      stepRunError,
  } =
    await supabase
      .from(
        "workflow_step_runs"
      )
      .select("*")
      .eq(
        "id",
        stepRunId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

  if (
    stepRunError
  ) {
    throw new Error(
      `Unable to load approval step: ${stepRunError.message}`
    );
  }

  if (!stepRun) {
    throw new Error(
      "Approval step was not found."
    );
  }

  if (
    ![
      "Pending",
      "Waiting",
    ].includes(
      stepRun.status
    )
  ) {
    throw new Error(
      "This approval has already been decided."
    );
  }

  // =======================================================
  // LOAD WORKFLOW RUN
  // =======================================================

  const {
    data:
      workflowRun,
    error:
      workflowRunError,
  } =
    await supabase
      .from(
        "workflow_runs"
      )
      .select("*")
      .eq(
        "id",
        stepRun.workflow_run_id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

  if (
    workflowRunError
  ) {
    throw new Error(
      `Unable to load workflow run: ${workflowRunError.message}`
    );
  }

  if (!workflowRun) {
    throw new Error(
      "Workflow run was not found."
    );
  }

  // =======================================================
  // LOAD WORKFLOW
  // =======================================================

  const workflow =
    await loadWorkflowById({
      supabase,
      organizationId,

      workflowId:
        workflowRun.workflow_id,
    });

  if (!workflow) {
    throw new Error(
      "Workflow definition was not found."
    );
  }

  const currentStep =
    (
      workflow.steps ||
      []
    ).find(
      (
        step
      ) =>
        String(
          step.id
        ) ===
        String(
          stepRun.workflow_step_id
        )
    );

  if (!currentStep) {
    throw new Error(
      "Approval workflow step definition was not found."
    );
  }

  if (
    currentStep.step_type !==
    "Approval"
  ) {
    throw new Error(
      "The selected workflow step is not an approval step."
    );
  }

  // =======================================================
  // SAVE HUMAN DECISION
  // =======================================================

  const {
    data:
      decidedStepRun,
    error:
      decisionError,
  } =
    await supabase
      .from(
        "workflow_step_runs"
      )
      .update({
        status:
          "Completed",

        decision:
          cleanDecision,

        decided_by:
          decidedByEmployeeId,

        output_payload: {
          ...(
            stepRun.output_payload ||
            {}
          ),

          decision:
            cleanDecision,

          decided_by:
            decidedByEmployeeId,

          decided_at:
            now(),
        },

        error_message:
          null,

        completed_at:
          now(),

        updated_at:
          now(),
      })
      .eq(
        "id",
        stepRun.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .in(
        "status",
        [
          "Pending",
          "Waiting",
        ]
      )
      .select()
      .maybeSingle();

  if (
    decisionError
  ) {
    throw new Error(
      `Unable to save approval decision: ${decisionError.message}`
    );
  }

  if (
    !decidedStepRun
  ) {
    throw new Error(
      "This approval has already been decided."
    );
  }

  // =======================================================
  // REJECTION
  // =======================================================

  if (
    cleanDecision ===
    "Rejected"
  ) {
    const rejectedRecord =
      await rejectWorkflowRecord({
        supabase,
        organizationId,
        workflowRun,
      });

    const completedRun =
      await completeWorkflowRun({
        supabase,
        organizationId,
        workflowRun,

        outputPayload: {
          ...(
            workflowRun
              .output_payload ||
            {}
          ),

          waiting_for:
            null,

          workflow_step_run_id:
            null,

          assigned_employee_id:
            null,

          approval_decision:
            "Rejected",

          decided_by:
            decidedByEmployeeId,

          rejected_at:
            now(),
        },
      });

    return {
      decision:
        "Rejected",

      stepRun:
        decidedStepRun,

      workflowRun:
        completedRun,

      record:
        rejectedRecord,

      result: {
        state:
          "Completed",

        reason:
          "Rejected",
      },
    };
  }

  // =======================================================
  // APPROVED → CONTINUE WORKFLOW
  // =======================================================

  const nextStep =
    getNextWorkflowStep({
      workflow,

      currentStep,
    });

  const payload = {
    ...(
      workflowRun
        .input_payload ||
      {}
    ),

    approval: {
      decision:
        "Approved",

      decided_by:
        decidedByEmployeeId,

      decided_at:
        now(),

      workflow_step_run_id:
        decidedStepRun.id,
    },
  };

  /*
   * Clear the waiting state before continuing.
   */
  const resumedWorkflowRun =
    await updateWorkflowRun({
      supabase,
      organizationId,

      workflowRunId:
        workflowRun.id,

      updates: {
        status:
          "Running",

        output_payload: {
          ...(
            workflowRun
              .output_payload ||
            {}
          ),

          waiting_for:
            null,

          workflow_step_run_id:
            null,

          assigned_employee_id:
            null,

          approval_decision:
            "Approved",

          decided_by:
            decidedByEmployeeId,

          approved_at:
            now(),
        },

        error_message:
          null,
      },
    });

  const result =
    await runFromStep({
      supabase,
      organizationId,
      workflow,

      workflowRun:
        resumedWorkflowRun,

      step:
        nextStep,

      payload,
    });

  return {
    decision:
      "Approved",

    stepRun:
      decidedStepRun,

    workflowRun:
      resumedWorkflowRun,

    result,
  };
}

// =========================================================
// START ONE WORKFLOW
// =========================================================

export async function startWorkflowRun({
  supabase,
  organizationId,
  workflowId,
  workflowEventId = null,
  recordType,
  recordId = null,
  triggerEvent,
  inputPayload = {},
  initiatedBy = null,
}) {
  const workflow =
    await loadWorkflowById({
      supabase,
      organizationId,
      workflowId,
    });

  if (!workflow) {
    throw new Error(
      "Workflow definition not found."
    );
  }

  if (
    workflow.status !==
      "Active" ||
    workflow.is_active !==
      true
  ) {
    throw new Error(
      `Workflow "${workflow.name}" is not active.`
    );
  }

  const entryStep =
    getWorkflowEntryStep(
      workflow
    );

  const {
    data:
      workflowRun,
    error,
  } =
    await supabase
      .from(
        "workflow_runs"
      )
      .insert([
        {
          organization_id:
            organizationId,

          workflow_id:
            workflow.id,

          workflow_event_id:
            workflowEventId,

          record_type:
            recordType,

          record_id:
            recordId,

          trigger_event:
            triggerEvent,

          status:
            "Running",

          current_step_order:
            entryStep
              ?.step_order ||
            null,

          input_payload:
            inputPayload ||
            {},

          output_payload:
            {},

          error_message:
            null,

          initiated_by:
            initiatedBy,

          started_at:
            now(),
        },
      ])
      .select()
      .single();

  if (error) {
    throw new Error(
      `Unable to create workflow run: ${error.message}`
    );
  }

  if (!entryStep) {
    const completedRun =
      await completeWorkflowRun({
        supabase,
        organizationId,
        workflowRun,

        outputPayload: {
          message:
            "Workflow contains no executable steps.",
        },
      });

    return {
      workflow,

      workflowRun:
        completedRun,

      result: {
        state:
          "Completed",
      },
    };
  }

  const result =
    await runFromStep({
      supabase,
      organizationId,
      workflow,
      workflowRun,

      step:
        entryStep,

      payload:
        inputPayload,
    });

  return {
    workflow,

    workflowRun: {
      ...workflowRun,

      status:
        result?.state ===
        "Waiting"
          ? "Waiting"
          : result?.state ===
              "Completed"
            ? "Completed"
            : workflowRun.status,
    },

    result,
  };
}
