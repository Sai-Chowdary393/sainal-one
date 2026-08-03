"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "../../../components/layout/AppLayout";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";
import styles from "./lead-details.module.css";

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Proposal Sent",
  "Follow Up",
  "Won",
  "Lost",
];

export default function LeadDetails() {
  const params = useParams();
  const router = useRouter();
  const leadId = params?.id;

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [emailDraft, setEmailDraft] = useState("");
  const [quoteDraft, setQuoteDraft] = useState("");
  const [quoteSaved, setQuoteSaved] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingEmail, setGeneratingEmail] =
    useState(false);
  const [generatingQuote, setGeneratingQuote] =
    useState(false);
  const [creatingFollowUp, setCreatingFollowUp] =
    useState(false);

  useEffect(() => {
    if (leadId) {
      fetchLead();
    }
  }, [leadId]);

  async function fetchLead() {
    try {
      setLoading(true);
      setErrorMessage("");

      const directResponse = await fetch(
        `/api/leads/${leadId}`,
        {
          cache: "no-store",
        }
      );

      if (directResponse.ok) {
        const directData = await directResponse.json();

        const selectedLead = Array.isArray(directData)
          ? directData[0]
          : directData;

        setLead(selectedLead || null);
        return;
      }

      const response = await fetch("/api/leads", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load lead."
        );
      }

      const selectedLead = (
        Array.isArray(data) ? data : []
      ).find(
        (item) =>
          String(item.id) === String(leadId)
      );

      setLead(selectedLead || null);
    } catch (error) {
      console.error("Lead loading error:", error);

      setErrorMessage(
        error.message ||
          "We could not load this lead."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setLead((currentLead) => ({
      ...currentLead,
      [name]: value,
    }));
  }

  function cancelEdit() {
    setEditMode(false);
    fetchLead();
  }

  async function updateLead() {
    if (!lead) {
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/leads/${lead.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: String(lead.name || "").trim(),
            company: String(
              lead.company || ""
            ).trim(),
            email: String(lead.email || "").trim(),
            phone: String(lead.phone || "").trim(),
            status: lead.status || "New",
            value: String(lead.value || "").trim(),
            notes: String(lead.notes || "").trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to update lead."
        );
      }

      const updatedLead = Array.isArray(data)
        ? data[0]
        : data;

      if (updatedLead) {
        setLead(updatedLead);
      } else {
        await fetchLead();
      }

      setEditMode(false);
      alert("Lead updated successfully.");
    } catch (error) {
      console.error("Lead update error:", error);

      alert(
        error.message || "Error updating lead."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead() {
    if (!lead) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${lead.name || "this lead"}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/leads/${lead.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to delete lead."
        );
      }

      router.push("/leads");
      router.refresh();
    } catch (error) {
      console.error("Lead deletion error:", error);

      alert(
        error.message || "Error deleting lead."
      );
    }
  }

  async function generateEmail() {
    if (!lead) {
      return;
    }

    try {
      setGeneratingEmail(true);
      setEmailDraft("Generating AI email...");

      const response = await fetch(
        "/api/ai-assistant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `
Write a professional follow-up email for this lead.

Lead Name: ${lead.name || "Not available"}
Company: ${lead.company || "Not available"}
Email: ${lead.email || "Not available"}
Phone: ${lead.phone || "Not available"}
Source: ${lead.source || "Manual"}
Status: ${lead.status || "New"}
Lead Notes: ${lead.notes || "No notes"}
AI Score: ${lead.ai_score || "Not available"}
AI Summary: ${lead.ai_summary || "Not available"}
AI Recommended Action: ${
              lead.ai_next_action || "Not available"
            }

The email should:
- Be professional and friendly
- Mention their requirement
- Suggest a short discovery call
- Keep it concise
- Sign off as SaiNal Technologies Ltd
            `,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to generate email."
        );
      }

      setEmailDraft(
        data.answer || "No email was generated."
      );
    } catch (error) {
      console.error(
        "AI email generation error:",
        error
      );

      setEmailDraft("");
      alert(
        error.message ||
          "Error generating AI email."
      );
    } finally {
      setGeneratingEmail(false);
    }
  }

  async function createFollowUpTask() {
    if (!lead) {
      return;
    }

    try {
      setCreatingFollowUp(true);

      const response = await fetch(
        "/api/follow-ups",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            related_type: "Lead",
            related_id: lead.id,
            title: `Follow up with ${
              lead.name || "lead"
            }`,
            note:
              lead.ai_next_action ||
              `Follow up with ${
                lead.name || "the lead"
              } from ${
                lead.company || "their company"
              }.`,
            due_date: null,
            status: "Pending",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create follow-up."
        );
      }

      alert(
        "Follow-up task created successfully."
      );
    } catch (error) {
      console.error(
        "Follow-up creation error:",
        error
      );

      alert(
        error.message ||
          "Error creating follow-up task."
      );
    } finally {
      setCreatingFollowUp(false);
    }
  }

  async function generateQuote() {
    if (!lead) {
      return;
    }

    try {
      setGeneratingQuote(true);

      const quoteNumber = `SNQ-${Date.now()
        .toString()
        .slice(-6)}`;

      const quoteText = `SAINAL TECHNOLOGIES LTD

QUOTE

Quote Number: ${quoteNumber}
Date: ${new Date().toLocaleDateString("en-GB")}

Client:
${lead.company || ""}
${lead.name || ""}
${lead.email || ""}
${lead.phone || ""}

Service:
Website Development & Business Automation

Estimated Cost:
${lead.value || "To be confirmed"}

Estimated Delivery:
2 Weeks

Notes:
${lead.notes || "No notes added."}

Payment Terms:
25% deposit required before project starts.
75% balance payable before go-live.

Prepared By:
SaiNal Technologies Ltd
www.sainaltechnologies.com`;

      setQuoteDraft(quoteText);
      setQuoteSaved(false);

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quote_number: quoteNumber,
          lead_id: lead.id,
          customer_id: null,
          client: lead.company,
          contact: lead.name,
          email: lead.email,
          phone: lead.phone,
          service:
            "Website Development & Business Automation",
          amount: lead.value,
          status: "Draft Quote",
          quote_text: quoteText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to save quote."
        );
      }

      setQuoteSaved(true);
    } catch (error) {
      console.error(
        "Quote generation error:",
        error
      );

      alert(
        error.message || "Error saving quote."
      );
    } finally {
      setGeneratingQuote(false);
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Lead Details"
          description="Loading lead information."
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
          title="Lead Details"
          description="Review an individual lead record."
        >
          <section className={styles.errorPanel}>
            <div>
              <strong>Unable to load lead</strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={fetchLead}
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!lead) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Lead Details"
          description="Review an individual lead record."
        >
          <section className={styles.notFound}>
            <span className={styles.notFoundIcon}>
              ◎
            </span>

            <h2>Lead not found</h2>

            <p>
              This lead may have been deleted or you may
              not have access to it.
            </p>

            <Link
              href="/leads"
              className={styles.primaryButton}
            >
              Return to leads
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title={lead.name || "Lead Details"}
        description="Secure lead profile, commercial information and AI recommendations."
      >
        <div className={styles.page}>
          <section className={styles.pageHeader}>
            <div className={styles.headerCopy}>
              <Link
                href="/leads"
                className={styles.backLink}
              >
                ← Back to leads
              </Link>

              <span className={styles.eyebrow}>
                Lead record
              </span>

              <h2>
                {editMode
                  ? "Edit lead"
                  : lead.name || "Unnamed lead"}
              </h2>

              <p>
                Sensitive contact and commercial
                information is shown only on this record.
              </p>
            </div>

            <div className={styles.headerActions}>
              {editMode ? (
                <>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={updateLead}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setEditMode(true)}
                >
                  Edit lead
                </button>
              )}

              <button
                type="button"
                className={styles.actionButton}
                onClick={generateQuote}
                disabled={generatingQuote}
              >
                {generatingQuote
                  ? "Creating quote..."
                  : "Generate quote"}
              </button>

              <button
                type="button"
                className={styles.dangerButton}
                onClick={deleteLead}
              >
                Delete
              </button>
            </div>
          </section>

          <section className={styles.heroCard}>
            <div className={styles.identity}>
              <span className={styles.avatar}>
                {getInitials(lead.name)}
              </span>

              <div className={styles.identityCopy}>
                <h3>{lead.name || "Unnamed lead"}</h3>

                <p>
                  {lead.company || "No company"}
                </p>

                <div className={styles.identityMeta}>
                  <StatusBadge
                    status={lead.status || "New"}
                  />

                  <span className={styles.metaBadge}>
                    {lead.source || "Manual"}
                  </span>

                  <AiScoreBadge
                    score={lead.ai_score}
                  />
                </div>
              </div>
            </div>

            <div className={styles.heroValue}>
              <span>Estimated value</span>
              <strong>
                {lead.value || "Not set"}
              </strong>
              <small>
                Visible only inside this record
              </small>
            </div>
          </section>

          <section className={styles.contentGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>Lead information</h3>
                  <p>
                    Contact, company and commercial details
                  </p>
                </div>
              </div>

              {editMode ? (
                <div className={styles.editForm}>
                  <div className={styles.formGrid}>
                    <Field
                      label="Lead name"
                      name="name"
                      value={lead.name}
                      onChange={handleChange}
                    />

                    <Field
                      label="Company"
                      name="company"
                      value={lead.company}
                      onChange={handleChange}
                    />

                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      value={lead.email}
                      onChange={handleChange}
                    />

                    <Field
                      label="Phone"
                      name="phone"
                      type="tel"
                      value={lead.phone}
                      onChange={handleChange}
                    />

                    <div className={styles.field}>
                      <label htmlFor="lead-status">
                        Status
                      </label>

                      <select
                        id="lead-status"
                        name="status"
                        value={lead.status || "New"}
                        onChange={handleChange}
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

                    <Field
                      label="Estimated value"
                      name="value"
                      value={lead.value}
                      onChange={handleChange}
                    />

                    <div
                      className={`${styles.field} ${styles.fieldFull}`}
                    >
                      <label htmlFor="lead-notes">
                        Notes
                      </label>

                      <textarea
                        id="lead-notes"
                        name="notes"
                        value={lead.notes || ""}
                        onChange={handleChange}
                        rows={7}
                        placeholder="Add private lead notes"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.detailList}>
                  <DetailRow
                    label="Company"
                    value={lead.company}
                  />

                  <DetailRow
                    label="Email"
                    value={lead.email}
                    href={
                      lead.email
                        ? `mailto:${lead.email}`
                        : null
                    }
                  />

                  <DetailRow
                    label="Phone"
                    value={lead.phone}
                    href={
                      lead.phone
                        ? `tel:${lead.phone}`
                        : null
                    }
                  />

                  <DetailRow
                    label="Status"
                    customValue={
                      <StatusBadge
                        status={lead.status || "New"}
                      />
                    }
                  />

                  <DetailRow
                    label="Estimated value"
                    value={lead.value}
                  />

                  <DetailRow
                    label="Source"
                    value={lead.source || "Manual"}
                  />

                  <DetailRow
                    label="Created"
                    value={formatDate(
                      lead.created_at
                    )}
                  />
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div className={styles.aiHeader}>
                  <span className={styles.aiIcon}>
                    ✦
                  </span>

                  <div>
                    <h3>AI lead analysis</h3>
                    <p>
                      Qualification and recommended action
                    </p>
                  </div>
                </div>

                <AiScoreBadge
                  score={lead.ai_score}
                />
              </div>

              <div className={styles.aiSection}>
                <div className={styles.aiBlock}>
                  <span>AI summary</span>

                  <p>
                    {lead.ai_summary ||
                      "No AI summary is currently available."}
                  </p>
                </div>

                <div className={styles.aiBlock}>
                  <span>Recommended next action</span>

                  <p>
                    {lead.ai_next_action ||
                      "No AI recommendation is currently available."}
                  </p>
                </div>
              </div>

              <div className={styles.aiActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={generateEmail}
                  disabled={generatingEmail}
                >
                  {generatingEmail
                    ? "Generating..."
                    : "Generate email"}
                </button>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={createFollowUpTask}
                  disabled={creatingFollowUp}
                >
                  {creatingFollowUp
                    ? "Creating..."
                    : "Create follow-up"}
                </button>
              </div>
            </section>
          </section>

          <section className={styles.contentGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>Private notes</h3>
                  <p>
                    Internal information for your team
                  </p>
                </div>
              </div>

              <p className={styles.notesText}>
                {lead.notes ||
                  "No private notes have been added."}
              </p>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>Activity timeline</h3>
                  <p>
                    Current lead journey overview
                  </p>
                </div>
              </div>

              <div className={styles.timeline}>
                <TimelineItem
                  title="Lead created"
                  description={formatDateTime(
                    lead.created_at
                  )}
                />

                <TimelineItem
                  title="AI qualification"
                  description={
                    lead.ai_score
                      ? `Lead analysed as ${lead.ai_score}`
                      : "AI analysis not yet available"
                  }
                />

                <TimelineItem
                  title="Current stage"
                  description={
                    lead.status || "New"
                  }
                />

                <TimelineItem
                  title="Quote activity"
                  description={
                    quoteSaved
                      ? "A quote was generated during this session"
                      : "No new quote generated during this session"
                  }
                />
              </div>
            </section>
          </section>

          {emailDraft && (
            <section className={styles.fullPanel}>
              <div className={styles.draftPanel}>
                <div className={styles.draftHeader}>
                  <div>
                    <h3>AI follow-up email</h3>
                    <p>
                      Review and copy the generated email
                    </p>
                  </div>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() =>
                      navigator.clipboard?.writeText(
                        emailDraft
                      )
                    }
                  >
                    Copy email
                  </button>
                </div>

                <textarea
                  value={emailDraft}
                  onChange={(event) =>
                    setEmailDraft(
                      event.target.value
                    )
                  }
                  rows={12}
                  className={styles.draftTextarea}
                />
              </div>
            </section>
          )}

          {quoteDraft && (
            <section className={styles.fullPanel}>
              <div className={styles.draftPanel}>
                <div className={styles.draftHeader}>
                  <div>
                    <h3>Quote draft</h3>
                    <p>
                      The quote is stored in the Quotes
                      module
                    </p>
                  </div>

                  <Link
                    href="/quotes"
                    className={styles.secondaryButton}
                  >
                    Open quotes
                  </Link>
                </div>

                <textarea
                  value={quoteDraft}
                  readOnly
                  rows={18}
                  className={styles.draftTextarea}
                />

                {quoteSaved && (
                  <p className={styles.successMessage}>
                    Quote saved successfully. Open Quotes
                    to review or convert it.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={`lead-${name}`}>
        {label}
      </label>

      <input
        id={`lead-${name}`}
        name={name}
        type={type}
        value={value || ""}
        onChange={onChange}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  href,
  customValue,
}) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>

      {customValue ? (
        customValue
      ) : href && value ? (
        <a href={href}>{value}</a>
      ) : (
        <strong
          className={
            value ? "" : styles.emptyValue
          }
        >
          {value || "Not available"}
        </strong>
      )}
    </div>
  );
}

function AiScoreBadge({ score }) {
  const normalisedScore = String(score || "")
    .trim()
    .toLowerCase();

  let label = score || "Not analysed";
  let className = styles.aiNeutral;

  if (normalisedScore.includes("hot")) {
    label = "● Hot";
    className = styles.aiHot;
  } else if (
    normalisedScore.includes("warm")
  ) {
    label = "● Warm";
    className = styles.aiWarm;
  } else if (
    normalisedScore.includes("cold")
  ) {
    label = "● Cold";
    className = styles.aiCold;
  }

  return (
    <span
      className={`${styles.aiScore} ${className}`}
    >
      {label}
    </span>
  );
}

function TimelineItem({
  title,
  description,
}) {
  return (
    <div className={styles.timelineItem}>
      <span className={styles.timelineDot} />

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
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

function formatDateTime(value) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
