"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatusBadge from "../../../components/StatusBadge";

import styles from "./follow-up-details.module.css";

const STATUS_OPTIONS = [
  "Pending",
  "Completed",
];

const RELATED_TYPE_OPTIONS = [
  "General",
  "Lead",
  "Quote",
  "Customer",
  "Project",
  "Invoice",
];

export default function FollowUpDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const followUpId = params?.id;

  const [followUp, setFollowUp] = useState(null);
  const [draftFollowUp, setDraftFollowUp] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (followUpId) {
      fetchFollowUp();
    }
  }, [followUpId]);

  async function fetchFollowUp() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/follow-ups",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load follow-up."
        );
      }

      const selectedFollowUp = (
        Array.isArray(data) ? data : []
      ).find(
        (item) =>
          String(item.id) ===
          String(followUpId)
      );

      setFollowUp(selectedFollowUp || null);
      setDraftFollowUp(
        selectedFollowUp
          ? {
              ...selectedFollowUp,
              due_date: normaliseDateInput(
                selectedFollowUp.due_date
              ),
            }
          : null
      );
    } catch (error) {
      console.error(
        "Follow-up loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load this follow-up."
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setDraftFollowUp({
      ...followUp,
      due_date: normaliseDateInput(
        followUp.due_date
      ),
    });

    setEditing(true);
  }

  function cancelEditing() {
    setDraftFollowUp({
      ...followUp,
      due_date: normaliseDateInput(
        followUp.due_date
      ),
    });

    setEditing(false);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setDraftFollowUp((currentFollowUp) => ({
      ...currentFollowUp,
      [name]: value,
    }));
  }

  async function saveFollowUp() {
    if (!draftFollowUp?.title?.trim()) {
      alert("Follow-up title is required.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/follow-ups/${followUpId}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            related_type:
              draftFollowUp.related_type ||
              "General",

            title:
              draftFollowUp.title.trim(),

            note: String(
              draftFollowUp.note || ""
            ).trim(),

            due_date:
              draftFollowUp.due_date || null,

            status:
              draftFollowUp.status ||
              "Pending",
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

      const updatedFollowUp = Array.isArray(data)
        ? data[0]
        : data;

      const finalFollowUp = {
        ...followUp,
        ...draftFollowUp,
        ...(updatedFollowUp || {}),
      };

      setFollowUp(finalFollowUp);
      setDraftFollowUp({
        ...finalFollowUp,
        due_date: normaliseDateInput(
          finalFollowUp.due_date
        ),
      });

      setEditing(false);

      alert("Follow-up updated successfully.");
    } catch (error) {
      console.error(
        "Follow-up update error:",
        error
      );

      alert(
        error.message ||
          "Error updating follow-up."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status) {
    try {
      setSaving(true);

      const response = await fetch(
        `/api/follow-ups/${followUpId}`,
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
            "Failed to update follow-up status."
        );
      }

      const updatedFollowUp = Array.isArray(data)
        ? data[0]
        : data;

      setFollowUp((currentFollowUp) => ({
        ...currentFollowUp,
        ...(updatedFollowUp || {}),
        status,
      }));

      setDraftFollowUp((currentFollowUp) => ({
        ...currentFollowUp,
        ...(updatedFollowUp || {}),
        status,
      }));
    } catch (error) {
      console.error(
        "Follow-up status error:",
        error
      );

      alert(
        error.message ||
          "Error updating follow-up status."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteFollowUp() {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this follow-up?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(
        `/api/follow-ups/${followUpId}`,
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

      router.push("/follow-ups");
    } catch (error) {
      console.error(
        "Follow-up deletion error:",
        error
      );

      alert(
        error.message ||
          "Error deleting follow-up."
      );
    } finally {
      setDeleting(false);
    }
  }

  const overdue = useMemo(
    () =>
      followUp
        ? isFollowUpOverdue(followUp)
        : false,
    [followUp]
  );

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Follow-up Workspace"
          description="Loading follow-up information."
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
          title="Follow-up Workspace"
          description="Manage actions and reminders."
        >
          <section className={styles.errorPanel}>
            <div>
              <strong>
                Unable to load follow-up
              </strong>

              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={fetchFollowUp}
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!followUp || !draftFollowUp) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Follow-up Workspace"
          description="Manage actions and reminders."
        >
          <section className={styles.notFound}>
            <span className={styles.notFoundIcon}>
              ◷
            </span>

            <h2>Follow-up not found</h2>

            <p>
              This follow-up may have been
              deleted or is no longer available.
            </p>

            <Link
              href="/follow-ups"
              className={styles.primaryButton}
            >
              Return to follow-ups
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const visibleFollowUp = editing
    ? draftFollowUp
    : followUp;

  const recommendations =
    buildRecommendations(
      visibleFollowUp,
      overdue
    );

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          visibleFollowUp.title ||
          "Follow-up Workspace"
        }
        description="Manage reminders, actions and completion status."
      >
        <div className={styles.page}>
          <section className={styles.pageHeader}>
            <div className={styles.headerCopy}>
              <Link
                href="/follow-ups"
                className={styles.backLink}
              >
                ← Back to follow-ups
              </Link>

              <span className={styles.eyebrow}>
                Action workspace
              </span>

              <h2>
                {visibleFollowUp.title ||
                  "Untitled follow-up"}
              </h2>

              <p>
                Review, edit, reschedule or
                complete this business action.
              </p>
            </div>

            <div className={styles.headerActions}>
              {!editing ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={startEditing}
                >
                  Edit follow-up
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    disabled={saving}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    disabled={saving}
                    onClick={saveFollowUp}
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </>
              )}

              {normaliseStatus(
                followUp.status
              ) !== "completed" && (
                <button
                  type="button"
                  className={styles.successButton}
                  disabled={saving}
                  onClick={() =>
                    updateStatus("Completed")
                  }
                >
                  Mark completed
                </button>
              )}

              <button
                type="button"
                className={styles.dangerButton}
                disabled={deleting}
                onClick={deleteFollowUp}
              >
                {deleting
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </section>

          <section className={styles.heroCard}>
            <div className={styles.followUpIdentity}>
              <span className={styles.followUpIcon}>
                ◷
              </span>

              <div className={styles.identityCopy}>
                <span className={styles.identityLabel}>
                  Business follow-up
                </span>

                <h3>
                  {visibleFollowUp.title}
                </h3>

                <p>
                  {visibleFollowUp.note ||
                    "No follow-up notes have been added."}
                </p>

                <div className={styles.identityMeta}>
                  <StatusBadge
                    status={
                      visibleFollowUp.status ||
                      "Pending"
                    }
                  />

                  <span className={styles.metaBadge}>
                    {visibleFollowUp.related_type ||
                      "General"}
                  </span>

                  <span
                    className={
                      overdue
                        ? styles.overdueBadge
                        : styles.metaBadge
                    }
                  >
                    {overdue
                      ? "Follow-up overdue"
                      : `Due ${formatDate(
                          visibleFollowUp.due_date
                        )}`}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.heroMetrics}>
              <HeroMetric
                label="Status"
                value={
                  visibleFollowUp.status ||
                  "Pending"
                }
              />

              <HeroMetric
                label="Due date"
                value={formatDate(
                  visibleFollowUp.due_date
                )}
                warning={overdue}
              />

              <HeroMetric
                label="Related area"
                value={
                  visibleFollowUp.related_type ||
                  "General"
                }
              />
            </div>
          </section>

          <section className={styles.workspaceGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3>Follow-up information</h3>

                <p>
                  Action details, notes and
                  completion status
                </p>
              </div>

              {editing ? (
                <div className={styles.formGrid}>
                  <div
                    className={`${styles.field} ${styles.fieldFull}`}
                  >
                    <label htmlFor="edit-title">
                      Title *
                    </label>

                    <input
                      id="edit-title"
                      name="title"
                      value={draftFollowUp.title || ""}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="edit-related-type">
                      Related area
                    </label>

                    <select
                      id="edit-related-type"
                      name="related_type"
                      value={
                        draftFollowUp.related_type ||
                        "General"
                      }
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
                    <label htmlFor="edit-status">
                      Status
                    </label>

                    <select
                      id="edit-status"
                      name="status"
                      value={
                        draftFollowUp.status ||
                        "Pending"
                      }
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

                  <div className={styles.field}>
                    <label htmlFor="edit-due-date">
                      Due date
                    </label>

                    <input
                      id="edit-due-date"
                      name="due_date"
                      type="date"
                      value={
                        draftFollowUp.due_date ||
                        ""
                      }
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>

                  <div
                    className={`${styles.field} ${styles.fieldFull}`}
                  >
                    <label htmlFor="edit-note">
                      Notes
                    </label>

                    <textarea
                      id="edit-note"
                      name="note"
                      rows={7}
                      value={
                        draftFollowUp.note || ""
                      }
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : (
                <div className={styles.detailList}>
                  <DetailRow
                    label="Title"
                    value={followUp.title}
                  />

                  <DetailRow
                    label="Related area"
                    value={
                      followUp.related_type
                    }
                  />

                  <DetailRow
                    label="Status"
                    customValue={
                      <StatusBadge
                        status={
                          followUp.status ||
                          "Pending"
                        }
                      />
                    }
                  />

                  <DetailRow
                    label="Due date"
                    value={formatDate(
                      followUp.due_date
                    )}
                  />

                  <DetailRow
                    label="Created"
                    value={formatDate(
                      followUp.created_at
                    )}
                  />

                  <DetailRow
                    label="Notes"
                    value={followUp.note}
                  />
                </div>
              )}
            </section>

            <section className={styles.aiPanel}>
              <div className={styles.aiHeader}>
                <span className={styles.aiIcon}>
                  ✦
                </span>

                <div>
                  <span>Action intelligence</span>
                  <h3>Next-action overview</h3>
                </div>
              </div>

              <div className={styles.riskGrid}>
                <RiskMetric
                  label="Action status"
                  value={
                    followUp.status ||
                    "Pending"
                  }
                />

                <RiskMetric
                  label="Timing"
                  value={
                    overdue
                      ? "Overdue"
                      : isToday(
                          followUp.due_date
                        )
                        ? "Due today"
                        : "Scheduled"
                  }
                />

                <RiskMetric
                  label="Related area"
                  value={
                    followUp.related_type ||
                    "General"
                  }
                />

                <RiskMetric
                  label="Notes"
                  value={
                    followUp.note
                      ? "Available"
                      : "Missing"
                  }
                />
              </div>

              <div
                className={styles.aiRecommendations}
              >
                <span>Recommended actions</span>

                {recommendations.map(
                  (recommendation, index) => (
                    <div
                      key={`${recommendation}-${index}`}
                      className={
                        styles.recommendationItem
                      }
                    >
                      <span>→</span>
                      <p>{recommendation}</p>
                    </div>
                  )
                )}
              </div>
            </section>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>Follow-up activity</h3>

              <p>
                Current lifecycle of this
                business action
              </p>
            </div>

            <div className={styles.timeline}>
              <TimelineItem
                title="Follow-up created"
                description="The follow-up was added to the action workspace."
                date={followUp.created_at}
              />

              {followUp.due_date && (
                <TimelineItem
                  title={
                    overdue
                      ? "Follow-up overdue"
                      : "Follow-up scheduled"
                  }
                  description={`Action due ${formatDate(
                    followUp.due_date
                  )}.`}
                  date={followUp.due_date}
                />
              )}

              {normaliseStatus(
                followUp.status
              ) === "completed" && (
                <TimelineItem
                  title="Follow-up completed"
                  description="The action has been marked as completed."
                  date={
                    followUp.updated_at ||
                    followUp.created_at
                  }
                />
              )}
            </div>
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
    <div className={styles.detailRow}>
      <span>{label}</span>

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
          {value || "Not available"}
        </strong>
      )}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  warning = false,
}) {
  return (
    <div
      className={`${styles.heroMetric} ${
        warning
          ? styles.heroMetricWarning
          : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RiskMetric({
  label,
  value,
}) {
  return (
    <div className={styles.riskMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TimelineItem({
  title,
  description,
  date,
}) {
  return (
    <div className={styles.timelineItem}>
      <span className={styles.timelineDot} />

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <time>{formatDate(date)}</time>
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

function normaliseDateInput(value) {
  if (!value) {
    return "";
  }

  return String(value).split("T")[0];
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
    `${normaliseDateInput(
      followUp.due_date
    )}T23:59:59`
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
    `${normaliseDateInput(value)}T12:00:00`
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

  const dateValue = normaliseDateInput(value);

  const date = new Date(
    `${dateValue}T12:00:00`
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

function buildRecommendations(
  followUp,
  overdue
) {
  const recommendations = [];

  if (
    normaliseStatus(followUp.status) ===
    "completed"
  ) {
    recommendations.push(
      "No further action is required unless another follow-up should be scheduled."
    );
  } else if (overdue) {
    recommendations.push(
      "Complete or reschedule this overdue follow-up as soon as possible."
    );
  } else if (isToday(followUp.due_date)) {
    recommendations.push(
      "This follow-up is due today and should be prioritised."
    );
  } else {
    recommendations.push(
      "Review the action before its due date and prepare any required information."
    );
  }

  if (!followUp.due_date) {
    recommendations.push(
      "Add a due date so the follow-up can be tracked properly."
    );
  }

  if (!followUp.note) {
    recommendations.push(
      "Add notes describing the expected outcome or next action."
    );
  }

  if (
    normaliseStatus(
      followUp.related_type
    ) === "general"
  ) {
    recommendations.push(
      "Consider assigning the follow-up to a lead, customer, quote, project or invoice."
    );
  }

  return recommendations.slice(0, 5);
}
