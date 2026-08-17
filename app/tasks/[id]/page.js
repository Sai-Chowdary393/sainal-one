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

// =========================================================
// OPTIONS
// =========================================================

const TASK_STATUS_OPTIONS = [
  "To Do",
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

// =========================================================
// PAGE
// =========================================================

export default function TaskDetailsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const taskId =
    params?.id;

  // =======================================================
  // TASK
  // =======================================================

  const [
    task,
    setTask,
  ] = useState(null);

  const [
    activity,
    setActivity,
  ] = useState([]);

  // =======================================================
  // EMPLOYEES
  // =======================================================

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

  // =======================================================
  // STATES
  // =======================================================

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    activityLoading,
    setActivityLoading,
  ] = useState(false);

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
    activityError,
    setActivityError,
  ] = useState("");

  const [
    editMode,
    setEditMode,
  ] = useState(false);

  // =======================================================
  // FORM
  // =======================================================

  const [
    formData,
    setFormData,
  ] = useState({
    task_name: "",
    description: "",
    assigned_employee_id: "",
    status: "To Do",
    priority: "Medium",
    due_date: "",
  });

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    if (!taskId) {
      return;
    }

    loadWorkspace();
  }, [
    taskId,
  ]);

  // =======================================================
  // LOAD COMPLETE WORKSPACE
  // =======================================================

  async function loadWorkspace() {
    try {
      setLoading(true);

      setErrorMessage("");

      const [
        taskResponse,
        activityResponse,
        employeesResponse,
      ] =
        await Promise.all([
          fetch(
            `/api/tasks/${taskId}`,
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            `/api/tasks/${taskId}/activity`,
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/employees",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      const [
        taskData,
        activityData,
        employeesData,
      ] =
        await Promise.all([
          taskResponse.json(),

          activityResponse.json(),

          employeesResponse.json(),
        ]);

      // ===================================================
      // TASK
      // ===================================================

      if (
        !taskResponse.ok
      ) {
        throw new Error(
          taskData.error ||
            "Failed to load task."
        );
      }

      const selectedTask =
        taskData?.task ||
        null;

      setTask(
        selectedTask
      );

      if (
        selectedTask
      ) {
        syncFormWithTask(
          selectedTask
        );
      }

      // ===================================================
      // ACTIVITY
      // ===================================================

      if (
        activityResponse.ok
      ) {
        setActivity(
          Array.isArray(
            activityData?.activity
          )
            ? activityData.activity
            : []
        );

        setActivityError(
          ""
        );
      } else {
        setActivity([]);

        setActivityError(
          activityData.error ||
            "Unable to load task activity."
        );
      }

      // ===================================================
      // EMPLOYEES
      // ===================================================

      if (
        employeesResponse.ok
      ) {
        const employeeRows =
          Array.isArray(
            employeesData?.employees
          )
            ? employeesData.employees
            : [];

        const activeEmployees =
          employeeRows
            .filter(
              (employee) =>
                employee?.id &&
                employee?.is_active !==
                  false &&
                normaliseStatus(
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
          employeesData?.currentEmployee ||
            null
        );
      } else {
        console.error(
          "Employee loading error:",
          employeesData?.error
        );

        setEmployees([]);

        setCurrentEmployee(
          null
        );
      }
    } catch (error) {
      console.error(
        "Task workspace loading error:",
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

  // =======================================================
  // REFRESH ACTIVITY
  // =======================================================

  async function fetchActivity() {
    try {
      setActivityLoading(
        true
      );

      setActivityError(
        ""
      );

      const response =
        await fetch(
          `/api/tasks/${taskId}/activity`,
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
            "Unable to load task activity."
        );
      }

      setActivity(
        Array.isArray(
          data?.activity
        )
          ? data.activity
          : []
      );
    } catch (error) {
      console.error(
        "Task activity loading error:",
        error
      );

      setActivityError(
        error.message ||
          "Unable to load task activity."
      );
    } finally {
      setActivityLoading(
        false
      );
    }
  }

  // =======================================================
  // FORM SYNC
  // =======================================================

  function syncFormWithTask(
    selectedTask
  ) {
    setFormData({
      task_name:
        selectedTask.task_name ||
        "",

      description:
        selectedTask.description ||
        "",

      assigned_employee_id:
        selectedTask.assigned_employee_id ||
        "",

      /*
       * Older SaiNal One tasks may still contain "Open".
       * The editor now standardises them to "To Do".
       */
      status:
        getEditableStatus(
          selectedTask.status
        ),

      priority:
        selectedTask.priority ||
        "Medium",

      due_date:
        normaliseDateInput(
          selectedTask.due_date
        ),
    });
  }

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

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

  function cancelEdit() {
    if (
      task
    ) {
      syncFormWithTask(
        task
      );
    }

    setEditMode(
      false
    );
  }

  // =======================================================
  // SAVE TASK
  // =======================================================

  async function saveTask(
    event
  ) {
    event.preventDefault();

    if (
      !formData
        .task_name
        .trim()
    ) {
      alert(
        "Task name is required."
      );

      return;
    }

    try {
      setSaving(true);

      const updatePayload = {
        task_name:
          formData
            .task_name
            .trim(),

        description:
          formData
            .description
            .trim(),

        status:
          formData.status,

        priority:
          formData.priority,

        due_date:
          formData.due_date ||
          null,
      };

      /*
       * Only organisation owners currently have
       * reassignment rights in the backend.
       *
       * Normal employees can still edit their own
       * task fields without accidentally sending an
       * assignment field and receiving a 403.
       */

      if (
        currentEmployee
          ?.is_organization_owner
      ) {
        updatePayload.assigned_employee_id =
          formData.assigned_employee_id ||
          null;
      }

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
                updatePayload
              ),
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

      syncFormWithTask(
        data.task
      );

      setEditMode(
        false
      );

      await fetchActivity();

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

  // =======================================================
  // CHANGE STATUS
  // =======================================================

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

      syncFormWithTask(
        data.task
      );

      await fetchActivity();
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

  // =======================================================
  // DELETE TASK
  // =======================================================

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

      /*
       * Project work should return to the project.
       * Other work returns to My Work.
       */

      if (
        task?.project_id
      ) {
        router.push(
          `/projects/${task.project_id}`
        );
      } else {
        router.push(
          "/follow-ups"
        );
      }
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

  // =======================================================
  // DERIVED VALUES
  // =======================================================

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

  const assignee =
    getAssignee({
      task,
      employees,
    });

  const displayStatus =
    getDisplayStatus(
      task?.status
    );

  const backHref =
    task?.project_id
      ? `/projects/${task.project_id}`
      : "/follow-ups";

  const backLabel =
    task?.project_id
      ? "Back to project"
      : "Back to My Work";

  const canReassign =
    Boolean(
      currentEmployee
        ?.is_organization_owner
    );

  // =======================================================
  // LOADING
  // =======================================================

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

  // =======================================================
  // ERROR
  // =======================================================

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
                loadWorkspace
              }
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // NOT FOUND
  // =======================================================

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
              This task may have been
              deleted or you may not
              have access to it.
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

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          task.task_name ||
          "Task Workspace"
        }
        description="Manage task ownership, progress, priority and related business records."
      >
        <div
          className={
            styles.page
          }
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <Link
                href={
                  backHref
                }
                className={
                  styles.backLink
                }
              >
                ← {backLabel}
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
                Review ownership,
                progress and the
                business context for
                this task.
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
              ) ===
                "open" ||
              normaliseStatus(
                task.status
              ) ===
                "to do" ? (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={
                    saving
                  }
                  onClick={() =>
                    changeStatus(
                      "In Progress"
                    )
                  }
                >
                  Start work
                </button>
              ) : null}

              {normaliseStatus(
                task.status
              ) ===
                "blocked" && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={
                    saving
                  }
                  onClick={() =>
                    changeStatus(
                      "In Progress"
                    )
                  }
                >
                  Resume work
                </button>
              )}

              {normaliseStatus(
                task.status
              ) ===
                "in progress" && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={
                    saving
                  }
                  onClick={() =>
                    changeStatus(
                      "Blocked"
                    )
                  }
                >
                  Block
                </button>
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

              {normaliseStatus(
                task.status
              ) ===
                "completed" && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={
                    saving
                  }
                  onClick={() =>
                    changeStatus(
                      "To Do"
                    )
                  }
                >
                  Reopen
                </button>
              )}
            </div>
          </section>

          {/* =================================================
              HERO
          ================================================= */}

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
                {normaliseStatus(
                  task.status
                ) ===
                "completed"
                  ? "✓"
                  : "☑"}
              </span>

              <div>
                <span
                  className={
                    styles.heroLabel
                  }
                >
                  {workflowGenerated
                    ? "Workflow generated"
                    : task.project_id
                      ? "Project task"
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
                      displayStatus
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

                  <span
                    className={
                      styles.priorityBadge
                    }
                  >
                    Assigned to{" "}
                    {assignee.name}
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

          {/* =================================================
              EDIT
          ================================================= */}

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
                    Update ownership,
                    delivery status,
                    priority and task
                    details.
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
                {/* TASK NAME */}

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
                    disabled={
                      saving
                    }
                    required
                  />
                </label>

                {/* ASSIGNED TO */}

                <label>
                  <span>
                    Assigned to
                  </span>

                  {canReassign ? (
                    <select
                      name="assigned_employee_id"
                      value={
                        formData.assigned_employee_id ||
                        ""
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
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
                            {formatEmployeeOption(
                              employee,
                              currentEmployee
                            )}
                          </option>
                        )
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={
                        assignee.name
                      }
                      disabled
                      readOnly
                    />
                  )}
                </label>

                {/* STATUS */}

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
                </label>

                {/* PRIORITY */}

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
                    disabled={
                      saving
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

                {/* DUE DATE */}

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
                    disabled={
                      saving
                    }
                  />
                </label>

                {/* DESCRIPTION */}

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
                    rows={
                      5
                    }
                    disabled={
                      saving
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
                    onClick={
                      cancelEdit
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
              {/* =================================================
                  INFORMATION
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
                      Task information
                    </h3>

                    <p>
                      Ownership, status,
                      priority and
                      schedule.
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
                          displayStatus
                        }
                      />
                    }
                  />

                  <DetailRow
                    label="Assigned to"
                    value={
                      assignee.name
                    }
                  />

                  {assignee.subtitle && (
                    <DetailRow
                      label="Role"
                      value={
                        assignee.subtitle
                      }
                    />
                  )}

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

              {/* =================================================
                  LINKAGE
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
                      Source & linkage
                    </h3>

                    <p>
                      Where this task came
                      from and what it
                      relates to.
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
                        : task.project_id
                          ? "Project task"
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
                          Open related
                          record →
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

          {/* =================================================
              DESCRIPTION
          ================================================= */}

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

          {/* =================================================
              ACTIVITY
          ================================================= */}

          <section
            className={
              styles.activityPanel
            }
          >
            <div
              className={
                styles.activityHeader
              }
            >
              <div>
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  Audit trail
                </span>

                <h3>
                  Task activity
                </h3>

                <p>
                  Track ownership,
                  status, priority,
                  schedule and other
                  changes.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  fetchActivity
                }
                disabled={
                  activityLoading
                }
              >
                {activityLoading
                  ? "Refreshing..."
                  : "Refresh activity"}
              </button>
            </div>

            {activityError && (
              <div
                className={
                  styles.activityError
                }
              >
                {activityError}
              </div>
            )}

            <div
              className={
                styles.timeline
              }
            >
              {/* SYNTHETIC CREATION EVENT */}

              <ActivityItem
                icon="+"
                title={
                  workflowGenerated
                    ? "Task created by workflow"
                    : task.project_id
                      ? "Project task created"
                      : "Task created"
                }
                message={
                  workflowGenerated
                    ? "SaiNal One workflow automation created this task."
                    : task.project_id
                      ? "This task was created as part of project delivery."
                      : "This task was created in SaiNal One."
                }
                actor={
                  workflowGenerated
                    ? "Workflow automation"
                    : "SaiNal One"
                }
                createdAt={
                  task.created_at
                }
                isFirst={
                  activity.length ===
                  0
                }
              />

              {[
                ...activity,
              ]
                .reverse()
                .map(
                  (
                    item,
                    index
                  ) => (
                    <ActivityItem
                      key={
                        item.id
                      }
                      icon={getActivityIcon(
                        item.activity_type
                      )}
                      title={getActivityTitle(
                        item
                      )}
                      message={getReadableActivityMessage({
                        item,
                        employees,
                      })}
                      actor={
                        item.employee
                          ?.full_name ||
                        item.employee
                          ?.email ||
                        "SaiNal One user"
                      }
                      createdAt={
                        item.created_at
                      }
                      isFirst={
                        index ===
                        activity.length -
                          1
                      }
                    />
                  )
                )}
            </div>
          </section>

          {/* =================================================
              DELETE
          ================================================= */}

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
                Permanently remove
                this task from SaiNal
                One.
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

// =========================================================
// DETAIL ROW
// =========================================================

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

// =========================================================
// ACTIVITY ITEM
// =========================================================

function ActivityItem({
  icon,
  title,
  message,
  actor,
  createdAt,
  isFirst,
}) {
  return (
    <div
      className={
        styles.timelineItem
      }
    >
      <div
        className={
          styles.timelineRail
        }
      >
        <span
          className={
            styles.timelineIcon
          }
        >
          {icon}
        </span>

        {!isFirst && (
          <span
            className={
              styles.timelineLine
            }
          />
        )}
      </div>

      <div
        className={
          styles.timelineContent
        }
      >
        <div
          className={
            styles.timelineTop
          }
        >
          <strong>
            {title}
          </strong>

          <span>
            {formatDateTime(
              createdAt
            )}
          </span>
        </div>

        <p>
          {message}
        </p>

        <small>
          {actor}
        </small>
      </div>
    </div>
  );
}

// =========================================================
// LOADING
// =========================================================

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
// ASSIGNEE
// =========================================================

function getAssignee({
  task,
  employees,
}) {
  if (
    !task?.assigned_employee_id
  ) {
    return {
      name:
        "Unassigned",

      subtitle:
        null,
    };
  }

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

  /*
   * Some task endpoints may later return employee
   * enrichment directly. Support that as well.
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

  return {
    name:
      "Assigned employee",

    subtitle:
      null,
  };
}

function formatEmployeeOption(
  employee,
  currentEmployee
) {
  const name =
    employee.full_name ||
    employee.email ||
    employee.employee_number ||
    "Employee";

  const role =
    employee.job_title
      ? ` — ${employee.job_title}`
      : "";

  const you =
    currentEmployee?.id &&
    String(
      employee.id
    ) ===
      String(
        currentEmployee.id
      )
      ? " (You)"
      : "";

  return `${name}${role}${you}`;
}

// =========================================================
// ACTIVITY
// =========================================================

function getReadableActivityMessage({
  item,
  employees,
}) {
  if (
    item?.field_name !==
    "assigned_employee_id"
  ) {
    return (
      item?.message ||
      "Task updated."
    );
  }

  const oldEmployeeName =
    getEmployeeNameFromId(
      item.old_value,
      employees
    );

  const newEmployeeName =
    getEmployeeNameFromId(
      item.new_value,
      employees
    );

  if (
    !item.old_value &&
    item.new_value
  ) {
    return `Task assigned to ${newEmployeeName}.`;
  }

  if (
    item.old_value &&
    !item.new_value
  ) {
    return `Task unassigned from ${oldEmployeeName}.`;
  }

  if (
    item.old_value &&
    item.new_value
  ) {
    return `Task reassigned from ${oldEmployeeName} to ${newEmployeeName}.`;
  }

  return (
    item.message ||
    "Task assignment changed."
  );
}

function getEmployeeNameFromId(
  employeeId,
  employees
) {
  if (!employeeId) {
    return "Unassigned";
  }

  const employee =
    employees.find(
      (
        item
      ) =>
        String(
          item.id
        ) ===
        String(
          employeeId
        )
    );

  if (!employee) {
    /*
     * Do not expose a long UUID in the UI.
     */
    return "another employee";
  }

  return (
    employee.full_name ||
    employee.email ||
    "employee"
  );
}

// =========================================================
// STATUS
// =========================================================

function normaliseStatus(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function getEditableStatus(
  value
) {
  const status =
    normaliseStatus(
      value
    );

  /*
   * Legacy status migration at UI level.
   */

  if (
    status ===
    "open"
  ) {
    return "To Do";
  }

  if (
    status ===
    "in progress"
  ) {
    return "In Progress";
  }

  if (
    status ===
    "blocked"
  ) {
    return "Blocked";
  }

  if (
    status ===
    "completed" ||
    status ===
    "complete" ||
    status ===
    "done"
  ) {
    return "Completed";
  }

  return "To Do";
}

function getDisplayStatus(
  value
) {
  return getEditableStatus(
    value
  );
}

// =========================================================
// DATE
// =========================================================

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

// =========================================================
// RELATED RECORD
// =========================================================

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

// =========================================================
// DUE STATE
// =========================================================

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

// =========================================================
// ACTIVITY ICON
// =========================================================

function getActivityIcon(
  type
) {
  switch (
    String(
      type || ""
    ).toLowerCase()
  ) {
    case "task_completed":
      return "✓";

    case "status_changed":
      return "↻";

    case "assignment_changed":
      return "→";

    case "field_changed":
      return "•";

    default:
      return "•";
  }
}

// =========================================================
// ACTIVITY TITLE
// =========================================================

function getActivityTitle(
  activity
) {
  switch (
    String(
      activity
        ?.activity_type ||
        ""
    ).toLowerCase()
  ) {
    case "task_completed":
      return "Task completed";

    case "status_changed":
      return "Status changed";

    case "assignment_changed":
      return "Assignment changed";

    case "field_changed":
      if (
        activity.field_name ===
        "priority"
      ) {
        return "Priority changed";
      }

      if (
        activity.field_name ===
        "due_date"
      ) {
        return "Due date changed";
      }

      if (
        activity.field_name ===
        "task_name"
      ) {
        return "Task renamed";
      }

      if (
        activity.field_name ===
        "description"
      ) {
        return "Description updated";
      }

      return "Task updated";

    default:
      return "Task updated";
  }
}
