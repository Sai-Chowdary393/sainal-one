"use client";

import { useEffect, useState } from "react";

import styles from "../project-details.module.css";

const TASK_STATUS_OPTIONS = [
  "To Do",
  "In Progress",
  "Completed",
  "Blocked",
];

const EMPTY_EDIT_FORM = {
  task_name: "",
  description: "",
  status: "To Do",
  due_date: "",
};

export default function TaskTable({
  tasks = [],
  updatingTaskId = null,
  deletingTaskId = null,
  savingTaskId = null,
  onUpdateStatus,
  onSaveTask,
  onDeleteTask,
  onAddTask,
}) {
  const [editingTaskId, setEditingTaskId] =
    useState(null);

  const [editForm, setEditForm] =
    useState(EMPTY_EDIT_FORM);

  useEffect(() => {
    if (
      editingTaskId &&
      !tasks.some(
        (task) =>
          String(task.id) ===
          String(editingTaskId)
      )
    ) {
      cancelEditing();
    }
  }, [tasks, editingTaskId]);

  function startEditing(task) {
    setEditingTaskId(task.id);

    setEditForm({
      task_name:
        task.task_name || "",

      description:
        task.description || "",

      status:
        task.status || "To Do",

      due_date:
        normaliseDateInput(
          task.due_date
        ),
    });
  }

  function cancelEditing() {
    setEditingTaskId(null);
    setEditForm(EMPTY_EDIT_FORM);
  }

  function handleEditChange(event) {
    const { name, value } =
      event.target;

    setEditForm(
      (currentForm) => ({
        ...currentForm,
        [name]: value,
      })
    );
  }

  async function submitEdit(event) {
    event.preventDefault();

    if (!editingTaskId) {
      return;
    }

    if (
      !editForm.task_name.trim()
    ) {
      alert(
        "Please enter the task name."
      );

      return;
    }

    const saved =
      await onSaveTask(
        editingTaskId,
        {
          task_name:
            editForm.task_name.trim(),

          description:
            editForm.description.trim(),

          status:
            editForm.status,

          due_date:
            editForm.due_date ||
            null,
        }
      );

    if (saved !== false) {
      cancelEditing();
    }
  }

  if (tasks.length === 0) {
    return (
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
          No project tasks yet
        </h3>

        <p>
          Add a task manually or generate
          the default project workflow to
          begin tracking delivery progress.
        </p>

        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={onAddTask}
        >
          Add first task
        </button>
      </div>
    );
  }

  return (
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
            <th>Task</th>
            <th>Description</th>
            <th>Status</th>
            <th>Due date</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => {
            const isEditing =
              String(
                editingTaskId
              ) ===
              String(task.id);

            const overdue =
              isTaskOverdue(task);

            return (
              <TaskRows
                key={task.id}
                task={task}
                overdue={overdue}
                isEditing={
                  isEditing
                }
                editForm={
                  editForm
                }
                updating={
                  String(
                    updatingTaskId
                  ) ===
                  String(task.id)
                }
                deleting={
                  String(
                    deletingTaskId
                  ) ===
                  String(task.id)
                }
                saving={
                  String(
                    savingTaskId
                  ) ===
                  String(task.id)
                }
                onEdit={() =>
                  startEditing(task)
                }
                onCancelEdit={
                  cancelEditing
                }
                onEditChange={
                  handleEditChange
                }
                onSubmitEdit={
                  submitEdit
                }
                onUpdateStatus={(
                  status
                ) =>
                  onUpdateStatus(
                    task.id,
                    status
                  )
                }
                onDelete={() =>
                  onDeleteTask(
                    task.id
                  )
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskRows({
  task,
  overdue,
  isEditing,
  editForm,
  updating,
  deleting,
  saving,
  onEdit,
  onCancelEdit,
  onEditChange,
  onSubmitEdit,
  onUpdateStatus,
  onDelete,
}) {
  return (
    <>
      <tr>
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
              <strong>
                {task.task_name ||
                  "Untitled task"}
              </strong>

              <small>
                {getTaskSubtitle(
                  task,
                  overdue
                )}
              </small>

              {overdue && (
                <span
                  className={
                    styles.overdueLabel
                  }
                >
                  Overdue
                </span>
              )}
            </div>
          </div>
        </td>

        <td>
          <span
            className={
              styles.taskDescription
            }
          >
            {task.description ||
              "No description"}
          </span>
        </td>

        <td>
          <select
            className={
              styles.statusSelect
            }
            value={
              task.status ||
              "To Do"
            }
            disabled={
              updating ||
              saving ||
              deleting ||
              isEditing
            }
            onChange={(event) =>
              onUpdateStatus(
                event.target.value
              )
            }
            aria-label={`Update status for ${
              task.task_name ||
              "task"
            }`}
          >
            {TASK_STATUS_OPTIONS.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}
          </select>
        </td>

        <td>
          <div>
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
          </div>
        </td>

        <td>
          <span
            className={
              styles.taskDate
            }
          >
            {formatDate(
              task.created_at
            )}
          </span>
        </td>

        <td>
          <div
            className={
              styles.taskActions
            }
          >
            <button
              type="button"
              className={
                styles.smallButton
              }
              disabled={
                updating ||
                saving ||
                deleting ||
                isEditing
              }
              onClick={onEdit}
            >
              Edit
            </button>

            <button
              type="button"
              className={
                styles.dangerButton
              }
              disabled={
                updating ||
                saving ||
                deleting ||
                isEditing
              }
              onClick={onDelete}
            >
              {deleting
                ? "Deleting..."
                : "Delete"}
            </button>
          </div>
        </td>
      </tr>

      {isEditing && (
        <tr
          className={
            styles.editRow
          }
        >
          <td
            colSpan="6"
            className={
              styles.editCell
            }
          >
            <form
              className={
                styles.inlineEditor
              }
              onSubmit={
                onSubmitEdit
              }
            >
              <div
                className={
                  styles.inlineEditorGrid
                }
              >
                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor={`edit-task-name-${task.id}`}
                  >
                    Task name *
                  </label>

                  <input
                    id={`edit-task-name-${task.id}`}
                    name="task_name"
                    type="text"
                    value={
                      editForm.task_name
                    }
                    onChange={
                      onEditChange
                    }
                    disabled={saving}
                    required
                  />
                </div>

                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor={`edit-task-status-${task.id}`}
                  >
                    Status
                  </label>

                  <select
                    id={`edit-task-status-${task.id}`}
                    name="status"
                    value={
                      editForm.status
                    }
                    onChange={
                      onEditChange
                    }
                    disabled={saving}
                  >
                    {TASK_STATUS_OPTIONS.map(
                      (status) => (
                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {status}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div
                  className={`${styles.field} ${styles.fieldFull}`}
                >
                  <label
                    htmlFor={`edit-task-description-${task.id}`}
                  >
                    Description
                  </label>

                  <textarea
                    id={`edit-task-description-${task.id}`}
                    name="description"
                    value={
                      editForm.description
                    }
                    onChange={
                      onEditChange
                    }
                    rows={4}
                    disabled={saving}
                  />
                </div>

                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor={`edit-task-due-date-${task.id}`}
                  >
                    Due date
                  </label>

                  <input
                    id={`edit-task-due-date-${task.id}`}
                    name="due_date"
                    type="date"
                    value={
                      editForm.due_date
                    }
                    onChange={
                      onEditChange
                    }
                    disabled={saving}
                  />
                </div>
              </div>

              <div
                className={
                  styles.inlineEditorActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={saving}
                  onClick={
                    onCancelEdit
                  }
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
                    ? "Saving task..."
                    : "Save changes"}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function getTaskSubtitle(
  task,
  overdue
) {
  if (overdue) {
    return "Action required";
  }

  const status =
    task.status || "To Do";

  if (status === "Completed") {
    return "Task completed";
  }

  if (status === "Blocked") {
    return "Delivery blocked";
  }

  if (
    status === "In Progress"
  ) {
    return "Work in progress";
  }

  return "Ready to start";
}

function isTaskOverdue(task) {
  if (
    !task.due_date ||
    task.status === "Completed"
  ) {
    return false;
  }

  const dueDate = String(
    task.due_date
  ).includes("T")
    ? new Date(task.due_date)
    : new Date(
        `${task.due_date}T23:59:59`
      );

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    return false;
  }

  return dueDate < new Date();
}

function normaliseDateInput(
  value
) {
  if (!value) {
    return "";
  }

  return String(value).split(
    "T"
  )[0];
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = String(
    value
  ).includes("T")
    ? new Date(value)
    : new Date(
        `${value}T12:00:00`
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
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}
