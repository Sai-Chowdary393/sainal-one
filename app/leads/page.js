"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "../../components/layout/AppLayout";
import StatusBadge from "../../components/StatusBadge";
import ProtectedRoute from "../../components/ProtectedRoute";
import styles from "./leads.module.css";

const INITIAL_FORM_DATA = {
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "New",
  value: "",
};

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Proposal Sent",
  "Follow Up",
  "Won",
  "Lost",
];

export default function Leads() {
  const [showForm, setShowForm] = useState(false);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [formData, setFormData] = useState(
    INITIAL_FORM_DATA
  );

  useEffect(() => {
    fetchLeads();
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
        "Unable to read lead page parameters:",
        error
      );
    }
  }, []);

  async function fetchLeads() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/leads", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load leads."
        );
      }

      setLeads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lead loading error:", error);

      setErrorMessage(
        error.message ||
          "We could not load the leads."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function openCreateForm() {
    setFormData(INITIAL_FORM_DATA);
    setShowForm(true);
  }

  function closeCreateForm() {
    setFormData(INITIAL_FORM_DATA);
    setShowForm(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanName = formData.name.trim();
    const cleanCompany = formData.company.trim();

    if (!cleanName || !cleanCompany) {
      alert("Please enter lead name and company.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          name: cleanName,
          company: cleanCompany,
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          value: formData.value.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to save lead."
        );
      }

      const createdLead = Array.isArray(data)
        ? data[0]
        : data;

      if (createdLead) {
        setLeads((currentLeads) => [
          createdLead,
          ...currentLeads,
        ]);
      } else {
        await fetchLeads();
      }

      closeCreateForm();
    } catch (error) {
      console.error("Lead creation error:", error);

      alert(
        error.message || "Error saving lead."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredLeads = useMemo(() => {
    const normalisedSearchValue = searchValue
      .trim()
      .toLowerCase();

    return leads.filter((lead) => {
      const matchesSearch =
        !normalisedSearchValue ||
        [
          lead.name,
          lead.company,
          lead.status,
          lead.source,
          lead.ai_score,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalisedSearchValue)
        );

      const matchesStatus =
        statusFilter === "All" ||
        String(lead.status || "")
          .trim()
          .toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [leads, searchValue, statusFilter]);

  const hotLeads = leads.filter((lead) =>
    String(lead.ai_score || "")
      .toLowerCase()
      .includes("hot")
  ).length;

  const wonLeads = leads.filter(
    (lead) =>
      String(lead.status || "")
        .trim()
        .toLowerCase() === "won"
  ).length;

  const newLeads = leads.filter(
    (lead) =>
      String(lead.status || "")
        .trim()
        .toLowerCase() === "new"
  ).length;

  function clearFilters() {
    setSearchValue("");
    setStatusFilter("All");
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="Leads"
        description="Manage enquiries, opportunities and AI-qualified leads."
      >
        <div className={styles.page}>
          <section className={styles.pageHeader}>
            <div className={styles.pageHeaderCopy}>
              <span className={styles.eyebrow}>
                CRM workspace
              </span>

              <h2>Lead pipeline</h2>

              <p>
                Review lead progress and open an individual
                record to view contact details, estimated
                value and AI recommendations.
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

              {showForm ? "Close form" : "Add lead"}
            </button>
          </section>

          {showForm && (
            <section className={styles.formPanel}>
              <div className={styles.formHeading}>
                <div>
                  <h3>Create a new lead</h3>
                  <p>
                    Contact and commercial information will
                    only appear inside the lead record.
                  </p>
                </div>
              </div>

              <form
                className={styles.leadForm}
                onSubmit={handleSubmit}
              >
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label htmlFor="lead-name">
                      Lead name *
                    </label>

                    <input
                      id="lead-name"
                      name="name"
                      placeholder="Example: James Smith"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="lead-company">
                      Company *
                    </label>

                    <input
                      id="lead-company"
                      name="company"
                      placeholder="Example: NorthStar Logistics"
                      value={formData.company}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="lead-email">
                      Email
                    </label>

                    <input
                      id="lead-email"
                      name="email"
                      type="email"
                      placeholder="name@company.com"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="lead-phone">
                      Phone
                    </label>

                    <input
                      id="lead-phone"
                      name="phone"
                      type="tel"
                      placeholder="Telephone number"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="lead-status">
                      Status
                    </label>

                    <select
                      id="lead-status"
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="lead-value">
                      Estimated value
                    </label>

                    <input
                      id="lead-value"
                      name="value"
                      placeholder="Example: £2,500"
                      value={formData.value}
                      onChange={handleChange}
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
                    className={styles.primaryButton}
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving lead..."
                      : "Save lead"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className={styles.summaryRow}>
            <SummaryCard
              label="Total leads"
              value={leads.length}
              detail="All current lead records"
            />

            <SummaryCard
              label="New"
              value={newLeads}
              detail="Waiting for initial engagement"
            />

            <SummaryCard
              label="AI hot leads"
              value={hotLeads}
              detail="High-priority opportunities"
            />

            <SummaryCard
              label="Won"
              value={wonLeads}
              detail="Successfully converted"
            />
          </section>

          <section className={styles.toolbarPanel}>
            <label className={styles.searchBox}>
              <span aria-hidden="true">⌕</span>

              <input
                type="search"
                placeholder="Search by name, company, source or AI score..."
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(event.target.value)
                }
                aria-label="Search leads"
              />
            </label>

            <div className={styles.filters}>
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="Filter leads by status"
              >
                <option value="All">All statuses</option>

                {STATUS_OPTIONS.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>

              {(searchValue ||
                statusFilter !== "All") && (
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
                <strong>Unable to load leads</strong>
                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={fetchLeads}
              >
                Try again
              </button>
            </section>
          ) : (
            <section className={styles.tablePanel}>
              <div className={styles.tableHeading}>
                <div>
                  <h3>Lead records</h3>

                  <p>
                    Sensitive information is available only
                    inside each lead record.
                  </p>
                </div>

                <span className={styles.resultCount}>
                  {filteredLeads.length} result
                  {filteredLeads.length === 1 ? "" : "s"}
                </span>
              </div>

              {filteredLeads.length === 0 ? (
                <EmptyState
                  hasFilters={
                    Boolean(searchValue) ||
                    statusFilter !== "All"
                  }
                  onClearFilters={clearFilters}
                  onAddLead={openCreateForm}
                />
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.leadTable}>
                    <thead>
                      <tr>
                        <th>Lead</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Source</th>
                        <th>AI score</th>
                        <th>Created</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td>
                            <div
                              className={
                                styles.leadIdentity
                              }
                            >
                              <span
                                className={
                                  styles.leadAvatar
                                }
                              >
                                {getInitials(
                                  lead.name
                                )}
                              </span>

                              <div
                                className={
                                  styles.leadIdentityCopy
                                }
                              >
                                <Link
                                  href={`/leads/${lead.id}`}
                                  className={
                                    styles.leadLink
                                  }
                                >
                                  {lead.name ||
                                    "Unnamed lead"}
                                </Link>

                                <small>
                                  Open to view full
                                  details
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={
                                styles.companyName
                              }
                            >
                              {lead.company ||
                                "No company"}
                            </span>
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                lead.status || "New"
                              }
                            />
                          </td>

                          <td>
                            <span
                              className={
                                styles.sourceBadge
                              }
                            >
                              {lead.source || "Manual"}
                            </span>
                          </td>

                          <td>
                            <AiScoreBadge
                              score={lead.ai_score}
                            />
                          </td>

                          <td>
                            <span
                              className={
                                styles.createdDate
                              }
                            >
                              {formatDate(
                                lead.created_at
                              )}
                            </span>
                          </td>

                          <td>
                            <Link
                              href={`/leads/${lead.id}`}
                              className={
                                styles.openButton
                              }
                              aria-label={`Open ${
                                lead.name ||
                                "lead"
                              }`}
                            >
                              Open
                              <span>→</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
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

function SummaryCard({ label, value, detail }) {
  return (
    <div className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AiScoreBadge({ score }) {
  const normalisedScore = String(score || "")
    .trim()
    .toLowerCase();

  let label = score || "Not analysed";
  let icon = "—";
  let className = styles.aiNeutral;

  if (normalisedScore.includes("hot")) {
    label = "Hot";
    icon = "●";
    className = styles.aiHot;
  } else if (normalisedScore.includes("warm")) {
    label = "Warm";
    icon = "●";
    className = styles.aiWarm;
  } else if (normalisedScore.includes("cold")) {
    label = "Cold";
    icon = "●";
    className = styles.aiCold;
  }

  return (
    <span
      className={`${styles.aiScore} ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onAddLead,
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>◎</span>

      <h3>
        {hasFilters
          ? "No matching leads"
          : "No leads found"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current search and status filters."
          : "Create your first lead to begin managing your sales pipeline."}
      </p>

      <button
        type="button"
        className={styles.primaryButton}
        onClick={
          hasFilters
            ? onClearFilters
            : onAddLead
        }
      >
        {hasFilters ? "Clear filters" : "Add lead"}
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <section className={styles.loadingPanel}>
      {Array.from({ length: 5 }).map(
        (_, index) => (
          <div
            key={index}
            className={styles.loadingRow}
          />
        )
      )}
    </section>
  );
}

function getInitials(value = "") {
  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "LD";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
