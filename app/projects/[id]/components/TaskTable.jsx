"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

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
  assigned_employee_id: "",
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
  const [
    editingTaskId,
    setEditingTaskId,
  ] = useState(null);

  const [
    editForm,
    setEditForm,
  ] = useState(
    EMPTY_EDIT_FORM
  );

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

  const [
    loadingEmployees,
    setLoadingEmployees,
  ] = useState(false);

  // =======================================================
  // LOAD EMPLOYEES
  // =======================================================

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      setLoadingEmployees(
        true
      );

      const response =
        await fetch(
          "/api/employees",
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
            "Failed to load employees."
        );
      }

      const employeeRows =
        Array.isArray(
          data?.employees
        )
          ? data.employees
          : [];

      const activeEmployees =
        employeeRows
          .filter(
            (
              employee
            ) =>
              employee?.id &&
              employee
                ?.is_active !==
                false &&
              normaliseValue(
                employee
                  ?.employment_status
              ) !==
                "inactive"
          )
          .sort(
            (
              first,
              second
            ) =>
              String(
                first.full_name ||
                  first.email ||
                  ""
              ).localeCompare(
                String(
                  second.full_name ||
                    second.email ||
                    ""
                )
              )
          );

      setEmployees(
        activeEmployees
      );

      setCurrentEmployee(
        data?.currentEmployee ||
          null
      );
    } catch (error) {
      console.error(
        "Task employee loading error:",
        error
      );

      setEmployees([]);
      setCurrentEmployee(
        null
      );
    } finally {
      setLoadingEmployees(
        false
      );
    }
  }

  // =======================================================
  // EDITING
  // =======================================================

  useEffect(() => {
    if (
      editingTaskId &&
      !tasks.some(
        (task) =>
          String(
            task.id
          ) ===
          String(
            editingTaskId
          )
      )
    ) {
      cancelEditing();
    }
  }, [
    tasks,
    editingTaskId,
  ]);

  function startEditing(
    task
  ) {
    setEditingTaskId(
      task.id
    );

    setEditForm({
      task_name:
        task.task_name ||
        "",

      description:
        task.description ||
        "",

      status:
        task.status ||
        "To Do",

      due_date:
        normaliseDateInput(
          task.due_date
        ),

      assigned_employee_id:
        task.assigned_employee_id ||
        "",
    });
  }

  function cancelEditing() {
    setEditingTaskId(
      null
    );

    setEditForm(
      EMPTY_EDIT_FORM
    );
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
        currentForm
      ) => ({
        ...currentForm,

        [name]:
          value,
      })
    );
  }

  async function submitEdit(
    event
  ) {
    event.preventDefault();

    if (
      !editingTaskId
    ) {
      return;
    }

    if (
      !editForm
        .task_name
        .trim()
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
            editForm
              .task_name
              .trim(),

          description:
            editForm
              .description
              .trim(),

          status:
            editForm.status,

          due_date:
            editForm.due_date ||
            null,

          /*
           * Empty string deliberately becomes NULL.
           *
           * This allows an organisation owner
           * to make an existing task Unassigned.
           */
          assigned_employee_id:
            editForm.assigned_employee_id ||
            null,
        }
      );

    if (
      saved !==
      false
    ) {
      cancelEditing();
    }
  }

  // =======================================================
  // EMPTY STATE
  // =======================================================

  if (
    tasks.length ===
    0
  ) {
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
          Add a task manually or
          generate the default project
          workflow to begin tracking
          delivery progress.
        </p>

        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={
            onAddTask
          }
        >
          Add first task
        </button>
      </div>
    );
  }

  // =======================================================
  // TASK TABLE
  // =======================================================

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
            <th>
              Task
            </th>

            <th>
              Description
            </th>

            <th>
              Assigned to
            </th>

            <th>
              Status
            </th>

            <th>
              Due date
            </th>

            <th>
              Created
            </th>

            <th>
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {tasks.map(
            (task) => {
              const isEditing =
                String(
                  editingTaskId
                ) ===
                String(
                  task.id
                );

              const overdue =
                isTaskOverdue(
                  task
                );

              return (
                <TaskRows
                  key={
                    task.id
                  }
                  task={
                    task
                  }
                  overdue={
                    overdue
                  }
                  isEditing={
                    isEditing
                  }
                  editForm={
                    editForm
                  }
                  employees={
                    employees
                  }
                  currentEmployee={
                    currentEmployee
                  }
                  loadingEmployees={
                    loadingEmployees
                  }
                  updating={
                    String(
                      updatingTaskId
                    ) ===
                    String(
                      task.id
                    )
                  }
                  deleting={
                    String(
                      deletingTaskId
                    ) ===
                    String(
                      task.id
                    )
                  }
                  saving={
                    String(
                      savingTaskId
                    ) ===
                    String(
                      task.id
                    )
                  }
                  onEdit={() =>
                    startEditing(
                      task
                    )
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
            }
          )}
        </tbody>
      </table>
    </div>
  );
}

// =========================================================
// TASK ROW
// =========================================================

function TaskRows({
  task,
  overdue,
  isEditing,
  editForm,
  employees,
  currentEmployee,
  loadingEmployees,
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
  const status =
    normaliseTaskStatus(
      task.status
    );

  const busy =
    updating ||
    saving ||
    deleting ||
    isEditing;

  const assignee =
    getAssignee({
      task,
      employees,
    });

  return (
    <>
      <tr>
        {/* TASK */}

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
              {status ===
              "completed"
                ? "✓"
                : status ===
                    "blocked"
                  ? "!"
                  : "□"}
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

        {/* DESCRIPTION */}

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

        {/* ASSIGNEE */}

        <td>
          <div>
            <strong>
              {assignee.name}
            </strong>

            {assignee.subtitle && (
              <div
                className={
                  styles.taskDescription
                }
              >
                {assignee.subtitle}
              </div>
            )}
          </div>
        </td>

        {/* STATUS */}

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
              busy
            }
            onChange={(
              event
            ) =>
              onUpdateStatus(
                event.target
                  .value
              )
            }
            aria-label={`Update status for ${
              task.task_name ||
              "task"
            }`}
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
        </td>

        {/* DUE DATE */}

        <td>
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
        </td>

        {/* CREATED */}

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

        {/* ACTIONS */}

        <td>
          <div
            className={
              styles.taskActions
            }
          >
            <TaskStatusActions
              status={
                status
              }
              disabled={
                busy
              }
              updating={
                updating
              }
              onUpdateStatus={
                onUpdateStatus
              }
            />

            <Link
              href={`/follow-ups/${task.id}`}
              className={
                styles.smallButton
              }
            >
              Open task →
            </Link>

            <button
              type="button"
              className={
                styles.smallButton
              }
              disabled={
                busy
              }
              onClick={
                onEdit
              }
            >
              Edit
            </button>

            <button
              type="button"
              className={
                styles.dangerButton
              }
              disabled={
                busy
              }
              onClick={
                onDelete
              }
            >
              {deleting
                ? "Deleting..."
                : "Delete"}
            </button>
          </div>
        </td>
      </tr>

      {/* INLINE EDITOR */}

      {isEditing && (
        <tr
          className={
            styles.editRow
          }
        >
          <td
            colSpan="7"
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
                {/* NAME */}

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
                      editForm
                        .task_name
                    }
                    onChange={
                      onEditChange
                    }
                    disabled={
                      saving
                    }
                    required
                  />
                </div>

                {/* ASSIGNED TO */}

                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor={`edit-task-assignee-${task.id}`}
                  >
                    Assigned to
                  </label>

                  <select
                    id={`edit-task-assignee-${task.id}`}
                    name="assigned_employee_id"
                    value={
                      editForm.assigned_employee_id ||
                      ""
                    }
                    onChange={
                      onEditChange
                    }
                    disabled={
                      saving ||
                      loadingEmployees
                    }
                  >
                    <option value="">
                      {loadingEmployees
                        ? "Loading employees..."
                        : "Unassigned"}
                    </option>

                    {employees.map(
                      (
                        employee
                      ) => {
                        const employeeName =
                          employee.full_name ||
                          employee.email ||
                          employee.employee_number ||
                          "Employee";

                        const isCurrentEmployee =
                          currentEmployee?.id &&
                          String(
                            employee.id
                          ) ===
                            String(
                              currentEmployee.id
                            );

                        return (
                          <option
                            key={
                              employee.id
                            }
                            value={
                              employee.id
                            }
                          >
                            {employeeName}

                            {employee.job_title
                              ? ` — ${employee.job_title}`
                              : ""}

                            {isCurrentEmployee
                              ? " (You)"
                              : ""}
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>

                {/* STATUS */}

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
                    disabled={
                      saving
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
                </div>

                {/* DUE DATE */}

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
                      editForm
                        .due_date
                    }
                    onChange={
                      onEditChange
                    }
                    disabled={
                      saving
                    }
                  />
                </div>

                {/* DESCRIPTION */}

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
                      editForm
                        .description
                    }
                    onChange={
                      onEditChange
                    }
                    rows={
                      4
                    }
                    disabled={
                      saving
                    }
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
                  disabled={
                    saving
                  }
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
                  disabled={
                    saving
                  }
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

// =========================================================
// QUICK STATUS ACTIONS
// =========================================================

function TaskStatusActions({
  status,
  disabled,
  updating,
  onUpdateStatus,
}) {
  if (
    updating
  ) {
    return (
      <button
        type="button"
        className={
          styles.smallButton
        }
        disabled
      >
        Updating...
      </button>
    );
  }

  if (
    status ===
    "to do"
  ) {
    return (
      <button
        type="button"
        className={
          styles.successButton
        }
        disabled={
          disabled
        }
        onClick={() =>
          onUpdateStatus(
            "In Progress"
          )
        }
      >
        Start work
      </button>
    );
  }

  if (
    status ===
    "in progress"
  ) {
    return (
      <>
        <button
          type="button"
          className={
            styles.successButton
          }
          disabled={
            disabled
          }
          onClick={() =>
            onUpdateStatus(
              "Completed"
            )
          }
        >
          Mark completed
        </button>

        <button
          type="button"
          className={
            styles.warningButton
          }
          disabled={
            disabled
          }
          onClick={() =>
            onUpdateStatus(
              "Blocked"
            )
          }
        >
          Block
        </button>
      </>
    );
  }

  if (
    status ===
    "blocked"
  ) {
    return (
      <button
        type="button"
        className={
          styles.warningButton
        }
        disabled={
          disabled
        }
        onClick={() =>
          onUpdateStatus(
            "In Progress"
          )
        }
      >
        Resume work
      </button>
    );
  }

  if (
    status ===
    "completed"
  ) {
    return (
      <button
        type="button"
        className={
          styles.secondaryButton
        }
        disabled={
          disabled
        }
        onClick={() =>
          onUpdateStatus(
            "To Do"
          )
        }
      >
        Reopen
      </button>
    );
  }

  return null;
}

// =========================================================
// ASSIGNEE
// =========================================================

function getAssignee({
  task,
  employees,
}) {
  /*
   * The newer /api/tasks response already
   * enriches tasks with assigned_employee.
   */

  if (
    task.assigned_employee
  ) {
    return {
      name:
        task.assigned_employee
          .full_name ||
        task.assigned_employee
          .email ||
        "Assigned employee",

      subtitle:
        task.assigned_employee
          .job_title ||
        null,
    };
  }

  /*
   * Fallback to the employee directory.
   */

  if (
    task.assigned_employee_id
  ) {
    const employee =
      employees.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            task.assigned_employee_id
          )
      );

    if (employee) {
      return {
        name:
          employee.full_name ||
          employee.email ||
          "Assigned employee",

        subtitle:
          employee.job_title ||
          null,
      };
    }

    return {
      name:
        "Assigned employee",

      subtitle:
        null,
    };
  }

  return {
    name:
      "Unassigned",

    subtitle:
      null,
  };
}

// =========================================================
// TASK SUBTITLE
// =========================================================

function getTaskSubtitle(
  task,
  overdue
) {
  if (
    overdue
  ) {
    return "Action required";
  }

  const status =
    normaliseTaskStatus(
      task.status
    );

  if (
    status ===
    "completed"
  ) {
    return "Task completed";
  }

  if (
    status ===
    "blocked"
  ) {
    return "Delivery blocked";
  }

  if (
    status ===
    "in progress"
  ) {
    return "Work in progress";
  }

  return "Ready to start";
}

// =========================================================
// OVERDUE
// =========================================================

function isTaskOverdue(
  task
) {
  if (
    !task.due_date ||
    normaliseTaskStatus(
      task.status
    ) ===
      "completed"
  ) {
    return false;
  }

  const dueDate =
    String(
      task.due_date
    ).includes(
      "T"
    )
      ? new Date(
          task.due_date
        )
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

  return (
    dueDate <
    new Date()
  );
}

// =========================================================
// DATE INPUT
// =========================================================

function normaliseDateInput(
  value
) {
  if (
    !value
  ) {
    return "";
  }

  return String(
    value
  ).split(
    "T"
  )[0];
}

// =========================================================
// NORMALISE
// =========================================================

function normaliseTaskStatus(
  value
) {
  return String(
    value ||
      "To Do"
  )
    .trim()
    .toLowerCase();
}

function normaliseValue(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

// =========================================================
// DATE DISPLAY
// =========================================================

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "Not set";
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
