"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import AppLayout from "../../../../components/layout/AppLayout";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import WorkflowCanvas from "../../../../components/workflows/WorkflowCanvas";

import styles from "./workflow-designer.module.css";

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

const CONDITION_OPERATORS = [
  {
    value: "equals",
    label: "Equals",
  },
  {
    value: "not_equals",
    label: "Does not equal",
  },
  {
    value: "greater_than",
    label: "Greater than",
  },
  {
    value: "greater_than_or_equal",
    label: "Greater than or equal",
  },
  {
    value: "less_than",
    label: "Less than",
  },
  {
    value: "less_than_or_equal",
    label: "Less than or equal",
  },
  {
    value: "contains",
    label: "Contains",
  },
  {
    value: "not_contains",
    label: "Does not contain",
  },
  {
    value: "is_empty",
    label: "Is empty",
  },
  {
    value: "is_not_empty",
    label: "Is not empty",
  },
];

export default function WorkflowDesignerPage() {
  const params = useParams();

  const workflowId =
    params?.id;

  const [
    workflow,
    setWorkflow,
  ] = useState(null);

  const [
    steps,
    setSteps,
  ] = useState([]);

  const [
    selectedStepId,
    setSelectedStepId,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    canManage,
    setCanManage,
  ] = useState(false);

  // =======================================================
  // WORKFLOW TEST STATE
  // =======================================================

  const [
    testPanelOpen,
    setTestPanelOpen,
  ] = useState(false);

  const [
    testPayload,
    setTestPayload,
  ] = useState(
    JSON.stringify(
      {
        amount: 12000,
      },
      null,
      2
    )
  );

  const [
    testing,
    setTesting,
  ] = useState(false);

  const [
    testResult,
    setTestResult,
  ] = useState(null);

  const [
    testError,
    setTestError,
  ] = useState("");

  // =======================================================
  // LOAD WORKFLOW
  // =======================================================

  const loadWorkflow =
    useCallback(async () => {
      if (!workflowId) {
        return;
      }

      try {
        setLoading(true);

        setErrorMessage("");

        const response =
          await fetch(
            `/api/workflows/${workflowId}`,
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load workflow."
          );
        }

        const loadedWorkflow =
          data.workflow;

        const loadedSteps =
          normalizeCanvasPositions(
            loadedWorkflow.steps ||
              []
          );

        setWorkflow(
          loadedWorkflow
        );

        setSteps(
          loadedSteps
        );

        setCanManage(
          Boolean(
            data.canManage
          )
        );

        setSelectedStepId(
          loadedSteps[0]?.id ||
            null
        );
      } catch (error) {
        console.error(
          "Workflow designer loading error:",
          error
        );

        setErrorMessage(
          error.message ||
            "Unable to load workflow."
        );
      } finally {
        setLoading(false);
      }
    }, [workflowId]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  // =======================================================
  // SELECTED STEP
  // =======================================================

  const selectedStep =
    useMemo(
      () =>
        steps.find(
          (step) =>
            step.id ===
            selectedStepId
        ) || null,
      [
        steps,
        selectedStepId,
      ]
    );

  // =======================================================
  // NODE POSITION
  // =======================================================

  function handlePositionChange(
    stepId,
    x,
    y
  ) {
    setSteps((current) =>
      current.map((step) =>
        step.id === stepId
          ? {
              ...step,

              position_x:
                Math.round(x),

              position_y:
                Math.round(y),
            }
          : step
      )
    );
  }

  // =======================================================
  // CANVAS CONNECTION
  // =======================================================

  function handleConnectionChange(
    sourceStepId,
    branch,
    targetStepId
  ) {
    setSteps((current) =>
      current.map((step) => {
        if (
          step.id !==
          sourceStepId
        ) {
          return step;
        }

        const targetIsDatabaseStep =
          isDatabaseId(
            targetStepId
          );

        if (
          branch === "true"
        ) {
          return {
            ...step,

            true_step_id:
              targetIsDatabaseStep
                ? targetStepId
                : null,

            true_step_ref:
              targetIsDatabaseStep
                ? null
                : targetStepId,

            next_step_id:
              null,

            next_step_ref:
              null,
          };
        }

        if (
          branch === "false"
        ) {
          return {
            ...step,

            false_step_id:
              targetIsDatabaseStep
                ? targetStepId
                : null,

            false_step_ref:
              targetIsDatabaseStep
                ? null
                : targetStepId,

            next_step_id:
              null,

            next_step_ref:
              null,
          };
        }

        return {
          ...step,

          next_step_id:
            targetIsDatabaseStep
              ? targetStepId
              : null,

          next_step_ref:
            targetIsDatabaseStep
              ? null
              : targetStepId,
        };
      })
    );
  }

  // =======================================================
  // UPDATE SELECTED STEP
  // =======================================================

  function updateSelectedStep(
    field,
    value
  ) {
    if (!selectedStepId) {
      return;
    }

    setSteps((current) =>
      current.map((step) =>
        step.id ===
        selectedStepId
          ? {
              ...step,

              [field]:
                value,
            }
          : step
      )
    );
  }

  // =======================================================
  // UPDATE ACTION CONFIG
  // =======================================================

  function updateActionConfig(
    field,
    value
  ) {
    if (!selectedStepId) {
      return;
    }

    setSteps((current) =>
      current.map((step) => {
        if (
          step.id !==
          selectedStepId
        ) {
          return step;
        }

        const currentConfig = {
          ...(step.configuration ||
            {}),

          ...(step.action_config ||
            {}),
        };

        const nextConfig = {
          ...currentConfig,

          [field]:
            value,
        };

        return {
          ...step,

          configuration:
            nextConfig,

          action_config:
            nextConfig,
        };
      })
    );
  }

  // =======================================================
  // ADD STEP
  // =======================================================

  function addStep() {
    const nextOrder =
      steps.length + 1;

    const temporaryId =
      `new-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    const previousStep =
      steps
        .slice()
        .sort(
          (
            first,
            second
          ) =>
            Number(
              first.step_order
            ) -
            Number(
              second.step_order
            )
        )
        .at(-1);

    const x =
      previousStep
        ? Number(
            previousStep.position_x ||
              240
          )
        : 240;

    const y =
      previousStep
        ? Number(
            previousStep.position_y ||
              80
          ) + 170
        : 220;

    const newStep = {
      id:
        temporaryId,

      local_id:
        temporaryId,

      step_order:
        nextOrder,

      name:
        `Step ${nextOrder}`,

      step_type:
        "Notification",

      description:
        "",

      configuration:
        {},

      action_config:
        {},

      condition_configuration:
        {},

      is_required:
        true,

      is_active:
        true,

      position_x:
        x,

      position_y:
        y,

      next_step_id:
        null,

      next_step_ref:
        null,

      true_step_id:
        null,

      true_step_ref:
        null,

      false_step_id:
        null,

      false_step_ref:
        null,

      condition_type:
        null,

      condition_field:
        null,

      condition_operator:
        null,

      condition_value:
        null,
    };

    setSteps((current) => {
      const updatedExistingSteps =
        current.map(
          (step) => {
            if (
              previousStep &&
              step.id ===
                previousStep.id &&
              step.step_type !==
                "Condition"
            ) {
              return {
                ...step,

                next_step_id:
                  null,

                next_step_ref:
                  temporaryId,
              };
            }

            return step;
          }
        );

      return [
        ...updatedExistingSteps,
        newStep,
      ];
    });

    setSelectedStepId(
      temporaryId
    );
  }

  // =======================================================
  // REMOVE STEP
  // =======================================================

  function removeSelectedStep() {
    if (!selectedStep) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove "${selectedStep.name}" from this workflow?`
      );

    if (!confirmed) {
      return;
    }

    const removedId =
      selectedStep.id;

    const nextSteps =
      steps
        .filter(
          (step) =>
            step.id !==
            removedId
        )
        .map(
          (
            step,
            index
          ) => ({
            ...step,

            step_order:
              index + 1,

            next_step_id:
              step.next_step_id ===
              removedId
                ? null
                : step.next_step_id,

            next_step_ref:
              step.next_step_ref ===
              removedId
                ? null
                : step.next_step_ref,

            true_step_id:
              step.true_step_id ===
              removedId
                ? null
                : step.true_step_id,

            true_step_ref:
              step.true_step_ref ===
              removedId
                ? null
                : step.true_step_ref,

            false_step_id:
              step.false_step_id ===
              removedId
                ? null
                : step.false_step_id,

            false_step_ref:
              step.false_step_ref ===
              removedId
                ? null
                : step.false_step_ref,
          })
        );

    setSteps(
      nextSteps
    );

    setSelectedStepId(
      nextSteps[0]?.id ||
        null
    );
  }

  // =======================================================
  // AUTO ARRANGE
  // =======================================================

  function autoArrange() {
    setSteps((current) =>
      current
        .slice()
        .sort(
          (
            first,
            second
          ) =>
            Number(
              first.step_order
            ) -
            Number(
              second.step_order
            )
        )
        .map(
          (
            step,
            index
          ) => ({
            ...step,

            position_x:
              280,

            position_y:
              220 +
              index * 170,
          })
        )
    );
  }

  // =======================================================
  // RUN WORKFLOW TEST
  // =======================================================

  async function runWorkflowTest() {
    if (!workflow) {
      return;
    }

    try {
      setTesting(true);

      setTestError("");

      setTestResult(
        null
      );

      let parsedPayload =
        {};

      try {
        parsedPayload =
          JSON.parse(
            testPayload ||
              "{}"
          );
      } catch {
        throw new Error(
          "Test payload must be valid JSON."
        );
      }

      if (
        !parsedPayload ||
        typeof parsedPayload !==
          "object" ||
        Array.isArray(
          parsedPayload
        )
      ) {
        throw new Error(
          "Test payload must be a JSON object."
        );
      }

      const response =
        await fetch(
          `/api/workflows/${workflow.id}/test`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                payload:
                  parsedPayload,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to run workflow test."
        );
      }

      setTestResult(
        data
      );
    } catch (error) {
      console.error(
        "Workflow test error:",
        error
      );

      setTestError(
        error.message ||
          "Unable to run workflow test."
      );
    } finally {
      setTesting(false);
    }
  }

  function closeTestPanel() {
    setTestPanelOpen(
      false
    );

    setTestResult(
      null
    );

    setTestError(
      ""
    );
  }

  // =======================================================
  // SAVE WORKFLOW
  // =======================================================

  async function saveWorkflow() {
    if (!workflow) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name:
          workflow.name,

        code:
          workflow.code,

        description:
          workflow.description ||
          "",

        module:
          workflow.module,

        trigger_event:
          workflow.trigger_event,

        status:
          workflow.status,

        is_active:
          workflow.is_active,

        steps:
          steps.map(
            (
              step,
              index
            ) => {
              const isNew =
                String(
                  step.id
                ).startsWith(
                  "new-"
                );

              return {
                id:
                  isNew
                    ? undefined
                    : step.id,

                local_id:
                  isNew
                    ? step.id
                    : undefined,

                step_order:
                  index + 1,

                name:
                  step.name,

                step_type:
                  step.step_type,

                description:
                  step.description ||
                  "",

                configuration:
                  step.configuration ||
                  {},

                action_config:
                  step.action_config ||
                  step.configuration ||
                  {},

                condition_configuration:
                  step.condition_configuration ||
                  {},

                is_required:
                  Boolean(
                    step.is_required
                  ),

                is_active:
                  Boolean(
                    step.is_active
                  ),

                position_x:
                  Number(
                    step.position_x ||
                      0
                  ),

                position_y:
                  Number(
                    step.position_y ||
                      0
                  ),

                condition_type:
                  step.condition_type ||
                  null,

                condition_field:
                  step.condition_field ||
                  null,

                condition_operator:
                  step.condition_operator ||
                  null,

                condition_value:
                  step.condition_value ??
                  null,

                next_step_id:
                  isDatabaseId(
                    step.next_step_id
                  )
                    ? step.next_step_id
                    : null,

                next_step_ref:
                  step.next_step_ref ||
                  (
                    step.next_step_id &&
                    !isDatabaseId(
                      step.next_step_id
                    )
                      ? step.next_step_id
                      : null
                  ),

                true_step_id:
                  isDatabaseId(
                    step.true_step_id
                  )
                    ? step.true_step_id
                    : null,

                true_step_ref:
                  step.true_step_ref ||
                  (
                    step.true_step_id &&
                    !isDatabaseId(
                      step.true_step_id
                    )
                      ? step.true_step_id
                      : null
                  ),

                false_step_id:
                  isDatabaseId(
                    step.false_step_id
                  )
                    ? step.false_step_id
                    : null,

                false_step_ref:
                  step.false_step_ref ||
                  (
                    step.false_step_id &&
                    !isDatabaseId(
                      step.false_step_id
                    )
                      ? step.false_step_id
                      : null
                  ),
              };
            }
          ),
      };

      const response =
        await fetch(
          `/api/workflows/${workflow.id}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save workflow."
        );
      }

      setWorkflow(
        data.workflow
      );

      const savedSteps =
        normalizeCanvasPositions(
          data.workflow.steps ||
            []
        );

      setSteps(
        savedSteps
      );

      const stillExists =
        savedSteps.some(
          (step) =>
            step.id ===
            selectedStepId
        );

      setSelectedStepId(
        stillExists
          ? selectedStepId
          : savedSteps[0]?.id ||
              null
      );

      alert(
        "Workflow designer saved successfully."
      );
    } catch (error) {
      console.error(
        "Workflow designer save error:",
        error
      );

      alert(
        error.message ||
          "Unable to save workflow."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Workflow Designer"
          description="Loading workflow..."
        >
          <div
            className={
              styles.loadingPanel
            }
          >
            <div />
            <div />
            <div />
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // ERROR
  // =======================================================

  if (
    errorMessage ||
    !workflow
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Workflow Designer"
          description="Workflow configuration."
        >
          <section
            className={
              styles.errorPanel
            }
          >
            <strong>
              Unable to open workflow
            </strong>

            <p>
              {errorMessage ||
                "Workflow not found."}
            </p>

            <Link
              href="/settings/workflows"
              className={
                styles.secondaryButton
              }
            >
              Back to workflows
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Workflow Designer"
        description="Build visual business processes, approvals and automation."
      >
        <div
          className={
            styles.page
          }
        >
          {/* PAGE HEADER */}

          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <Link
                href="/settings/workflows"
                className={
                  styles.backLink
                }
              >
                ← Back to workflows
              </Link>

              <span
                className={
                  styles.eyebrow
                }
              >
                Visual Workflow Designer
              </span>

              <h2>
                {workflow.name}
              </h2>

              <p>
                {workflow.description ||
                  `${workflow.module} workflow triggered by ${formatTrigger(
                    workflow.trigger_event
                  )}.`}
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <span
                className={`${styles.statusBadge} ${
                  workflow.status ===
                  "Active"
                    ? styles.activeStatus
                    : styles.draftStatus
                }`}
              >
                {workflow.status}
              </span>

              {canManage && (
                <>
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={
                      autoArrange
                    }
                  >
                    Auto arrange
                  </button>

                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={() => {
                      setTestPanelOpen(
                        true
                      );

                      setTestError(
                        ""
                      );

                      setTestResult(
                        null
                      );
                    }}
                    disabled={
                      workflow.status !==
                      "Active"
                    }
                    title={
                      workflow.status !==
                      "Active"
                        ? "Activate the workflow before testing it."
                        : "Run this workflow with sample data."
                    }
                  >
                    Test workflow
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      saveWorkflow
                    }
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save designer"}
                  </button>
                </>
              )}
            </div>
          </section>

          {/* TEST WORKFLOW PANEL */}

          {testPanelOpen && (
            <section
              className={
                styles.testPanel
              }
            >
              <div
                className={
                  styles.testPanelHeader
                }
              >
                <div>
                  <span
                    className={
                      styles.eyebrow
                    }
                  >
                    Workflow Test
                  </span>

                  <h3>
                    Test{" "}
                    {workflow.name}
                  </h3>

                  <p>
                    Run this workflow
                    with sample business
                    data before connecting
                    it to real records.
                  </p>
                </div>

                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    closeTestPanel
                  }
                  disabled={
                    testing
                  }
                >
                  Close
                </button>
              </div>

              <div
                className={
                  styles.testGrid
                }
              >
                <div>
                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      Test payload
                    </span>

                    <textarea
                      rows={12}
                      value={
                        testPayload
                      }
                      onChange={(
                        event
                      ) =>
                        setTestPayload(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={
                        testing
                      }
                    />
                  </label>

                  <p
                    className={
                      styles.testHint
                    }
                  >
                    This is sample
                    business data only.
                    No real quote will
                    be changed during
                    this test.
                  </p>

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      runWorkflowTest
                    }
                    disabled={
                      testing ||
                      workflow.status !==
                        "Active"
                    }
                  >
                    {testing
                      ? "Running test..."
                      : "Run workflow test"}
                  </button>
                </div>

                <div
                  className={
                    styles.testResultPanel
                  }
                >
                  <span
                    className={
                      styles.eyebrow
                    }
                  >
                    Test Result
                  </span>

                  {testError && (
                    <div
                      className={
                        styles.testError
                      }
                    >
                      <strong>
                        Test failed
                      </strong>

                      <p>
                        {
                          testError
                        }
                      </p>
                    </div>
                  )}

                  {!testError &&
                    !testResult && (
                      <div
                        className={
                          styles.testEmpty
                        }
                      >
                        Run the
                        workflow to
                        see execution
                        details here.
                      </div>
                    )}

                  {testResult && (
                    <div
                      className={
                        styles.testSuccess
                      }
                    >
                      <strong>
                        {
                          testResult.message
                        }
                      </strong>

                      <div
                        className={
                          styles.testDetails
                        }
                      >
                        <div>
                          <span>
                            Workflow
                          </span>

                          <strong>
                            {testResult
                              .workflow
                              ?.name ||
                              "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Event
                          </span>

                          <strong>
                            {formatTrigger(
                              testResult
                                .event
                                ?.event_name
                            ) ||
                              "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Event status
                          </span>

                          <strong>
                            {testResult
                              .event
                              ?.status ||
                              "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Workflow run
                          </span>

                          <strong>
                            {testResult
                              .workflow_run
                              ?.id ||
                              "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Result
                          </span>

                          <strong>
                            {testResult
                              .execution
                              ?.result
                              ?.state ||
                              "Processed"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Current step
                          </span>

                          <strong>
                            {testResult
                              .execution
                              ?.result
                              ?.stepName ||
                              "Completed"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Assigned employee
                          </span>

                          <strong>
                            {testResult
                              .execution
                              ?.result
                              ?.assignedEmployeeId ||
                              "Not resolved"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* WORKFLOW SUMMARY */}

          <section
            className={
              styles.workflowMeta
            }
          >
            <MetaCard
              label="Module"
              value={
                workflow.module
              }
            />

            <MetaCard
              label="Trigger"
              value={formatTrigger(
                workflow.trigger_event
              )}
            />

            <MetaCard
              label="Steps"
              value={
                steps.length
              }
            />

            <MetaCard
              label="Version"
              value={
                workflow.version ||
                1
              }
            />
          </section>

          {/* DESIGNER */}

          <section
            className={
              styles.designerLayout
            }
          >
            {/* CANVAS */}

            <div
              className={
                styles.canvasPanel
              }
            >
              <div
                className={
                  styles.canvasToolbar
                }
              >
                <div>
                  <h3>
                    Workflow canvas
                  </h3>

                  <p>
                    Drag nodes, create
                    connections and design
                    the business process
                    visually.
                  </p>
                </div>

                {canManage && (
                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      addStep
                    }
                  >
                    + Add step
                  </button>
                )}
              </div>

              {steps.length ===
              0 ? (
                <div
                  className={
                    styles.emptyCanvas
                  }
                >
                  <span>
                    ⌘
                  </span>

                  <h3>
                    No steps yet
                  </h3>

                  <p>
                    Add the first node to
                    begin designing this
                    workflow.
                  </p>

                  {canManage && (
                    <button
                      type="button"
                      className={
                        styles.primaryButton
                      }
                      onClick={
                        addStep
                      }
                    >
                      Add first step
                    </button>
                  )}
                </div>
              ) : (
                <WorkflowCanvas
                  workflow={
                    workflow
                  }
                  steps={
                    steps
                  }
                  selectedStepId={
                    selectedStepId
                  }
                  onSelectStep={
                    setSelectedStepId
                  }
                  onNodesChanged={
                    handlePositionChange
                  }
                  onConnectionsChanged={
                    handleConnectionChange
                  }
                />
              )}
            </div>

            {/* CONFIGURATION */}

            <aside
              className={
                styles.configurationPanel
              }
            >
              {selectedStep ? (
                <>
                  <div
                    className={
                      styles.configurationHeader
                    }
                  >
                    <div>
                      <span
                        className={
                          styles.eyebrow
                        }
                      >
                        Selected node
                      </span>

                      <h3>
                        {
                          selectedStep.name
                        }
                      </h3>
                    </div>

                    <span
                      className={
                        styles.stepNumber
                      }
                    >
                      {
                        selectedStep.step_order
                      }
                    </span>
                  </div>

                  <div
                    className={
                      styles.configurationBody
                    }
                  >
                    <Field
                      label="Step name"
                    >
                      <input
                        value={
                          selectedStep.name
                        }
                        disabled={
                          !canManage
                        }
                        onChange={(
                          event
                        ) =>
                          updateSelectedStep(
                            "name",
                            event
                              .target
                              .value
                          )
                        }
                      />
                    </Field>

                    <Field
                      label="Step type"
                    >
                      <select
                        value={
                          selectedStep.step_type
                        }
                        disabled={
                          !canManage
                        }
                        onChange={(
                          event
                        ) =>
                          updateSelectedStep(
                            "step_type",
                            event
                              .target
                              .value
                          )
                        }
                      >
                        {STEP_TYPES.map(
                          (type) => (
                            <option
                              key={
                                type
                              }
                              value={
                                type
                              }
                            >
                              {type}
                            </option>
                          )
                        )}
                      </select>
                    </Field>

                    <Field
                      label="Description"
                    >
                      <textarea
                        rows={3}
                        value={
                          selectedStep.description ||
                          ""
                        }
                        disabled={
                          !canManage
                        }
                        onChange={(
                          event
                        ) =>
                          updateSelectedStep(
                            "description",
                            event
                              .target
                              .value
                          )
                        }
                      />
                    </Field>

                    {selectedStep.step_type ===
                      "Condition" && (
                      <ConditionEditor
                        step={
                          selectedStep
                        }
                        steps={
                          steps
                        }
                        disabled={
                          !canManage
                        }
                        onUpdate={
                          updateSelectedStep
                        }
                      />
                    )}

                    {selectedStep.step_type ===
                      "Approval" && (
                      <ApprovalEditor
                        step={
                          selectedStep
                        }
                        disabled={
                          !canManage
                        }
                        onUpdate={
                          updateActionConfig
                        }
                      />
                    )}

                    {selectedStep.step_type ===
                      "Email" && (
                      <EmailEditor
                        step={
                          selectedStep
                        }
                        disabled={
                          !canManage
                        }
                        onUpdate={
                          updateActionConfig
                        }
                      />
                    )}

                    {selectedStep.step_type ===
                      "Notification" && (
                      <NotificationEditor
                        step={
                          selectedStep
                        }
                        disabled={
                          !canManage
                        }
                        onUpdate={
                          updateActionConfig
                        }
                      />
                    )}

                    {selectedStep.step_type !==
                      "Condition" && (
                      <Field
                        label="Next step"
                      >
                        <select
                          value={
                            selectedStep.next_step_id ||
                            ""
                          }
                          disabled={
                            !canManage
                          }
                          onChange={(
                            event
                          ) =>
                            updateSelectedStep(
                              "next_step_id",
                              event
                                .target
                                .value ||
                                null
                            )
                          }
                        >
                          <option value="">
                            End workflow /
                            automatic
                          </option>

                          {steps
                            .filter(
                              (
                                step
                              ) =>
                                step.id !==
                                  selectedStep.id &&
                                isDatabaseId(
                                  step.id
                                )
                            )
                            .map(
                              (
                                step
                              ) => (
                                <option
                                  key={
                                    step.id
                                  }
                                  value={
                                    step.id
                                  }
                                >
                                  {
                                    step.name
                                  }
                                </option>
                              )
                            )}
                        </select>
                      </Field>
                    )}

                    <label
                      className={
                        styles.toggleField
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          Boolean(
                            selectedStep.is_required
                          )
                        }
                        disabled={
                          !canManage
                        }
                        onChange={(
                          event
                        ) =>
                          updateSelectedStep(
                            "is_required",
                            event
                              .target
                              .checked
                          )
                        }
                      />

                      <span>
                        <strong>
                          Required step
                        </strong>

                        <small>
                          Workflow waits
                          for this step to
                          complete.
                        </small>
                      </span>
                    </label>

                    {canManage && (
                      <button
                        type="button"
                        className={
                          styles.deleteButton
                        }
                        onClick={
                          removeSelectedStep
                        }
                      >
                        Remove step
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div
                  className={
                    styles.noSelection
                  }
                >
                  <span>
                    ◇
                  </span>

                  <h3>
                    Select a node
                  </h3>

                  <p>
                    Click a workflow node
                    to configure its
                    behaviour.
                  </p>
                </div>
              )}
            </aside>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// CONDITION EDITOR
// =========================================================

function ConditionEditor({
  step,
  steps,
  disabled,
  onUpdate,
}) {
  return (
    <div
      className={
        styles.specialConfig
      }
    >
      <strong>
        Condition settings
      </strong>

      <Field
        label="Condition type"
      >
        <select
          value={
            step.condition_type ||
            "Field"
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "condition_type",
              event.target.value
            )
          }
        >
          <option value="Field">
            Record field
          </option>

          <option value="Formula">
            Formula
          </option>

          <option value="AI">
            AI decision
          </option>
        </select>
      </Field>

      <Field label="Field">
        <input
          value={
            step.condition_field ||
            ""
          }
          disabled={
            disabled
          }
          placeholder="Example: amount"
          onChange={(event) =>
            onUpdate(
              "condition_field",
              event.target.value
            )
          }
        />
      </Field>

      <Field label="Operator">
        <select
          value={
            step.condition_operator ||
            "equals"
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "condition_operator",
              event.target.value
            )
          }
        >
          {CONDITION_OPERATORS.map(
            (operator) => (
              <option
                key={
                  operator.value
                }
                value={
                  operator.value
                }
              >
                {
                  operator.label
                }
              </option>
            )
          )}
        </select>
      </Field>

      <Field label="Value">
        <input
          value={
            step.condition_value ??
            ""
          }
          disabled={
            disabled
          }
          placeholder="Example: 10000"
          onChange={(event) =>
            onUpdate(
              "condition_value",
              event.target.value
            )
          }
        />
      </Field>

      <Field label="If YES">
        <select
          value={
            step.true_step_id ||
            ""
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "true_step_id",
              event.target.value ||
                null
            )
          }
        >
          <option value="">
            Select next step
          </option>

          {steps
            .filter(
              (candidate) =>
                candidate.id !==
                  step.id &&
                isDatabaseId(
                  candidate.id
                )
            )
            .map(
              (candidate) => (
                <option
                  key={
                    candidate.id
                  }
                  value={
                    candidate.id
                  }
                >
                  {
                    candidate.name
                  }
                </option>
              )
            )}
        </select>
      </Field>

      <Field label="If NO">
        <select
          value={
            step.false_step_id ||
            ""
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "false_step_id",
              event.target.value ||
                null
            )
          }
        >
          <option value="">
            Select next step
          </option>

          {steps
            .filter(
              (candidate) =>
                candidate.id !==
                  step.id &&
                isDatabaseId(
                  candidate.id
                )
            )
            .map(
              (candidate) => (
                <option
                  key={
                    candidate.id
                  }
                  value={
                    candidate.id
                  }
                >
                  {
                    candidate.name
                  }
                </option>
              )
            )}
        </select>
      </Field>
    </div>
  );
}

// =========================================================
// APPROVAL EDITOR
// =========================================================

function ApprovalEditor({
  step,
  disabled,
  onUpdate,
}) {
  const config =
    step.action_config ||
    step.configuration ||
    {};

  return (
    <div
      className={
        styles.specialConfig
      }
    >
      <strong>
        Approval settings
      </strong>

      <Field label="Approver">
        <select
          value={
            config.approver_type ||
            "Manager"
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "approver_type",
              event.target.value
            )
          }
        >
          <option value="Manager">
            Record owner's manager
          </option>

          <option value="Employee">
            Specific employee
          </option>

          <option value="Department">
            Department manager
          </option>

          <option value="Role">
            Employee with role
          </option>
        </select>
      </Field>
    </div>
  );
}

// =========================================================
// EMAIL EDITOR
// =========================================================

function EmailEditor({
  step,
  disabled,
  onUpdate,
}) {
  const config =
    step.action_config ||
    step.configuration ||
    {};

  return (
    <div
      className={
        styles.specialConfig
      }
    >
      <strong>
        Email settings
      </strong>

      <Field label="Recipient">
        <select
          value={
            config.recipient ||
            "Record Contact"
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "recipient",
              event.target.value
            )
          }
        >
          <option value="Record Contact">
            Record contact
          </option>

          <option value="Record Owner">
            Record owner
          </option>

          <option value="Manager">
            Owner's manager
          </option>
        </select>
      </Field>

      <Field label="Subject">
        <input
          value={
            config.subject ||
            ""
          }
          disabled={
            disabled
          }
          placeholder="Email subject"
          onChange={(event) =>
            onUpdate(
              "subject",
              event.target.value
            )
          }
        />
      </Field>
    </div>
  );
}

// =========================================================
// NOTIFICATION EDITOR
// =========================================================

function NotificationEditor({
  step,
  disabled,
  onUpdate,
}) {
  const config = {
    ...(step.configuration ||
      {}),

    ...(step.action_config ||
      {}),
  };

  return (
    <div
      className={
        styles.specialConfig
      }
    >
      <strong>
        Notification settings
      </strong>

      <Field label="Recipient">
        <select
          value={
            config.recipient ||
            "Record Owner"
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "recipient",
              event.target.value
            )
          }
        >
          <option value="Record Owner">
            Record owner
          </option>

          <option value="Manager">
            Record owner's manager
          </option>

          <option value="Employee">
            Specific employee
          </option>

          <option value="Department Manager">
            Department manager
          </option>

          <option value="Role">
            Employee with role
          </option>

          <option value="Organisation">
            Everyone in organisation
          </option>
        </select>
      </Field>

      <Field label="Notification title">
        <input
          value={
            config.title ||
            ""
          }
          disabled={
            disabled
          }
          placeholder="Example: Quote approved"
          onChange={(event) =>
            onUpdate(
              "title",
              event.target.value
            )
          }
        />
      </Field>

      <Field label="Message">
        <textarea
          rows={5}
          value={
            config.message ||
            ""
          }
          disabled={
            disabled
          }
          placeholder="Example: Quote {{quote_number}} for {{client}} has been approved."
          onChange={(event) =>
            onUpdate(
              "message",
              event.target.value
            )
          }
        />
      </Field>

      <Field label="Severity">
        <select
          value={
            config.type ||
            config.severity ||
            "success"
          }
          disabled={
            disabled
          }
          onChange={(event) => {
            onUpdate(
              "type",
              event.target.value
            );

            onUpdate(
              "severity",
              event.target.value
            );
          }}
        >
          <option value="info">
            Information
          </option>

          <option value="success">
            Success
          </option>

          <option value="warning">
            Warning
          </option>

          <option value="error">
            Error
          </option>
        </select>
      </Field>

      <label
        className={
          styles.toggleField
        }
      >
        <input
          type="checkbox"
          checked={
            config.open_record !==
            false
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "open_record",
              event.target.checked
            )
          }
        />

        <span>
          <strong>
            Open originating record
          </strong>

          <small>
            Clicking the notification
            opens the related quote,
            lead, project or other
            business record.
          </small>
        </span>
      </label>

      <label
        className={
          styles.toggleField
        }
      >
        <input
          type="checkbox"
          checked={
            config.create_notification !==
            false
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "create_notification",
              event.target.checked
            )
          }
        />

        <span>
          <strong>
            Create in-app notification
          </strong>

          <small>
            Adds this message to the
            SaiNal One Notification
            Center.
          </small>
        </span>
      </label>

      <label
        className={
          styles.toggleField
        }
      >
        <input
          type="checkbox"
          checked={
            Boolean(
              config.send_email
            )
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onUpdate(
              "send_email",
              event.target.checked
            )
          }
        />

        <span>
          <strong>
            Send email also
          </strong>

          <small>
            Reserved for the Email
            Engine milestone. The
            setting can be saved now
            but email delivery is not
            active yet.
          </small>
        </span>
      </label>

      <div
        className={
          styles.notificationVariables
        }
      >
        <strong>
          Available variables
        </strong>

        <p>
          Use variables in the title
          or message. We will connect
          runtime replacement next.
        </p>

        <div
          className={
            styles.variableList
          }
        >
          <code>
            {"{{quote_number}}"}
          </code>

          <code>
            {"{{client}}"}
          </code>

          <code>
            {"{{amount}}"}
          </code>

          <code>
            {"{{email}}"}
          </code>

          <code>
            {"{{record_type}}"}
          </code>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// GENERIC FIELD
// =========================================================

function Field({
  label,
  children,
}) {
  return (
    <label
      className={
        styles.field
      }
    >
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}

// =========================================================
// META CARD
// =========================================================

function MetaCard({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.metaCard
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

// =========================================================
// NORMALIZE POSITIONS
// =========================================================

function normalizeCanvasPositions(
  steps
) {
  return steps.map(
    (
      step,
      index
    ) => {
      const hasPosition =
        Number(
          step.position_x
        ) !== 0 ||
        Number(
          step.position_y
        ) !== 0;

      return {
        ...step,

        position_x:
          hasPosition
            ? Number(
                step.position_x
              )
            : 280,

        position_y:
          hasPosition
            ? Number(
                step.position_y
              )
            : 220 +
              index * 170,

        configuration:
          step.configuration ||
          {},

        action_config:
          step.action_config ||
          step.configuration ||
          {},

        condition_configuration:
          step.condition_configuration ||
          {},

        next_step_ref:
          null,

        true_step_ref:
          null,

        false_step_ref:
          null,
      };
    }
  );
}

// =========================================================
// FORMAT TRIGGER
// =========================================================

function formatTrigger(value) {
  return String(
    value || ""
  )
    .split("_")
    .filter(Boolean)
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

// =========================================================
// UUID CHECK
// =========================================================

function isDatabaseId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}
