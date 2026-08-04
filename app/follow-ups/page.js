"use client";

import { useEffect, useMemo, useState } from "react";
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

const STATUS_OPTIONS = [
  "Pending",
  "Completed",
];

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchFollowUps();
  }, []);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(
        window.location.search
      );

      if (searchParams.get("create") === "true") {
        setShowForm(true);

        window.history.replaceState(
          {},
          "",
          window.location.pathname
        );
      }
    } catch (error) {
      console.error(
        "Unable to read follow-up parameters:",
        error
      );
    }
  }, []);

  async function fetchFollowUps() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/follow-ups", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load follow-ups."
        );
      }

      setFollowUps(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Follow-up loading error:", error);

      setErrorMessage(
        error.message ||
          "We could not load the follow-ups."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function openCreateForm() {
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function closeCreateForm() {
    setFormData(EMPTY_FORM);
    setShowForm(false);
  }

  async function createFollowUp(event) {
    event.preventDefault();

    const cleanTitle = formData.title.trim();

    if (!cleanTitle) {
      alert("Please enter a follow-up title.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/follow-ups", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          related_type:
            formData.related_type || "General",

          title: cleanTitle,

          note: formData.note.trim(),

          due_date:
            formData.due_date || null,

          status:
            formData.status || "Pending",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create follow-up."
        );
      }

      const createdFollowUp = Array.isArray(data)
        ? data[0]
        : data;

      if (createdFollowUp) {
        setFollowUps((currentFollowUps) => [
          createdFollowUp,
          ...currentFollowUps,
        ]);
      } else {
        await fetchFollowUps();
      }

      closeCreateForm();

      alert("Follow-up created successfully.");
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

  async function updateStatus(id, status) {
    try {
      const response = await fetch(
        `/api/follow-ups/${id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update follow-up."
        );
      }

      setFollowUps((currentFollowUps) =>
        currentFollowUps.map((followUp) =>
          String(followUp.id) === String(id)
            ? {
                ...followUp,
                ...(Array.isArray(data)
                  ? data[0]
                  : data),
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

      await fetchFollowUps();
    }
  }

  async function deleteFollowUp(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this follow-up?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/follow-ups/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete follow-up."
        );
      }

      setFollowUps((currentFollowUps) =>
        currentFollowUps.filter(
          (followUp) =>
            String(followUp.id) !== String(id)
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

  const filteredFollowUps = useMemo(() => {
    const search = searchValue
      .trim()
      .toLowerCase();

    return followUps
      .filter((followUp) => {
        const matchesSearch =
          !search ||
          [
            followUp.title,
            followUp.note,
            followUp.related_type,
            followUp.status,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search)
          );

        const matchesStatus =
          statusFilter === "All" ||
          normaliseStatus(followUp.status) ===
            normaliseStatus(statusFilter);

        const matchesType =
          typeFilter === "All" ||
          normaliseStatus(
            followUp.related_type
          ) === normaliseStatus(typeFilter);

        return (
          matchesSearch &&
          matchesStatus &&
          matchesType
        );
      })
      .sort(sortFollowUps);
  }, [
    followUps,
    searchValue,
    statusFilter,
    typeFilter,
  ]);

  const pendingCount = followUps.filter(
    (item) =>
      normaliseStatus(item.status) !==
      "completed"
  ).length;

  const completedCount = followUps.filter(
    (item) =>
      normaliseStatus(item.status) ===
      "completed"
  ).length;

  const overdueCount = followUps.filter(
    (item) => isFollowUpOverdue(item)
  ).length;

  const todayCount = followUps.filter(
    (item) =>
      normaliseStatus(item.status) !==
        "completed" &&
      isToday(item.due_date)
  ).length;

  const filtersActive =
    Boolean(searchValue) ||
    statusFilter !== "All" ||
    typeFilter !== "All";

  function clearFilters() {
    setSearchValue("");
    setStatusFilter("All");
    setTypeFilter("All");
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="Follow-ups"
        description="Manage reminders, customer actions and upcoming business commitments."
      >
        <div className={styles.page}>
          <section className={styles.pageHeader}>
            <div className={styles.pageHeaderCopy}>
              <span className={styles.eyebrow}>
                Action workspace
              </span>

              <h2>Follow-up management</h2>

              <p>
                Track customer actions, reminders,
                upcoming commitments and overdue
                follow-ups across SaiNal One.
              </p>
            </div>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={
                showForm
                  ? closeCreateForm
                  : openCreateForm
              }
            >
              <span>{showForm ? "×" : "+"}</span>

              {showForm
                ? "Close form"
                : "Create follow-up"}
            </button>
          </section>

          {showForm && (
            <section className={styles.formPanel}>
              <div className={styles.formHeading}>
                <h3>Create a new follow-up</h3>

                <p>
                  Add an action, reminder, note and
                  due date.
                </p>
              </div>

              <form
                className={styles.followUpForm}
                onSubmit={createFollowUp}
              >
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label htmlFor="follow-up-type">
                      Related area
                    </label>

                    <select
                      id="follow-up-type"
                      name="related_type"
                      value={formData.related_type}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      {RELATED_TYPE_OPTIONS.map(
                        (option) => (
                          <option
                            key={option}
                            value={option}
                          >
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="follow-up-status">
                      Status
                    </label>

                    <select
                      id="follow-up-status"
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      {STATUS_OPTIONS.map(
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
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="Example: Call customer about proposal approval"
                      disabled={saving}
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
                      value={formData.note}
                      onChange={handleChange}
                      placeholder="Add context or the expected next action."
                      rows={5}
                      disabled={saving}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="follow-up-due-date">
                      Due date
                    </label>

                    <input
                      id="follow-up-due-date"
                      type="date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={closeCreateForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving follow-up..."
                      : "Save follow-up"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className={styles.summaryGrid}>
            <SummaryCard
              icon="◷"
              label="Pending"
              value={pendingCount}
              detail="Actions still open"
              tone="Gold"
            />

            <SummaryCard
              icon="!"
              label="Overdue"
              value={overdueCount}
              detail="Require attention"
              tone="Red"
            />

            <SummaryCard
              icon="○"
              label="Due today"
              value={todayCount}
              detail="Today's commitments"
              tone="Blue"
            />

            <SummaryCard
              icon="✓"
              label="Completed"
              value={completedCount}
              detail="Actions finished"
              tone="Green"
            />
          </section>

          <section className={styles.toolbarPanel}>
            <label className={styles.searchBox}>
              <span aria-hidden="true">⌕</span>

              <input
                type="search"
                placeholder="Search title, note, type or status..."
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(event.target.value)
                }
                aria-label="Search follow-ups"
              />
            </label>

            <div className={styles.filters}>
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="Filter by status"
              >
                <option value="All">
                  All statuses
                </option>

                {STATUS_OPTIONS.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>

              <select
                className={styles.filterSelect}
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value)
                }
                aria-label="Filter by type"
              >
                <option value="All">All types</option>

                {RELATED_TYPE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  )
                )}
              </select>

              {filtersActive && (
                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          {loading ? (
            <LoadingState />
          ) : errorMessage ? (
            <section className={styles.errorPanel}>
              <div>
                <strong>
                  Unable to load follow-ups
                </strong>

                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={fetchFollowUps}
              >
                Try again
              </button>
            </section>
          ) : (
            <section className={styles.tablePanel}>
              <div className={styles.tableHeading}>
                <div>
                  <h3>Follow-up records</h3>

                  <p>
                    Notes and full action details are
                    available inside each follow-up
                    workspace.
                  </p>
                </div>

                <span className={styles.resultCount}>
                  {filteredFollowUps.length} result
                  {filteredFollowUps.length === 1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredFollowUps.length === 0 ? (
                <EmptyState
                  hasFilters={filtersActive}
                  onClearFilters={clearFilters}
                  onCreateFollowUp={openCreateForm}
                />
              ) : (
                <div className={styles.tableWrapper}>
                  <table
                    className={styles.followUpTable}
                  >
                    <thead>
                      <tr>
                        <th>Follow-up</th>
                        <th>Related area</th>
                        <th>Due date</th>
                        <th>Status</th>
                        <th>Action</th>
                        <th aria-label="Open" />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredFollowUps.map(
                        (followUp) => {
                          const overdue =
                            isFollowUpOverdue(
                              followUp
                            );

                          return (
                            <tr key={followUp.id}>
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
                                    ◷
                                  </span>

                                  <div
                                    className={
                                      styles.followUpIdentityCopy
                                    }
                                  >
                                    <Link
                                      href={`/follow-ups/${followUp.id}`}
                                      className={
                                        styles.followUpLink
                                      }
                                    >
                                      {followUp.title ||
                                        "Untitled follow-up"}
                                    </Link>

                                    <small>
                                      Open follow-up workspace
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
                                  {followUp.related_type ||
                                    "General"}
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
                                    followUp.due_date
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
                                    followUp.status ||
                                    "Pending"
                                  }
                                />
                              </td>

                              <td>
                                <select
                                  className={
                                    styles.statusSelect
                                  }
                                  value={
                                    followUp.status ||
                                    "Pending"
                                  }
                                  onChange={(event) =>
                                    updateStatus(
                                      followUp.id,
                                      event.target.value
                                    )
                                  }
                                >
                                  {STATUS_OPTIONS.map(
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

                                <button
                                  type="button"
                                  className={
                                    styles.deleteButton
                                  }
                                  onClick={() =>
                                    deleteFollowUp(
                                      followUp.id
                                    )
                                  }
                                >
                                  Delete
                                </button>
                              </td>

                              <td>
                                <Link
                                  href={`/follow-ups/${followUp.id}`}
                                  className={
                                    styles.openButton
                                  }
                                >
                                  Open →
                                </Link>
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
        styles[`summary${tone}`] || ""
      }`}
    >
      <span className={styles.summaryIcon}>
        {icon}
      </span>

      <span className={styles.summaryLabel}>
        {label}
      </span>

      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onCreateFollowUp,
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>
        ◷
      </span>

      <h3>
        {hasFilters
          ? "No matching follow-ups"
          : "No follow-ups yet"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current filters."
          : "Create your first follow-up to begin tracking business actions and reminders."}
      </p>

      <button
        type="button"
        className={styles.primaryButton}
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
    <section className={styles.loadingPanel}>
      {Array.from({
        length: 5,
      }).map((_, index) => (
        <div
          key={index}
          className={styles.loadingRow}
        />
      ))}
    </section>
  );
}

function sortFollowUps(firstItem, secondItem) {
  const firstCompleted =
    normaliseStatus(firstItem.status) ===
    "completed";

  const secondCompleted =
    normaliseStatus(secondItem.status) ===
    "completed";

  if (firstCompleted !== secondCompleted) {
    return firstCompleted ? 1 : -1;
  }

  const firstDate =
    firstItem.due_date || "9999-12-31";

  const secondDate =
    secondItem.due_date || "9999-12-31";

  return firstDate.localeCompare(secondDate);
}

function normaliseStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isFollowUpOverdue(followUp) {
  if (
    !followUp.due_date ||
    normaliseStatus(followUp.status) ===
      "completed"
  ) {
    return false;
  }

  const dueDate = new Date(
    `${String(followUp.due_date).split("T")[0]}T23:59:59`
  );

  return (
    !Number.isNaN(dueDate.getTime()) &&
    dueDate < new Date()
  );
}

function isToday(value) {
  if (!value) {
    return false;
  }

  const date = new Date(
    `${String(value).split("T")[0]}T12:00:00`
  );

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(
    `${String(value).split("T")[0]}T12:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
