"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";

import styles from "./follow-ups.module.css";

const EMPTY_FORM = {
  related_type: "General",
  title: "",
  note: "",
  due_date: "",
  status: "Pending",
};

const RELATED_TYPE_OPTIONS = [
  "General",
  "Lead",
  "Quote",
  "Customer",
  "Project",
  "Invoice",
];

const FOLLOW_UP_STATUS_OPTIONS = [
  "Pending",
  "Completed",
];

const TASK_STATUS_OPTIONS = [
  "Open",
  "In Progress",
  "Blocked",
  "Completed",
];

const WORK_FILTERS = [
  "All",
  "Tasks",
  "Follow-ups",
];

export default function FollowUpsPage() {
  const [
    followUps,
    setFollowUps,
  ] = useState([]);

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
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
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    searchValue,
    setSearchValue,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("All");

  const [
    workFilter,
    setWorkFilter,
  ] = useState("All");

  const [
    formData,
    setFormData,
  ] = useState(
    EMPTY_FORM
  );

  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {
    fetchWork();
  }, []);

  useEffect(() => {
    try {
      const searchParams =
        new URLSearchParams(
          window.location.search
        );

      if (
        searchParams.get(
          "create"
        ) === "true"
      ) {
        setShowForm(true);

        window.history.replaceState(
          {},
          "",
          window.location.pathname
        );
      }
    } catch (error) {
      console.error(
        "Unable to read work parameters:",
        error
      );
    }
  }, []);

  // =======================================================
  // LOAD TASKS + FOLLOW UPS
  // =======================================================

  async function fetchWork() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        followUpResponse,
        taskResponse,
      ] = await Promise.all([
        fetch(
          "/api/follow-ups",
          {
            cache:
              "no-store",
          }
        ),

        fetch(
          "/api/tasks",
          {
            cache:
              "no-store",
          }
        ),
      ]);

      const [
        followUpData,
        taskData,
      ] = await Promise.all([
        followUpResponse.json(),
        taskResponse.json(),
      ]);

      if (
        !followUpResponse.ok
      ) {
        throw new Error(
          followUpData.error ||
            "Failed to load follow-ups."
        );
      }

      if (
        !taskResponse.ok
      ) {
        throw new Error(
          taskData.error ||
            "Failed to load tasks."
        );
      }

      setFollowUps(
        Array.isArray(
          followUpData
        )
          ? followUpData
          : []
      );

      setTasks(
        extractTasksFromResponse(
          taskData
        )
      );

      setCurrentEmployee(
        !Array.isArray(
          taskData
        )
          ? taskData?.currentEmployee ||
              null
          : null
      );
    } catch (error) {
      console.error(
        "My Work loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load your work."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // CREATE FOLLOW UP
  // =======================================================

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (
        currentForm
      ) => ({
        ...currentForm,

        [name]:
          value,
      })
    );
  }

  function openCreateForm() {
    setFormData(
      EMPTY_FORM
    );

    setShowForm(true);
  }

  function closeCreateForm() {
    setFormData(
      EMPTY_FORM
    );

    setShowForm(false);
  }

  async function createFollowUp(
    event
  ) {
    event.preventDefault();

    const cleanTitle =
      formData.title.trim();

    if (!cleanTitle) {
      alert(
        "Please enter a follow-up title."
      );

      return;
    }

    try {
      setSaving(true);

      const response =
        await fetch(
          "/api/follow-ups",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                related_type:
                  formData.related_type ||
                  "General",

                title:
                  cleanTitle,

                note:
                  formData.note.trim(),

                due_date:
                  formData.due_date ||
                  null,

                status:
                  formData.status ||
                  "Pending",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create follow-up."
        );
      }

      const created =
        Array.isArray(
          data
        )
          ? data[0]
          : data;

      if (created) {
        setFollowUps(
          (
            current
          ) => [
            created,
            ...current,
          ]
        );
      } else {
        await fetchWork();
      }

      closeCreateForm();

      alert(
        "Follow-up created successfully."
      );
    } catch (error) {
      console.error(
        "Follow-up creation error:",
        error
      );

      alert(
        error.message ||
          "Error creating follow-up."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // FOLLOW-UP STATUS
  // =======================================================

  async function updateFollowUpStatus(
    id,
    status
  ) {
    try {
      const response =
        await fetch(
          `/api/follow-ups/${id}`,
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
            "Failed to update follow-up."
        );
      }

      const updated =
        Array.isArray(data)
          ? data[0]
          : data;

      setFollowUps(
        (
          current
        ) =>
          current.map(
            (
              followUp
            ) =>
              String(
                followUp.id
              ) ===
              String(id)
                ? {
                    ...followUp,
                    ...updated,
                    status,
                  }
                : followUp
          )
      );
    } catch (error) {
      console.error(
        "Follow-up status error:",
        error
      );

      alert(
        error.message ||
          "Error updating follow-up."
      );

      await fetchWork();
    }
  }

  // =======================================================
  // TASK STATUS
  // =======================================================

  async function updateTaskStatus(
    id,
    status
  ) {
    try {
      const response =
        await fetch(
          `/api/tasks/${id}`,
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
            "Failed to update task."
        );
      }

      const updatedTask =
        extractTaskFromResponse(
          data
        );

      if (!updatedTask) {
        await fetchWork();

        return;
      }

      setTasks(
        (
          current
        ) =>
          current.map(
            (task) =>
              String(
                task.id
              ) ===
              String(id)
                ? {
                    ...task,
                    ...updatedTask,
                  }
                : task
          )
      );
    } catch (error) {
      console.error(
        "Task status error:",
        error
      );

      alert(
        error.message ||
          "Error updating task."
      );

      await fetchWork();
    }
  }

  // =======================================================
  // DELETE FOLLOW UP
  // =======================================================

  async function deleteFollowUp(
    id
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this follow-up?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/follow-ups/${id}`,
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
            "Failed to delete follow-up."
        );
      }

      setFollowUps(
        (
          current
        ) =>
          current.filter(
            (
              followUp
            ) =>
              String(
                followUp.id
              ) !==
              String(id)
          )
      );
    } catch (error) {
      console.error(
        "Follow-up deletion error:",
        error
      );

      alert(
        error.message ||
          "Error deleting follow-up."
      );
    }
  }

  // =======================================================
  // DELETE TASK
  // =======================================================

  async function deleteTask(
    id
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this task?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/tasks/${id}`,
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

      setTasks(
        (
          current
        ) =>
          current.filter(
            (task) =>
              String(
                task.id
              ) !==
              String(id)
          )
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

      await fetchWork();
    }
  }

  // =======================================================
  // NORMALISE INTO ONE WORK LIST
  // =======================================================

  const workItems =
    useMemo(() => {
      const taskItems =
        tasks.map(
          (task) => ({
            id:
              task.id,

            itemType:
              "Task",

            title:
              task.task_name ||
              "Untitled task",

            description:
              task.description ||
              "",

            relatedType:
              task.record_type
                ? formatRecordType(
                    task.record_type
                  )
                : task.project_id
                  ? "Project"
                  : "General",

            status:
              task.status ||
              "Open",

            dueDate:
              task.due_date,

            createdAt:
              task.created_at,

            priority:
              task.priority ||
              "Medium",

            recordType:
              task.record_type,

            recordId:
              task.record_id,

            workflowRunId:
              task.workflow_run_id,

            assignedEmployeeId:
              task.assigned_employee_id,

            automatic:
              Boolean(
                task.workflow_run_id
              ),

            source:
              task,
          })
        );

      const followUpItems =
        followUps.map(
          (followUp) => ({
            id:
              followUp.id,

            itemType:
              "Follow-up",

            title:
              followUp.title ||
              "Untitled follow-up",

            description:
              followUp.note ||
              "",

            relatedType:
              followUp.related_type ||
              "General",

            status:
              followUp.status ||
              "Pending",

            dueDate:
              followUp.due_date,

            createdAt:
              followUp.created_at,

            priority:
              null,

            recordType:
              null,

            recordId:
              null,

            workflowRunId:
              null,

            assignedEmployeeId:
              null,

            automatic:
              false,

            source:
              followUp,
          })
        );

      return [
        ...taskItems,
        ...followUpItems,
      ];
    }, [
      tasks,
      followUps,
    ]);

  // =======================================================
  // FILTERING
  // =======================================================

  const filteredWork =
    useMemo(() => {
      const search =
        searchValue
          .trim()
          .toLowerCase();

      return workItems
        .filter(
          (item) => {
            const matchesSearch =
              !search ||
              [
                item.title,
                item.description,
                item.relatedType,
                item.status,
                item.priority,
                item.itemType,
              ].some(
                (
                  value
                ) =>
                  String(
                    value ||
                      ""
                  )
                    .toLowerCase()
                    .includes(
                      search
                    )
              );

            const matchesWorkType =
              workFilter ===
                "All" ||
              (
                workFilter ===
                  "Tasks" &&
                item.itemType ===
                  "Task"
              ) ||
              (
                workFilter ===
                  "Follow-ups" &&
                item.itemType ===
                  "Follow-up"
              );

            const matchesStatus =
              statusFilter ===
                "All" ||
              normaliseStatus(
                item.status
              ) ===
                normaliseStatus(
                  statusFilter
                );

            const matchesType =
              typeFilter ===
                "All" ||
              normaliseStatus(
                item.relatedType
              ) ===
                normaliseStatus(
                  typeFilter
                );

            return (
              matchesSearch &&
              matchesWorkType &&
              matchesStatus &&
              matchesType
            );
          }
        )
        .sort(
          sortWorkItems
        );
    }, [
      workItems,
      searchValue,
      workFilter,
      statusFilter,
      typeFilter,
    ]);

  // =======================================================
  // SUMMARY
  // =======================================================

  const openCount =
    workItems.filter(
      (item) =>
        !isCompleted(
          item.status
        )
    ).length;

  const completedCount =
    workItems.filter(
      (item) =>
        isCompleted(
          item.status
        )
    ).length;

  const overdueCount =
    workItems.filter(
      isWorkItemOverdue
    ).length;

  const todayCount =
    workItems.filter(
      (item) =>
        !isCompleted(
          item.status
        ) &&
        isToday(
          item.dueDate
        )
    ).length;

  const workflowTaskCount =
    workItems.filter(
      (item) =>
        item.itemType ===
          "Task" &&
        item.automatic
    ).length;

  const filtersActive =
    Boolean(
      searchValue
    ) ||
    statusFilter !==
      "All" ||
    typeFilter !==
      "All" ||
    workFilter !==
      "All";

  function clearFilters() {
    setSearchValue("");

    setStatusFilter(
      "All"
    );

    setTypeFilter(
      "All"
    );

    setWorkFilter(
      "All"
    );
  }

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="My Work"
        description="Manage tasks, follow-ups and workflow-generated actions from one workspace."
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
                styles.pageHeaderCopy
              }
            >
              <span
                className={
                  styles.eyebrow
                }
              >
                Action workspace
              </span>

              <h2>
                My Work
              </h2>

              <p>
                Review tasks,
                customer follow-ups
                and actions created
                automatically by
                SaiNal One workflows.
              </p>

              {currentEmployee && (
                <small>
                  Showing tasks assigned
                  to{" "}
                  <strong>
                    {currentEmployee.full_name ||
                      currentEmployee.email ||
                      "you"}
                  </strong>
                </small>
              )}
            </div>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={
                showForm
                  ? closeCreateForm
                  : openCreateForm
              }
            >
              <span>
                {showForm
                  ? "×"
                  : "+"}
              </span>

              {showForm
                ? "Close form"
                : "Create follow-up"}
            </button>
          </section>

          {showForm && (
            <section
              className={
                styles.formPanel
              }
            >
              <div
                className={
                  styles.formHeading
                }
              >
                <h3>
                  Create a new
                  follow-up
                </h3>

                <p>
                  Add an action,
                  reminder, note and
                  due date.
                </p>
              </div>

              <form
                className={
                  styles.followUpForm
                }
                onSubmit={
                  createFollowUp
                }
              >
                <div
                  className={
                    styles.formGrid
                  }
                >
                  <div
                    className={
                      styles.field
                    }
                  >
                    <label htmlFor="follow-up-type">
                      Related area
                    </label>

                    <select
                      id="follow-up-type"
                      name="related_type"
                      value={
                        formData.related_type
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    >
                      {RELATED_TYPE_OPTIONS.map(
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
                            {
                              option
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label htmlFor="follow-up-status">
                      Status
                    </label>

                    <select
                      id="follow-up-status"
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
                      {FOLLOW_UP_STATUS_OPTIONS.map(
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
                  </div>

                  <div
                    className={`${styles.field} ${styles.fieldFull}`}
                  >
                    <label htmlFor="follow-up-title">
                      Follow-up title *
                    </label>

                    <input
                      id="follow-up-title"
                      name="title"
                      type="text"
                      value={
                        formData.title
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: Call customer about proposal approval"
                      disabled={
                        saving
                      }
                      required
                    />
                  </div>

                  <div
                    className={`${styles.field} ${styles.fieldFull}`}
                  >
                    <label htmlFor="follow-up-note">
                      Notes
                    </label>

                    <textarea
                      id="follow-up-note"
                      name="note"
                      value={
                        formData.note
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Add context or the expected next action."
                      rows={5}
                      disabled={
                        saving
                      }
                    />
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label htmlFor="follow-up-due-date">
                      Due date
                    </label>

                    <input
                      id="follow-up-due-date"
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
                      closeCreateForm
                    }
                    disabled={
                      saving
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
                      ? "Saving follow-up..."
                      : "Save follow-up"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="◷"
              label="Open work"
              value={
                openCount
              }
              detail="Tasks and follow-ups"
              tone="Gold"
            />

            <SummaryCard
              icon="!"
              label="Overdue"
              value={
                overdueCount
              }
              detail="Require attention"
              tone="Red"
            />

            <SummaryCard
              icon="○"
              label="Due today"
              value={
                todayCount
              }
              detail="Today's commitments"
              tone="Blue"
            />

            <SummaryCard
              icon="✓"
              label="Completed"
              value={
                completedCount
              }
              detail={`${workflowTaskCount} workflow task${
                workflowTaskCount ===
                1
                  ? ""
                  : "s"
              } created`}
              tone="Green"
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
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search tasks, follow-ups, records or status..."
                value={
                  searchValue
                }
                onChange={(
                  event
                ) =>
                  setSearchValue(
                    event
                      .target
                      .value
                  )
                }
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
                value={
                  workFilter
                }
                onChange={(
                  event
                ) =>
                  setWorkFilter(
                    event
                      .target
                      .value
                  )
                }
              >
                {WORK_FILTERS.map(
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
                      {
                        option
                      }
                    </option>
                  )
                )}
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
                  setStatusFilter(
                    event
                      .target
                      .value
                  )
                }
              >
                <option value="All">
                  All statuses
                </option>

                <option value="Open">
                  Open
                </option>

                <option value="Pending">
                  Pending
                </option>

                <option value="In Progress">
                  In Progress
                </option>

                <option value="Blocked">
                  Blocked
                </option>

                <option value="Completed">
                  Completed
                </option>
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={
                  typeFilter
                }
                onChange={(
                  event
                ) =>
                  setTypeFilter(
                    event
                      .target
                      .value
                  )
                }
              >
                <option value="All">
                  All related areas
                </option>

                {RELATED_TYPE_OPTIONS.map(
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
                      {
                        option
                      }
                    </option>
                  )
                )}
              </select>

              {filtersActive && (
                <button
                  type="button"
                  className={
                    styles.clearButton
                  }
                  onClick={
                    clearFilters
                  }
                >
                  Clear filters
                </button>
              )}
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
                  Unable to load
                  My Work
                </strong>

                <p>
                  {
                    errorMessage
                  }
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  fetchWork
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              className={
                styles.tablePanel
              }
            >
              <div
                className={
                  styles.tableHeading
                }
              >
                <div>
                  <h3>
                    Work items
                  </h3>

                  <p>
                    Manual follow-ups
                    and tasks created
                    by people or
                    workflow automation.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {
                    filteredWork.length
                  }{" "}
                  result
                  {filteredWork.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredWork.length ===
              0 ? (
                <EmptyState
                  hasFilters={
                    filtersActive
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onCreateFollowUp={
                    openCreateForm
                  }
                />
              ) : (
                <div
                  className={
                    styles.tableWrapper
                  }
                >
                  <table
                    className={
                      styles.followUpTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Work item
                        </th>

                        <th>
                          Related
                        </th>

                        <th>
                          Due date
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Action
                        </th>

                        <th
                          aria-label="Open"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredWork.map(
                        (
                          item
                        ) => {
                          const overdue =
                            isWorkItemOverdue(
                              item
                            );

                          const recordHref =
                            getRecordHref(
                              item.recordType,
                              item.recordId
                            );

                          return (
                            <tr
                              key={`${item.itemType}-${item.id}`}
                            >
                              <td>
                                <div
                                  className={
                                    styles.followUpIdentity
                                  }
                                >
                                  <span
                                    className={
                                      styles.followUpIcon
                                    }
                                  >
                                    {item.itemType ===
                                    "Task"
                                      ? "☑"
                                      : "◷"}
                                  </span>

                                  <div
                                    className={
                                      styles.followUpIdentityCopy
                                    }
                                  >
                                    {item.itemType ===
                                    "Follow-up" ? (
                                      <Link
                                        href={`/follow-ups/${item.id}`}
                                        className={
                                          styles.followUpLink
                                        }
                                      >
                                        {item.title}
                                      </Link>
                                    ) : (
                                      <Link
                                        href={`/tasks/${item.id}`}
                                        className={
                                          styles.followUpLink
                                        }
                                      >
                                        {item.title}
                                      </Link>
                                    )}

                                    <small>
                                      {item.itemType}

                                      {item.automatic
                                        ? " · Workflow generated"
                                        : ""}

                                      {item.priority
                                        ? ` · ${item.priority} priority`
                                        : ""}
                                    </small>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span
                                  className={
                                    styles.typeBadge
                                  }
                                >
                                  {
                                    item.relatedType
                                  }
                                </span>
                              </td>

                              <td>
                                <span
                                  className={`${styles.dateText} ${
                                    overdue
                                      ? styles.dateTextOverdue
                                      : ""
                                  }`}
                                >
                                  {formatDate(
                                    item.dueDate
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
                              </td>

                              <td>
                                <StatusBadge
                                  status={
                                    item.status
                                  }
                                />
                              </td>

                              <td>
                                {item.itemType ===
                                "Task" ? (
                                  <select
                                    className={
                                      styles.statusSelect
                                    }
                                    value={
                                      item.status
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateTaskStatus(
                                        item.id,
                                        event
                                          .target
                                          .value
                                      )
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
                                  <select
                                    className={
                                      styles.statusSelect
                                    }
                                    value={
                                      item.status
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateFollowUpStatus(
                                        item.id,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                  >
                                    {FOLLOW_UP_STATUS_OPTIONS.map(
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
                                )}

                                <button
                                  type="button"
                                  className={
                                    styles.deleteButton
                                  }
                                  onClick={() =>
                                    item.itemType ===
                                    "Task"
                                      ? deleteTask(
                                          item.id
                                        )
                                      : deleteFollowUp(
                                          item.id
                                        )
                                  }
                                >
                                  Delete
                                </button>
                              </td>

                              <td>
                                {recordHref ? (
                                  <Link
                                    href={
                                      recordHref
                                    }
                                    className={
                                      styles.openButton
                                    }
                                  >
                                    Open record →
                                  </Link>
                                ) : item.itemType ===
                                  "Follow-up" ? (
                                  <Link
                                    href={`/follow-ups/${item.id}`}
                                    className={
                                      styles.openButton
                                    }
                                  >
                                    Open →
                                  </Link>
                                ) : (
                                  <Link
                                    href={`/tasks/${item.id}`}
                                    className={
                                      styles.openButton
                                    }
                                  >
                                    Open task →
                                  </Link>
                                )}
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
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
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
          `summary${tone}`
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

      <strong>
        {value}
      </strong>

      <small>
        {detail}
      </small>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onCreateFollowUp,
}) {
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
        ◷
      </span>

      <h3>
        {hasFilters
          ? "No matching work"
          : "No work items yet"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current filters."
          : "Tasks created by workflows and manual follow-ups will appear here."}
      </p>

      <button
        type="button"
        className={
          styles.primaryButton
        }
        onClick={
          hasFilters
            ? onClearFilters
            : onCreateFollowUp
        }
      >
        {hasFilters
          ? "Clear filters"
          : "Create follow-up"}
      </button>
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
        length: 5,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={index}
            className={
              styles.loadingRow
            }
          />
        )
      )}
    </section>
  );
}

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

function extractTaskFromResponse(
  data
) {
  if (!data) {
    return null;
  }

  if (
    data.task &&
    typeof data.task ===
      "object"
  ) {
    return data.task;
  }

  if (
    Array.isArray(
      data
    )
  ) {
    return (
      data[0] ||
      null
    );
  }

  if (
    typeof data ===
      "object" &&
    data.id
  ) {
    return data;
  }

  return null;
}

function sortWorkItems(
  first,
  second
) {
  const firstCompleted =
    isCompleted(
      first.status
    );

  const secondCompleted =
    isCompleted(
      second.status
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
    first.dueDate ||
    "9999-12-31";

  const secondDate =
    second.dueDate ||
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

function isCompleted(
  value
) {
  return (
    normaliseStatus(
      value
    ) ===
    "completed"
  );
}

function isWorkItemOverdue(
  item
) {
  if (
    !item.dueDate ||
    isCompleted(
      item.status
    )
  ) {
    return false;
  }

  const dueDate =
    new Date(
      `${String(
        item.dueDate
      ).split("T")[0]}T23:59:59`
    );

  return (
    !Number.isNaN(
      dueDate.getTime()
    ) &&
    dueDate <
      new Date()
  );
}

function isToday(
  value
) {
  if (!value) {
    return false;
  }

  const date =
    new Date(
      `${String(
        value
      ).split("T")[0]}T12:00:00`
    );

  const today =
    new Date();

  return (
    date.getFullYear() ===
      today.getFullYear() &&
    date.getMonth() ===
      today.getMonth() &&
    date.getDate() ===
      today.getDate()
  );
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

function formatRecordType(
  value
) {
  const clean =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (!clean) {
    return "General";
  }

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
