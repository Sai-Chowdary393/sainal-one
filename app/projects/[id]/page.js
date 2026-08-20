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

      setAccess({
        isOwner:
          Boolean(
            data.access
              ?.isOwner
          ),

        canViewAll:
          Boolean(
            data.access
              ?.canViewAll
          ),

        canViewTeam:
          Boolean(
            data.access
              ?.canViewTeam
          ),

        canViewOwn:
          Boolean(
            data.access
              ?.canViewOwn
          ),

        canCreate:
          Boolean(
            data.access
              ?.canCreate
          ),

        canEdit:
          Boolean(
            data.access
              ?.canEdit
          ),

        canDelete:
          Boolean(
            data.access
              ?.canDelete
          ),

        canAssign:
          Boolean(
            data.access
              ?.canAssign
          ),
      });

      setTaskAccess({
        isOwner:
          Boolean(
            data.taskAccess
              ?.isOwner
          ),

        canViewAll:
          Boolean(
            data.taskAccess
              ?.canViewAll
          ),

        canViewTeam:
          Boolean(
            data.taskAccess
              ?.canViewTeam
          ),

        canViewOwn:
          Boolean(
            data.taskAccess
              ?.canViewOwn
          ),

        canCreate:
          Boolean(
            data.taskAccess
              ?.canCreate
          ),

        canEdit:
          Boolean(
            data.taskAccess
              ?.canEdit
          ),

        canDelete:
          Boolean(
            data.taskAccess
              ?.canDelete
          ),

        canAssign:
          Boolean(
            data.taskAccess
              ?.canAssign
          ),
      });

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
          ? project.owner_employee_id ||
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

    if (!confirmed) {
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
            <h2>
              Project not found
            </h2>

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
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          project.project_name ||
          "Project Workspace"
        }
        description="Manage delivery, ownership, project tasks and invoicing."
      >
        <div
          className={
            styles.page
          }
        >
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
                {
                  project.project_name
                }
              </h2>

              <p>
                {project.description ||
                  "Manage project delivery and tasks."}
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
                  Generate default tasks
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
                  Delete project
                </button>
              )}
            </div>
          </section>

          {showTaskForm &&
            taskAccess.canCreate && (
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
                      Add task
                    </h3>

                    <p>
                      Create a delivery task for this project.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={
                    createTask
                  }
                >
                  <div
                    style={
                      formGridStyle
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
                      <label
                        style={
                          fieldStyle
                        }
                      >
                        <span>
                          Assigned employee
                        </span>

                        <select
                          name="assigned_employee_id"
                          value={
                            taskForm.assigned_employee_id
                          }
                          onChange={
                            handleTaskFormChange
                          }
                          style={
                            inputStyle
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
                      </label>
                    )}
                  </div>

                  <label
                    style={{
                      ...fieldStyle,
                      marginTop:
                        "14px",
                    }}
                  >
                    <span>
                      Description
                    </span>

                    <textarea
                      name="description"
                      rows={4}
                      value={
                        taskForm.description
                      }
                      onChange={
                        handleTaskFormChange
                      }
                      style={
                        textareaStyle
                      }
                    />
                  </label>

                  <div
                    className={
                      styles.headerActions
                    }
                    style={{
                      marginTop:
                        "18px",
                    }}
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
                  <h3>
                    Edit project
                  </h3>
                </div>

                <form
                  onSubmit={
                    saveProject
                  }
                >
                  <div
                    style={
                      formGridStyle
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
                  </div>

                  <div
                    className={
                      styles.headerActions
                    }
                    style={{
                      marginTop:
                        "18px",
                    }}
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
                      Save project
                    </button>
                  </div>
                </form>
              </section>
            )}

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
                <StatusBadge
                  status={
                    project.status ||
                    "Planning"
                  }
                />

                <h3>
                  {
                    project.project_name
                  }
                </h3>

                <p>
                  {project.description ||
                    "No description"}
                </p>
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
              />
            </div>
          </section>

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
                style={
                  emptyStateStyle
                }
              >
                <strong>
                  No visible tasks
                </strong>

                <p>
                  There are no tasks available within your current Task permissions.
                </p>
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table
                  style={
                    tableStyle
                  }
                >
                  <thead>
                    <tr>
                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Task
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Assignee
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Status
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Priority
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Due
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
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

                        return (
                          <tr
                            key={
                              task.id
                            }
                          >
                            <td
                              style={
                                tableCellStyle
                              }
                            >
                              {editing ? (
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
                              ) : (
                                <>
                                  <strong>
                                    {
                                      task.task_name
                                    }
                                  </strong>

                                  {task.description && (
                                    <div
                                      style={
                                        tableDescriptionStyle
                                      }
                                    >
                                      {
                                        task.description
                                      }
                                    </div>
                                  )}
                                </>
                              )}
                            </td>

                            <td
                              style={
                                tableCellStyle
                              }
                            >
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
                                  style={
                                    inputStyle
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

                            <td
                              style={
                                tableCellStyle
                              }
                            >
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
                                  style={
                                    inputStyle
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

                            <td
                              style={
                                tableCellStyle
                              }
                            >
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
                                  style={
                                    inputStyle
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

                            <td
                              style={
                                tableCellStyle
                              }
                            >
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
                                formatDate(
                                  task.due_date
                                )
                              )}
                            </td>

                            <td
                              style={
                                tableCellStyle
                              }
                            >
                              <div
                                style={
                                  actionRowStyle
                                }
                              >
                                {editing ? (
                                  <>
                                    <button
                                      type="button"
                                      className={
                                        styles.primaryButton
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
                                          styles.secondaryButton
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
                                      normaliseStatus(
                                        task.status
                                      ) !==
                                        "completed" && (
                                        <button
                                          type="button"
                                          className={
                                            styles.secondaryButton
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
                                          styles.secondaryButton
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
              <h3>
                Project information
              </h3>
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
                  customer?.company ||
                  customer?.customer_name ||
                  "Not linked"
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
              <h3>
                Linked invoices
              </h3>
            </div>

            {invoices.length ===
            0 ? (
              <div
                style={
                  emptyStateStyle
                }
              >
                No linked invoices.
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table
                  style={
                    tableStyle
                  }
                >
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
                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <Link
                              href={`/invoices/${invoice.id}`}
                            >
                              {invoice.invoice_number ||
                                "Invoice"}{" "}
                              →
                            </Link>
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {invoice.total_amount ||
                              invoice.amount ||
                              "Not set"}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <StatusBadge
                              status={
                                invoice.status ||
                                "Draft Invoice"
                              }
                            />
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
    <label
      style={
        fieldStyle
      }
    >
      <span>
        {label}
      </span>

      <input
        name={
          name
        }
        type={
          type
        }
        value={
          value
        }
        onChange={
          onChange
        }
        style={
          inputStyle
        }
      />
    </label>
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
    <label
      style={
        fieldStyle
      }
    >
      <span>
        {label}
      </span>

      <select
        name={
          name
        }
        value={
          value
        }
        onChange={
          onChange
        }
        style={
          inputStyle
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
    </label>
  );
}

function HeroMetric({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.heroMetric
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

function DetailRow({
  label,
  value,
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

      <strong>
        {value ||
          "Not available"}
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
  if (!value) {
    return "";
  }

  return String(
    value
  ).slice(
    0,
    10
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "Not set";
  }

  const date =
    new Date(
      String(
        value
      ).includes(
        "T"
      )
        ? value
        : `${value}T12:00:00`
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
    !task.due_date ||
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        task.status
      )
    )
  ) {
    return false;
  }

  const date =
    new Date(
      `${String(
        task.due_date
      ).slice(
        0,
        10
      )}T23:59:59`
    );

  return (
    !Number.isNaN(
      date.getTime()
    ) &&
    date <
      new Date()
  );
}

function sortTasks(
  first,
  second
) {
  const firstDone =
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        first.status
      )
    );

  const secondDone =
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        second.status
      )
    );

  if (
    firstDone !==
    secondDone
  ) {
    return firstDone
      ? 1
      : -1;
  }

  return String(
    first.due_date ||
      "9999"
  ).localeCompare(
    String(
      second.due_date ||
        "9999"
    )
  );
}

function getMoneyValue(
  value
) {
  const parsed =
    Number(
      String(
        value ||
          ""
      ).replace(
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
  if (!value) {
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
// SMALL INLINE STYLES
// =========================================================

const fieldStyle = {
  display:
    "grid",
  gap:
    "7px",
  fontSize:
    "13px",
  fontWeight:
    700,
};

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

const formGridStyle = {
  display:
    "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap:
    "14px",
};

const tableStyle = {
  width:
    "100%",
  borderCollapse:
    "collapse",
  fontSize:
    "13px",
};

const tableHeaderStyle = {
  padding:
    "11px 12px",
  textAlign:
    "left",
  borderBottom:
    "1px solid #e5e7eb",
  fontSize:
    "11px",
};

const tableCellStyle = {
  padding:
    "12px",
  borderBottom:
    "1px solid #eef1f5",
  verticalAlign:
    "top",
};

const tableDescriptionStyle = {
  marginTop:
    "4px",
  maxWidth:
    "420px",
  opacity:
    0.7,
  fontSize:
    "11px",
};

const actionRowStyle = {
  display:
    "flex",
  flexWrap:
    "wrap",
  gap:
    "6px",
};

const emptyStateStyle = {
  padding:
    "28px 20px",
  textAlign:
    "center",
  fontSize:
    "13px",
};
