"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatusBadge from "../../../components/StatusBadge";

import styles from "./project-details.module.css";

// =========================================================
// CONSTANTS
// =========================================================

const PROJECT_STATUS_OPTIONS = [
  "Planning",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];

const TASK_STATUS_OPTIONS = [
  "To Do",
  "In Progress",
  "Completed",
  "Blocked",
  "Cancelled",
];

const TASK_PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const COMPLETED_TASK_STATUSES = [
  "completed",
  "complete",
  "done",
];

const EMPTY_ACCESS = {
  isOwner: false,
  canViewAll: false,
  canViewTeam: false,
  canViewOwn: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canAssign: false,
};

const EMPTY_EDIT_FORM = {
  project_name: "",
  description: "",
  amount: "",
  status: "Planning",
  start_date: "",
  due_date: "",
  owner_employee_id: "",
};

const EMPTY_TASK_FORM = {
  task_name: "",
  description: "",
  status: "To Do",
  priority: "Medium",
  due_date: "",
  assigned_employee_id: "",
};

// =========================================================
// PAGE
// =========================================================

export default function ProjectDetailsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const projectId =
    params?.id;

  const [
    project,
    setProject,
  ] = useState(null);

  const [
    customer,
    setCustomer,
  ] = useState(null);

  const [
    quote,
    setQuote,
  ] = useState(null);

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    invoices,
    setInvoices,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    taskEmployees,
    setTaskEmployees,
  ] = useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

  const [
    access,
    setAccess,
  ] = useState(
    EMPTY_ACCESS
  );

  const [
    taskAccess,
    setTaskAccess,
  ] = useState(
    EMPTY_ACCESS
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    showEditForm,
    setShowEditForm,
  ] = useState(false);

  const [
    editForm,
    setEditForm,
  ] = useState(
    EMPTY_EDIT_FORM
  );

  const [
    savingProject,
    setSavingProject,
  ] = useState(false);

  const [
    deletingProject,
    setDeletingProject,
  ] = useState(false);

  const [
    generatingInvoice,
    setGeneratingInvoice,
  ] = useState(false);

  const [
    showTaskForm,
    setShowTaskForm,
  ] = useState(false);

  const [
    taskForm,
    setTaskForm,
  ] = useState(
    EMPTY_TASK_FORM
  );

  const [
    savingTask,
    setSavingTask,
  ] = useState(false);

  const [
    editingTaskId,
    setEditingTaskId,
  ] = useState(null);

  const [
    taskEditForm,
    setTaskEditForm,
  ] = useState(
    EMPTY_TASK_FORM
  );

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    if (
      projectId
    ) {
      fetchProjectDetails();
    }
  }, [
    projectId,
  ]);

  async function fetchProjectDetails() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          `/api/projects/${encodeURIComponent(
            projectId
          )}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to load project."
        );
      }

      const nextProject =
        data.project ||
        null;

      setProject(
        nextProject
      );

      setCustomer(
        data.customer ||
          null
      );

      setQuote(
        data.quote ||
          null
      );

      setTasks(
        Array.isArray(
          data.tasks
        )
          ? [
              ...data.tasks,
            ].sort(
              sortTasks
            )
          : []
      );

      setInvoices(
        Array.isArray(
          data.invoices
        )
          ? data.invoices
          : []
      );

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setTaskEmployees(
        Array.isArray(
          data.taskEmployees
        )
          ? data.taskEmployees
          : []
      );

      setCurrentEmployee(
        data.currentEmployee ||
          null
      );

      setAccess(
        buildAccess(
          data.access
        )
      );

      setTaskAccess(
        buildAccess(
          data.taskAccess
        )
      );

      if (
        nextProject
      ) {
        populateEditForm(
          nextProject
        );
      }
    } catch (error) {
      console.error(
        "Project details loading error:",
        error
      );

      setProject(
        null
      );

      setErrorMessage(
        error.message ||
          "We could not load this project."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // =======================================================
  // PROJECT EDIT
  // =======================================================

  function populateEditForm(
    projectRecord
  ) {
    setEditForm({
      project_name:
        projectRecord
          ?.project_name ||
        "",

      description:
        projectRecord
          ?.description ||
        "",

      amount:
        projectRecord
          ?.amount ||
        "",

      status:
        projectRecord
          ?.status ||
        "Planning",

      start_date:
        normaliseDateInput(
          projectRecord
            ?.start_date
        ),

      due_date:
        normaliseDateInput(
          projectRecord
            ?.due_date
        ),

      owner_employee_id:
        projectRecord
          ?.owner_employee_id ||
        "",
    });
  }

  function handleEditChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setEditForm(
      (
        current
      ) => ({
        ...current,
        [name]:
          value,
      })
    );
  }

  function openEditForm() {
    if (
      !project ||
      !access.canEdit
    ) {
      return;
    }

    populateEditForm(
      project
    );

    setShowEditForm(
      true
    );
  }

  function closeEditForm() {
    if (
      project
    ) {
      populateEditForm(
        project
      );
    }

    setShowEditForm(
      false
    );
  }

  async function saveProject(
    event
  ) {
    event.preventDefault();

    if (
      !project ||
      !access.canEdit
    ) {
      return;
    }

    const projectName =
      editForm.project_name
        .trim();

    if (
      !projectName
    ) {
      alert(
        "Project name is required."
      );

      return;
    }

    try {
      setSavingProject(
        true
      );

      const payload = {
        project_name:
          projectName,

        description:
          editForm.description
            .trim(),

        amount:
          editForm.amount
            .trim(),

        status:
          editForm.status,

        start_date:
          editForm.start_date ||
          null,

        due_date:
          editForm.due_date ||
          null,
      };

      if (
        access.canAssign
      ) {
        payload.owner_employee_id =
          editForm.owner_employee_id ||
          null;
      }

      const response =
        await fetch(
          `/api/projects/${encodeURIComponent(
            project.id
          )}`,
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

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to update project."
        );
      }

      if (
        data.project
      ) {
        setProject(
          data.project
        );

        populateEditForm(
          data.project
        );
      } else {
        await fetchProjectDetails();
      }

      setShowEditForm(
        false
      );

      alert(
        data.message ||
          "Project updated successfully."
      );
    } catch (error) {
      alert(
        error.message ||
          "Error updating project."
      );
    } finally {
      setSavingProject(
        false
      );
    }
  }

  // =======================================================
  // TASK CREATE
  // =======================================================

  function openTaskForm() {
    if (
      !taskAccess.canCreate
    ) {
      return;
    }

    setTaskForm({
      ...EMPTY_TASK_FORM,

      assigned_employee_id:
        taskAccess.canAssign
          ? project
              ?.owner_employee_id ||
            currentEmployee
              ?.id ||
            ""
          : "",
    });

    setShowTaskForm(
      true
    );
  }

  function closeTaskForm() {
    setTaskForm(
      EMPTY_TASK_FORM
    );

    setShowTaskForm(
      false
    );
  }

  function handleTaskFormChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setTaskForm(
      (
        current
      ) => ({
        ...current,
        [name]:
          value,
      })
    );
  }

  async function createTask(
    event
  ) {
    event.preventDefault();

    if (
      !taskAccess.canCreate
    ) {
      return;
    }

    if (
      !taskForm.task_name
        .trim()
    ) {
      alert(
        "Task name is required."
      );

      return;
    }

    try {
      setSavingTask(
        true
      );

      const payload = {
        project_id:
          project.id,

        task_name:
          taskForm.task_name
            .trim(),

        description:
          taskForm.description
            .trim(),

        status:
          taskForm.status,

        priority:
          taskForm.priority,

        due_date:
          taskForm.due_date ||
          null,
      };

      if (
        taskAccess.canAssign &&
        taskForm
          .assigned_employee_id
      ) {
        payload.assigned_employee_id =
          taskForm.assigned_employee_id;
      }

      const response =
        await fetch(
          "/api/tasks",
          {
            method:
              "POST",

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

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to create task."
        );
      }

      closeTaskForm();

      await fetchProjectDetails();

      alert(
        data.message ||
          "Task created successfully."
      );
    } catch (error) {
      alert(
        error.message ||
          "Unable to create task."
      );
    } finally {
      setSavingTask(
        false
      );
    }
  }

  // =======================================================
  // DEFAULT TASKS
  // =======================================================

  async function generateDefaultTasks() {
    if (
      !taskAccess.canCreate
    ) {
      return;
    }

    /*
     * Prevent accidental duplicate template generation.
     * Manual tasks can still be added using "+ Add task".
     */
    if (
      tasks.length >
      0
    ) {
      const confirmed =
        window.confirm(
          "This project already has tasks. Generate another set of default tasks?"
        );

      if (
        !confirmed
      ) {
        return;
      }
    }

    const defaults = [
      {
        task_name:
          "Kick-off meeting",

        description:
          "Confirm project scope, delivery expectations and stakeholders.",

        priority:
          "High",
      },
      {
        task_name:
          "Confirm delivery plan",

        description:
          "Agree milestones, delivery dates and responsibilities.",

        priority:
          "High",
      },
      {
        task_name:
          "Complete implementation",

        description:
          "Deliver the agreed project scope.",

        priority:
          "Medium",
      },
      {
        task_name:
          "Customer review",

        description:
          "Complete customer review and resolve outstanding items.",

        priority:
          "Medium",
      },
      {
        task_name:
          "Project handover",

        description:
          "Complete final handover and confirm closure.",

        priority:
          "Medium",
      },
    ];

    try {
      setSavingTask(
        true
      );

      for (
        const item of defaults
      ) {
        const response =
          await fetch(
            "/api/tasks",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  project_id:
                    project.id,

                  ...item,

                  status:
                    "To Do",

                  due_date:
                    null,
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              "Failed to generate default tasks."
          );
        }
      }

      await fetchProjectDetails();

      alert(
        "Default project tasks created successfully."
      );
    } catch (error) {
      alert(
        error.message ||
          "Unable to generate default tasks."
      );
    } finally {
      setSavingTask(
        false
      );
    }
  }

  // =======================================================
  // TASK EDIT
  // =======================================================

  function startTaskEdit(
    task
  ) {
    if (
      !taskAccess.canEdit &&
      !taskAccess.canAssign
    ) {
      return;
    }

    setEditingTaskId(
      task.id
    );

    setTaskEditForm({
      task_name:
        task.task_name ||
        "",

      description:
        task.description ||
        "",

      status:
        task.status ||
        "To Do",

      priority:
        task.priority ||
        "Medium",

      due_date:
        normaliseDateInput(
          task.due_date
        ),

      assigned_employee_id:
        task.assigned_employee_id ||
        "",
    });
  }

  function cancelTaskEdit() {
    setEditingTaskId(
      null
    );

    setTaskEditForm(
      EMPTY_TASK_FORM
    );
  }

  function handleTaskEditChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setTaskEditForm(
      (
        current
      ) => ({
        ...current,
        [name]:
          value,
      })
    );
  }

  async function saveTask(
    taskId
  ) {
    const payload = {};

    if (
      taskAccess.canEdit
    ) {
      payload.task_name =
        taskEditForm.task_name
          .trim();

      payload.description =
        taskEditForm.description
          .trim();

      payload.status =
        taskEditForm.status;

      payload.priority =
        taskEditForm.priority;

      payload.due_date =
        taskEditForm.due_date ||
        null;
    }

    if (
      taskAccess.canAssign
    ) {
      payload.assigned_employee_id =
        taskEditForm.assigned_employee_id ||
        "";
    }

    try {
      setSavingTask(
        true
      );

      const response =
        await fetch(
          `/api/tasks/${taskId}`,
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

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to update task."
        );
      }

      cancelTaskEdit();

      await fetchProjectDetails();
    } catch (error) {
      alert(
        error.message ||
          "Unable to update task."
      );
    } finally {
      setSavingTask(
        false
      );
    }
  }

  async function quickTaskStatus(
    taskId,
    status
  ) {
    if (
      !taskAccess.canEdit
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/tasks/${taskId}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                status,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to update task."
        );
      }

      await fetchProjectDetails();
    } catch (error) {
      alert(
        error.message ||
          "Unable to update task."
      );
    }
  }

  async function deleteTask(
    task
  ) {
    if (
      !taskAccess.canDelete
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${task.task_name}"?`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/tasks/${task.id}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to delete task."
        );
      }

      await fetchProjectDetails();
    } catch (error) {
      alert(
        error.message ||
          "Unable to delete task."
      );
    }
  }

  // =======================================================
  // DELETE PROJECT
  // =======================================================

  async function deleteProject() {
    if (
      !project ||
      !access.canDelete
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this project? Projects with linked tasks or invoices cannot be deleted."
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeletingProject(
        true
      );

      const response =
        await fetch(
          `/api/projects/${project.id}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to delete project."
        );
      }

      router.push(
        "/projects"
      );

      router.refresh();
    } catch (error) {
      alert(
        error.message ||
          "Unable to delete project."
      );
    } finally {
      setDeletingProject(
        false
      );
    }
  }

  // =======================================================
  // GENERATE INVOICE
  // =======================================================

  async function generateInvoice() {
    if (
      !project ||
      generatingInvoice
    ) {
      return;
    }

    try {
      setGeneratingInvoice(
        true
      );

      const response =
        await fetch(
          "/api/invoices",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                project_id:
                  project.id,

                customer_id:
                  project.customer_id ||
                  null,

                quote_id:
                  project.quote_id ||
                  null,

                client:
                  customer?.company ||
                  customer?.customer_name ||
                  project.project_name,

                service:
                  quote?.service ||
                  project.description ||
                  "Project Service",

                subtotal:
                  project.amount ||
                  "0",

                vat_rate:
                  "0",

                due_date:
                  null,

                status:
                  "Draft Invoice",
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to create invoice."
        );
      }

      if (
        data.invoice?.id
      ) {
        router.push(
          `/invoices/${data.invoice.id}`
        );
      } else {
        await fetchProjectDetails();

        alert(
          data.message ||
            "Invoice generated successfully."
        );
      }
    } catch (error) {
      alert(
        error.message ||
          "Unable to generate invoice."
      );
    } finally {
      setGeneratingInvoice(
        false
      );
    }
  }

  // =======================================================
  // METRICS
  // =======================================================

  const metrics =
    useMemo(
      () => {
        const total =
          tasks.length;

        const completed =
          tasks.filter(
            (
              task
            ) =>
              COMPLETED_TASK_STATUSES.includes(
                normaliseStatus(
                  task.status
                )
              )
          ).length;

        const blocked =
          tasks.filter(
            (
              task
            ) =>
              normaliseStatus(
                task.status
              ) ===
              "blocked"
          ).length;

        const overdue =
          tasks.filter(
            isTaskOverdue
          ).length;

        const progress =
          total ===
          0
            ? 0
            : Math.round(
                (
                  completed /
                  total
                ) *
                  100
              );

        return {
          total,
          completed,
          blocked,
          overdue,
          progress,
        };
      },
      [
        tasks,
      ]
    );

  // =======================================================
  // STATES
  // =======================================================

  if (
    loading
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Project Workspace"
          description="Loading project information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    errorMessage
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Project Workspace"
          description="Manage project delivery and tasks."
        >
          <section
            className={
              styles.errorPanel
            }
          >
            <div>
              <strong>
                Unable to load project
              </strong>

              <p>
                {errorMessage}
              </p>
            </div>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={
                fetchProjectDetails
              }
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    !project
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Project Workspace"
          description="Manage project delivery and tasks."
        >
          <section
            className={
              styles.notFound
            }
          >
            <span
              className={
                styles.notFoundIcon
              }
            >
              ▰
            </span>

            <h2>
              Project not found
            </h2>

            <p>
              The project may have been removed or you may not have access to it.
            </p>

            <Link
              href="/projects"
              className={
                styles.primaryButton
              }
            >
              Return to projects
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // CLEAN DISPLAY HIERARCHY
  // =======================================================

  const customerName =
    customer?.company ||
    customer?.customer_name ||
    "Customer";

  const serviceName =
    quote?.service ||
    project.description ||
    project.project_name ||
    "Project delivery";

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Project Workspace"
        description="Manage delivery, tasks and invoicing."
      >
        <div
          className={
            styles.page
          }
        >
          {/* =================================================
              PAGE HEADER
          ================================================= */}

          <section
            className={
              styles.pageHeader
            }
          >
            <div
              className={
                styles.headerCopy
              }
            >
              <Link
                href="/projects"
                className={
                  styles.backLink
                }
              >
                ← Back to projects
              </Link>

              <span
                className={
                  styles.eyebrow
                }
              >
                Delivery workspace
              </span>

              <h2>
                {customerName}
              </h2>

              <p>
                {serviceName}
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              {taskAccess.canCreate && (
                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  onClick={
                    showTaskForm
                      ? closeTaskForm
                      : openTaskForm
                  }
                >
                  {showTaskForm
                    ? "Close task form"
                    : "+ Add task"}
                </button>
              )}

              {taskAccess.canCreate && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={
                    savingTask
                  }
                  onClick={
                    generateDefaultTasks
                  }
                >
                  {savingTask
                    ? "Generating..."
                    : "Generate default tasks"}
                </button>
              )}

              {access.canEdit && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    showEditForm
                      ? closeEditForm
                      : openEditForm
                  }
                >
                  {showEditForm
                    ? "Close edit"
                    : "Edit project"}
                </button>
              )}

              {normaliseStatus(
                project.status
              ) ===
                "completed" && (
                <button
                  type="button"
                  className={
                    styles.successButton
                  }
                  disabled={
                    generatingInvoice
                  }
                  onClick={
                    generateInvoice
                  }
                >
                  {generatingInvoice
                    ? "Generating..."
                    : "Generate invoice"}
                </button>
              )}

              {access.canDelete && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={
                    deletingProject
                  }
                  onClick={
                    deleteProject
                  }
                >
                  {deletingProject
                    ? "Deleting..."
                    : "Delete project"}
                </button>
              )}
            </div>
          </section>

          {/* =================================================
              ADD TASK
          ================================================= */}

          {showTaskForm &&
            taskAccess.canCreate && (
              <section
                className={
                  styles.taskFormPanel
                }
              >
                <div
                  className={
                    styles.taskFormHeader
                  }
                >
                  <h3>
                    Add task
                  </h3>

                  <p>
                    Create a delivery task for this project.
                  </p>
                </div>

                <form
                  className={
                    styles.taskForm
                  }
                  onSubmit={
                    createTask
                  }
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <TaskField
                      label="Task name"
                      name="task_name"
                      value={
                        taskForm.task_name
                      }
                      onChange={
                        handleTaskFormChange
                      }
                    />

                    <TaskField
                      label="Due date"
                      name="due_date"
                      type="date"
                      value={
                        taskForm.due_date
                      }
                      onChange={
                        handleTaskFormChange
                      }
                    />

                    <TaskSelect
                      label="Status"
                      name="status"
                      value={
                        taskForm.status
                      }
                      onChange={
                        handleTaskFormChange
                      }
                      options={
                        TASK_STATUS_OPTIONS
                      }
                    />

                    <TaskSelect
                      label="Priority"
                      name="priority"
                      value={
                        taskForm.priority
                      }
                      onChange={
                        handleTaskFormChange
                      }
                      options={
                        TASK_PRIORITY_OPTIONS
                      }
                    />

                    {taskAccess.canAssign && (
                      <div
                        className={
                          styles.field
                        }
                      >
                        <label
                          htmlFor="task-assigned-employee"
                        >
                          Assigned employee
                        </label>

                        <select
                          id="task-assigned-employee"
                          name="assigned_employee_id"
                          value={
                            taskForm.assigned_employee_id
                          }
                          onChange={
                            handleTaskFormChange
                          }
                        >
                          <option value="">
                            Default project owner
                          </option>

                          {taskEmployees.map(
                            (
                              employee
                            ) => (
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
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}

                    <div
                      className={`${styles.field} ${styles.fieldFull}`}
                    >
                      <label
                        htmlFor="task-description"
                      >
                        Description
                      </label>

                      <textarea
                        id="task-description"
                        name="description"
                        rows={4}
                        value={
                          taskForm.description
                        }
                        onChange={
                          handleTaskFormChange
                        }
                      />
                    </div>
                  </div>

                  <div
                    className={
                      styles.formActions
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.secondaryButton
                      }
                      onClick={
                        closeTaskForm
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className={
                        styles.primaryButton
                      }
                      disabled={
                        savingTask
                      }
                    >
                      {savingTask
                        ? "Saving..."
                        : "Save task"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* =================================================
              EDIT PROJECT
          ================================================= */}

          {showEditForm &&
            access.canEdit && (
              <section
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <h3>
                      Edit project
                    </h3>

                    <p>
                      Update delivery information, dates, status and ownership.
                    </p>
                  </div>
                </div>

                <form
                  className={
                    styles.taskForm
                  }
                  onSubmit={
                    saveProject
                  }
                  style={{
                    marginTop:
                      "18px",
                  }}
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <TaskField
                      label="Project name"
                      name="project_name"
                      value={
                        editForm.project_name
                      }
                      onChange={
                        handleEditChange
                      }
                    />

                    <TaskField
                      label="Amount"
                      name="amount"
                      value={
                        editForm.amount
                      }
                      onChange={
                        handleEditChange
                      }
                    />

                    <TaskField
                      label="Start date"
                      name="start_date"
                      type="date"
                      value={
                        editForm.start_date
                      }
                      onChange={
                        handleEditChange
                      }
                    />

                    <TaskField
                      label="Due date"
                      name="due_date"
                      type="date"
                      value={
                        editForm.due_date
                      }
                      onChange={
                        handleEditChange
                      }
                    />

                    <TaskSelect
                      label="Status"
                      name="status"
                      value={
                        editForm.status
                      }
                      onChange={
                        handleEditChange
                      }
                      options={
                        PROJECT_STATUS_OPTIONS
                      }
                    />

                    {access.canAssign && (
                      <div
                        className={
                          styles.field
                        }
                      >
                        <label
                          htmlFor="project-owner"
                        >
                          Project owner
                        </label>

                        <select
                          id="project-owner"
                          name="owner_employee_id"
                          value={
                            editForm.owner_employee_id
                          }
                          onChange={
                            handleEditChange
                          }
                        >
                          <option value="">
                            Unassigned
                          </option>

                          {employees.map(
                            (
                              employee
                            ) => (
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
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}

                    <div
                      className={`${styles.field} ${styles.fieldFull}`}
                    >
                      <label
                        htmlFor="project-description"
                      >
                        Description
                      </label>

                      <textarea
                        id="project-description"
                        name="description"
                        rows={5}
                        value={
                          editForm.description
                        }
                        onChange={
                          handleEditChange
                        }
                      />
                    </div>
                  </div>

                  <div
                    className={
                      styles.formActions
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.secondaryButton
                      }
                      onClick={
                        closeEditForm
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className={
                        styles.primaryButton
                      }
                      disabled={
                        savingProject
                      }
                    >
                      {savingProject
                        ? "Saving..."
                        : "Save project"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* =================================================
              PROJECT HERO
          ================================================= */}

          <section
            className={
              styles.heroCard
            }
          >
            <div
              className={
                styles.projectIdentity
              }
            >
              <span
                className={
                  styles.projectIcon
                }
              >
                ▰
              </span>

              <div
                className={
                  styles.identityCopy
                }
              >
                <span
                  className={
                    styles.identityLabel
                  }
                >
                  Project delivery
                </span>

                <h3>
                  {serviceName}
                </h3>

                <p>
                  {customerName}
                </p>

                <div
                  className={
                    styles.identityMeta
                  }
                >
                  <StatusBadge
                    status={
                      project.status ||
                      "Planning"
                    }
                  />

                  <span
                    className={
                      styles.metaBadge
                    }
                  >
                    Owner:{" "}
                    {project.owner
                      ?.full_name ||
                      "Unassigned"}
                  </span>

                  <span
                    className={
                      styles.metaBadge
                    }
                  >
                    {formatProjectAmount(
                      project.amount
                    )}
                  </span>

                  {project.quote_id && (
                    <span
                      className={
                        styles.linkedBadge
                      }
                    >
                      Linked quote
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              className={
                styles.heroMetrics
              }
            >
              <HeroMetric
                label="Progress"
                value={`${metrics.progress}%`}
              />

              <HeroMetric
                label="Tasks"
                value={
                  metrics.total
                }
              />

              <HeroMetric
                label="Overdue"
                value={
                  metrics.overdue
                }
                warning={
                  metrics.overdue >
                  0
                }
              />
            </div>
          </section>

          {/* =================================================
              PROJECT TASKS
          ================================================= */}

          <section
            className={
              styles.taskPanel
            }
          >
            <div
              className={
                styles.taskPanelHeader
              }
            >
              <div>
                <h3>
                  Project tasks
                </h3>

                <p>
                  Only tasks within your Task access are shown.
                </p>
              </div>

              <span
                className={
                  styles.taskCount
                }
              >
                {tasks.length} task
                {tasks.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>

            {tasks.length ===
            0 ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <span
                  className={
                    styles.emptyIcon
                  }
                >
                  ✓
                </span>

                <h3>
                  No visible tasks
                </h3>

                <p>
                  There are no tasks available within your current Task permissions.
                  You can add a task or generate the default delivery template.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.taskTableWrapper
                }
              >
                <table
                  className={
                    styles.taskTable
                  }
                >
                  <thead>
                    <tr>
                      <th>
                        Task
                      </th>

                      <th>
                        Assignee
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Priority
                      </th>

                      <th>
                        Due
                      </th>

                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {tasks.map(
                      (
                        task
                      ) => {
                        const editing =
                          editingTaskId ===
                          task.id;

                        const overdue =
                          isTaskOverdue(
                            task
                          );

                        return (
                          <tr
                            key={
                              task.id
                            }
                            className={
                              editing
                                ? styles.editRow
                                : ""
                            }
                          >
                            <td>
                              <div
                                className={
                                  styles.taskIdentity
                                }
                              >
                                <span
                                  className={
                                    styles.taskIcon
                                  }
                                >
                                  ✓
                                </span>

                                <div
                                  className={
                                    styles.taskIdentityCopy
                                  }
                                >
                                  {editing &&
                                  taskAccess.canEdit ? (
                                    <>
                                      <input
                                        name="task_name"
                                        value={
                                          taskEditForm.task_name
                                        }
                                        onChange={
                                          handleTaskEditChange
                                        }
                                        style={
                                          inputStyle
                                        }
                                      />

                                      <textarea
                                        name="description"
                                        rows={3}
                                        value={
                                          taskEditForm.description
                                        }
                                        onChange={
                                          handleTaskEditChange
                                        }
                                        style={{
                                          ...textareaStyle,
                                          marginTop:
                                            "8px",
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <strong>
                                        {
                                          task.task_name
                                        }
                                      </strong>

                                      <small>
                                        {task.description ||
                                          "No task description"}
                                      </small>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td>
                              {editing &&
                              taskAccess.canAssign ? (
                                <select
                                  name="assigned_employee_id"
                                  value={
                                    taskEditForm.assigned_employee_id
                                  }
                                  onChange={
                                    handleTaskEditChange
                                  }
                                  className={
                                    styles.statusSelect
                                  }
                                >
                                  <option value="">
                                    Unassigned
                                  </option>

                                  {taskEmployees.map(
                                    (
                                      employee
                                    ) => (
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
                                      </option>
                                    )
                                  )}
                                </select>
                              ) : (
                                task.assigned_employee
                                  ?.full_name ||
                                "Unassigned"
                              )}
                            </td>

                            <td>
                              {editing &&
                              taskAccess.canEdit ? (
                                <select
                                  name="status"
                                  value={
                                    taskEditForm.status
                                  }
                                  onChange={
                                    handleTaskEditChange
                                  }
                                  className={
                                    styles.statusSelect
                                  }
                                >
                                  {TASK_STATUS_OPTIONS.map(
                                    (
                                      status
                                    ) => (
                                      <option
                                        key={
                                          status
                                        }
                                        value={
                                          status
                                        }
                                      >
                                        {
                                          status
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              ) : (
                                <StatusBadge
                                  status={
                                    task.status ||
                                    "To Do"
                                  }
                                />
                              )}
                            </td>

                            <td>
                              {editing &&
                              taskAccess.canEdit ? (
                                <select
                                  name="priority"
                                  value={
                                    taskEditForm.priority
                                  }
                                  onChange={
                                    handleTaskEditChange
                                  }
                                  className={
                                    styles.statusSelect
                                  }
                                >
                                  {TASK_PRIORITY_OPTIONS.map(
                                    (
                                      priority
                                    ) => (
                                      <option
                                        key={
                                          priority
                                        }
                                        value={
                                          priority
                                        }
                                      >
                                        {
                                          priority
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              ) : (
                                task.priority ||
                                "Medium"
                              )}
                            </td>

                            <td>
                              {editing &&
                              taskAccess.canEdit ? (
                                <input
                                  type="date"
                                  name="due_date"
                                  value={
                                    taskEditForm.due_date
                                  }
                                  onChange={
                                    handleTaskEditChange
                                  }
                                  style={
                                    inputStyle
                                  }
                                />
                              ) : (
                                <>
                                  <span
                                    className={`${styles.taskDate} ${
                                      overdue
                                        ? styles.taskDateOverdue
                                        : ""
                                    }`}
                                  >
                                    {formatDate(
                                      task.due_date
                                    )}
                                  </span>

                                  {overdue && (
                                    <span
                                      className={
                                        styles.overdueLabel
                                      }
                                    >
                                      Overdue
                                    </span>
                                  )}
                                </>
                              )}
                            </td>

                            <td>
                              <div
                                className={
                                  styles.taskActions
                                }
                              >
                                {editing ? (
                                  <>
                                    <button
                                      type="button"
                                      className={
                                        styles.primaryButton
                                      }
                                      disabled={
                                        savingTask
                                      }
                                      onClick={() =>
                                        saveTask(
                                          task.id
                                        )
                                      }
                                    >
                                      Save
                                    </button>

                                    <button
                                      type="button"
                                      className={
                                        styles.secondaryButton
                                      }
                                      onClick={
                                        cancelTaskEdit
                                      }
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {(taskAccess.canEdit ||
                                      taskAccess.canAssign) && (
                                      <button
                                        type="button"
                                        className={
                                          styles.smallButton
                                        }
                                        onClick={() =>
                                          startTaskEdit(
                                            task
                                          )
                                        }
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {taskAccess.canEdit &&
                                      !COMPLETED_TASK_STATUSES.includes(
                                        normaliseStatus(
                                          task.status
                                        )
                                      ) && (
                                        <button
                                          type="button"
                                          className={
                                            styles.successButton
                                          }
                                          onClick={() =>
                                            quickTaskStatus(
                                              task.id,
                                              "Completed"
                                            )
                                          }
                                        >
                                          Complete
                                        </button>
                                      )}

                                    {taskAccess.canDelete && (
                                      <button
                                        type="button"
                                        className={
                                          styles.dangerButton
                                        }
                                        onClick={() =>
                                          deleteTask(
                                            task
                                          )
                                        }
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* =================================================
              INFORMATION + PROGRESS
          ================================================= */}

          <section
            className={
              styles.workspaceGrid
            }
          >
            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <h3>
                    Project information
                  </h3>

                  <p>
                    Delivery ownership, customer and commercial information.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.detailList
                }
              >
                <DetailRow
                  label="Owner"
                  value={
                    project.owner
                      ?.full_name ||
                    "Unassigned"
                  }
                />

                <DetailRow
                  label="Customer"
                  value={
                    customerName
                  }
                />

                <DetailRow
                  label="Project value"
                  value={
                    formatProjectAmount(
                      project.amount
                    )
                  }
                />

                <DetailRow
                  label="Start date"
                  value={
                    formatDate(
                      project.start_date
                    )
                  }
                />

                <DetailRow
                  label="Due date"
                  value={
                    formatDate(
                      project.due_date
                    )
                  }
                />

                <DetailRow
                  label="Status"
                  customValue={
                    <StatusBadge
                      status={
                        project.status ||
                        "Planning"
                      }
                    />
                  }
                />

                {quote?.quote_number && (
                  <DetailRow
                    label="Source quote"
                    customValue={
                      <Link
                        href={`/quotes/${quote.id}`}
                      >
                        {quote.quote_number} →
                      </Link>
                    }
                  />
                )}
              </div>
            </section>

            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <h3>
                    Delivery progress
                  </h3>

                  <p>
                    Current task completion and delivery health.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.progressOverview
                }
              >
                <div
                  className={
                    styles.progressHeader
                  }
                >
                  <strong>
                    {metrics.progress}%
                  </strong>

                  <span>
                    {metrics.completed} of {metrics.total} tasks completed
                  </span>
                </div>

                <div
                  className={
                    styles.progressTrack
                  }
                >
                  <div
                    className={
                      styles.progressFill
                    }
                    style={{
                      width:
                        `${metrics.progress}%`,
                    }}
                  />
                </div>

                <div
                  className={
                    styles.progressMetrics
                  }
                >
                  <ProgressMetric
                    label="Tasks"
                    value={
                      metrics.total
                    }
                  />

                  <ProgressMetric
                    label="Completed"
                    value={
                      metrics.completed
                    }
                  />

                  <ProgressMetric
                    label="Blocked"
                    value={
                      metrics.blocked
                    }
                    warning={
                      metrics.blocked >
                      0
                    }
                  />

                  <ProgressMetric
                    label="Overdue"
                    value={
                      metrics.overdue
                    }
                    danger={
                      metrics.overdue >
                      0
                    }
                  />
                </div>
              </div>
            </section>
          </section>

          {/* =================================================
              LINKED INVOICES
          ================================================= */}

          <section
            className={
              styles.panel
            }
          >
            <div
              className={
                styles.panelHeader
              }
            >
              <div>
                <h3>
                  Linked invoices
                </h3>

                <p>
                  Finance records generated from this project.
                </p>
              </div>
            </div>

            {invoices.length ===
            0 ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <span
                  className={
                    styles.emptyIcon
                  }
                >
                  £
                </span>

                <h3>
                  No linked invoices
                </h3>

                <p>
                  When the project is completed, use Generate invoice to create the customer invoice.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.taskTableWrapper
                }
              >
                <table
                  className={
                    styles.taskTable
                  }
                >
                  <thead>
                    <tr>
                      <th>
                        Invoice
                      </th>

                      <th>
                        Amount
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Due date
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoices.map(
                      (
                        invoice
                      ) => (
                        <tr
                          key={
                            invoice.id
                          }
                        >
                          <td>
                            <Link
                              href={`/invoices/${invoice.id}`}
                            >
                              {invoice.invoice_number ||
                                "Invoice"}{" "}
                              →
                            </Link>
                          </td>

                          <td>
                            {formatProjectAmount(
                              invoice.total_amount ||
                                invoice.amount ||
                                invoice.subtotal
                            )}
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                invoice.status ||
                                "Draft Invoice"
                              }
                            />
                          </td>

                          <td>
                            {formatDate(
                              invoice.due_date
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function TaskField({
  label,
  name,
  value,
  onChange,
  type = "text",
}) {
  return (
    <div
      className={
        styles.field
      }
    >
      <label
        htmlFor={
          name
        }
      >
        {label}
      </label>

      <input
        id={
          name
        }
        name={
          name
        }
        type={
          type
        }
        value={
          value ||
          ""
        }
        onChange={
          onChange
        }
      />
    </div>
  );
}

function TaskSelect({
  label,
  name,
  value,
  onChange,
  options,
}) {
  return (
    <div
      className={
        styles.field
      }
    >
      <label
        htmlFor={
          name
        }
      >
        {label}
      </label>

      <select
        id={
          name
        }
        name={
          name
        }
        value={
          value ||
          ""
        }
        onChange={
          onChange
        }
      >
        {options.map(
          (
            option
          ) => (
            <option
              key={
                option
              }
              value={
                option
              }
            >
              {option}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function DetailRow({
  label,
  value,
  customValue,
}) {
  return (
    <div
      className={
        styles.detailRow
      }
    >
      <span>
        {label}
      </span>

      {customValue || (
        <strong
          className={
            value &&
            value !==
              "Not set" &&
            value !==
              "Not linked" &&
            value !==
              "Unassigned"
              ? ""
              : styles.emptyValue
          }
        >
          {value ||
            "Not set"}
        </strong>
      )}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  warning = false,
}) {
  return (
    <div
      className={`${styles.heroMetric} ${
        warning
          ? styles.heroMetricWarning
          : ""
      }`}
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

function ProgressMetric({
  label,
  value,
  warning = false,
  danger = false,
}) {
  return (
    <div
      className={`${styles.progressMetric} ${
        warning
          ? styles.progressMetricWarning
          : ""
      } ${
        danger
          ? styles.progressMetricDanger
          : ""
      }`}
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

function LoadingState() {
  return (
    <section
      className={
        styles.loadingPanel
      }
    >
      {Array.from({
        length:
          6,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={
              index
            }
            className={
              styles.loadingRow
            }
          />
        )
      )}
    </section>
  );
}

// =========================================================
// HELPERS
// =========================================================

function buildAccess(
  source
) {
  return {
    isOwner:
      Boolean(
        source?.isOwner
      ),

    canViewAll:
      Boolean(
        source?.canViewAll
      ),

    canViewTeam:
      Boolean(
        source?.canViewTeam
      ),

    canViewOwn:
      Boolean(
        source?.canViewOwn
      ),

    canCreate:
      Boolean(
        source?.canCreate
      ),

    canEdit:
      Boolean(
        source?.canEdit
      ),

    canDelete:
      Boolean(
        source?.canDelete
      ),

    canAssign:
      Boolean(
        source?.canAssign
      ),
  };
}

function normaliseStatus(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function normaliseDateInput(
  value
) {
  if (
    !value
  ) {
    return "";
  }

  const text =
    String(
      value
    );

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    return text;
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "Not set";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not set";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  );
}

function isTaskOverdue(
  task
) {
  if (
    !task?.due_date
  ) {
    return false;
  }

  if (
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        task.status
      )
    ) ||
    normaliseStatus(
      task.status
    ) ===
      "cancelled"
  ) {
    return false;
  }

  const due =
    new Date(
      task.due_date
    );

  if (
    Number.isNaN(
      due.getTime()
    )
  ) {
    return false;
  }

  due.setHours(
    23,
    59,
    59,
    999
  );

  return due.getTime() <
    Date.now();
}

function sortTasks(
  a,
  b
) {
  const aCompleted =
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        a.status
      )
    );

  const bCompleted =
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        b.status
      )
    );

  if (
    aCompleted !==
    bCompleted
  ) {
    return aCompleted
      ? 1
      : -1;
  }

  const aDue =
    a.due_date
      ? new Date(
          a.due_date
        ).getTime()
      : Number.MAX_SAFE_INTEGER;

  const bDue =
    b.due_date
      ? new Date(
          b.due_date
        ).getTime()
      : Number.MAX_SAFE_INTEGER;

  if (
    aDue !==
    bDue
  ) {
    return aDue -
      bDue;
  }

  return String(
    a.task_name ||
      ""
  ).localeCompare(
    String(
      b.task_name ||
        ""
    )
  );
}

function getMoneyValue(
  value
) {
  const parsed =
    Number.parseFloat(
      String(
        value ||
          ""
      )
        .replace(
          /,/g,
          ""
        )
        .replace(
          /[^0-9.-]/g,
          ""
        )
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function formatProjectAmount(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return "Not set";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      maximumFractionDigits:
        0,
    }
  ).format(
    getMoneyValue(
      value
    )
  );
}

// =========================================================
// INLINE FALLBACK STYLES FOR TASK EDIT CONTROLS
// =========================================================

const inputStyle = {
  width:
    "100%",

  minHeight:
    "40px",

  padding:
    "8px 10px",

  border:
    "1px solid #d8dee8",

  borderRadius:
    "8px",

  background:
    "#ffffff",

  fontFamily:
    "inherit",

  fontSize:
    "13px",
};

const textareaStyle = {
  ...inputStyle,

  minHeight:
    "90px",

  resize:
    "vertical",
};
