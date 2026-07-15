"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import Sidebar from "../../components/Sidebar";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function getRelatedLink(log) {
  if (!log.related_record_id) {
    return null;
  }

  if (log.email_type === "Proposal") {
    return `/proposals/${log.related_record_id}`;
  }

  if (log.email_type === "Invoice") {
    return `/invoices/${log.related_record_id}`;
  }

  return null;
}

export default function EmailsPage() {
  const [emailLogs, setEmailLogs] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [emailType, setEmailType] =
    useState("");

  const [status, setStatus] =
    useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchEmailLogs();
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, emailType, status]);

  async function fetchEmailLogs() {
    setLoading(true);

    try {
      const params =
        new URLSearchParams();

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      if (emailType) {
        params.set(
          "email_type",
          emailType
        );
      }

      if (status) {
        params.set("status", status);
      }

      const response = await fetch(
        `/api/email-logs?${params.toString()}`
      );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to load email history."
        );

        return;
      }

      setEmailLogs(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(error);

      alert(
        "Error loading email history."
      );
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
              <h1>Email Centre</h1>

              <p className="helperText">
                Review proposal and invoice
                emails sent from SaiNal One.
              </p>
            </div>
          </div>

          <section className="panel">
            <div className="settingsGrid">
              <label>
                Search

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Recipient, subject or document number"
                />
              </label>

              <label>
                Email Type

                <select
                  value={emailType}
                  onChange={(event) =>
                    setEmailType(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    All email types
                  </option>

                  <option value="Proposal">
                    Proposal
                  </option>

                  <option value="Invoice">
                    Invoice
                  </option>
                </select>
              </label>

              <label>
                Status

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    All statuses
                  </option>

                  <option value="Sent">
                    Sent
                  </option>

                  <option value="Failed">
                    Failed
                  </option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            {loading ? (
              <p>Loading email history...</p>
            ) : emailLogs.length === 0 ? (
              <p className="helperText">
                No email history found. Send a
                proposal or invoice to create
                your first email log.
              </p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table className="leadTable">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Recipient</th>
                      <th>Type</th>
                      <th>Subject</th>
                      <th>
                        Related Record
                      </th>
                      <th>Status</th>
                      <th>Error</th>
                    </tr>
                  </thead>

                  <tbody>
                    {emailLogs.map((log) => {
                      const relatedLink =
                        getRelatedLink(log);

                      return (
                        <tr key={log.id}>
                          <td>
                            {formatDateTime(
                              log.sent_at ||
                                log.created_at
                            )}
                          </td>

                          <td>
                            {log.recipient}
                          </td>

                          <td>
                            {log.email_type}
                          </td>

                          <td>
                            {log.subject ||
                              "-"}
                          </td>

                          <td>
                            {relatedLink ? (
                              <Link
                                href={
                                  relatedLink
                                }
                                className="leadLink"
                              >
                                {log.related_record_number ||
                                  "View record"}
                              </Link>
                            ) : (
                              log.related_record_number ||
                              "-"
                            )}
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                log.status
                              }
                            />
                          </td>

                          <td>
                            {log.error_message ||
                              "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
