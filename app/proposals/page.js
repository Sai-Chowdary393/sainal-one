"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function ProposalsPage() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProposals();
  }, []);

  async function fetchProposals() {
    try {
      const response = await fetch("/api/proposals");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load proposals.");
        return;
      }

      setProposals(data || []);
    } catch (error) {
      console.error(error);
      alert("Error loading proposals.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <div className="topBar">
            <div>
              <h1>Proposals</h1>

              <p className="helperText">
                Review AI-generated proposals and track client
                approval.
              </p>
            </div>
          </div>

          {loading ? (
            <p>Loading proposals...</p>
          ) : (
            <div className="panel">
              <table className="leadTable">
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Service</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {proposals.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        No proposals found. Create one using the
                        AI Assistant.
                      </td>
                    </tr>
                  ) : (
                    proposals.map((proposal) => (
                      <tr key={proposal.id}>
                        <td>
                          <Link
                            href={`/proposals/${proposal.id}`}
                            className="leadLink"
                          >
                            {proposal.proposal_number}
                          </Link>
                        </td>

                        <td>{proposal.client || "-"}</td>
                        <td>{proposal.contact || "-"}</td>
                        <td>{proposal.service || "-"}</td>
                        <td>
                          {proposal.amount ||
                            "To be confirmed"}
                        </td>
                        <td>{proposal.status}</td>
                        <td>
                          {proposal.created_at
                            ? new Date(
                                proposal.created_at
                              ).toLocaleDateString("en-GB")
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
