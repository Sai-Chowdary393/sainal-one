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

import TaskForm from "./components/TaskForm";
import TaskTable from "./components/TaskTable";

import styles from "./project-details.module.css";

const EMPTY_TASK_FORM = {
  task_name: "",
  description: "",
  status: "To Do",
  due_date: "",
};

const COMPLETED_TASK_STATUSES = [
  "completed",
  "complete",
  "done",
];

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
    tasks,
    setTasks,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

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
    addingTask,
    setAddingTask,
  ] = useState(false);

  const [
    generatingTasks,
    setGeneratingTasks,
  ] = useState(false);

  const [
    generatingInvoice,
    setGeneratingInvoice,
  ] = useState(false);

  const [
    updatingTaskId,
    setUpdatingTaskId,
  ] = useState(null);

  const [
    savingTaskId,
    setSavingTaskId,
  ] = useState(null);

  const [
    deletingTaskId,
    setDeletingTaskId,
  ] = useState(null);

  useEffect(() => {
    if (
      projectId
    ) {
      fetchProjectDetails();
    }
  }, [
    projectId,
  ]);

  // =======================================================
  // LOAD PROJECT
  // =======================================================

  async function fetchProjectDetails() {
    try {
      setLoading(true);

      setErrorMessage("");

      const [
        projectsResponse,
        tasksResponse,
      ] = await Promise.all([
        fetch(
          "/api/projects",
          {
            cache:
              "no-store",
          }
        ),

        fetch(
          `/api/tasks?scope=project&project_id=${encodeURIComponent(
            projectId
          )}`,
          {
            cache:
              "no-store",
          }
        ),
      ]);

      const projectsData =
        await projectsResponse.json();

      const tasksData =
        await tasksResponse.json();

      if (
        !projectsResponse.ok
      ) {
        throw new Error(
          projectsData.error ||
            "Failed to load projects."
        );
      }

      if (
        !tasksResponse.ok
      ) {
        throw new Error(
          tasksData.error ||
            "Failed to load project tasks."
        );
      }

      const selectedProject =
        (
          Array.isArray(
            projectsData
          )
            ? projectsData
            : []
        ).find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              projectId
            )
        );

      const projectTasks =
        extractTasksFromResponse(
          tasksData
        ).sort(
          sortTasks
        );

      setProject(
        selectedProject ||
          null
      );

      setTasks(
        projectTasks
      );
    } catch (error) {
      console.error(
        "Project details loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load this project."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // TASK FORM
  // =======================================================

  function handleTaskChange(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setTaskForm(
      (
        currentTaskForm
      ) => ({
        ...currentTaskForm,

        [name]:
          value,
      })
    );
  }

  function openTaskForm() {
    setTaskForm(
      EMPTY_TASK_FORM
    );

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

  // =======================================================
  // ADD TASK
  // =======================================================

  async function addTask(
    event
  ) {
    event.preventDefault();

    const taskName =
      taskForm.task_name.trim();

    if (!taskName) {
      alert(
        "Please enter the task name."
      );

      return;
    }

    try {
      setAddingTask(
        true
      );

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
                  projectId,

                task_name:
                  taskName,

                description:
                  taskForm.description.trim(),

                status:
                  taskForm.status ||
                  "To Do",

                due_date:
                  taskForm.due_date ||
                  null,

                priority:
                  "Medium",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to add task."
        );
      }

      closeTaskForm();

      await refreshTasksAndProjectStatus();

      alert(
        data.message ||
          "Task added successfully."
      );
    } catch (error) {
      console.error(
        "Task creation error:",
        error
      );

      alert(
        error.message ||
          "Error adding task."
      );
    } finally {
      setAddingTask(
        false
      );
    }
  }

  // =======================================================
  // SAVE TASK
  // =======================================================

  async function saveTask(
    taskId,
    taskData
  ) {
    try {
      setSavingTaskId(
        taskId
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
              JSON.stringify({
                task_name:
                  taskData.task_name.trim(),

                description:
                  String(
                    taskData.description ||
                      ""
                  ).trim(),

                status:
                  taskData.status ||
                  "To Do",

                due_date:
                  taskData.due_date ||
                  null,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save task changes."
        );
      }

      await refreshTasksAndProjectStatus();

      alert(
        data.message ||
          "Task updated successfully."
      );

      return true;
    } catch (error) {
      console.error(
        "Task save error:",
        error
      );

      alert(
        error.message ||
          "Error updating task."
      );

      return false;
    } finally {
      setSavingTaskId(
        null
      );
    }
  }

  // =======================================================
  // STATUS
  // =======================================================

  async function updateTaskStatus(
    taskId,
    newStatus
  ) {
    try {
      setUpdatingTaskId(
        taskId
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
              JSON.stringify({
                status:
                  newStatus,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update task status."
        );
      }

      await refreshTasksAndProjectStatus();
    } catch (error) {
      console.error(
        "Task status update error:",
        error
      );

      alert(
        error.message ||
          "Error updating task status."
      );
    } finally {
      setUpdatingTaskId(
        null
      );
    }
  }

  // =======================================================
  // DELETE TASK
  // =======================================================

  async function deleteTask(
    taskId
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this task?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingTaskId(
        taskId
      );

      const response =
        await fetch(
          `/api/tasks/${taskId}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete task."
        );
      }

      await refreshTasksAndProjectStatus();

      alert(
        data.message ||
          "Task deleted successfully."
      );
    } catch (error) {
      console.error(
        "Task deletion error:",
        error
      );

      alert(
        error.message ||
          "Error deleting task."
      );
    } finally {
      setDeletingTaskId(
        null
      );
    }
  }

  // =======================================================
  // DEFAULT TASKS
  // =======================================================

  async function generateDefaultTasks() {
    if (
      !project ||
      generatingTasks
    ) {
      return;
    }

    if (
      tasks.length >
      0
    ) {
      const confirmed =
        window.confirm(
          "This project already has tasks. The default-task generator should prevent duplicates. Continue?"
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      setGeneratingTasks(
        true
      );

      const response =
        await fetch(
          `/api/projects/${project.id}/generate-tasks`,
          {
            method:
              "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to generate default tasks."
        );
      }

      await refreshTasksAndProjectStatus();

      alert(
        data.message ||
          "Default tasks generated successfully."
      );
    } catch (error) {
      console.error(
        "Default task generation error:",
        error
      );

      alert(
        error.message ||
          "Error generating default tasks."
      );
    } finally {
      setGeneratingTasks(
        false
      );
    }
  }

  // =======================================================
  // REFRESH TASKS
  // =======================================================

  async function refreshTasksAndProjectStatus() {
    const response =
      await fetch(
        `/api/tasks?scope=project&project_id=${encodeURIComponent(
          projectId
        )}`,
        {
          cache:
            "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Failed to refresh tasks."
      );
    }

    const projectTasks =
      extractTasksFromResponse(
        data
      ).sort(
        sortTasks
      );

    setTasks(
      projectTasks
    );

    await updateProjectStatus(
      projectTasks
    );
  }

  // =======================================================
  // PROJECT STATUS
  // =======================================================

  async function updateProjectStatus(
    projectTasks
  ) {
    try {
      let newStatus =
        "Planning";

      if (
        projectTasks.length >
        0
      ) {
        const completedTaskCount =
          projectTasks.filter(
            (task) =>
              COMPLETED_TASK_STATUSES.includes(
                normaliseStatus(
                  task.status
                )
              )
          ).length;

        const hasActiveTask =
          projectTasks.some(
            (task) =>
              [
                "in progress",
                "blocked",
              ].includes(
                normaliseStatus(
                  task.status
                )
              )
          );

        if (
          completedTaskCount ===
          projectTasks.length
        ) {
          newStatus =
            "Completed";
        } else if (
          completedTaskCount >
            0 ||
          hasActiveTask
        ) {
          newStatus =
            "In Progress";
        }
      }

      const response =
        await fetch(
          `/api/projects/${projectId}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                status:
                  newStatus,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          data.error ||
            "Failed to update project status."
        );

        return;
      }

      const updatedProject =
        Array.isArray(
          data
        )
          ? data[0]
          : data?.project ||
            data;

      setProject(
        (
          currentProject
        ) => ({
          ...currentProject,

          ...(updatedProject ||
            {}),

          status:
            updatedProject?.status ||
            newStatus,
        })
      );
    } catch (error) {
      console.error(
        "Automatic project status error:",
        error
      );
    }
  }

  // =======================================================
  // INVOICE
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
                  project.project_name,

                service:
                  project.description ||
                  "Project Service",

                amount:
                  project.amount ||
                  "£0.00",

                subtotal:
                  project.amount ||
                  "£0.00",

                vat_rate:
                  "0%",

                vat_amount:
                  "£0.00",

                total_amount:
                  project.amount ||
                  "£0.00",

                status:
                  "Draft Invoice",

                due_date:
                  null,

                payment_terms:
                  "Payment due within 14 days of invoice date.",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create invoice."
        );
      }

      const createdInvoice =
        Array.isArray(
          data
        )
          ? data[0]
          : data?.invoice ||
            data;

      alert(
        "Invoice generated successfully."
      );

      if (
        createdInvoice?.id
      ) {
        router.push(
          `/invoices/${createdInvoice.id}`
        );
      }
    } catch (error) {
      console.error(
        "Invoice generation error:",
        error
      );

      alert(
        error.message ||
          "Error generating invoice."
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

  const projectMetrics =
    useMemo(() => {
      const totalTasks =
        tasks.length;

      const completedTasks =
        tasks.filter(
          (task) =>
            COMPLETED_TASK_STATUSES.includes(
              normaliseStatus(
                task.status
              )
            )
        ).length;

      const blockedTasks =
        tasks.filter(
          (task) =>
            normaliseStatus(
              task.status
            ) ===
            "blocked"
        ).length;

      const overdueTasks =
        tasks.filter(
          (task) =>
            isTaskOverdue(
              task
            )
        ).length;

      const inProgressTasks =
        tasks.filter(
          (task) =>
            normaliseStatus(
              task.status
            ) ===
            "in progress"
        ).length;

      const progress =
        totalTasks ===
        0
          ? 0
          : Math.round(
              (
                completedTasks /
                totalTasks
              ) * 100
            );

      const delayed =
        !COMPLETED_TASK_STATUSES.includes(
          normaliseStatus(
            project?.status
          )
        ) &&
        (
          isDateOverdue(
            project?.due_date
          ) ||
          overdueTasks >
            0
        );

      return {
        totalTasks,

        completedTasks,

        blockedTasks,

        overdueTasks,

        inProgressTasks,

        progress,

        delayed,
      };
    }, [
      tasks,
      project,
    ]);

  // =======================================================
  // LOADING / ERRORS
  // =======================================================

  if (loading) {
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

  if (errorMessage) {
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
                styles.secondaryButton
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

  if (!project) {
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
              This project may have
              been deleted or you may
              not have access to it.
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

  const recommendations =
    buildProjectRecommendations(
      project,
      projectMetrics
    );

  const deliveryRisk =
    getDeliveryRisk(
      project,
      projectMetrics
    );

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
        description="Manage project delivery, tasks, progress and invoicing."
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
                {project.project_name ||
                  "Unnamed project"}
              </h2>

              <p>
                Manage tasks,
                delivery progress,
                risk and project
                invoicing.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
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
                  : "Add task"}
              </button>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                disabled={
                  generatingTasks
                }
                onClick={
                  generateDefaultTasks
                }
              >
                {generatingTasks
                  ? "Generating..."
                  : tasks.length >
                      0
                    ? "Check default tasks"
                    : "Generate default tasks"}
              </button>

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
                    ? "Generating invoice..."
                    : "Generate invoice"}
                </button>
              )}
            </div>
          </section>

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
                  {project.project_name ||
                    "Unnamed project"}
                </h3>

                <p>
                  {project.description ||
                    "No project description has been added."}
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
                    Start{" "}
                    {formatDate(
                      project.start_date
                    )}
                  </span>

                  <span
                    className={
                      projectMetrics.delayed
                        ? styles.overdueBadge
                        : styles.metaBadge
                    }
                  >
                    {projectMetrics.delayed
                      ? "Delivery delayed"
                      : `Due ${formatDate(
                          project.due_date
                        )}`}
                  </span>

                  {project.customer_id && (
                    <span
                      className={
                        styles.linkedBadge
                      }
                    >
                      Linked customer
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
                label="Project value"
                value={formatProjectAmount(
                  project.amount
                )}
              />

              <HeroMetric
                label="Progress"
                value={`${projectMetrics.progress}%`}
                success={
                  projectMetrics.progress ===
                  100
                }
              />

              <HeroMetric
                label="Delivery risk"
                value={
                  deliveryRisk
                }
                warning={
                  deliveryRisk ===
                  "High"
                }
              />
            </div>
          </section>

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
                    Scope, dates, value
                    and business links
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.detailList
                }
              >
                <DetailRow
                  label="Project name"
                  value={
                    project.project_name
                  }
                />

                <DetailRow
                  label="Description"
                  value={
                    project.description
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

                <DetailRow
                  label="Project value"
                  value={formatProjectAmount(
                    project.amount
                  )}
                />

                <DetailRow
                  label="Start date"
                  value={formatDate(
                    project.start_date
                  )}
                />

                <DetailRow
                  label="Due date"
                  value={formatDate(
                    project.due_date
                  )}
                />

                <DetailRow
                  label="Created"
                  value={formatDate(
                    project.created_at
                  )}
                />

                <DetailRow
                  label="Customer"
                  customValue={
                    project.customer_id ? (
                      <Link
                        href={`/customers/${project.customer_id}`}
                      >
                        Open linked customer →
                      </Link>
                    ) : (
                      <strong
                        className={
                          styles.emptyValue
                        }
                      >
                        Not linked
                      </strong>
                    )
                  }
                />

                <DetailRow
                  label="Source quote"
                  customValue={
                    project.quote_id ? (
                      <Link
                        href={`/quotes/${project.quote_id}`}
                      >
                        Open linked quote →
                      </Link>
                    ) : (
                      <strong
                        className={
                          styles.emptyValue
                        }
                      >
                        Not linked
                      </strong>
                    )
                  }
                />
              </div>
            </section>

            <section
              className={
                styles.aiPanel
              }
            >
              <div
                className={
                  styles.aiHeader
                }
              >
                <span
                  className={
                    styles.aiIcon
                  }
                >
                  ✦
                </span>

                <div>
                  <span>
                    Delivery intelligence
                  </span>

                  <h3>
                    Project risk overview
                  </h3>
                </div>
              </div>

              <div
                className={
                  styles.riskGrid
                }
              >
                <RiskMetric
                  label="Delivery risk"
                  value={
                    deliveryRisk
                  }
                />

                <RiskMetric
                  label="Progress"
                  value={`${projectMetrics.progress}%`}
                />

                <RiskMetric
                  label="Blocked tasks"
                  value={
                    projectMetrics.blockedTasks
                  }
                />

                <RiskMetric
                  label="Overdue tasks"
                  value={
                    projectMetrics.overdueTasks
                  }
                />
              </div>

              <div
                className={
                  styles.aiRecommendations
                }
              >
                <span>
                  Recommended actions
                </span>

                {recommendations.map(
                  (
                    recommendation,
                    index
                  ) => (
                    <div
                      key={`${recommendation}-${index}`}
                      className={
                        styles.recommendationItem
                      }
                    >
                      <span>
                        →
                      </span>

                      <p>
                        {
                          recommendation
                        }
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
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
                  Project progress
                </h3>

                <p>
                  Delivery completion
                  based on project tasks
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
                  {
                    projectMetrics.progress
                  }%
                </strong>

                <span>
                  {
                    projectMetrics.completedTasks
                  }{" "}
                  of{" "}
                  {
                    projectMetrics.totalTasks
                  }{" "}
                  tasks completed
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
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        projectMetrics.progress
                      )
                    )}%`,
                  }}
                />
              </div>

              <div
                className={
                  styles.progressMetrics
                }
              >
                <ProgressMetric
                  label="Total tasks"
                  value={
                    projectMetrics.totalTasks
                  }
                />

                <ProgressMetric
                  label="Completed"
                  value={
                    projectMetrics.completedTasks
                  }
                />

                <ProgressMetric
                  label="Blocked"
                  value={
                    projectMetrics.blockedTasks
                  }
                  warning
                />

                <ProgressMetric
                  label="Overdue"
                  value={
                    projectMetrics.overdueTasks
                  }
                  danger
                />
              </div>
            </div>
          </section>

          {showTaskForm && (
            <TaskForm
              formData={
                taskForm
              }
              saving={
                addingTask
              }
              onChange={
                handleTaskChange
              }
              onSubmit={
                addTask
              }
              onCancel={
                closeTaskForm
              }
            />
          )}

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
                  Add, edit, complete
                  and manage project
                  delivery tasks.
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

            <TaskTable
              tasks={
                tasks
              }
              updatingTaskId={
                updatingTaskId
              }
              savingTaskId={
                savingTaskId
              }
              deletingTaskId={
                deletingTaskId
              }
              onUpdateStatus={
                updateTaskStatus
              }
              onSaveTask={
                saveTask
              }
              onDeleteTask={
                deleteTask
              }
              onAddTask={
                openTaskForm
              }
            />
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// COMPONENTS
// =======================================================

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

      {customValue ? (
        customValue
      ) : (
        <strong
          className={
            value
              ? ""
              : styles.emptyValue
          }
        >
          {value ||
            "Not available"}
        </strong>
      )}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  success = false,
  warning = false,
}) {
  return (
    <div
      className={`${styles.heroMetric} ${
        success
          ? styles.heroMetricSuccess
          : ""
      } ${
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

function RiskMetric({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.riskMetric
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

function LoadingState() {
  return (
    <section
      className={
        styles.loadingPanel
      }
    >
      {Array.from({
        length: 6,
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
// API HELPERS
// =======================================================

function extractTasksFromResponse(
  data
) {
  if (
    Array.isArray(
      data
    )
  ) {
    return data;
  }

  if (
    Array.isArray(
      data?.tasks
    )
  ) {
    return data.tasks;
  }

  return [];
}

// =========================================================
// TASK HELPERS
// =======================================================

function sortTasks(
  firstTask,
  secondTask
) {
  const firstCompleted =
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        firstTask.status
      )
    );

  const secondCompleted =
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        secondTask.status
      )
    );

  if (
    firstCompleted !==
    secondCompleted
  ) {
    return firstCompleted
      ? 1
      : -1;
  }

  const firstDate =
    firstTask.due_date ||
    "9999-12-31";

  const secondDate =
    secondTask.due_date ||
    "9999-12-31";

  return firstDate.localeCompare(
    secondDate
  );
}

function normaliseStatus(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function getMoneyValue(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const cleanedValue =
    String(value)
      .replace(
        /,/g,
        ""
      )
      .replace(
        /[^\d.-]/g,
        ""
      );

  const parsedValue =
    Number.parseFloat(
      cleanedValue
    );

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
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

      minimumFractionDigits:
        0,

      maximumFractionDigits:
        0,
    }
  ).format(
    getMoneyValue(
      value
    )
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "Not available";
  }

  const date =
    String(
      value
    ).includes(
      "T"
    )
      ? new Date(
          value
        )
      : new Date(
          `${value}T12:00:00`
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
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

function isDateOverdue(
  value
) {
  if (!value) {
    return false;
  }

  const date =
    String(
      value
    ).includes(
      "T"
    )
      ? new Date(
          value
        )
      : new Date(
          `${value}T23:59:59`
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    date <
    new Date()
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

  return isDateOverdue(
    task.due_date
  );
}

function getDeliveryRisk(
  project,
  metrics
) {
  if (
    normaliseStatus(
      project.status
    ) ===
    "completed"
  ) {
    return "No risk";
  }

  if (
    metrics.overdueTasks >
      0 ||
    metrics.blockedTasks >
      1 ||
    isDateOverdue(
      project.due_date
    )
  ) {
    return "High";
  }

  if (
    metrics.blockedTasks ===
      1 ||
    metrics.progress <
      30
  ) {
    return "Medium";
  }

  return "Low";
}

function buildProjectRecommendations(
  project,
  metrics
) {
  const recommendations =
    [];

  if (
    metrics.totalTasks ===
    0
  ) {
    recommendations.push(
      "Add project tasks or generate the default delivery workflow."
    );
  }

  if (
    metrics.overdueTasks >
    0
  ) {
    recommendations.push(
      `Review the ${metrics.overdueTasks} overdue task${
        metrics.overdueTasks ===
        1
          ? ""
          : "s"
      } and update their delivery dates.`
    );
  }

  if (
    metrics.blockedTasks >
    0
  ) {
    recommendations.push(
      `Resolve the ${metrics.blockedTasks} blocked task${
        metrics.blockedTasks ===
        1
          ? ""
          : "s"
      } before delivery is delayed further.`
    );
  }

  if (
    !project.due_date
  ) {
    recommendations.push(
      "Add a project due date so delivery risk can be tracked."
    );
  }

  if (
    !project.customer_id
  ) {
    recommendations.push(
      "Link the project to a customer for a complete business history."
    );
  }

  if (
    metrics.progress ===
      100 &&
    normaliseStatus(
      project.status
    ) ===
      "completed"
  ) {
    recommendations.push(
      "The project is complete and ready for invoice generation and customer handover."
    );
  }

  if (
    recommendations.length ===
    0
  ) {
    recommendations.push(
      "The project is progressing normally. Continue monitoring upcoming task due dates."
    );
  }

  return recommendations.slice(
    0,
    5
  );
}
