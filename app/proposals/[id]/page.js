"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../../components/Sidebar";
import ProtectedRoute from "../../../components/ProtectedRoute";
import SendRecordEmail from "../../../components/SendRecordEmail";

export default function ProposalDetailsPage({ params }) {
  const resolvedParams = use(params);
  const proposalId = resolvedParams.id;

  const [proposal, setProposal] = useState(null);
  const [draftProposal, setDraftProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchProposal();
  }, [proposalId]);

  async function fetchProposal() {
    try {
      const response = await fetch(
        `/api/proposals/${proposalId}`
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load proposal.");
        return;
      }

      setProposal(data);
      setDraftProposal(data);
    } catch (error) {
      console.error(error);
      alert("Error loading proposal.");
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

    setSaving(true);

    try {
      const response = await fetch(
        `/api/proposals/${proposalId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: draftProposal.title,
            client: draftProposal.client,
            contact: draftProposal.contact,
            email: draftProposal.email,
            service: draftProposal.service,
            amount: draftProposal.amount,
            status: draftProposal.status,
            proposal_text: draftProposal.proposal_text,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to update proposal.");
        return;
      }

      setProposal(data);
      setDraftProposal(data);
      setEditing(false);

      alert("Proposal updated successfully.");
    } catch (error) {
      console.error(error);
      alert("Error updating proposal.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status) {
    setSaving(true);

    try {
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

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to update proposal status.");
        return;
      }

      setProposal(data);
      setDraftProposal(data);
    } catch (error) {
      console.error(error);
      alert("Error updating proposal status.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <p>Loading proposal...</p>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!proposal || !draftProposal) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <Link
              href="/proposals"
              className="leadLink"
            >
              ← Back to Proposals
            </Link>

            <h1>Proposal not found</h1>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const visibleProposal = editing
    ? draftProposal
    : proposal;

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <div className="topBar noPrint">
            <div>
              <Link
                href="/proposals"
                className="leadLink"
              >
                ← Back to Proposals
              </Link>

              <h1>
                {visibleProposal.title}
              </h1>

              <p className="helperText">
                {proposal.proposal_number}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <SendRecordEmail
                endpoint={`/api/proposals/${proposal.id}/send`}
                defaultEmail={proposal.email || ""}
                defaultSubject={`${proposal.title} – ${proposal.proposal_number}`}
                recordLabel="proposal"
                onSent={(data) => {
                  if (data.proposal) {
                    setProposal(data.proposal);
                    setDraftProposal(data.proposal);
                  }
                }}
              />

              {!editing ? (
                <button
                  type="button"
                  className="primaryBtn"
                  onClick={startEditing}
                >
                  Edit Proposal
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="primaryBtn"
                    disabled={saving}
                    onClick={saveProposal}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Proposal"}
                  </button>

                  <button
                    type="button"
                    className="primaryBtn"
                    disabled={saving}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                </>
              )}

              <button
                type="button"
                className="primaryBtn"
                onClick={() => window.print()}
              >
                Print / Save PDF
              </button>
            </div>
          </div>

          <section className="panel">
            <div className="settingsGrid noPrint">
              <label className="fullWidth">
                Proposal Title

                <input
                  name="title"
                  value={visibleProposal.title || ""}
                  disabled={!editing || saving}
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Status

                <select
                  name="status"
                  value={visibleProposal.status || "Draft"}
                  disabled={saving}
                  onChange={(event) => {
                    if (editing) {
                      handleFieldChange(event);
                    } else {
                      updateStatus(event.target.value);
                    }
                  }}
                >
                  <option>Draft</option>
                  <option>Sent</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </label>

              <label>
                Client

                <input
                  name="client"
                  value={visibleProposal.client || ""}
                  disabled={!editing || saving}
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Contact

                <input
                  name="contact"
                  value={visibleProposal.contact || ""}
                  disabled={!editing || saving}
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Email

                <input
                  name="email"
                  type="email"
                  value={visibleProposal.email || ""}
                  disabled={!editing || saving}
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Service

                <input
                  name="service"
                  value={visibleProposal.service || ""}
                  disabled={!editing || saving}
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Amount

                <input
                  name="amount"
                  value={visibleProposal.amount || ""}
                  disabled={!editing || saving}
                  onChange={handleFieldChange}
                  placeholder="Example: £3,000"
                />
              </label>
            </div>

            {editing ? (
              <div style={{ marginTop: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    marginBottom: "8px",
                  }}
                >
                  Proposal Content
                </label>

                <textarea
                  name="proposal_text"
                  className="emailDraftBox"
                  rows={30}
                  value={draftProposal.proposal_text || ""}
                  disabled={saving}
                  onChange={handleFieldChange}
                />
              </div>
            ) : (
              <article
                className="proposalDocument"
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.8",
                  marginTop: "24px",
                }}
              >
                {proposal.proposal_text}
              </article>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
