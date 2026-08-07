"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
} from "next/navigation";

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
    value:
      "greater_than_or_equal",
    label:
      "Greater than or equal",
  },
  {
    value: "less_than",
    label: "Less than",
  },
  {
    value:
      "less_than_or_equal",
    label:
      "Less than or equal",
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
            loadedWorkflow.steps || []
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
              position_x: x,
              position_y: y,
            }
          : step
      )
    );
  }

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
              [field]: value,
            }
          : step
      )
    );
  }

  function updateActionConfig(
    field,
    value
  ) {
    if (!selectedStep) {
      return;
    }

    updateSelectedStep(
      "action_config",
      {
        ...(selectedStep.action_config ||
          selectedStep.configuration ||
          {}),

        [field]: value,
      }
    );

    updateSelectedStep(
      "configuration",
      {
        ...(selectedStep.configuration ||
          {}),

        [field]: value,
      }
    );
  }

  function addStep() {
    const nextOrder =
      steps.length + 1;

    /*
     * New steps do not yet have a database
     * UUID, so we create a temporary id.
     *
     * workflowEngine.js understands local_id
     * when we save.
     */
    const temporaryId =
      `new-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    const previousStep =
      steps
        .slice()
        .sort(
          (first, second) =>
            first.step_order -
            second.step_order
        )
        .at(-1);

    const x =
      previousStep
        ? previousStep.position_x
        : 140;

    const y =
      previousStep
        ? previousStep.position_y +
          150
        : 100;

    const newStep = {
      id: temporaryId,
      local_id:
        temporaryId,

      step_order:
        nextOrder,

      name:
        `Step ${nextOrder}`,

      step_type:
        "Notification",

      description: "",

      configuration: {},

      action_config: {},

      condition_configuration:
        {},

      is_required: true,
      is_active: true,

      position_x: x,
      position_y: y,

      next_step_id: null,
      true_step_id: null,
      false_step_id: null,

      condition_type: null,
      condition_field: null,
      condition_operator:
        null,
      condition_value: null,
    };

    setSteps((current) => {
      const next =
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

                next_step_ref:
                  temporaryId,
              };
            }

            return step;
          }
        );

      return [
        ...next,
        newStep,
      ];
    });

    setSelectedStepId(
      temporaryId
    );
  }

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
            step.id !== removedId
        )
        .map(
          (step, index) => ({
            ...step,

            step_order:
              index + 1,

            next_step_id:
              step.next_step_id ===
              removedId
                ? null
                : step.next_step_id,

            true_step_id:
              step.true_step_id ===
              removedId
                ? null
                : step.true_step_id,

            false_step_id:
              step.false_step_id ===
              removedId
                ? null
                : step.false_step_id,

            next_step_ref:
              step.next_step_ref ===
              removedId
                ? null
                : step.next_step_ref,
          })
        );

    setSteps(nextSteps);

    setSelectedStepId(
      nextSteps[0]?.id ||
        null
    );
  }

  function autoArrange() {
    setSteps((current) =>
      current
        .slice()
        .sort(
          (first, second) =>
            first.step_order -
            second.step_order
        )
        .map(
          (step, index) => ({
            ...step,

            position_x: 240,

            position_y:
              80 +
              index * 150,
          })
        )
    );
  }

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
                id: isNew
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

                true_step_id:
                  isDatabaseId(
                    step.true_step_id
                  )
                    ? step.true_step_id
                    : null,

                false_step_id:
                  isDatabaseId(
                    step.false_step_id
                  )
                    ? step.false_step_id
                    : null,

                next_step_ref:
                  step.next_step_ref ||
                  null,

                true_step_ref:
                  step.true_step_ref ||
                  null,

                false_step_ref:
                  step.false_step_ref ||
                  null,
              };
            }
          ),
      };

      const response =
        await fetch(
          `/api/workflows/${workflow.id}`,
          {
            method: "PATCH",

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

      setSteps(savedSteps);

      setSelectedStepId(
        savedSteps[0]?.id ||
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

  return (
    <ProtectedRoute>
      <AppLayout
        title="Workflow Designer"
        description="Build visual business processes, approvals and automation."
      >
        <div
          className={styles.page}
        >
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
              value={steps.length}
            />

            <MetaCard
              label="Version"
              value={
                workflow.version ||
                1
              }
            />
          </section>

          <section
            className={
              styles.designerLayout
            }
          >
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
                    Drag nodes to organise
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
                  workflow={workflow}
                  steps={steps}
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
                          (
                            type
                          ) => (
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

                    <Field
                      label="Next step"
                    >
                      <select
                        value={
                          selectedStep.next_step_id ||
                          ""
                        }
                        disabled={
                          !canManage ||
                          selectedStep.step_type ===
                            "Condition"
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

                    <label
                      className={
                        styles.toggleField
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedStep.is_required
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
                          Required
                          step
                        </strong>

                        <small>
                          Workflow
                          waits for
                          this step to
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
                  <span>◇</span>

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
        Condition
      </strong>

      <Field
        label="Condition type"
      >
        <select
          value={
            step.condition_type ||
            "Field"
          }
          disabled={disabled}
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

      <Field
        label="Field"
      >
        <input
          value={
            step.condition_field ||
            ""
          }
          disabled={disabled}
          placeholder="Example: amount"
          onChange={(event) =>
            onUpdate(
              "condition_field",
              event.target.value
            )
          }
        />
      </Field>

      <Field
        label="Operator"
      >
        <select
          value={
            step.condition_operator ||
            "equals"
          }
          disabled={disabled}
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
                {operator.label}
              </option>
            )
          )}
        </select>
      </Field>

      <Field
        label="Value"
      >
        <input
          value={
            step.condition_value ??
            ""
          }
          disabled={disabled}
          placeholder="Example: 10000"
          onChange={(event) =>
            onUpdate(
              "condition_value",
              event.target.value
            )
          }
        />
      </Field>

      <Field
        label="If YES"
      >
        <select
          value={
            step.true_step_id ||
            ""
          }
          disabled={disabled}
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

      <Field
        label="If NO"
      >
        <select
          value={
            step.false_step_id ||
            ""
          }
          disabled={disabled}
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

      <Field
        label="Approver"
      >
        <select
          value={
            config.approver_type ||
            "Manager"
          }
          disabled={disabled}
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

      <Field
        label="Recipient"
      >
        <select
          value={
            config.recipient ||
            "Record Contact"
          }
          disabled={disabled}
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

      <Field
        label="Subject"
      >
        <input
          value={
            config.subject ||
            ""
          }
          disabled={disabled}
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

function Field({
  label,
  children,
}) {
  return (
    <label
      className={styles.field}
    >
      <span>{label}</span>

      {children}
    </label>
  );
}

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
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function normalizeCanvasPositions(
  steps
) {
  return steps.map(
    (step, index) => {
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
            : 240,

        position_y:
          hasPosition
            ? Number(
                step.position_y
              )
            : 80 +
              index * 150,

        action_config:
          step.action_config ||
          step.configuration ||
          {},
      };
    }
  );
}

function formatTrigger(value) {
  return String(value || "")
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

function isDatabaseId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}
