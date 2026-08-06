"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import styles from "./workflows.module.css";

const MODULE_OPTIONS = [
  "Leads",
  "Quotes",
  "Proposals",
  "Customers",
  "Projects",
  "Invoices",
  "Follow-ups",
  "Employees",
  "Administration",
  "AI",
];

const TRIGGER_OPTIONS = {
  Leads: [
    {
      value: "lead_created",
      label: "Lead created",
    },
    {
      value: "lead_updated",
      label: "Lead updated",
    },
    {
      value: "lead_qualified",
      label: "Lead qualified",
    },
    {
      value: "lead_converted",
      label: "Lead converted",
    },
  ],

  Quotes: [
    {
      value: "quote_created",
      label: "Quote created",
    },
    {
      value: "quote_submitted",
      label: "Quote submitted for approval",
    },
    {
      value: "quote_approved",
      label: "Quote approved",
    },
    {
      value: "quote_changes_requested",
      label: "Quote changes requested",
    },
    {
      value: "quote_sent",
      label: "Quote sent",
    },
    {
      value: "quote_accepted",
      label: "Quote accepted",
    },
    {
      value: "quote_rejected",
      label: "Quote rejected",
    },
  ],

  Proposals: [
    {
      value: "proposal_created",
      label: "Proposal created",
    },
    {
      value: "proposal_submitted",
      label: "Proposal submitted",
    },
    {
      value: "proposal_approved",
      label: "Proposal approved",
    },
    {
      value: "proposal_sent",
      label: "Proposal sent",
    },
    {
      value: "proposal_accepted",
      label: "Proposal accepted",
    },
  ],

  Customers: [
    {
      value: "customer_created",
      label: "Customer created",
    },
    {
      value: "customer_updated",
      label: "Customer updated",
    },
  ],

  Projects: [
    {
      value: "project_created",
      label: "Project created",
    },
    {
      value: "project_started",
      label: "Project started",
    },
    {
      value: "project_completed",
      label: "Project completed",
    },
    {
      value: "project_at_risk",
      label: "Project marked at risk",
    },
  ],

  Invoices: [
    {
      value: "invoice_created",
      label: "Invoice created",
    },
    {
      value: "invoice_submitted",
      label: "Invoice submitted",
    },
    {
      value: "invoice_sent",
      label: "Invoice sent",
    },
    {
      value: "invoice_paid",
      label: "Invoice paid",
    },
    {
      value: "invoice_overdue",
      label: "Invoice overdue",
    },
  ],

  "Follow-ups": [
    {
      value: "follow_up_created",
      label: "Follow-up created",
    },
    {
      value: "follow_up_due",
      label: "Follow-up due",
    },
    {
      value: "follow_up_overdue",
      label: "Follow-up overdue",
    },
    {
      value: "follow_up_completed",
      label: "Follow-up completed",
    },
  ],

  Employees: [
    {
      value: "employee_created",
      label: "Employee created",
    },
    {
      value: "employee_on_leave",
      label: "Employee marked on leave",
    },
    {
      value: "employee_returned",
      label: "Employee returned",
    },
  ],

  Administration: [
    {
      value: "role_assigned",
      label: "Role assigned",
    },
    {
      value: "department_changed",
      label: "Department changed",
    },
  ],

  AI: [
    {
      value: "ai_insight_created",
      label: "AI insight created",
    },
    {
      value: "ai_risk_detected",
      label: "AI risk detected",
    },
  ],
};

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

const STATUS_OPTIONS = [
  "Draft",
  "Active",
  "Inactive",
];

const INITIAL_FORM = {
  name: "",
  code: "",
  description: "",
  module: "Quotes",
  trigger_event: "quote_submitted",
  status: "Draft",
  is_active: false,
  steps: [],
};

function createEmptyStep(order) {
  return {
    local_id:
      typeof crypto !== "undefined" &&
      crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,

    step_order: order,
    name: "",
    step_type: "Approval",
    description: "",
    is_required: true,
    is_active: true,
    configuration: {},
    condition_configuration: {},
  };
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] =
    useState([]);

  const [employees, setEmployees] =
    useState([]);

  const [departments, setDepartments] =
    useState([]);

  const [roles, setRoles] =
    useState([]);

  const [canManage, setCanManage] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [searchValue, setSearchValue] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [moduleFilter, setModuleFilter] =
    useState("All");

  const [showEditor, setShowEditor] =
    useState(false);

  const [editingWorkflowId, setEditingWorkflowId] =
    useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM);

  useEffect(() => {
    fetchWorkspace();
  }, []);

  async function fetchWorkspace() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/workflows",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load workflows."
        );
      }

      setWorkflows(
        Array.isArray(data.workflows)
          ? data.workflows
          : []
      );

      setEmployees(
        Array.isArray(data.employees)
          ? data.employees
          : []
      );

      setDepartments(
        Array.isArray(data.departments)
          ? data.departments
          : []
      );

      setRoles(
        Array.isArray(data.roles)
          ? data.roles
          : []
      );

      setCanManage(
        Boolean(data.canManage)
      );
    } catch (error) {
      console.error(
        "Workflow workspace loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to load workflows."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetEditor() {
    setEditingWorkflowId(null);

    setFormData({
      ...INITIAL_FORM,
      steps: [],
    });

    setShowEditor(false);
  }

  function openCreateEditor() {
    setEditingWorkflowId(null);

    setFormData({
      ...INITIAL_FORM,
      steps: [
        createEmptyStep(1),
      ],
    });

    setShowEditor(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openEditEditor(workflow) {
    setEditingWorkflowId(
      workflow.id
    );

    setFormData({
      name: workflow.name || "",
      code: workflow.code || "",
      description:
        workflow.description || "",
      module:
        workflow.module || "Quotes",
      trigger_event:
        workflow.trigger_event ||
        "quote_submitted",
      status:
        workflow.status || "Draft",
      is_active:
        workflow.is_active === true,

      steps: Array.isArray(
        workflow.steps
      )
        ? workflow.steps.map(
            (step, index) => ({
              ...step,
              local_id:
                step.id ||
                `${workflow.id}-${index}`,
              configuration:
                step.configuration || {},
              condition_configuration:
                step.condition_configuration ||
                {},
            })
          )
        : [],
    });

    setShowEditor(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleFieldChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    if (name === "module") {
      const triggerOptions =
        TRIGGER_OPTIONS[value] || [];

      setFormData((current) => ({
        ...current,
        module: value,
        trigger_event:
          triggerOptions[0]?.value || "",
      }));

      return;
    }

    if (name === "status") {
      setFormData((current) => ({
        ...current,
        status: value,
        is_active:
          value === "Active",
      }));

      return;
    }

    setFormData((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : name === "code"
            ? formatCode(value)
            : value,
    }));
  }

  function updateStep(
    localId,
    field,
    value
  ) {
    setFormData((current) => ({
      ...current,

      steps: current.steps.map(
        (step) =>
          step.local_id === localId
            ? {
                ...step,
                [field]: value,
              }
            : step
      ),
    }));
  }

  function addStep() {
    setFormData((current) => ({
      ...current,

      steps: [
        ...current.steps,
        createEmptyStep(
          current.steps.length + 1
        ),
      ],
    }));
  }

  function removeStep(localId) {
    setFormData((current) => {
      const remaining =
        current.steps.filter(
          (step) =>
            step.local_id !== localId
        );

      return {
        ...current,

        steps: remaining.map(
          (step, index) => ({
            ...step,
            step_order: index + 1,
          })
        ),
      };
    });
  }

  function moveStep(
    localId,
    direction
  ) {
    setFormData((current) => {
      const steps = [
        ...current.steps,
      ];

      const currentIndex =
        steps.findIndex(
          (step) =>
            step.local_id === localId
        );

      if (currentIndex < 0) {
        return current;
      }

      const targetIndex =
        direction === "up"
          ? currentIndex - 1
          : currentIndex + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= steps.length
      ) {
        return current;
      }

      const currentStep =
        steps[currentIndex];

      steps[currentIndex] =
        steps[targetIndex];

      steps[targetIndex] =
        currentStep;

      return {
        ...current,

        steps: steps.map(
          (step, index) => ({
            ...step,
            step_order: index + 1,
          })
        ),
      };
    });
  }

  async function saveWorkflow(event) {
    event.preventDefault();

    if (!formData.name.trim()) {
      alert(
        "Please enter the workflow name."
      );
      return;
    }

    if (!formData.code.trim()) {
      alert(
        "Please enter the workflow code."
      );
      return;
    }

    if (!formData.trigger_event) {
      alert(
        "Please select a trigger event."
      );
      return;
    }

    if (
      formData.status === "Active" &&
      formData.steps.length === 0
    ) {
      alert(
        "An active workflow must contain at least one step."
      );
      return;
    }

    const invalidStep =
      formData.steps.find(
        (step) => !step.name.trim()
      );

    if (invalidStep) {
      alert(
        "Please enter a name for every workflow step."
      );
      return;
    }

    try {
      setSaving(true);

      const endpoint =
        editingWorkflowId
          ? `/api/workflows/${editingWorkflowId}`
          : "/api/workflows";

      const method =
        editingWorkflowId
          ? "PATCH"
          : "POST";

      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        description:
          formData.description.trim(),
        module: formData.module,
        trigger_event:
          formData.trigger_event,
        status: formData.status,
        is_active:
          formData.status === "Active",

        steps: formData.steps.map(
          (step, index) => ({
            step_order: index + 1,
            name: step.name.trim(),
            step_type:
              step.step_type,
            description:
              step.description.trim(),
            is_required:
              Boolean(step.is_required),
            is_active:
              Boolean(step.is_active),

            configuration:
              buildStepConfiguration(
                step
              ),

            condition_configuration:
              step.condition_configuration ||
              {},
          })
        ),
      };

      const response = await fetch(
        endpoint,
        {
          method,

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            payload
          ),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save workflow."
        );
      }

      const wasEditing = Boolean(
        editingWorkflowId
      );

      resetEditor();
      await fetchWorkspace();

      alert(
        wasEditing
          ? "Workflow updated successfully."
          : "Workflow created successfully."
      );
    } catch (error) {
      console.error(
        "Workflow save error:",
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

  async function archiveWorkflow(
    workflow
  ) {
    const confirmed =
      window.confirm(
        `Archive ${workflow.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/workflows/${workflow.id}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to archive workflow."
        );
      }

      await fetchWorkspace();

      alert(
        data.message ||
          "Workflow archived successfully."
      );
    } catch (error) {
      console.error(
        "Workflow archive error:",
        error
      );

      alert(
        error.message ||
          "Unable to archive workflow."
      );
    }
  }

  async function changeWorkflowStatus(
    workflow,
    nextStatus
  ) {
    try {
      const response = await fetch(
        `/api/workflows/${workflow.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            status: nextStatus,
            is_active:
              nextStatus === "Active",
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update workflow status."
        );
      }

      await fetchWorkspace();
    } catch (error) {
      console.error(
        "Workflow status error:",
        error
      );

      alert(
        error.message ||
          "Unable to change workflow status."
      );
    }
  }

  const filteredWorkflows =
    useMemo(() => {
      const search =
        searchValue
          .trim()
          .toLowerCase();

      return workflows.filter(
        (workflow) => {
          const matchesSearch =
            !search ||
            [
              workflow.name,
              workflow.code,
              workflow.description,
              workflow.module,
              workflow.trigger_event,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(search)
            );

          const matchesStatus =
            statusFilter === "All" ||
            workflow.status ===
              statusFilter;

          const matchesModule =
            moduleFilter === "All" ||
            workflow.module ===
              moduleFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesModule
          );
        }
      );
    }, [
      workflows,
      searchValue,
      statusFilter,
      moduleFilter,
    ]);

  const activeWorkflows =
    workflows.filter(
      (workflow) =>
        workflow.status ===
          "Active" ||
        workflow.is_active === true
    ).length;

  const draftWorkflows =
    workflows.filter(
      (workflow) =>
        workflow.status === "Draft"
    ).length;

  const totalSteps =
    workflows.reduce(
      (total, workflow) =>
        total +
        Number(
          workflow.step_count ||
            workflow.steps?.length ||
            0
        ),
      0
    );

  const totalApprovalSteps =
    workflows.reduce(
      (total, workflow) =>
        total +
        Number(
          workflow.approval_step_count ||
            0
        ),
      0
    );

  const triggerOptions =
    TRIGGER_OPTIONS[
      formData.module
    ] || [];

  return (
    <ProtectedRoute>
      <AppLayout
        title="Workflow Builder"
        description="Design approvals, automation steps and business processes across SaiNal One."
      >
        <div className={styles.page}>
          <section
            className={
              styles.pageHeader
            }
          >
            <div
              className={
                styles.pageHeaderCopy
              }
            >
              <span
                className={
                  styles.eyebrow
                }
              >
                Administration
              </span>

              <h2>
                Workflow automation
              </h2>

              <p>
                Create reusable business
                processes for approvals,
                notifications, email,
                tasks, record updates and
                AI actions.
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={
                  showEditor
                    ? resetEditor
                    : openCreateEditor
                }
              >
                <span>
                  {showEditor
                    ? "×"
                    : "+"}
                </span>

                {showEditor
                  ? "Close builder"
                  : "Create workflow"}
              </button>
            )}
          </section>

          {!canManage &&
            !loading && (
              <section
                className={
                  styles.noticePanel
                }
              >
                <strong>
                  Read-only access
                </strong>

                <p>
                  You can review workflow
                  definitions, but you do not
                  have permission to create or
                  change workflows.
                </p>
              </section>
            )}

          {showEditor &&
            canManage && (
              <form
                className={
                  styles.builder
                }
                onSubmit={saveWorkflow}
              >
                <section
                  className={
                    styles.builderHeader
                  }
                >
                  <div>
                    <span
                      className={
                        styles.builderEyebrow
                      }
                    >
                      {editingWorkflowId
                        ? "Edit workflow"
                        : "New workflow"}
                    </span>

                    <h3>
                      {editingWorkflowId
                        ? formData.name ||
                          "Workflow"
                        : "Build a business process"}
                    </h3>

                    <p>
                      Define when the workflow
                      starts and add the steps
                      that should run in order.
                    </p>
                  </div>

                  <span
                    className={
                      styles.versionBadge
                    }
                  >
                    {editingWorkflowId
                      ? "Existing workflow"
                      : "Version 1"}
                  </span>
                </section>

                <section
                  className={
                    styles.workflowDetails
                  }
                >
                  <div
                    className={
                      styles.sectionHeading
                    }
                  >
                    <span
                      className={
                        styles.sectionIcon
                      }
                    >
                      ⌘
                    </span>

                    <div>
                      <h3>
                        Workflow details
                      </h3>

                      <p>
                        Give the workflow a
                        clear identity and
                        select its business
                        trigger.
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <FormField
                      label="Workflow name"
                      name="name"
                      value={
                        formData.name
                      }
                      onChange={
                        handleFieldChange
                      }
                      placeholder="Example: Quote Approval"
                      required
                    />

                    <FormField
                      label="Workflow code"
                      name="code"
                      value={
                        formData.code
                      }
                      onChange={
                        handleFieldChange
                      }
                      placeholder="Example: QUOTE_APPROVAL"
                      required
                    />

                    <SelectField
                      label="Module"
                      name="module"
                      value={
                        formData.module
                      }
                      onChange={
                        handleFieldChange
                      }
                    >
                      {MODULE_OPTIONS.map(
                        (module) => (
                          <option
                            key={module}
                            value={module}
                          >
                            {module}
                          </option>
                        )
                      )}
                    </SelectField>

                    <SelectField
                      label="Trigger event"
                      name="trigger_event"
                      value={
                        formData.trigger_event
                      }
                      onChange={
                        handleFieldChange
                      }
                    >
                      {triggerOptions.map(
                        (trigger) => (
                          <option
                            key={
                              trigger.value
                            }
                            value={
                              trigger.value
                            }
                          >
                            {
                              trigger.label
                            }
                          </option>
                        )
                      )}
                    </SelectField>

                    <SelectField
                      label="Status"
                      name="status"
                      value={
                        formData.status
                      }
                      onChange={
                        handleFieldChange
                      }
                    >
                      {STATUS_OPTIONS.map(
                        (status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        )
                      )}
                    </SelectField>

                    <FormField
                      label="Description"
                      name="description"
                      value={
                        formData.description
                      }
                      onChange={
                        handleFieldChange
                      }
                      placeholder="Describe what this workflow controls and when it should be used"
                      textarea
                      rows={4}
                      fullWidth
                    />
                  </div>
                </section>

                <section
                  className={
                    styles.stepsPanel
                  }
                >
                  <div
                    className={
                      styles.stepsHeading
                    }
                  >
                    <div
                      className={
                        styles.sectionHeading
                      }
                    >
                      <span
                        className={
                          styles.sectionIcon
                        }
                      >
                        ⇢
                      </span>

                      <div>
                        <h3>
                          Workflow steps
                        </h3>

                        <p>
                          Steps run in the
                          order shown below.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={
                        styles.secondaryButton
                      }
                      onClick={addStep}
                    >
                      + Add step
                    </button>
                  </div>

                  {formData.steps.length ===
                  0 ? (
                    <div
                      className={
                        styles.emptySteps
                      }
                    >
                      <span>⇢</span>

                      <h3>
                        No workflow steps
                      </h3>

                      <p>
                        Add an approval,
                        notification, email,
                        task or record update
                        step.
                      </p>

                      <button
                        type="button"
                        className={
                          styles.primaryButton
                        }
                        onClick={addStep}
                      >
                        Add first step
                      </button>
                    </div>
                  ) : (
                    <div
                      className={
                        styles.stepsList
                      }
                    >
                      {formData.steps.map(
                        (step, index) => (
                          <StepEditor
                            key={
                              step.local_id
                            }
                            step={step}
                            index={index}
                            totalSteps={
                              formData.steps
                                .length
                            }
                            employees={
                              employees
                            }
                            departments={
                              departments
                            }
                            roles={roles}
                            onChange={
                              updateStep
                            }
                            onMove={
                              moveStep
                            }
                            onRemove={
                              removeStep
                            }
                          />
                        )
                      )}
                    </div>
                  )}
                </section>

                <section
                  className={
                    styles.builderActions
                  }
                >
                  <div>
                    <strong>
                      Save workflow definition
                    </strong>

                    <p>
                      Active workflows must
                      contain at least one
                      valid step.
                    </p>
                  </div>

                  <div
                    className={
                      styles.actionButtons
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.secondaryButton
                      }
                      onClick={resetEditor}
                      disabled={saving}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className={
                        styles.primaryButton
                      }
                      disabled={saving}
                    >
                      {saving
                        ? "Saving workflow..."
                        : editingWorkflowId
                          ? "Update workflow"
                          : "Create workflow"}
                    </button>
                  </div>
                </section>
              </form>
            )}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="⌘"
              label="Workflows"
              value={workflows.length}
              detail="All workflow definitions"
              tone="gold"
            />

            <SummaryCard
              icon="✓"
              label="Active"
              value={activeWorkflows}
              detail="Currently enabled"
              tone="green"
            />

            <SummaryCard
              icon="◌"
              label="Draft"
              value={draftWorkflows}
              detail="Still being configured"
              tone="blue"
            />

            <SummaryCard
              icon="⇢"
              label="Steps"
              value={totalSteps}
              detail={`${totalApprovalSteps} approval steps`}
              tone="purple"
            />
          </section>

          <section
            className={
              styles.toolbarPanel
            }
          >
            <label
              className={
                styles.searchBox
              }
            >
              <span aria-hidden="true">
                ⌕
              </span>

              <input
                type="search"
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                placeholder="Search workflow, code, module or trigger..."
              />
            </label>

            <div
              className={
                styles.filters
              }
            >
              <select
                className={
                  styles.filterSelect
                }
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All statuses
                </option>

                <option value="Draft">
                  Draft
                </option>

                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>

                <option value="Archived">
                  Archived
                </option>
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={moduleFilter}
                onChange={(event) =>
                  setModuleFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All modules
                </option>

                {MODULE_OPTIONS.map(
                  (module) => (
                    <option
                      key={module}
                      value={module}
                    >
                      {module}
                    </option>
                  )
                )}
              </select>
            </div>
          </section>

          {loading ? (
            <LoadingState />
          ) : errorMessage ? (
            <section
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to load workflows
                </strong>

                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  fetchWorkspace
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              className={
                styles.workflowsPanel
              }
            >
              <div
                className={
                  styles.panelHeading
                }
              >
                <div>
                  <h3>
                    Workflow definitions
                  </h3>

                  <p>
                    Review business triggers,
                    ordered steps and
                    activation status.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {filteredWorkflows.length}{" "}
                  result
                  {filteredWorkflows.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredWorkflows.length ===
              0 ? (
                <EmptyState
                  hasWorkflows={
                    workflows.length > 0
                  }
                  canManage={canManage}
                  onCreate={
                    openCreateEditor
                  }
                />
              ) : (
                <div
                  className={
                    styles.workflowGrid
                  }
                >
                  {filteredWorkflows.map(
                    (workflow) => (
                      <WorkflowCard
                        key={
                          workflow.id
                        }
                        workflow={
                          workflow
                        }
                        canManage={
                          canManage
                        }
                        onEdit={() =>
                          openEditEditor(
                            workflow
                          )
                        }
                        onArchive={() =>
                          archiveWorkflow(
                            workflow
                          )
                        }
                        onStatusChange={
                          (
                            nextStatus
                          ) =>
                            changeWorkflowStatus(
                              workflow,
                              nextStatus
                            )
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function StepEditor({
  step,
  index,
  totalSteps,
  employees,
  departments,
  roles,
  onChange,
  onMove,
  onRemove,
}) {
  const configuration =
    step.configuration || {};

  function updateConfiguration(
    field,
    value
  ) {
    onChange(
      step.local_id,
      "configuration",
      {
        ...configuration,
        [field]: value,
      }
    );
  }

  return (
    <article
      className={styles.stepCard}
    >
      <div
        className={
          styles.stepNumber
        }
      >
        {index + 1}
      </div>

      <div
        className={
          styles.stepContent
        }
      >
        <div
          className={
            styles.stepTop
          }
        >
          <div>
            <span
              className={
                styles.stepEyebrow
              }
            >
              Step {index + 1}
            </span>

            <h3>
              {step.name ||
                "Untitled step"}
            </h3>
          </div>

          <div
            className={
              styles.stepControls
            }
          >
            <button
              type="button"
              onClick={() =>
                onMove(
                  step.local_id,
                  "up"
                )
              }
              disabled={index === 0}
              aria-label="Move step up"
            >
              ↑
            </button>

            <button
              type="button"
              onClick={() =>
                onMove(
                  step.local_id,
                  "down"
                )
              }
              disabled={
                index === totalSteps - 1
              }
              aria-label="Move step down"
            >
              ↓
            </button>

            <button
              type="button"
              className={
                styles.removeStepButton
              }
              onClick={() =>
                onRemove(
                  step.local_id
                )
              }
            >
              Remove
            </button>
          </div>
        </div>

        <div
          className={
            styles.stepFormGrid
          }
        >
          <label
            className={styles.field}
          >
            <span>Step name *</span>

            <input
              value={step.name}
              onChange={(event) =>
                onChange(
                  step.local_id,
                  "name",
                  event.target.value
                )
              }
              placeholder="Example: Manager approval"
              required
            />
          </label>

          <label
            className={styles.field}
          >
            <span>Step type</span>

            <select
              value={step.step_type}
              onChange={(event) =>
                onChange(
                  step.local_id,
                  "step_type",
                  event.target.value
                )
              }
            >
              {STEP_TYPES.map(
                (stepType) => (
                  <option
                    key={stepType}
                    value={stepType}
                  >
                    {stepType}
                  </option>
                )
              )}
            </select>
          </label>

          <label
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <span>Description</span>

            <textarea
              rows={3}
              value={
                step.description
              }
              onChange={(event) =>
                onChange(
                  step.local_id,
                  "description",
                  event.target.value
                )
              }
              placeholder="Describe what should happen during this step"
            />
          </label>

          {step.step_type ===
            "Approval" && (
            <>
              <label
                className={
                  styles.field
                }
              >
                <span>
                  Approver type
                </span>

                <select
                  value={
                    configuration.approver_type ||
                    "Manager"
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "approver_type",
                      event.target.value
                    )
                  }
                >
                  <option value="Manager">
                    Record owner’s manager
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
              </label>

              {configuration.approver_type ===
                "Employee" && (
                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Approver employee
                  </span>

                  <select
                    value={
                      configuration.employee_id ||
                      ""
                    }
                    onChange={(event) =>
                      updateConfiguration(
                        "employee_id",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select employee
                    </option>

                    {employees.map(
                      (employee) => (
                        <option
                          key={
                            employee.id
                          }
                          value={
                            employee.id
                          }
                        >
                          {
                            employee.full_name
                          }
                          {employee.job_title
                            ? ` — ${employee.job_title}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

              {configuration.approver_type ===
                "Department" && (
                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Department
                  </span>

                  <select
                    value={
                      configuration.department_id ||
                      ""
                    }
                    onChange={(event) =>
                      updateConfiguration(
                        "department_id",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select department
                    </option>

                    {departments.map(
                      (department) => (
                        <option
                          key={
                            department.id
                          }
                          value={
                            department.id
                          }
                        >
                          {
                            department.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

              {configuration.approver_type ===
                "Role" && (
                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Approver role
                  </span>

                  <select
                    value={
                      configuration.role_id ||
                      ""
                    }
                    onChange={(event) =>
                      updateConfiguration(
                        "role_id",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select role
                    </option>

                    {roles.map((role) => (
                      <option
                        key={role.id}
                        value={role.id}
                      >
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {step.step_type ===
            "Email" && (
            <>
              <label
                className={
                  styles.field
                }
              >
                <span>
                  Recipient
                </span>

                <select
                  value={
                    configuration.recipient ||
                    "Record Contact"
                  }
                  onChange={(event) =>
                    updateConfiguration(
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
                    Owner’s manager
                  </option>
                </select>
              </label>

              <label
                className={
                  styles.field
                }
              >
                <span>
                  Email subject
                </span>

                <input
                  value={
                    configuration.subject ||
                    ""
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "subject",
                      event.target.value
                    )
                  }
                  placeholder="Email subject"
                />
              </label>
            </>
          )}

          {step.step_type ===
            "Notification" && (
            <label
              className={
                styles.field
              }
            >
              <span>
                Notify
              </span>

              <select
                value={
                  configuration.recipient ||
                  "Record Owner"
                }
                onChange={(event) =>
                  updateConfiguration(
                    "recipient",
                    event.target.value
                  )
                }
              >
                <option value="Record Owner">
                  Record owner
                </option>

                <option value="Manager">
                  Owner’s manager
                </option>

                <option value="Approver">
                  Current approver
                </option>
              </select>
            </label>
          )}

          {step.step_type ===
            "Create Task" && (
            <>
              <label
                className={
                  styles.field
                }
              >
                <span>
                  Assign task to
                </span>

                <select
                  value={
                    configuration.assignee ||
                    "Record Owner"
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "assignee",
                      event.target.value
                    )
                  }
                >
                  <option value="Record Owner">
                    Record owner
                  </option>

                  <option value="Manager">
                    Owner’s manager
                  </option>

                  <option value="Specific Employee">
                    Specific employee
                  </option>
                </select>
              </label>

              <label
                className={
                  styles.field
                }
              >
                <span>
                  Due in days
                </span>

                <input
                  type="number"
                  min="0"
                  value={
                    configuration.due_days ||
                    1
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "due_days",
                      Number(
                        event.target.value
                      )
                    )
                  }
                />
              </label>
            </>
          )}

          {step.step_type ===
            "Wait" && (
            <label
              className={
                styles.field
              }
            >
              <span>
                Wait duration in hours
              </span>

              <input
                type="number"
                min="1"
                value={
                  configuration.hours ||
                  24
                }
                onChange={(event) =>
                  updateConfiguration(
                    "hours",
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </label>
          )}

          {step.step_type ===
            "Update Record" && (
            <>
              <label
                className={
                  styles.field
                }
              >
                <span>
                  Field name
                </span>

                <input
                  value={
                    configuration.field ||
                    ""
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "field",
                      event.target.value
                    )
                  }
                  placeholder="Example: status"
                />
              </label>

              <label
                className={
                  styles.field
                }
              >
                <span>
                  New value
                </span>

                <input
                  value={
                    configuration.value ||
                    ""
                  }
                  onChange={(event) =>
                    updateConfiguration(
                      "value",
                      event.target.value
                    )
                  }
                  placeholder="Example: Approved"
                />
              </label>
            </>
          )}

          <label
            className={
              styles.toggleOption
            }
          >
            <input
              type="checkbox"
              checked={
                step.is_required
              }
              onChange={(event) =>
                onChange(
                  step.local_id,
                  "is_required",
                  event.target.checked
                )
              }
            />

            <span>
              <strong>
                Required step
              </strong>

              <small>
                The workflow cannot continue
                until this step completes.
              </small>
            </span>
          </label>
        </div>
      </div>
    </article>
  );
}

function WorkflowCard({
  workflow,
  canManage,
  onEdit,
  onArchive,
  onStatusChange,
}) {
  const stepCount =
    workflow.step_count ||
    workflow.steps?.length ||
    0;

  return (
    <article
      className={
        styles.workflowCard
      }
    >
      <div
        className={
          styles.workflowCardHeader
        }
      >
        <span
          className={
            styles.workflowIcon
          }
        >
          ⌘
        </span>

        <StatusBadge
          status={
            workflow.status ||
            "Draft"
          }
        />
      </div>

      <div
        className={
          styles.workflowIdentity
        }
      >
        <span
          className={
            styles.workflowCode
          }
        >
          {workflow.code}
        </span>

        <h3>{workflow.name}</h3>

        <p>
          {workflow.description ||
            "No workflow description has been added."}
        </p>
      </div>

      <div
        className={
          styles.workflowTrigger
        }
      >
        <span>
          {workflow.module}
        </span>

        <strong>
          {formatTrigger(
            workflow.trigger_event
          )}
        </strong>
      </div>

      <div
        className={
          styles.workflowMetrics
        }
      >
        <Metric
          label="Steps"
          value={stepCount}
        />

        <Metric
          label="Approvals"
          value={
            workflow.approval_step_count ||
            0
          }
        />

        <Metric
          label="Version"
          value={
            workflow.version || 1
          }
        />
      </div>

      <div
        className={
          styles.stepPreview
        }
      >
        {(workflow.steps || [])
          .slice(0, 4)
          .map((step, index) => (
            <div
              key={step.id}
              className={
                styles.previewStep
              }
            >
              <span>{index + 1}</span>

              <div>
                <strong>
                  {step.name}
                </strong>

                <small>
                  {step.step_type}
                </small>
              </div>
            </div>
          ))}

        {stepCount === 0 && (
          <span
            className={
              styles.emptyValue
            }
          >
            No steps configured
          </span>
        )}
      </div>

      {canManage && (
        <div
          className={
            styles.cardActions
          }
        >
          <button
            type="button"
            className={
              styles.openButton
            }
            onClick={onEdit}
          >
            Edit workflow
          </button>

          {workflow.status ===
          "Active" ? (
            <button
              type="button"
              className={
                styles.statusButton
              }
              onClick={() =>
                onStatusChange(
                  "Inactive"
                )
              }
            >
              Deactivate
            </button>
          ) : workflow.status !==
            "Archived" ? (
            <button
              type="button"
              className={
                styles.activateButton
              }
              onClick={() =>
                onStatusChange(
                  "Active"
                )
              }
            >
              Activate
            </button>
          ) : null}

          {workflow.status !==
            "Archived" && (
            <button
              type="button"
              className={
                styles.archiveButton
              }
              onClick={onArchive}
            >
              Archive
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }) {
  const className =
    status === "Active"
      ? styles.statusGreen
      : status === "Draft"
        ? styles.statusBlue
        : status === "Inactive"
          ? styles.statusAmber
          : styles.statusNeutral;

  return (
    <span
      className={`${styles.statusBadge} ${className}`}
    >
      {status}
    </span>
  );
}

function Metric({
  label,
  value,
}) {
  return (
    <div
      className={styles.metric}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  textarea = false,
  rows = 4,
  required = false,
  fullWidth = false,
}) {
  return (
    <label
      className={`${styles.field} ${
        fullWidth
          ? styles.fieldFull
          : ""
      }`}
    >
      <span>
        {label}
        {required ? " *" : ""}
      </span>

      {textarea ? (
        <textarea
          name={name}
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
      ) : (
        <input
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  children,
}) {
  return (
    <label
      className={styles.field}
    >
      <span>{label}</span>

      <select
        name={name}
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
    </label>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone,
}) {
  return (
    <div
      className={`${styles.summaryCard} ${
        styles[
          `summary${capitalise(
            tone
          )}`
        ] || ""
      }`}
    >
      <span
        className={
          styles.summaryIcon
        }
      >
        {icon}
      </span>

      <span
        className={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EmptyState({
  hasWorkflows,
  canManage,
  onCreate,
}) {
  return (
    <div
      className={styles.emptyState}
    >
      <span
        className={
          styles.emptyIcon
        }
      >
        ⌘
      </span>

      <h3>
        {hasWorkflows
          ? "No matching workflows"
          : "No workflows created"}
      </h3>

      <p>
        {hasWorkflows
          ? "Try changing the search or filters."
          : "Create the first workflow to automate approvals, notifications, tasks and record updates."}
      </p>

      {canManage &&
        !hasWorkflows && (
          <button
            type="button"
            className={
              styles.primaryButton
            }
            onClick={onCreate}
          >
            Create workflow
          </button>
        )}
    </div>
  );
}

function LoadingState() {
  return (
    <section
      className={
        styles.loadingGrid
      }
    >
      {Array.from({
        length: 3,
      }).map((_, index) => (
        <div
          key={index}
          className={
            styles.loadingCard
          }
        />
      ))}
    </section>
  );
}

function buildStepConfiguration(
  step
) {
  return step.configuration || {};
}

function formatCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatTrigger(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function capitalise(value) {
  const text =
    String(value || "");

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}
