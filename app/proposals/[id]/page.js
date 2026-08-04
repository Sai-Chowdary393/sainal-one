"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import SendRecordEmail from "../../../components/SendRecordEmail";
import StatusBadge from "../../../components/StatusBadge";

import styles from "./proposal-details.module.css";

const STATUS_OPTIONS = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
];

export default function ProposalDetailsPage() {
  const params = useParams();
  const proposalId = params?.id;

  const [proposal, setProposal] = useState(null);
  const [draftProposal, setDraftProposal] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (proposalId) {
      fetchProposal();
    }
  }, [proposalId]);

  async function fetchProposal() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        `/api/proposals/${proposalId}`,
        {
          cache: "no-store",
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load proposal."
        );
      }

      const selectedProposal = Array.isArray(data)
        ? data[0]
        : data;

      setProposal(selectedProposal || null);
      setDraftProposal(selectedProposal || null);
    } catch (error) {
      console.error(
        "Proposal loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load this proposal."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setDraftProposal((currentProposal) => ({
      ...currentProposal,
      [name]: value,
    }));
  }

  function startEditing() {
    setDraftProposal({
      ...proposal,
    });

    setEditing(true);
  }

  function cancelEditing() {
    setDraftProposal({
      ...proposal,
    });

    setEditing(false);
  }

  async function saveProposal() {
    if (!draftProposal) {
      return;
    }

    if (!draftProposal.title?.trim()) {
      alert("Proposal title is required.");
      return;
    }

    if (!draftProposal.client?.trim()) {
      alert("Client name is required.");
      return;
    }

    if (!draftProposal.service?.trim()) {
      alert("Service is required.");
      return;
    }

    if (!draftProposal.proposal_text?.trim()) {
      alert("Proposal content is required.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/proposals/${proposalId}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            title: draftProposal.title.trim(),

            client: draftProposal.client.trim(),

            contact: String(
              draftProposal.contact || ""
            ).trim(),

            email: String(
              draftProposal.email || ""
            ).trim(),

            service: draftProposal.service.trim(),

            amount: String(
              draftProposal.amount || ""
            ).trim(),

            status:
              draftProposal.status || "Draft",

            proposal_text:
              draftProposal.proposal_text.trim(),
          }),
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update proposal."
        );
      }

      const updatedProposal = Array.isArray(data)
        ? data[0]
        : data;

      const finalProposal =
        updatedProposal || draftProposal;

      setProposal(finalProposal);
      setDraftProposal(finalProposal);
      setEditing(false);

      alert("Proposal updated successfully.");
    } catch (error) {
      console.error(
        "Proposal update error:",
        error
      );

      alert(
        error.message ||
          "Error updating proposal."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status) {
    try {
      setSaving(true);

      const response = await fetch(
        `/api/proposals/${proposalId}`,
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

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update proposal status."
        );
      }

      const updatedProposal = Array.isArray(data)
        ? data[0]
        : data;

      setProposal((currentProposal) => ({
        ...currentProposal,
        ...(updatedProposal || {}),
        status,
      }));

      setDraftProposal((currentProposal) => ({
        ...currentProposal,
        ...(updatedProposal || {}),
        status,
      }));
    } catch (error) {
      console.error(
        "Proposal status update error:",
        error
      );

      alert(
        error.message ||
          "Error updating proposal status."
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyProposal() {
    const proposalContent =
      proposal?.proposal_text || "";

    if (!proposalContent) {
      alert("No proposal content is available.");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        proposalContent
      );

      alert("Proposal copied successfully.");
    } catch (error) {
      console.error(
        "Proposal copy error:",
        error
      );

      alert("Unable to copy the proposal.");
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Proposal Studio"
          description="Loading proposal information."
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
          title="Proposal Studio"
          description="Review and manage a customer proposal."
        >
          <section className={styles.errorPanel}>
            <div>
              <strong>
                Unable to load proposal
              </strong>

              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={fetchProposal}
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!proposal || !draftProposal) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Proposal Studio"
          description="Review and manage a customer proposal."
        >
          <section className={styles.notFound}>
            <span className={styles.notFoundIcon}>
              ▤
            </span>

            <h2>Proposal not found</h2>

            <p>
              This proposal may have been deleted
              or you may not have access to it.
            </p>

            <Link
              href="/proposals"
              className={styles.primaryButton}
            >
              Return to proposals
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const visibleProposal = editing
    ? draftProposal
    : proposal;

  /*
   * These are normal calculations rather than hooks.
   * This prevents the React hook-order crash.
   */
  const sections = parseProposalSections(
    visibleProposal.proposal_text || ""
  );

  const recommendations =
    buildRecommendations(
      visibleProposal,
      sections
    );

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          visibleProposal.title ||
          "Proposal Studio"
        }
        description="Proposal document, client information, pricing and approval workflow."
      >
        <div className={styles.page}>
          <section
            className={`${styles.pageHeader} ${styles.noPrint}`}
          >
            <div className={styles.headerCopy}>
              <Link
                href="/proposals"
                className={styles.backLink}
              >
                ← Back to proposals
              </Link>

              <span className={styles.eyebrow}>
                Proposal Studio
              </span>

              <h2>
                {visibleProposal.title ||
                  "Untitled proposal"}
              </h2>

              <p>
                {proposal.proposal_number ||
                  "Proposal"}
              </p>
            </div>

            <div className={styles.headerActions}>
              <SendRecordEmail
                endpoint={`/api/proposals/${proposal.id}/send`}
                defaultEmail={proposal.email || ""}
                defaultSubject={`${proposal.title || "Proposal"} – ${
                  proposal.proposal_number ||
                  "SaiNal One"
                }`}
                recordLabel="proposal"
                onSent={(data) => {
                  if (data?.proposal) {
                    setProposal(data.proposal);
                    setDraftProposal(
                      data.proposal
                    );
                  }
                }}
              />

              {!editing ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={startEditing}
                >
                  Edit proposal
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={saving}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={saving}
                    onClick={saveProposal}
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </>
              )}

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={copyProposal}
              >
                Copy proposal
              </button>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => window.print()}
              >
                Print / Save PDF
              </button>
            </div>
          </section>

          <section className={styles.heroCard}>
            <div className={styles.proposalIdentity}>
              <span className={styles.proposalIcon}>
                ▤
              </span>

              <div className={styles.identityCopy}>
                <span className={styles.heroLabel}>
                  Customer proposal
                </span>

                <h3>
                  {visibleProposal.client ||
                    "Unnamed client"}
                </h3>

                <p>
                  {visibleProposal.service ||
                    "Professional services"}
                </p>

                <div className={styles.identityMeta}>
                  <StatusBadge
                    status={
                      visibleProposal.status ||
                      "Draft"
                    }
                  />

                  <span className={styles.metaBadge}>
                    Created{" "}
                    {formatDate(
                      proposal.created_at
                    )}
                  </span>

                  <span className={styles.metaBadge}>
                    {proposal.proposal_number ||
                      "No proposal number"}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.amountCard}>
              <span>Proposal value</span>

              <strong>
                {formatProposalAmount(
                  visibleProposal.amount
                )}
              </strong>

              <small>
                {visibleProposal.status || "Draft"}
              </small>
            </div>
          </section>

          <section className={styles.workspaceGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>Proposal information</h3>

                  <p>
                    Client, service, pricing and
                    status
                  </p>
                </div>
              </div>

              {editing ? (
                <div className={styles.formGrid}>
                  <Field
                    label="Proposal title"
                    name="title"
                    value={draftProposal.title}
                    onChange={handleFieldChange}
                    full
                  />

                  <Field
                    label="Client"
                    name="client"
                    value={draftProposal.client}
                    onChange={handleFieldChange}
                  />

                  <Field
                    label="Contact"
                    name="contact"
                    value={draftProposal.contact}
                    onChange={handleFieldChange}
                  />

                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    value={draftProposal.email}
                    onChange={handleFieldChange}
                  />

                  <Field
                    label="Service"
                    name="service"
                    value={draftProposal.service}
                    onChange={handleFieldChange}
                  />

                  <Field
                    label="Amount"
                    name="amount"
                    value={draftProposal.amount}
                    onChange={handleFieldChange}
                  />

                  <div className={styles.field}>
                    <label htmlFor="proposal-status">
                      Status
                    </label>

                    <select
                      id="proposal-status"
                      name="status"
                      value={
                        draftProposal.status ||
                        "Draft"
                      }
                      disabled={saving}
                      onChange={handleFieldChange}
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
                </div>
              ) : (
                <div className={styles.detailList}>
                  <DetailRow
                    label="Proposal title"
                    value={proposal.title}
                  />

                  <DetailRow
                    label="Client"
                    value={proposal.client}
                  />

                  <DetailRow
                    label="Contact"
                    value={proposal.contact}
                  />

                  <DetailRow
                    label="Email"
                    value={proposal.email}
                    href={
                      proposal.email
                        ? `mailto:${proposal.email}`
                        : null
                    }
                  />

                  <DetailRow
                    label="Service"
                    value={proposal.service}
                  />

                  <DetailRow
                    label="Amount"
                    value={formatProposalAmount(
                      proposal.amount
                    )}
                  />

                  <DetailRow
                    label="Status"
                    customValue={
                      <select
                        className={
                          styles.inlineStatusSelect
                        }
                        value={
                          proposal.status || "Draft"
                        }
                        disabled={saving}
                        onChange={(event) =>
                          updateStatus(
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
                    }
                  />

                  <DetailRow
                    label="Created"
                    value={formatDate(
                      proposal.created_at
                    )}
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
                  <span>
                    Proposal intelligence
                  </span>

                  <h3>Quality overview</h3>
                </div>
              </div>

              <div className={styles.qualityGrid}>
                <QualityMetric
                  label="Structure"
                  value={
                    sections.length >= 5
                      ? "Strong"
                      : "Needs work"
                  }
                />

                <QualityMetric
                  label="Commercials"
                  value={
                    visibleProposal.amount
                      ? "Included"
                      : "Missing"
                  }
                />

                <QualityMetric
                  label="Client"
                  value={
                    visibleProposal.client
                      ? "Defined"
                      : "Missing"
                  }
                />

                <QualityMetric
                  label="Status"
                  value={
                    visibleProposal.status ||
                    "Draft"
                  }
                />
              </div>

              <div
                className={styles.aiRecommendations}
              >
                <span>
                  Recommended improvements
                </span>

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

          {editing ? (
            <section className={styles.editorPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>Proposal content</h3>

                  <p>
                    Edit the complete
                    customer-facing document
                  </p>
                </div>
              </div>

              <textarea
                name="proposal_text"
                className={styles.proposalEditor}
                rows={34}
                value={
                  draftProposal.proposal_text ||
                  ""
                }
                disabled={saving}
                onChange={handleFieldChange}
              />
            </section>
          ) : (
            <section className={styles.documentPanel}>
              <div
                className={`${styles.documentToolbar} ${styles.noPrint}`}
              >
                <div>
                  <span className={styles.eyebrow}>
                    Customer document
                  </span>

                  <h3>Full proposal</h3>
                </div>

                <div>
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={copyProposal}
                  >
                    Copy
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={() =>
                      window.print()
                    }
                  >
                    Export PDF
                  </button>
                </div>
              </div>

              <article
                className={styles.proposalDocument}
              >
                <header className={styles.documentHeader}>
                  <div>
                    <span
                      className={
                        styles.documentBrandMark
                      }
                    >
                      SN
                    </span>

                    <div>
                      <strong>
                        SaiNal Technologies Ltd
                      </strong>

                      <p>
                        Business technology
                        solutions
                      </p>
                    </div>
                  </div>

                  <div className={styles.documentTitle}>
                    <span>PROPOSAL</span>

                    <strong>
                      {proposal.proposal_number ||
                        "Proposal"}
                    </strong>
                  </div>
                </header>

                <section className={styles.documentMeta}>
                  <div>
                    <span>Prepared for</span>

                    <strong>
                      {proposal.client || "Client"}
                    </strong>

                    <p>{proposal.contact || ""}</p>
                    <p>{proposal.email || ""}</p>
                  </div>

                  <div>
                    <span>Proposal date</span>

                    <strong>
                      {formatDate(
                        proposal.created_at
                      )}
                    </strong>

                    <span>Status</span>

                    <strong>
                      {proposal.status || "Draft"}
                    </strong>
                  </div>
                </section>

                <section
                  className={styles.documentSummary}
                >
                  <div>
                    <span>Proposal title</span>

                    <strong>
                      {proposal.title ||
                        "Proposal"}
                    </strong>
                  </div>

                  <div>
                    <span>Value</span>

                    <strong>
                      {formatProposalAmount(
                        proposal.amount
                      )}
                    </strong>
                  </div>
                </section>

                <div
                  className={styles.documentSections}
                >
                  {sections.length > 0 ? (
                    sections.map(
                      (section, index) => (
                        <section
                          key={`${section.title}-${index}`}
                          className={
                            styles.documentSection
                          }
                        >
                          {section.title && (
                            <h3>
                              {section.title}
                            </h3>
                          )}

                          <p>{section.content}</p>
                        </section>
                      )
                    )
                  ) : (
                    <pre
                      className={
                        styles.proposalPreview
                      }
                    >
                      {proposal.proposal_text ||
                        "No proposal content is available."}
                    </pre>
                  )}
                </div>

                <footer
                  className={styles.documentFooter}
                >
                  <p>SaiNal Technologies Ltd</p>

                  <p>
                    www.sainaltechnologies.com
                  </p>
                </footer>
              </article>
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
  full = false,
}) {
  return (
    <div
      className={`${styles.field} ${
        full ? styles.fieldFull : ""
      }`}
    >
      <label htmlFor={`proposal-${name}`}>
        {label}
      </label>

      <input
        id={`proposal-${name}`}
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

function QualityMetric({
  label,
  value,
}) {
  return (
    <div className={styles.qualityMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LoadingState() {
  return (
    <section className={styles.loadingPanel}>
      {Array.from({
        length: 6,
      }).map((_, index) => (
        <div
          key={index}
          className={styles.loadingRow}
        />
      ))}
    </section>
  );
}

function parseProposalSections(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim());

  const sections = [];

  let currentTitle = "";
  let currentContent = [];

  function flushSection() {
    const content = currentContent
      .join("\n")
      .trim();

    if (currentTitle || content) {
      sections.push({
        title: currentTitle,
        content,
      });
    }

    currentTitle = "";
    currentContent = [];
  }

  lines.forEach((line) => {
    const isHeading =
      line &&
      line.length <= 55 &&
      line === line.toUpperCase() &&
      /[A-Z]/.test(line);

    if (isHeading) {
      flushSection();
      currentTitle = line;
      return;
    }

    if (line) {
      currentContent.push(line);
    }
  });

  flushSection();

  return sections.filter(
    (section) =>
      section.title || section.content
  );
}

function buildRecommendations(
  proposal,
  sections
) {
  const recommendations = [];

  const sectionTitles = sections.map(
    (section) =>
      String(
        section.title || ""
      ).toLowerCase()
  );

  if (
    !sectionTitles.some((title) =>
      title.includes("executive")
    )
  ) {
    recommendations.push(
      "Add an executive summary focused on the client's objectives."
    );
  }

  if (
    !sectionTitles.some((title) =>
      title.includes("scope")
    )
  ) {
    recommendations.push(
      "Define the scope of work and any exclusions clearly."
    );
  }

  if (
    !sectionTitles.some((title) =>
      title.includes("timeline")
    )
  ) {
    recommendations.push(
      "Add an indicative delivery timeline and milestones."
    );
  }

  if (
    !sectionTitles.some((title) =>
      title.includes("deliverable")
    )
  ) {
    recommendations.push(
      "List the expected deliverables and acceptance criteria."
    );
  }

  if (!proposal.amount) {
    recommendations.push(
      "Add the commercial value or explain how pricing will be confirmed."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "The proposal contains a strong base structure. Review wording and client-specific detail before sending."
    );
  }

  return recommendations.slice(0, 5);
}

function getMoneyValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  return (
    Number(
      String(value).replace(
        /[^0-9.-]/g,
        ""
      )
    ) || 0
  );
}

function formatProposalAmount(value) {
  if (!value) {
    return "To be confirmed";
  }

  return getMoneyValue(value).toLocaleString(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );
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

async function readJsonResponse(response) {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      error:
        "The server returned an invalid response.",
    };
  }
}
