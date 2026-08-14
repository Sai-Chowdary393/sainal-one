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

import styles from "./task-details.module.css";

const TASK_STATUS_OPTIONS = [
  "Open",
  "In Progress",
  "Blocked",
  "Completed",
];

const PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export default function TaskDetailsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const taskId =
    params?.id;

  const [
    task,
    setTask,
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
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    editMode,
    setEditMode,
  ] = useState(false);

  const [
    formData,
    setFormData,
  ] = useState({
    task_name: "",
    description: "",
    status: "Open",
    priority: "Medium",
    due_date: "",
  });

  useEffect(() => {
    if (!taskId) {
      return;
    }

    fetchTask();
  }, [taskId]);

  async function fetchTask() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          `/api/tasks/${taskId}`,
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
            "Failed to load task."
        );
      }

      const selectedTask =
        data?.task ||
        null;

      setTask(
        selectedTask
      );

      if (selectedTask) {
        setFormData({
          task_name:
            selectedTask.task_name ||
            "",

          description:
            selectedTask.description ||
            "",

          status:
            selectedTask.status ||
            "Open",

          priority:
            selectedTask.priority ||
            "Medium",

          due_date:
            normaliseDateInput(
              selectedTask.due_date
            ),
        });
      }
    } catch (error) {
      console.error(
        "Task loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to load task."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setFormData(
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
    event
  ) {
    event.preventDefault();

    if (
      !formData.task_name.trim()
    ) {
      alert(
        "Task name is required."
      );

      return;
    }

    try {
      setSaving(true);

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
                  formData.task_name.trim(),

                description:
                  formData.description.trim(),

                status:
                  formData.status,

                priority:
                  formData.priority,

                due_date:
                  formData.due_date ||
                  null,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update task."
        );
      }

      setTask(
        data.task
      );

      setEditMode(
        false
      );

      alert(
        data.message ||
          "Task updated successfully."
      );
    } catch (error) {
      console.error(
        "Task update error:",
        error
      );

      alert(
        error.message ||
          "Unable to update task."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    status
  ) {
    try {
      setSaving(true);

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

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update task status."
        );
      }

      setTask(
        data.task
      );

      setFormData(
        (
          current
        ) => ({
          ...current,
          status,
        })
      );
    } catch (error) {
      console.error(
        "Task status update error:",
        error
      );

      alert(
        error.message ||
          "Unable to update task status."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this task?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

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
            "Unable to delete task."
        );
      }

      alert(
        data.message ||
          "Task deleted successfully."
      );

      router.push(
        "/follow-ups"
      );
    } catch (error) {
      console.error(
        "Task deletion error:",
        error
      );

      alert(
        error.message ||
          "Unable to delete task."
      );
    } finally {
      setDeleting(false);
    }
  }

  const relatedHref =
    useMemo(
      () =>
        getRecordHref(
          task?.record_type,
          task?.record_id
        ),
      [
        task,
      ]
    );

  const workflowGenerated =
    Boolean(
      task?.workflow_run_id
    );

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Task Workspace"
          description="Loading task information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    errorMessage &&
    !task
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Task Workspace"
          description="Review and manage assigned work."
        >
          <section
            className={
              styles.errorPanel
            }
          >
            <strong>
              Unable to load task
            </strong>

            <p>
              {errorMessage}
            </p>

            <button
              type="button"
              className={
                styles.secondaryButton
              }
              onClick={
                fetchTask
              }
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!task) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Task Workspace"
          description="Review and manage assigned work."
        >
          <section
            className={
              styles.notFound
            }
          >
            <span>
              ☑
            </span>

            <h2>
              Task not found
            </h2>

            <p>
              This task may have been deleted or you may not have access to it.
            </p>

            <Link
              href="/follow-ups"
              className={
                styles.primaryButton
              }
            >
              Return to My Work
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          task.task_name ||
          "Task Workspace"
        }
        description="Manage task progress, priority and related business records."
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
            <div>
              <Link
                href="/follow-ups"
                className={
                  styles.backLink
                }
              >
                ← Back to My Work
              </Link>

              <span
                className={
                  styles.eyebrow
                }
              >
                Task workspace
              </span>

              <h2>
                {task.task_name}
              </h2>

              <p>
                Review the assigned action, update progress and open the related business record.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              {!editMode && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={() =>
                    setEditMode(
                      true
                    )
                  }
                >
                  Edit task
                </button>
              )}

              {relatedHref && (
                <Link
                  href={
                    relatedHref
                  }
                  className={
                    styles.secondaryButton
                  }
                >
                  Open related record
                </Link>
              )}

              {normaliseStatus(
                task.status
              ) !==
                "completed" && (
                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  disabled={
                    saving
                  }
                  onClick={() =>
                    changeStatus(
                      "Completed"
                    )
                  }
                >
                  Mark completed
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
                styles.taskIdentity
              }
            >
              <span
                className={
                  styles.taskIcon
                }
              >
                ☑
              </span>

              <div>
                <span
                  className={
                    styles.heroLabel
                  }
                >
                  {workflowGenerated
                    ? "Workflow generated"
                    : "Manual task"}
                </span>

                <h3>
                  {task.task_name}
                </h3>

                <p>
                  {task.description ||
                    "No task description has been added."}
                </p>

                <div
                  className={
                    styles.badges
                  }
                >
                  <StatusBadge
                    status={
                      task.status ||
                      "Open"
                    }
                  />

                  <span
                    className={
                      styles.priorityBadge
                    }
                  >
                    {task.priority ||
                      "Medium"}{" "}
                    priority
                  </span>

                  {workflowGenerated && (
                    <span
                      className={
                        styles.workflowBadge
                      }
                    >
                      Workflow generated
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              className={
                styles.dueCard
              }
            >
              <span>
                Due date
              </span>

              <strong>
                {formatDate(
                  task.due_date
                )}
              </strong>

              <small>
                {getDueState(
                  task
                )}
              </small>
            </div>
          </section>

          {editMode ? (
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
                    Edit task
                  </h3>

                  <p>
                    Update the task details and save your changes.
                  </p>
                </div>
              </div>

              <form
                className={
                  styles.editForm
                }
                onSubmit={
                  saveTask
                }
              >
                <label>
                  <span>
                    Task name
                  </span>

                  <input
                    type="text"
                    name="task_name"
                    value={
                      formData.task_name
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />
                </label>

                <label
                  className={
                    styles.fullField
                  }
                >
                  <span>
                    Description
                  </span>

                  <textarea
                    name="description"
                    value={
                      formData.description
                    }
                    onChange={
                      handleChange
                    }
                    rows={5}
                  />
                </label>

                <label>
                  <span>
                    Status
                  </span>

                  <select
                    name="status"
                    value={
                      formData.status
                    }
                    onChange={
                      handleChange
                    }
                  >
                    {TASK_STATUS_OPTIONS.map(
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

                <label>
                  <span>
                    Priority
                  </span>

                  <select
                    name="priority"
                    value={
                      formData.priority
                    }
                    onChange={
                      handleChange
                    }
                  >
                    {PRIORITY_OPTIONS.map(
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

                <label>
                  <span>
                    Due date
                  </span>

                  <input
                    type="date"
                    name="due_date"
                    value={
                      formData.due_date
                    }
                    onChange={
                      handleChange
                    }
                  />
                </label>

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
                    disabled={
                      saving
                    }
                    onClick={() =>
                      setEditMode(
                        false
                      )
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
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section
              className={
                styles.detailsGrid
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
                      Task information
                    </h3>

                    <p>
                      Status, priority and schedule.
                    </p>
                  </div>
                </div>

                <div
                  className={
                    styles.detailList
                  }
                >
                  <DetailRow
                    label="Status"
                    customValue={
                      <StatusBadge
                        status={
                          task.status ||
                          "Open"
                        }
                      />
                    }
                  />

                  <DetailRow
                    label="Priority"
                    value={
                      task.priority ||
                      "Medium"
                    }
                  />

                  <DetailRow
                    label="Due date"
                    value={formatDate(
                      task.due_date
                    )}
                  />

                  <DetailRow
                    label="Created"
                    value={formatDateTime(
                      task.created_at
                    )}
                  />

                  <DetailRow
                    label="Last updated"
                    value={formatDateTime(
                      task.updated_at
                    )}
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
                  <div>
                    <h3>
                      Source & linkage
                    </h3>

                    <p>
                      Where this task came from and what it relates to.
                    </p>
                  </div>
                </div>

                <div
                  className={
                    styles.detailList
                  }
                >
                  <DetailRow
                    label="Source"
                    value={
                      workflowGenerated
                        ? "Workflow automation"
                        : "Manual task"
                    }
                  />

                  <DetailRow
                    label="Related type"
                    value={
                      formatRecordType(
                        task.record_type
                      )
                    }
                  />

                  <DetailRow
                    label="Related record"
                    customValue={
                      relatedHref ? (
                        <Link
                          href={
                            relatedHref
                          }
                          className={
                            styles.recordLink
                          }
                        >
                          Open related record →
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
                    label="Project"
                    customValue={
                      task.project_id ? (
                        <Link
                          href={`/projects/${task.project_id}`}
                          className={
                            styles.recordLink
                          }
                        >
                          Open project →
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
                    label="Workflow run"
                    value={
                      task.workflow_run_id
                        ? "Linked"
                        : "Not linked"
                    }
                  />
                </div>
              </section>
            </section>
          )}

          <section
            className={
              styles.descriptionPanel
            }
          >
            <span
              className={
                styles.eyebrow
              }
            >
              Work instructions
            </span>

            <h3>
              Description
            </h3>

            <p>
              {task.description ||
                "No task description has been added."}
            </p>
          </section>

          <section
            className={
              styles.dangerPanel
            }
          >
            <div>
              <h3>
                Delete task
              </h3>

              <p>
                Permanently remove this task from SaiNal One.
              </p>
            </div>

            <button
              type="button"
              className={
                styles.deleteButton
              }
              disabled={
                deleting
              }
              onClick={
                deleteTask
              }
            >
              {deleting
                ? "Deleting..."
                : "Delete task"}
            </button>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
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

function normaliseStatus(
  value
) {
  return String(
    value || ""
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
  ).split(
    "T"
  )[0];
}

function formatDate(
  value
) {
  if (!value) {
    return "Not scheduled";
  }

  const date =
    new Date(
      `${String(
        value
      ).split("T")[0]}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not scheduled";
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

function formatDateTime(
  value
) {
  if (!value) {
    return "Not available";
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
    return "Not available";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function formatRecordType(
  value
) {
  if (!value) {
    return "Not linked";
  }

  const clean =
    String(
      value
    )
      .trim()
      .toLowerCase();

  return (
    clean
      .charAt(0)
      .toUpperCase() +
    clean.slice(1)
  );
}

function getRecordHref(
  recordType,
  recordId
) {
  if (
    !recordType ||
    !recordId
  ) {
    return null;
  }

  switch (
    normaliseStatus(
      recordType
    )
  ) {
    case "quote":
    case "quotes":
      return `/quotes/${recordId}`;

    case "lead":
    case "leads":
      return `/leads/${recordId}`;

    case "customer":
    case "customers":
      return `/customers/${recordId}`;

    case "project":
    case "projects":
      return `/projects/${recordId}`;

    case "proposal":
    case "proposals":
      return `/proposals/${recordId}`;

    case "invoice":
    case "invoices":
      return `/invoices/${recordId}`;

    default:
      return null;
  }
}

function getDueState(
  task
) {
  if (
    normaliseStatus(
      task?.status
    ) ===
    "completed"
  ) {
    return "Completed";
  }

  if (
    !task?.due_date
  ) {
    return "No deadline";
  }

  const dueDate =
    new Date(
      `${String(
        task.due_date
      ).split("T")[0]}T23:59:59`
    );

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    return "No deadline";
  }

  const now =
    new Date();

  if (
    dueDate <
    now
  ) {
    return "Overdue";
  }

  const today =
    new Date();

  if (
    dueDate.getFullYear() ===
      today.getFullYear() &&
    dueDate.getMonth() ===
      today.getMonth() &&
    dueDate.getDate() ===
      today.getDate()
  ) {
    return "Due today";
  }

  return "Upcoming";
}
