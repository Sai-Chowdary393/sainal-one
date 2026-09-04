"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";

import styles from "./follow-ups.module.css";

// =========================================================
// CONSTANTS
// =========================================================

const STATUS_OPTIONS = [
  "Pending",
  "Scheduled",
  "In Progress",
  "Completed",
  "No Answer",
  "Rescheduled",
  "Cancelled",
];

const ACTIVITY_TYPES = [
  "Follow-up",
  "Call",
  "Meeting",
  "Demo",
  "Email",
];

const RELATED_TYPES = [
  "General",
  "Lead",
  "Customer",
  "Quote",
  "Proposal",
  "Project",
  "Invoice",
];

const SCHEDULED_ACTIVITY_TYPES =
  new Set([
    "Call",
    "Meeting",
    "Demo",
  ]);

const EMPTY_FORM = {
  activity_type:
    "Follow-up",

  title:
    "",

  note:
    "",

  due_date:
    "",

  scheduled_at:
    "",

  status:
    "Pending",

  related_type:
    "General",

  related_id:
    "",

  assigned_employee_id:
    "",

  outcome:
    "",
};

const EMPTY_ACCESS = {
  isOwner:
    false,

  canViewAll:
    false,

  canViewTeam:
    false,

  canViewOwn:
    false,

  canCreate:
    false,

  canEdit:
    false,

  canDelete:
    false,

  canAssign:
    false,
};

// =========================================================
// PAGE
// =========================================================

export default function FollowUpsPage() {
  const [
    followUps,
    setFollowUps,
  ] =
    useState([]);

  const [
    leads,
    setLeads,
  ] =
    useState([]);

  const [
    employees,
    setEmployees,
  ] =
    useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] =
    useState(null);

  const [
    access,
    setAccess,
  ] =
    useState(
      EMPTY_ACCESS
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    showForm,
    setShowForm,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    form,
    setForm,
  ] =
    useState(
      EMPTY_FORM
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState(null);

  const [
    editForm,
    setEditForm,
  ] =
    useState(
      EMPTY_FORM
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("All");

  const [
    activityFilter,
    setActivityFilter,
  ] =
    useState("All");

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
    try {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      const [
        followUpResponse,
        leadsResponse,
      ] =
        await Promise.all([
          fetch(
            "/api/follow-ups",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/leads",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      const followUpData =
        await safeJson(
          followUpResponse
        );

      const leadsData =
        await safeJson(
          leadsResponse
        );

      if (
        !followUpResponse.ok
      ) {
        throw new Error(
          followUpData.error ||
            "Unable to load activities."
        );
      }

      setFollowUps(
        Array.isArray(
          followUpData.followUps
        )
          ? followUpData.followUps
          : []
      );

      setEmployees(
        Array.isArray(
          followUpData.employees
        )
          ? followUpData.employees
          : []
      );

      setCurrentEmployee(
        followUpData.currentEmployee ||
          null
      );

      setAccess(
        buildAccess(
          followUpData.access
        )
      );

      setLeads(
        leadsResponse.ok &&
          Array.isArray(
            leadsData.leads
          )
          ? leadsData.leads
          : []
      );
    } catch (error) {
      console.error(
        "Activity loading error:",
        error
      );

      setFollowUps(
        []
      );

      setLeads(
        []
      );

      setErrorMessage(
        error.message ||
          "Unable to load activities."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // =======================================================
  // CREATE
  // =======================================================

  function openCreateForm(
    activityType =
      "Follow-up"
  ) {
    const scheduled =
      SCHEDULED_ACTIVITY_TYPES.has(
        activityType
      );

    setForm({
      ...EMPTY_FORM,

      activity_type:
        activityType,

      status:
        scheduled
          ? "Scheduled"
          : "Pending",

      related_type:
        activityType ===
        "Call"
          ? "Lead"
          : "General",

      assigned_employee_id:
        access.canAssign
          ? currentEmployee?.id ||
            ""
          : "",
    });

    setShowForm(
      true
    );
  }

  function closeCreateForm() {
    setShowForm(
      false
    );

    setForm(
      EMPTY_FORM
    );
  }

  function handleFormChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setForm(
      (
        current
      ) => {
        const next = {
          ...current,

          [name]:
            value,
        };

        if (
          name ===
          "activity_type"
        ) {
          const scheduled =
            SCHEDULED_ACTIVITY_TYPES.has(
              value
            );

          next.status =
            scheduled
              ? "Scheduled"
              : "Pending";

          if (
            value ===
              "Call" &&
            current.related_type ===
              "General"
          ) {
            next.related_type =
              "Lead";

            next.related_id =
              "";
          }
        }

        if (
          name ===
          "related_type"
        ) {
          next.related_id =
            "";
        }

        return next;
      }
    );
  }

  async function createActivity(
    event
  ) {
    event.preventDefault();

    if (
      !form.title.trim()
    ) {
      alert(
        "Activity title is required."
      );

      return;
    }

    if (
      form.related_type ===
        "Lead" &&
      !form.related_id
    ) {
      alert(
        "Please select a lead."
      );

      return;
    }

    if (
      SCHEDULED_ACTIVITY_TYPES.has(
        form.activity_type
      ) &&
      !form.scheduled_at
    ) {
      alert(
        `${form.activity_type} date and time are required.`
      );

      return;
    }

    try {
      setSaving(
        true
      );

      const payload = {
        activity_type:
          form.activity_type,

        title:
          form.title.trim(),

        note:
          form.note.trim(),

        due_date:
          form.due_date ||
          null,

        scheduled_at:
          toIsoDateTime(
            form.scheduled_at
          ),

        status:
          form.status,

        related_type:
          form.related_type,

        related_id:
          form.related_id
            .trim() ||
          null,

        outcome:
          form.outcome
            .trim() ||
          null,
      };

      if (
        access.canAssign &&
        form.assigned_employee_id
      ) {
        payload.assigned_employee_id =
          form.assigned_employee_id;
      }

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
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await safeJson(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to create activity."
        );
      }

      closeCreateForm();

      await loadPageData();

      alert(
        data.message ||
          "Activity created successfully."
      );
    } catch (error) {
      alert(
        error.message ||
          "Unable to create activity."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // =======================================================
  // EDIT
  // =======================================================

  function startEdit(
    item,
    nextStatus =
      null
  ) {
    setEditingId(
      item.id
    );

    setEditForm({
      activity_type:
        item.activity_type ||
        "Follow-up",

      title:
        item.title ||
        "",

      note:
        item.note ||
        "",

      due_date:
        normaliseDateInput(
          item.due_date
        ),

      scheduled_at:
        normaliseDateTimeInput(
          item.scheduled_at
        ),

      status:
        nextStatus ||
        item.status ||
        "Pending",

      related_type:
        item.related_type ||
        "General",

      related_id:
        item.related_id ||
        "",

      assigned_employee_id:
        item.assigned_employee_id ||
        "",

      outcome:
        item.outcome ||
        "",
    });
  }

  function cancelEdit() {
    setEditingId(
      null
    );

    setEditForm(
      EMPTY_FORM
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
        current
      ) => {
        const next = {
          ...current,

          [name]:
            value,
        };

        if (
          name ===
          "related_type"
        ) {
          next.related_id =
            "";
        }

        return next;
      }
    );
  }

  async function saveActivity(
    id
  ) {
    try {
      setSaving(
        true
      );

      const payload = {};

      if (
        access.canEdit
      ) {
        if (
          !editForm.title.trim()
        ) {
          alert(
            "Activity title is required."
          );

          return;
        }

        if (
          editForm.related_type ===
            "Lead" &&
          !editForm.related_id
        ) {
          alert(
            "Please select a lead."
          );

          return;
        }

        if (
          SCHEDULED_ACTIVITY_TYPES.has(
            editForm.activity_type
          ) &&
          !editForm.scheduled_at
        ) {
          alert(
            `${editForm.activity_type} date and time are required.`
          );

          return;
        }

        payload.activity_type =
          editForm.activity_type;

        payload.title =
          editForm.title.trim();

        payload.note =
          editForm.note.trim();

        payload.due_date =
          editForm.due_date ||
          null;

        payload.scheduled_at =
          toIsoDateTime(
            editForm.scheduled_at
          );

        payload.status =
          editForm.status;

        payload.related_type =
          editForm.related_type;

        payload.related_id =
          editForm.related_id
            .trim() ||
          null;

        payload.outcome =
          editForm.outcome
            .trim() ||
          null;
      }

      if (
        access.canAssign
      ) {
        payload.assigned_employee_id =
          editForm.assigned_employee_id ||
          "";
      }

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
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await safeJson(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to update activity."
        );
      }

      cancelEdit();

      await loadPageData();
    } catch (error) {
      alert(
        error.message ||
          "Unable to update activity."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // =======================================================
  // QUICK STATUS
  // =======================================================

  async function patchStatus(
    item,
    status
  ) {
    if (
      !access.canEdit
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/follow-ups/${item.id}`,
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
        await safeJson(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to update activity."
        );
      }

      await loadPageData();
    } catch (error) {
      alert(
        error.message ||
          "Unable to update activity."
      );
    }
  }

  // =======================================================
  // DELETE
  // =======================================================

  async function deleteActivity(
    item
  ) {
    const confirmed =
      window.confirm(
        `Delete "${item.title}"?`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/follow-ups/${item.id}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await safeJson(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to delete activity."
        );
      }

      await loadPageData();
    } catch (error) {
      alert(
        error.message ||
          "Unable to delete activity."
      );
    }
  }

  // =======================================================
  // FILTERS
  // =======================================================

  const filtered =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return followUps.filter(
          (
            item
          ) => {
            const lead =
              getLeadForItem(
                item,
                leads
              );

            const matchesSearch =
              !query ||
              [
                item.title,
                item.note,
                item.activity_type,
                item.related_type,
                item.status,
                item.outcome,
                item.assigned_employee
                  ?.full_name,
                lead?.name,
                lead?.company,
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
                      query
                    )
              );

            const matchesStatus =
              statusFilter ===
                "All" ||
              normalise(
                item.status
              ) ===
                normalise(
                  statusFilter
                );

            const matchesActivity =
              activityFilter ===
                "All" ||
              normalise(
                item.activity_type ||
                  "Follow-up"
              ) ===
                normalise(
                  activityFilter
                );

            return (
              matchesSearch &&
              matchesStatus &&
              matchesActivity
            );
          }
        );
      },
      [
        followUps,
        leads,
        search,
        statusFilter,
        activityFilter,
      ]
    );

  // =======================================================
  // METRICS
  // =======================================================

  const openCount =
    followUps.filter(
      (
        item
      ) =>
        [
          "pending",
          "scheduled",
          "in progress",
          "rescheduled",
        ].includes(
          normalise(
            item.status
          )
        )
    ).length;

  const callsCount =
    followUps.filter(
      (
        item
      ) =>
        normalise(
          item.activity_type
        ) ===
        "call"
    ).length;

  const completedCount =
    followUps.filter(
      (
        item
      ) =>
        normalise(
          item.status
        ) ===
        "completed"
    ).length;

  const overdueCount =
    followUps.filter(
      isActivityOverdue
    ).length;

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Follow-ups"
        description="Manage calls, meetings, reminders and customer follow-up activity."
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
                Activity workspace
              </span>

              <h2>
                Activity centre
              </h2>

              <p>
                Schedule calls with leads, manage meetings and demos,
                and keep follow-up activity visible to the right employee.
              </p>
            </div>

            {access.canCreate && (
              <div
                className={
                  styles.headerActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.scheduleCallButton
                  }
                  onClick={() =>
                    openCreateForm(
                      "Call"
                    )
                  }
                >
                  <span>
                    ☎
                  </span>

                  Schedule call
                </button>

                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  onClick={() =>
                    showForm
                      ? closeCreateForm()
                      : openCreateForm()
                  }
                >
                  {showForm
                    ? "Close form"
                    : "+ Add activity"}
                </button>
              </div>
            )}
          </section>

          {/* =================================================
              CREATE FORM
          ================================================= */}

          {showForm &&
            access.canCreate && (
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
                  <div>
                    <span
                      className={
                        styles.eyebrow
                      }
                    >
                      New activity
                    </span>

                    <h3>
                      {form.activity_type ===
                      "Call"
                        ? "Schedule a call"
                        : `Create ${form.activity_type.toLowerCase()}`}
                    </h3>

                    <p>
                      Add the activity details, related record and owner.
                    </p>
                  </div>

                  <ActivityBadge
                    type={
                      form.activity_type
                    }
                  />
                </div>

                <form
                  className={
                    styles.activityForm
                  }
                  onSubmit={
                    createActivity
                  }
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <FormSelect
                      label="Activity type"
                      name="activity_type"
                      value={
                        form.activity_type
                      }
                      onChange={
                        handleFormChange
                      }
                      options={
                        ACTIVITY_TYPES
                      }
                    />

                    <FormField
                      label="Title"
                      name="title"
                      value={
                        form.title
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder={
                        activityTitlePlaceholder(
                          form.activity_type
                        )
                      }
                    />

                    <FormSelect
                      label="Related type"
                      name="related_type"
                      value={
                        form.related_type
                      }
                      onChange={
                        handleFormChange
                      }
                      options={
                        RELATED_TYPES
                      }
                    />

                    {form.related_type ===
                    "Lead" ? (
                      <LeadSelect
                        label="Lead"
                        value={
                          form.related_id
                        }
                        onChange={
                          handleFormChange
                        }
                        leads={
                          leads
                        }
                      />
                    ) : form.related_type ===
                      "General" ? (
                      <div
                        className={
                          styles.generalContext
                        }
                      >
                        <strong>
                          General activity
                        </strong>

                        <span>
                          No CRM record will be linked.
                        </span>
                      </div>
                    ) : (
                      <FormField
                        label="Related record ID"
                        name="related_id"
                        value={
                          form.related_id
                        }
                        onChange={
                          handleFormChange
                        }
                        placeholder="Record UUID"
                      />
                    )}

                    {SCHEDULED_ACTIVITY_TYPES.has(
                      form.activity_type
                    ) ? (
                      <FormField
                        label="Scheduled date & time"
                        name="scheduled_at"
                        type="datetime-local"
                        value={
                          form.scheduled_at
                        }
                        onChange={
                          handleFormChange
                        }
                      />
                    ) : (
                      <FormField
                        label="Due date"
                        name="due_date"
                        type="date"
                        value={
                          form.due_date
                        }
                        onChange={
                          handleFormChange
                        }
                      />
                    )}

                    <FormSelect
                      label="Status"
                      name="status"
                      value={
                        form.status
                      }
                      onChange={
                        handleFormChange
                      }
                      options={
                        STATUS_OPTIONS
                      }
                    />

                    {access.canAssign && (
                      <EmployeeSelect
                        value={
                          form.assigned_employee_id
                        }
                        onChange={
                          handleFormChange
                        }
                        employees={
                          employees
                        }
                        emptyLabel="Assign to me"
                      />
                    )}

                    <label
                      className={`${styles.field} ${styles.fieldFull}`}
                    >
                      <span>
                        {form.activity_type ===
                        "Call"
                          ? "Call agenda / notes"
                          : "Notes"}
                      </span>

                      <textarea
                        name="note"
                        rows={4}
                        value={
                          form.note
                        }
                        onChange={
                          handleFormChange
                        }
                        placeholder="Add context, agenda or next steps..."
                      />
                    </label>
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
                        : form.activity_type ===
                            "Call"
                          ? "Schedule call"
                          : "Save activity"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* =================================================
              SUMMARY
          ================================================= */}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              label="Visible activities"
              value={
                followUps.length
              }
              icon="◎"
              tone="gold"
            />

            <SummaryCard
              label="Calls"
              value={
                callsCount
              }
              icon="☎"
              tone="blue"
            />

            <SummaryCard
              label="Open / scheduled"
              value={
                openCount
              }
              icon="◷"
              tone="gold"
            />

            <SummaryCard
              label="Overdue"
              value={
                overdueCount
              }
              icon="!"
              tone="red"
            />

            <SummaryCard
              label="Completed"
              value={
                completedCount
              }
              icon="✓"
              tone="green"
            />
          </section>

          {/* =================================================
              TOOLBAR
          ================================================= */}

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
              <span>
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search activity, lead, company, assignee or status..."
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
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
                  activityFilter
                }
                onChange={(
                  event
                ) =>
                  setActivityFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All activity types
                </option>

                {ACTIVITY_TYPES.map(
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
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All statuses
                </option>

                {STATUS_OPTIONS.map(
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
                      {status}
                    </option>
                  )
                )}
              </select>

              {(search ||
                statusFilter !==
                  "All" ||
                activityFilter !==
                  "All") && (
                <button
                  type="button"
                  className={
                    styles.clearButton
                  }
                  onClick={() => {
                    setSearch(
                      ""
                    );

                    setStatusFilter(
                      "All"
                    );

                    setActivityFilter(
                      "All"
                    );
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </section>

          {/* =================================================
              RECORDS
          ================================================= */}

          {loading ? (
            <section
              className={
                styles.loadingPanel
              }
            >
              <div
                className={
                  styles.loadingRow
                }
              />

              <div
                className={
                  styles.loadingRow
                }
              />

              <div
                className={
                  styles.loadingRow
                }
              />
            </section>
          ) : errorMessage ? (
            <section
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to load activities
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
                  loadPageData
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
                    Activity records
                  </h3>

                  <p>
                    Calls, meetings, reminders and customer follow-up activity.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {filtered.length}{" "}
                  record
                  {filtered.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filtered.length ===
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
                    ◷
                  </span>

                  <h3>
                    No activities found
                  </h3>

                  <p>
                    Schedule a call or add an activity to start tracking customer follow-up work.
                  </p>
                </div>
              ) : (
                <div
                  className={
                    styles.tableWrapper
                  }
                >
                  <table
                    className={
                      styles.activityTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Activity
                        </th>

                        <th>
                          Related to
                        </th>

                        <th>
                          Assignee
                        </th>

                        <th>
                          Schedule / due
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map(
                        (
                          item
                        ) => {
                          const editing =
                            editingId ===
                            item.id;

                          const lead =
                            getLeadForItem(
                              item,
                              leads
                            );

                          const itemType =
                            item.activity_type ||
                            "Follow-up";

                          return (
                            <tr
                              key={
                                item.id
                              }
                            >
                              {/* =====================================
                                  ACTIVITY
                              ===================================== */}

                              <td>
                                {editing &&
                                access.canEdit ? (
                                  <div
                                    className={
                                      styles.editStack
                                    }
                                  >
                                    <InlineSelect
                                      name="activity_type"
                                      value={
                                        editForm.activity_type
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                      options={
                                        ACTIVITY_TYPES
                                      }
                                    />

                                    <input
                                      className={
                                        styles.inlineInput
                                      }
                                      name="title"
                                      value={
                                        editForm.title
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                    />

                                    <textarea
                                      className={
                                        styles.inlineTextarea
                                      }
                                      name="note"
                                      value={
                                        editForm.note
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                    />

                                    <input
                                      className={
                                        styles.inlineInput
                                      }
                                      name="outcome"
                                      value={
                                        editForm.outcome
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                      placeholder="Outcome / result"
                                    />
                                  </div>
                                ) : (
                                  <ActivityIdentity
                                    item={
                                      item
                                    }
                                    type={
                                      itemType
                                    }
                                  />
                                )}
                              </td>

                              {/* =====================================
                                  RELATED
                              ===================================== */}

                              <td>
                                {editing &&
                                access.canEdit ? (
                                  <div
                                    className={
                                      styles.editStack
                                    }
                                  >
                                    <InlineSelect
                                      name="related_type"
                                      value={
                                        editForm.related_type
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                      options={
                                        RELATED_TYPES
                                      }
                                    />

                                    {editForm.related_type ===
                                    "Lead" ? (
                                      <LeadSelectInline
                                        value={
                                          editForm.related_id
                                        }
                                        onChange={
                                          handleEditChange
                                        }
                                        leads={
                                          leads
                                        }
                                      />
                                    ) : editForm.related_type !==
                                      "General" ? (
                                      <input
                                        className={
                                          styles.inlineInput
                                        }
                                        name="related_id"
                                        value={
                                          editForm.related_id
                                        }
                                        onChange={
                                          handleEditChange
                                        }
                                        placeholder="Record UUID"
                                      />
                                    ) : null}
                                  </div>
                                ) : lead ? (
                                  <div
                                    className={
                                      styles.relatedIdentity
                                    }
                                  >
                                    <strong>
                                      {lead.name ||
                                        "Lead"}
                                    </strong>

                                    <small>
                                      {lead.company ||
                                        "No company"}
                                    </small>
                                  </div>
                                ) : (
                                  <span
                                    className={
                                      styles.relatedText
                                    }
                                  >
                                    {item.related_type ||
                                      "General"}
                                  </span>
                                )}
                              </td>

                              {/* =====================================
                                  ASSIGNEE
                              ===================================== */}

                              <td>
                                {editing &&
                                access.canAssign ? (
                                  <EmployeeSelectInline
                                    value={
                                      editForm.assigned_employee_id
                                    }
                                    onChange={
                                      handleEditChange
                                    }
                                    employees={
                                      employees
                                    }
                                  />
                                ) : (
                                  <div
                                    className={
                                      styles.assigneeCell
                                    }
                                  >
                                    <strong>
                                      {item.assigned_employee
                                        ?.full_name ||
                                        "Unassigned"}
                                    </strong>

                                    {item.assigned_employee
                                      ?.job_title && (
                                      <small>
                                        {
                                          item.assigned_employee.job_title
                                        }
                                      </small>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* =====================================
                                  DATE
                              ===================================== */}

                              <td>
                                {editing &&
                                access.canEdit ? (
                                  SCHEDULED_ACTIVITY_TYPES.has(
                                    editForm.activity_type
                                  ) ? (
                                    <input
                                      className={
                                        styles.inlineInput
                                      }
                                      type="datetime-local"
                                      name="scheduled_at"
                                      value={
                                        editForm.scheduled_at
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                    />
                                  ) : (
                                    <input
                                      className={
                                        styles.inlineInput
                                      }
                                      type="date"
                                      name="due_date"
                                      value={
                                        editForm.due_date
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                    />
                                  )
                                ) : (
                                  <DateCell
                                    item={
                                      item
                                    }
                                  />
                                )}
                              </td>

                              {/* =====================================
                                  STATUS
                              ===================================== */}

                              <td>
                                {editing &&
                                access.canEdit ? (
                                  <InlineSelect
                                    name="status"
                                    value={
                                      editForm.status
                                    }
                                    onChange={
                                      handleEditChange
                                    }
                                    options={
                                      STATUS_OPTIONS
                                    }
                                  />
                                ) : (
                                  <StatusBadge
                                    status={
                                      item.status ||
                                      "Pending"
                                    }
                                  />
                                )}
                              </td>

                              {/* =====================================
                                  ACTIONS
                              ===================================== */}

                              <td>
                                <div
                                  className={
                                    styles.actionCell
                                  }
                                >
                                  {editing ? (
                                    <>
                                      <button
                                        type="button"
                                        className={
                                          styles.saveButton
                                        }
                                        disabled={
                                          saving
                                        }
                                        onClick={() =>
                                          saveActivity(
                                            item.id
                                          )
                                        }
                                      >
                                        {saving
                                          ? "Saving..."
                                          : "Save"}
                                      </button>

                                      <button
                                        type="button"
                                        className={
                                          styles.smallButton
                                        }
                                        onClick={
                                          cancelEdit
                                        }
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      {(access.canEdit ||
                                        access.canAssign) && (
                                        <button
                                          type="button"
                                          className={
                                            styles.smallButton
                                          }
                                          onClick={() =>
                                            startEdit(
                                              item
                                            )
                                          }
                                        >
                                          Edit
                                        </button>
                                      )}

                                      {access.canEdit &&
                                        ![
                                          "completed",
                                          "cancelled",
                                        ].includes(
                                          normalise(
                                            item.status
                                          )
                                        ) && (
                                          <button
                                            type="button"
                                            className={
                                              styles.completeButton
                                            }
                                            onClick={() =>
                                              patchStatus(
                                                item,
                                                "Completed"
                                              )
                                            }
                                          >
                                            Complete
                                          </button>
                                        )}

                                      {access.canEdit &&
                                        normalise(
                                          itemType
                                        ) ===
                                          "call" &&
                                        ![
                                          "completed",
                                          "cancelled",
                                          "no answer",
                                        ].includes(
                                          normalise(
                                            item.status
                                          )
                                        ) && (
                                          <button
                                            type="button"
                                            className={
                                              styles.smallButton
                                            }
                                            onClick={() =>
                                              patchStatus(
                                                item,
                                                "No Answer"
                                              )
                                            }
                                          >
                                            No answer
                                          </button>
                                        )}

                                      {access.canEdit &&
                                        SCHEDULED_ACTIVITY_TYPES.has(
                                          itemType
                                        ) &&
                                        ![
                                          "completed",
                                          "cancelled",
                                        ].includes(
                                          normalise(
                                            item.status
                                          )
                                        ) && (
                                          <button
                                            type="button"
                                            className={
                                              styles.smallButton
                                            }
                                            onClick={() =>
                                              startEdit(
                                                item,
                                                "Rescheduled"
                                              )
                                            }
                                          >
                                            Reschedule
                                          </button>
                                        )}

                                      {access.canDelete && (
                                        <button
                                          type="button"
                                          className={
                                            styles.deleteButton
                                          }
                                          onClick={() =>
                                            deleteActivity(
                                              item
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
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// ACTIVITY IDENTITY
// =========================================================

function ActivityIdentity({
  item,
  type,
}) {
  const showType =
    normalise(
      type
    ) !==
    "follow-up";

  return (
    <div
      className={
        styles.activityIdentity
      }
    >
      {showType && (
        <span
          className={
            `${styles.activityInlineType} ${getActivityTypeClass(
              type
            )}`
          }
        >
          <span>
            {activityIcon(
              type
            )}
          </span>

          {type}
        </span>
      )}

      <strong>
        {item.title}
      </strong>

      {item.note && (
        <small>
          {item.note}
        </small>
      )}

      {item.outcome && (
        <span
          className={
            styles.outcomeText
          }
        >
          Outcome:{" "}
          {item.outcome}
        </span>
      )}
    </div>
  );
}

// =========================================================
// ACTIVITY BADGE
// =========================================================

function ActivityBadge({
  type,
}) {
  return (
    <span
      className={
        styles.formActivityBadge
      }
    >
      <span>
        {activityIcon(
          type
        )}
      </span>

      {type}
    </span>
  );
}

// =========================================================
// FORM COMPONENTS
// =========================================================

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) {
  return (
    <label
      className={
        styles.field
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
          value ||
          ""
        }
        onChange={
          onChange
        }
        placeholder={
          placeholder
        }
      />
    </label>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
}) {
  return (
    <label
      className={
        styles.field
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
    </label>
  );
}

function LeadSelect({
  label,
  value,
  onChange,
  leads,
}) {
  return (
    <label
      className={
        styles.field
      }
    >
      <span>
        {label}
      </span>

      <LeadSelectInline
        value={
          value
        }
        onChange={
          onChange
        }
        leads={
          leads
        }
      />
    </label>
  );
}

function LeadSelectInline({
  value,
  onChange,
  leads,
}) {
  return (
    <select
      className={
        styles.inlineInput
      }
      name="related_id"
      value={
        value ||
        ""
      }
      onChange={
        onChange
      }
    >
      <option value="">
        Select a lead
      </option>

      {leads.map(
        (
          lead
        ) => (
          <option
            key={
              lead.id
            }
            value={
              lead.id
            }
          >
            {lead.name ||
              "Unnamed lead"}
            {lead.company
              ? ` — ${lead.company}`
              : ""}
          </option>
        )
      )}
    </select>
  );
}

function EmployeeSelect({
  value,
  onChange,
  employees,
  emptyLabel,
}) {
  return (
    <label
      className={
        styles.field
      }
    >
      <span>
        Assigned employee
      </span>

      <select
        name="assigned_employee_id"
        value={
          value ||
          ""
        }
        onChange={
          onChange
        }
      >
        <option value="">
          {emptyLabel}
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
    </label>
  );
}

function EmployeeSelectInline({
  value,
  onChange,
  employees,
}) {
  return (
    <select
      className={
        styles.inlineInput
      }
      name="assigned_employee_id"
      value={
        value ||
        ""
      }
      onChange={
        onChange
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
  );
}

function InlineSelect({
  name,
  value,
  onChange,
  options,
}) {
  return (
    <select
      className={
        styles.inlineInput
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
  );
}

// =========================================================
// SUMMARY
// =========================================================

function SummaryCard({
  label,
  value,
  icon,
  tone,
}) {
  const toneClass =
    tone ===
    "red"
      ? styles.summaryRed
      : tone ===
          "blue"
        ? styles.summaryBlue
        : tone ===
            "green"
          ? styles.summaryGreen
          : styles.summaryGold;

  return (
    <article
      className={`${styles.summaryCard} ${toneClass}`}
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
    </article>
  );
}

// =========================================================
// DATE CELL
// =========================================================

function DateCell({
  item,
}) {
  if (
    item.scheduled_at
  ) {
    const overdue =
      isScheduledPast(
        item
      );

    return (
      <div
        className={
          styles.dateCell
        }
      >
        <span
          className={
            overdue
              ? styles.dateTextOverdue
              : styles.dateText
          }
        >
          {formatDateTime(
            item.scheduled_at
          )}
        </span>

        {overdue && (
          <span
            className={
              styles.overdueLabel
            }
          >
            Missed
          </span>
        )}
      </div>
    );
  }

  const overdue =
    isActivityOverdue(
      item
    );

  return (
    <div
      className={
        styles.dateCell
      }
    >
      <span
        className={
          overdue
            ? styles.dateTextOverdue
            : styles.dateText
        }
      >
        {formatDate(
          item.due_date
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
    </div>
  );
}

// =========================================================
// ACCESS
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

// =========================================================
// HELPERS
// =========================================================

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalise(
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
  return value
    ? String(
        value
      ).slice(
        0,
        10
      )
    : "";
}

function normaliseDateTimeInput(
  value
) {
  if (
    !value
  ) {
    return "";
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

  const pad = (
    part
  ) =>
    String(
      part
    ).padStart(
      2,
      "0"
    );

  return `${date.getFullYear()}-${pad(
    date.getMonth() +
      1
  )}-${pad(
    date.getDate()
  )}T${pad(
    date.getHours()
  )}:${pad(
    date.getMinutes()
  )}`;
}

function toIsoDateTime(
  value
) {
  if (
    !value
  ) {
    return null;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date.toISOString();
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
      `${String(
        value
      ).slice(
        0,
        10
      )}T12:00:00`
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

function formatDateTime(
  value
) {
  if (
    !value
  ) {
    return "Not scheduled";
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
    return "Not scheduled";
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

function isActivityOverdue(
  item
) {
  if (
    item.scheduled_at ||
    !item.due_date ||
    [
      "completed",
      "cancelled",
      "no answer",
    ].includes(
      normalise(
        item.status
      )
    )
  ) {
    return false;
  }

  const due =
    new Date(
      `${String(
        item.due_date
      ).slice(
        0,
        10
      )}T23:59:59`
    );

  return (
    !Number.isNaN(
      due.getTime()
    ) &&
    due <
      new Date()
  );
}

function isScheduledPast(
  item
) {
  if (
    !item.scheduled_at ||
    [
      "completed",
      "cancelled",
      "no answer",
    ].includes(
      normalise(
        item.status
      )
    )
  ) {
    return false;
  }

  const scheduled =
    new Date(
      item.scheduled_at
    );

  return (
    !Number.isNaN(
      scheduled.getTime()
    ) &&
    scheduled <
      new Date()
  );
}

function getLeadForItem(
  item,
  leads
) {
  if (
    normalise(
      item.related_type
    ) !==
      "lead" ||
    !item.related_id
  ) {
    return null;
  }

  return (
    leads.find(
      (
        lead
      ) =>
        String(
          lead.id
        ) ===
        String(
          item.related_id
        )
    ) ||
    null
  );
}

function activityIcon(
  type
) {
  switch (
    normalise(
      type
    )
  ) {
    case "call":
      return "☎";

    case "meeting":
      return "◫";

    case "demo":
      return "▶";

    case "email":
      return "✉";

    default:
      return "✓";
  }
}

function getActivityTypeClass(
  type
) {
  switch (
    normalise(
      type
    )
  ) {
    case "call":
      return styles.typeCall;

    case "meeting":
      return styles.typeMeeting;

    case "demo":
      return styles.typeDemo;

    case "email":
      return styles.typeEmail;

    default:
      return "";
  }
}

function activityTitlePlaceholder(
  type
) {
  switch (
    normalise(
      type
    )
  ) {
    case "call":
      return "e.g. Discovery call";

    case "meeting":
      return "e.g. Customer review meeting";

    case "demo":
      return "e.g. Product demo";

    case "email":
      return "e.g. Send proposal follow-up";

    default:
      return "e.g. Follow up on proposal";
  }
}
