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
  "In Progress",
  "Completed",
  "Cancelled",
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

const EMPTY_FORM = {
  title: "",
  note: "",
  due_date: "",
  status: "Pending",
  related_type: "General",
  related_id: "",
  assigned_employee_id: "",
};

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

// =========================================================
// PAGE
// =========================================================

export default function FollowUpsPage() {
  const [
    followUps,
    setFollowUps,
  ] = useState([]);

  const [
    employees,
    setEmployees,
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
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM
  );

  const [
    editingId,
    setEditingId,
  ] = useState(null);

  const [
    editForm,
    setEditForm,
  ] = useState(
    EMPTY_FORM
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All");

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    loadFollowUps();
  }, []);

  async function loadFollowUps() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          "/api/follow-ups",
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
            "Unable to load follow-ups."
        );
      }

      setFollowUps(
        Array.isArray(
          data.followUps
        )
          ? data.followUps
          : []
      );

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
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
    } catch (error) {
      console.error(
        "Follow-up loading error:",
        error
      );

      setFollowUps([]);

      setErrorMessage(
        error.message ||
          "Unable to load follow-ups."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // CREATE
  // =======================================================

  function openCreateForm() {
    setForm({
      ...EMPTY_FORM,

      assigned_employee_id:
        access.canAssign
          ? currentEmployee
              ?.id || ""
          : "",
    });

    setShowForm(true);
  }

  function closeCreateForm() {
    setShowForm(false);

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
      (current) => ({
        ...current,

        [name]:
          value,
      })
    );
  }

  async function createFollowUp(
    event
  ) {
    event.preventDefault();

    if (
      !form.title.trim()
    ) {
      alert(
        "Follow-up title is required."
      );

      return;
    }

    try {
      setSaving(true);

      const payload = {
        title:
          form.title.trim(),

        note:
          form.note.trim(),

        due_date:
          form.due_date ||
          null,

        status:
          form.status,

        related_type:
          form.related_type,

        related_id:
          form.related_id.trim() ||
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
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create follow-up."
        );
      }

      closeCreateForm();

      await loadFollowUps();
    } catch (error) {
      alert(
        error.message ||
          "Unable to create follow-up."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // EDIT
  // =======================================================

  function startEdit(item) {
    setEditingId(
      item.id
    );

    setEditForm({
      title:
        item.title || "",

      note:
        item.note || "",

      due_date:
        normaliseDateInput(
          item.due_date
        ),

      status:
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
    });
  }

  function cancelEdit() {
    setEditingId(null);

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
      (current) => ({
        ...current,

        [name]:
          value,
      })
    );
  }

  async function saveFollowUp(
    id
  ) {
    try {
      setSaving(true);

      const payload = {};

      if (
        access.canEdit
      ) {
        payload.title =
          editForm.title.trim();

        payload.note =
          editForm.note.trim();

        payload.due_date =
          editForm.due_date ||
          null;

        payload.status =
          editForm.status;

        payload.related_type =
          editForm.related_type;

        payload.related_id =
          editForm.related_id.trim() ||
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
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update follow-up."
        );
      }

      cancelEdit();

      await loadFollowUps();
    } catch (error) {
      alert(
        error.message ||
          "Unable to update follow-up."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // QUICK COMPLETE
  // =======================================================

  async function completeFollowUp(
    item
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
                status:
                  "Completed",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to complete follow-up."
        );
      }

      await loadFollowUps();
    } catch (error) {
      alert(
        error.message ||
          "Unable to complete follow-up."
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

    if (!confirmed) {
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
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete follow-up."
        );
      }

      await loadFollowUps();
    } catch (error) {
      alert(
        error.message ||
          "Unable to delete follow-up."
      );
    }
  }

  // =======================================================
  // FILTERS
  // =======================================================

  const filtered =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return followUps.filter(
        (item) => {
          const matchesSearch =
            !query ||
            [
              item.title,
              item.note,
              item.related_type,
              item.status,
              item.assigned_employee
                ?.full_name,
            ].some(
              (value) =>
                String(
                  value || ""
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

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      followUps,
      search,
      statusFilter,
    ]);

  // =======================================================
  // METRICS
  // =======================================================

  const pendingCount =
    followUps.filter(
      (item) =>
        [
          "pending",
          "in progress",
        ].includes(
          normalise(
            item.status
          )
        )
    ).length;

  const completedCount =
    followUps.filter(
      (item) =>
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
        description="Manage customer and operational follow-up activity."
      >
        <div
          style={
            styles.page
          }
        >
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
                Delivery workspace
              </span>

              <h2
                style={
                  styles.heading
                }
              >
                Follow-up centre
              </h2>

              <p
                style={
                  styles.description
                }
              >
                Track actions,
                reminders and
                customer follow-ups
                assigned across your
                organisation.
              </p>
            </div>

            {access.canCreate && (
              <button
                type="button"
                style={
                  styles.primaryButton
                }
                onClick={
                  showForm
                    ? closeCreateForm
                    : openCreateForm
                }
              >
                {showForm
                  ? "Close form"
                  : "+ Add follow-up"}
              </button>
            )}
          </section>

          {showForm &&
            access.canCreate && (
              <section
                style={
                  styles.panel
                }
              >
                <h3>
                  Create follow-up
                </h3>

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
                    <Field
                      label="Title"
                      name="title"
                      value={
                        form.title
                      }
                      onChange={
                        handleFormChange
                      }
                    />

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

                    <Field
                      label="Related record ID"
                      name="related_id"
                      value={
                        form.related_id
                      }
                      onChange={
                        handleFormChange
                      }
                    />

                    {access.canAssign && (
                      <label
                        style={
                          styles.field
                        }
                      >
                        <span>
                          Assigned employee
                        </span>

                        <select
                          name="assigned_employee_id"
                          value={
                            form.assigned_employee_id
                          }
                          onChange={
                            handleFormChange
                          }
                          style={
                            styles.input
                          }
                        >
                          <option value="">
                            Assign to me
                          </option>

                          {employees.map(
                            (employee) => (
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
                      ...styles.field,
                      marginTop:
                        "14px",
                    }}
                  >
                    <span>
                      Notes
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
                        : "Save follow-up"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          <section
            style={
              styles.summaryGrid
            }
          >
            <Summary
              label="Visible follow-ups"
              value={
                followUps.length
              }
            />

            <Summary
              label="Pending"
              value={
                pendingCount
              }
            />

            <Summary
              label="Overdue"
              value={
                overdueCount
              }
            />

            <Summary
              label="Completed"
              value={
                completedCount
              }
            />
          </section>

          <section
            style={
              styles.toolbar
            }
          >
            <input
              type="search"
              placeholder="Search follow-ups, assignee, status or related record..."
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
          </section>

          {loading ? (
            <div
              style={
                styles.panel
              }
            >
              Loading follow-ups...
            </div>
          ) : errorMessage ? (
            <section
              style={
                styles.error
              }
            >
              <div>
                <strong>
                  Unable to load follow-ups
                </strong>

                <p>
                  {errorMessage}
                </p>
              </div>

              <button
                type="button"
                style={
                  styles.secondaryButton
                }
                onClick={
                  loadFollowUps
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
                  <h3>
                    Follow-up records
                  </h3>

                  <p>
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
                  No follow-ups found.
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
                          Follow-up
                        </th>

                        <th
                          style={
                            styles.th
                          }
                        >
                          Related
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
                          Due
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
                        (item) => {
                          const editing =
                            editingId ===
                            item.id;

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
                                        {item.note}
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
                                  <select
                                    name="assigned_employee_id"
                                    value={
                                      editForm.assigned_employee_id
                                    }
                                    onChange={
                                      handleEditChange
                                    }
                                    style={
                                      styles.input
                                    }
                                  >
                                    <option value="">
                                      Unassigned
                                    </option>

                                    {employees.map(
                                      (employee) => (
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
                                        onClick={() =>
                                          saveFollowUp(
                                            item.id
                                          )
                                        }
                                      >
                                        Save
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
                                          "completed" && (
                                          <button
                                            type="button"
                                            style={
                                              styles.secondaryButtonSmall
                                            }
                                            onClick={() =>
                                              completeFollowUp(
                                                item
                                              )
                                            }
                                          >
                                            Complete
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
// COMPONENTS
// =========================================================

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
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
          value
        }
        onChange={
          onChange
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
        value
      }
      onChange={
        onChange
      }
      style={
        styles.input
      }
    >
      {options.map(
        (option) => (
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

function Summary({
  label,
  value,
}) {
  return (
    <article
      style={
        styles.summary
      }
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
// HELPERS
// =========================================================

function normalise(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function normaliseDateInput(value) {
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

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  const date =
    new Date(
      `${String(value).slice(
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

function isOverdue(item) {
  if (
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

// =========================================================
// SELF-CONTAINED STYLES
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

  summaryGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap:
      "14px",
  },

  summary: {
    display:
      "grid",
    gap:
      "10px",
    minHeight:
      "115px",
    padding:
      "17px",
    border:
      "1px solid #dfdbd1",
    borderRadius:
      "14px",
    background:
      "#ffffff",
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
  },

  td: {
    padding:
      "13px 12px",
    borderBottom:
      "1px solid #efede7",
    verticalAlign:
      "top",
  },

  note: {
    display:
      "block",
    maxWidth:
      "360px",
    marginTop:
      "4px",
    color:
      "#858078",
  },

  rowActions: {
    display:
      "flex",
    flexWrap:
      "wrap",
    gap:
      "6px",
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
