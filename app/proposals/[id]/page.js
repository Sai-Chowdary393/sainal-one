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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [proposalText, setProposalText] = useState("");

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
      setProposalText(data.proposal_text || "");
    } catch (error) {
      console.error(error);
      alert("Error loading proposal.");
    } finally {
      setLoading(false);
    }
  }

  async function updateProposal(updates) {
    setSaving(true);

    try {
      const response = await fetch(
        `/api/proposals/${proposalId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to update proposal.");
        return;
      }

      setProposal(data);
      setProposalText(data.proposal_text || "");
      setEditing(false);
    } catch (error) {
      console.error(error);
      alert("Error updating proposal.");
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

  if (!proposal) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <Link href="/proposals" className="leadLink">
              ← Back to Proposals
            </Link>

            <h1>Proposal not found</h1>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

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

              <h1>{proposal.title}</h1>

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
                    setProposalText(
                      data.proposal.proposal_text || ""
                    );
                  }
                }}
              />

              <button
                type="button"
                className="primaryBtn"
                onClick={() => setEditing(!editing)}
              >
                {editing
                  ? "Cancel Edit"
                  : "Edit Proposal"}
              </button>

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
              <label>
                Status

                <select
                  value={proposal.status}
                  disabled={saving}
                  onChange={(event) =>
                    updateProposal({
                      status: event.target.value,
                    })
                  }
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
                  value={proposal.client || ""}
                  readOnly
                />
              </label>

              <label>
                Contact

                <input
                  value={proposal.contact || ""}
                  readOnly
                />
              </label>

              <label>
                Email

                <input
                  value={proposal.email || ""}
                  readOnly
                />
              </label>

              <label>
                Service

                <input
                  value={proposal.service || ""}
                  readOnly
                />
              </label>

              <label>
                Amount

                <input
                  value={
                    proposal.amount ||
                    "To be confirmed"
                  }
                  readOnly
                />
              </label>
            </div>

            {editing ? (
              <div style={{ marginTop: "24px" }}>
                <textarea
                  className="emailDraftBox"
                  rows={30}
                  value={proposalText}
                  onChange={(event) =>
                    setProposalText(event.target.value)
                  }
                />

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginTop: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="primaryBtn"
                    disabled={saving}
                    onClick={() =>
                      updateProposal({
                        proposal_text: proposalText,
                      })
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save Proposal"}
                  </button>

                  <button
                    type="button"
                    className="primaryBtn"
                    disabled={saving}
                    onClick={() => {
                      setProposalText(
                        proposal.proposal_text || ""
                      );
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
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
