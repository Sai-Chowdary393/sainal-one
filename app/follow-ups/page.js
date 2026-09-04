"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";

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
            "Unable to load follow-ups."
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
        "Follow-up loading error:",
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
          "Unable to load follow-ups."
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
          ? currentEmployee
              ?.id ||
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

  async function createFollowUp(
    event
  ) {
    event.preventDefault();

    if (
      !form.title
        .trim()
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
          form.title
            .trim(),

        note:
          form.note
            .trim(),

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

  async function saveFollowUp(
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
          !editForm.title
            .trim()
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
          editForm.title
            .trim();

        payload.note =
          editForm.note
            .trim();

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

  async function deleteFollowUp(
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

  const pendingCount =
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
      isOverdue
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
          style={
            styles.page
          }
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <section
            style={
              styles.header
            }
          >
            <div>
              <span
                style={
                  styles.eyebrow
                }
              >
                Activity workspace
              </span>

              <h2
                style={
                  styles.heading
                }
              >
                Activity centre
              </h2>

              <p
                style={
                  styles.description
                }
              >
                Schedule calls with leads, manage meetings and demos,
                and keep every follow-up visible to the right employee.
              </p>
            </div>

            {access.canCreate && (
              <div
                style={
                  styles.headerActions
                }
              >
                <button
                  type="button"
                  style={
                    styles.callButton
                  }
                  onClick={() =>
                    openCreateForm(
                      "Call"
                    )
                  }
                >
                  ☎ Schedule call
                </button>

                <button
                  type="button"
                  style={
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
                style={
                  styles.panel
                }
              >
                <div
                  style={
                    styles.formHeader
                  }
                >
                  <div>
                    <span
                      style={
                        styles.eyebrow
                      }
                    >
                      New activity
                    </span>

                    <h3
                      style={
                        styles.formTitle
                      }
                    >
                      {form.activity_type ===
                      "Call"
                        ? "Schedule a call"
                        : `Create ${form.activity_type.toLowerCase()}`}
                    </h3>
                  </div>

                  <span
                    style={
                      styles.activityChip
                    }
                  >
                    {activityIcon(
                      form.activity_type
                    )}{" "}
                    {
                      form.activity_type
                    }
                  </span>
                </div>

                <form
                  onSubmit={
                    createFollowUp
                  }
                >
                  <div
                    style={
                      styles.formGrid
                    }
                  >
                    <SelectField
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

                    <Field
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

                    <SelectField
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
                      <LeadField
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
                        style={
                          styles.fieldHintCard
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
                      <Field
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
                      <Field
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
                      <Field
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

                    <SelectField
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
                      <EmployeeField
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
                  </div>

                  <label
                    style={{
                      ...styles.field,

                      marginTop:
                        "14px",
                    }}
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
                      style={
                        styles.textarea
                      }
                      placeholder="Add context, agenda or next steps..."
                    />
                  </label>

                  <div
                    style={
                      styles.actions
                    }
                  >
                    <button
                      type="button"
                      style={
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
                      style={
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
            style={
              styles.summaryGrid
            }
          >
            <Summary
              label="Visible activities"
              value={
                followUps.length
              }
            />

            <Summary
              label="Calls"
              value={
                callsCount
              }
            />

            <Summary
              label="Open / scheduled"
              value={
                pendingCount
              }
            />

            <Summary
              label="Overdue"
              value={
                overdueCount
              }
              danger={
                overdueCount >
                0
              }
            />

            <Summary
              label="Completed"
              value={
                completedCount
              }
              success={
                completedCount >
                0
              }
            />
          </section>

          {/* =================================================
              FILTERS
          ================================================= */}

          <section
            style={
              styles.toolbar
            }
          >
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
              style={
                styles.search
              }
            />

            <div
              style={
                styles.toolbarFilters
              }
            >
              <select
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
                style={
                  styles.filter
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
                style={
                  styles.filter
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
            </div>
          </section>

          {/* =================================================
              RECORDS
          ================================================= */}

          {loading ? (
            <div
              style={
                styles.panel
              }
            >
              Loading activities...
            </div>
          ) : errorMessage ? (
            <section
              style={
                styles.error
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
                style={
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
              style={
                styles.panel
              }
            >
              <div
                style={
                  styles.panelHeader
                }
              >
                <div>
                  <h3
                    style={
                      styles.formTitle
                    }
                  >
                    Activity records
                  </h3>

                  <p
                    style={
                      styles.panelDescription
                    }
                  >
                    {
                      filtered.length
                    }{" "}
                    visible record
                    {filtered.length ===
                    1
                      ? ""
                      : "s"}
                  </p>
                </div>
              </div>

              {filtered.length ===
              0 ? (
                <div
                  style={
                    styles.empty
                  }
                >
                  <strong>
                    No activities found.
                  </strong>

                  <span>
                    Schedule a call or add a follow-up to get started.
                  </span>
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
                      styles.table
                    }
                  >
                    <thead>
                      <tr>
                        <th
                          style={
                            styles.th
                          }
                        >
                          Type
                        </th>

                        <th
                          style={
                            styles.th
                          }
                        >
                          Activity
                        </th>

                        <th
                          style={
                            styles.th
                          }
                        >
                          Related to
                        </th>

                        <th
                          style={
                            styles.th
                          }
                        >
                          Assignee
                        </th>

                        <th
                          style={
                            styles.th
                          }
                        >
                          Schedule / due
                        </th>

                        <th
                          style={
                            styles.th
                          }
                        >
                          Status
                        </th>

                        <th
                          style={
                            styles.th
                          }
                        >
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
                              <td
                                style={
                                  styles.td
                                }
                              >
                                {editing &&
                                access.canEdit ? (
                                  <SelectFieldInline
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
                                ) : (
                                  <span
                                    style={
                                      styles.typeBadge
                                    }
                                  >
                                    <span>
                                      {activityIcon(
                                        itemType
                                      )}
                                    </span>

                                    {
                                      itemType
                                    }
                                  </span>
                                )}
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                {editing &&
                                access.canEdit ? (
                                  <>
                                    <input
                                      name="title"
                                      value={
                                        editForm.title
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                      style={
                                        styles.input
                                      }
                                    />

                                    <textarea
                                      name="note"
                                      value={
                                        editForm.note
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                      style={{
                                        ...styles.textarea,

                                        marginTop:
                                          "7px",
                                      }}
                                    />

                                    <input
                                      name="outcome"
                                      value={
                                        editForm.outcome
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                      style={{
                                        ...styles.input,

                                        marginTop:
                                          "7px",
                                      }}
                                      placeholder="Outcome / result"
                                    />
                                  </>
                                ) : (
                                  <>
                                    <strong>
                                      {
                                        item.title
                                      }
                                    </strong>

                                    {item.note && (
                                      <small
                                        style={
                                          styles.note
                                        }
                                      >
                                        {
                                          item.note
                                        }
                                      </small>
                                    )}

                                    {item.outcome && (
                                      <small
                                        style={
                                          styles.outcome
                                        }
                                      >
                                        Outcome:{" "}
                                        {
                                          item.outcome
                                        }
                                      </small>
                                    )}
                                  </>
                                )}
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                {editing &&
                                access.canEdit ? (
                                  <div
                                    style={
                                      styles.inlineStack
                                    }
                                  >
                                    <SelectFieldInline
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
                                      <LeadFieldInline
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
                                        name="related_id"
                                        value={
                                          editForm.related_id
                                        }
                                        onChange={
                                          handleEditChange
                                        }
                                        style={
                                          styles.input
                                        }
                                        placeholder="Record UUID"
                                      />
                                    ) : null}
                                  </div>
                                ) : lead ? (
                                  <div
                                    style={
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
                                  item.related_type ||
                                  "General"
                                )}
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                {editing &&
                                access.canAssign ? (
                                  <EmployeeFieldInline
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
                                  item.assigned_employee
                                    ?.full_name ||
                                  "Unassigned"
                                )}
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                {editing &&
                                access.canEdit ? (
                                  SCHEDULED_ACTIVITY_TYPES.has(
                                    editForm.activity_type
                                  ) ? (
                                    <input
                                      type="datetime-local"
                                      name="scheduled_at"
                                      value={
                                        editForm.scheduled_at
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                      style={
                                        styles.input
                                      }
                                    />
                                  ) : (
                                    <input
                                      type="date"
                                      name="due_date"
                                      value={
                                        editForm.due_date
                                      }
                                      onChange={
                                        handleEditChange
                                      }
                                      style={
                                        styles.input
                                      }
                                    />
                                  )
                                ) : item.scheduled_at ? (
                                  <span
                                    style={
                                      isScheduledPast(
                                        item
                                      )
                                        ? styles.overdue
                                        : {}
                                    }
                                  >
                                    {formatDateTime(
                                      item.scheduled_at
                                    )}
                                  </span>
                                ) : (
                                  <span
                                    style={
                                      isOverdue(
                                        item
                                      )
                                        ? styles.overdue
                                        : {}
                                    }
                                  >
                                    {formatDate(
                                      item.due_date
                                    )}
                                  </span>
                                )}
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                {editing &&
                                access.canEdit ? (
                                  <SelectFieldInline
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

                              <td
                                style={
                                  styles.td
                                }
                              >
                                <div
                                  style={
                                    styles.rowActions
                                  }
                                >
                                  {editing ? (
                                    <>
                                      <button
                                        type="button"
                                        style={
                                          styles.primaryButtonSmall
                                        }
                                        disabled={
                                          saving
                                        }
                                        onClick={() =>
                                          saveFollowUp(
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
                                        style={
                                          styles.secondaryButtonSmall
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
                                          style={
                                            styles.secondaryButtonSmall
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
                                        normalise(
                                          item.status
                                        ) !==
                                          "completed" &&
                                        normalise(
                                          item.status
                                        ) !==
                                          "cancelled" && (
                                          <button
                                            type="button"
                                            style={
                                              styles.completeButtonSmall
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
                                            style={
                                              styles.secondaryButtonSmall
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
                                            style={
                                              styles.secondaryButtonSmall
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
                                          style={
                                            styles.dangerButtonSmall
                                          }
                                          onClick={() =>
                                            deleteFollowUp(
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
// FORM COMPONENTS
// =========================================================

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) {
  return (
    <label
      style={
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
        style={
          styles.input
        }
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}) {
  return (
    <label
      style={
        styles.field
      }
    >
      <span>
        {label}
      </span>

      <SelectFieldInline
        name={
          name
        }
        value={
          value
        }
        onChange={
          onChange
        }
        options={
          options
        }
      />
    </label>
  );
}

function SelectFieldInline({
  name,
  value,
  onChange,
  options,
}) {
  return (
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
      style={
        styles.input
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

function LeadField({
  label,
  value,
  onChange,
  leads,
}) {
  return (
    <label
      style={
        styles.field
      }
    >
      <span>
        {label}
      </span>

      <LeadFieldInline
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

function LeadFieldInline({
  value,
  onChange,
  leads,
}) {
  return (
    <select
      name="related_id"
      value={
        value ||
        ""
      }
      onChange={
        onChange
      }
      style={
        styles.input
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

function EmployeeField({
  value,
  onChange,
  employees,
  emptyLabel,
}) {
  return (
    <label
      style={
        styles.field
      }
    >
      <span>
        Assigned employee
      </span>

      <EmployeeFieldInline
        value={
          value
        }
        onChange={
          onChange
        }
        employees={
          employees
        }
        emptyLabel={
          emptyLabel
        }
      />
    </label>
  );
}

function EmployeeFieldInline({
  value,
  onChange,
  employees,
  emptyLabel =
    "Unassigned",
}) {
  return (
    <select
      name="assigned_employee_id"
      value={
        value ||
        ""
      }
      onChange={
        onChange
      }
      style={
        styles.input
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
  );
}

function Summary({
  label,
  value,
  danger = false,
  success = false,
}) {
  return (
    <article
      style={{
        ...styles.summary,

        ...(danger
          ? styles.summaryDanger
          : {}),

        ...(success
          ? styles.summarySuccess
          : {}),
      }}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </article>
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

function isOverdue(
  item
) {
  if (
    item.scheduled_at ||
    !item.due_date ||
    [
      "completed",
      "cancelled",
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

// =========================================================
// STYLES
// =========================================================

const styles = {
  page: {
    display:
      "grid",

    gap:
      "20px",

    color:
      "#27241f",

    fontSize:
      "13px",
  },

  header: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "flex-start",

    gap:
      "20px",
  },

  headerActions: {
    display:
      "flex",

    flexWrap:
      "wrap",

    justifyContent:
      "flex-end",

    gap:
      "8px",
  },

  eyebrow: {
    display:
      "block",

    marginBottom:
      "7px",

    color:
      "#9a7300",

    fontSize:
      "10px",

    fontWeight:
      800,

    letterSpacing:
      "1px",

    textTransform:
      "uppercase",
  },

  heading: {
    margin:
      0,

    fontSize:
      "27px",
  },

  description: {
    maxWidth:
      "720px",

    margin:
      "7px 0 0",

    color:
      "#7d786e",

    fontSize:
      "13px",

    lineHeight:
      1.6,
  },

  panel: {
    padding:
      "20px",

    border:
      "1px solid #dfdbd1",

    borderRadius:
      "15px",

    background:
      "#ffffff",
  },

  panelHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    marginBottom:
      "15px",
  },

  panelDescription: {
    margin:
      "5px 0 0",

    color:
      "#817d74",

    fontSize:
      "12px",
  },

  formHeader: {
    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "16px",

    marginBottom:
      "18px",
  },

  formTitle: {
    margin:
      0,
  },

  formGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",

    gap:
      "14px",
  },

  field: {
    display:
      "grid",

    gap:
      "7px",

    fontSize:
      "12px",

    fontWeight:
      700,
  },

  fieldHintCard: {
    display:
      "grid",

    alignContent:
      "center",

    gap:
      "4px",

    minHeight:
      "64px",

    padding:
      "10px 12px",

    border:
      "1px dashed #d9d5cc",

    borderRadius:
      "8px",

    color:
      "#7d786e",

    background:
      "#fbfaf7",
  },

  input: {
    width:
      "100%",

    minHeight:
      "40px",

    padding:
      "8px 10px",

    border:
      "1px solid #d9d5cc",

    borderRadius:
      "8px",

    background:
      "#ffffff",

    fontFamily:
      "inherit",

    fontSize:
      "13px",
  },

  textarea: {
    width:
      "100%",

    minHeight:
      "90px",

    padding:
      "9px 10px",

    border:
      "1px solid #d9d5cc",

    borderRadius:
      "8px",

    resize:
      "vertical",

    fontFamily:
      "inherit",

    fontSize:
      "13px",
  },

  inlineStack: {
    display:
      "grid",

    gap:
      "7px",

    minWidth:
      "190px",
  },

  actions: {
    display:
      "flex",

    justifyContent:
      "flex-end",

    gap:
      "8px",

    marginTop:
      "18px",
  },

  primaryButton: {
    minHeight:
      "40px",

    padding:
      "0 15px",

    border:
      "1px solid #b88800",

    borderRadius:
      "9px",

    background:
      "#dca900",

    color:
      "#17130a",

    fontWeight:
      750,

    cursor:
      "pointer",
  },

  callButton: {
    minHeight:
      "40px",

    padding:
      "0 15px",

    border:
      "1px solid #c9decf",

    borderRadius:
      "9px",

    background:
      "#f3faf5",

    color:
      "#397451",

    fontWeight:
      800,

    cursor:
      "pointer",
  },

  secondaryButton: {
    minHeight:
      "40px",

    padding:
      "0 15px",

    border:
      "1px solid #ddd8cf",

    borderRadius:
      "9px",

    background:
      "#ffffff",

    fontWeight:
      700,

    cursor:
      "pointer",
  },

  activityChip: {
    display:
      "inline-flex",

    alignItems:
      "center",

    gap:
      "6px",

    minHeight:
      "30px",

    padding:
      "0 10px",

    borderRadius:
      "999px",

    color:
      "#755b00",

    background:
      "#f7efd1",

    fontSize:
      "10px",

    fontWeight:
      800,

    whiteSpace:
      "nowrap",
  },

  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(150px, 1fr))",

    gap:
      "14px",
  },

  summary: {
    display:
      "grid",

    gap:
      "10px",

    minHeight:
      "105px",

    padding:
      "17px",

    border:
      "1px solid #dfdbd1",

    borderRadius:
      "14px",

    background:
      "#ffffff",
  },

  summaryDanger: {
    border:
      "1px solid #efcaca",

    background:
      "#fff8f8",
  },

  summarySuccess: {
    border:
      "1px solid #cfe4d6",

    background:
      "#f7fbf8",
  },

  toolbar: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "12px",

    padding:
      "12px",

    border:
      "1px solid #dfdbd1",

    borderRadius:
      "13px",

    background:
      "#ffffff",
  },

  toolbarFilters: {
    display:
      "flex",

    gap:
      "8px",

    flexWrap:
      "wrap",

    justifyContent:
      "flex-end",
  },

  search: {
    width:
      "520px",

    maxWidth:
      "100%",

    minHeight:
      "40px",

    padding:
      "0 11px",

    border:
      "1px solid #ddd8cf",

    borderRadius:
      "9px",
  },

  filter: {
    minHeight:
      "40px",

    padding:
      "0 11px",

    border:
      "1px solid #ddd8cf",

    borderRadius:
      "9px",

    background:
      "#ffffff",
  },

  table: {
    width:
      "100%",

    borderCollapse:
      "collapse",

    fontSize:
      "12px",
  },

  th: {
    padding:
      "11px 12px",

    borderBottom:
      "1px solid #e7e3dc",

    textAlign:
      "left",

    fontSize:
      "10px",

    textTransform:
      "uppercase",

    whiteSpace:
      "nowrap",
  },

  td: {
    padding:
      "13px 12px",

    borderBottom:
      "1px solid #efede7",

    verticalAlign:
      "top",
  },

  typeBadge: {
    display:
      "inline-flex",

    alignItems:
      "center",

    gap:
      "6px",

    minHeight:
      "28px",

    padding:
      "0 9px",

    borderRadius:
      "999px",

    color:
      "#615b4d",

    background:
      "#f4f1e9",

    fontSize:
      "10px",

    fontWeight:
      800,

    whiteSpace:
      "nowrap",
  },

  relatedIdentity: {
    display:
      "grid",

    gap:
      "3px",
  },

  note: {
    display:
      "block",

    maxWidth:
      "340px",

    marginTop:
      "4px",

    color:
      "#858078",

    lineHeight:
      1.5,
  },

  outcome: {
    display:
      "block",

    maxWidth:
      "340px",

    marginTop:
      "5px",

    color:
      "#397451",

    fontWeight:
      700,
  },

  rowActions: {
    display:
      "flex",

    flexWrap:
      "wrap",

    gap:
      "6px",

    minWidth:
      "180px",
  },

  primaryButtonSmall: {
    padding:
      "7px 10px",

    border:
      "1px solid #b88800",

    borderRadius:
      "7px",

    background:
      "#dca900",

    fontSize:
      "11px",

    fontWeight:
      700,

    cursor:
      "pointer",
  },

  completeButtonSmall: {
    padding:
      "7px 10px",

    border:
      "1px solid #c9decf",

    borderRadius:
      "7px",

    background:
      "#f3faf5",

    color:
      "#397451",

    fontSize:
      "11px",

    fontWeight:
      800,

    cursor:
      "pointer",
  },

  secondaryButtonSmall: {
    padding:
      "7px 10px",

    border:
      "1px solid #ddd8cf",

    borderRadius:
      "7px",

    background:
      "#ffffff",

    fontSize:
      "11px",

    fontWeight:
      700,

    cursor:
      "pointer",
  },

  dangerButtonSmall: {
    padding:
      "7px 10px",

    border:
      "1px solid #e2baba",

    borderRadius:
      "7px",

    background:
      "#fff7f7",

    color:
      "#a23f3f",

    fontSize:
      "11px",

    fontWeight:
      700,

    cursor:
      "pointer",
  },

  overdue: {
    color:
      "#b43b3b",

    fontWeight:
      800,
  },

  empty: {
    display:
      "grid",

    gap:
      "6px",

    padding:
      "35px 20px",

    textAlign:
      "center",

    color:
      "#817d74",
  },

  error: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "20px",

    padding:
      "20px",

    border:
      "1px solid #efcaca",

    borderRadius:
      "14px",

    background:
      "#fff7f7",

    color:
      "#9f3c3c",
  },
};
