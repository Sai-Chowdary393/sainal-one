"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import StatusBadge from "../../components/StatusBadge";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function Leads() {
  const [showForm, setShowForm] = useState(false);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    status: "New",
    value: "",
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    try {
      const response = await fetch("/api/leads");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load leads.");
        return;
      }

      setLeads(data || []);
    } catch (error) {
      console.error(error);
      alert("Error loading leads.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.name || !formData.company) {
      alert("Please enter lead name and company.");
      return;
    }

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to save lead.");
        return;
      }

      setLeads([data[0], ...leads]);

      setFormData({
        name: "",
        company: "",
        email: "",
        phone: "",
        status: "New",
        value: "",
      });

      setShowForm(false);
    } catch (error) {
      console.error(error);
      alert("Error saving lead.");
    }
  }

  function getAiScoreLabel(score) {
    if (!score) return "-";

    if (score.toLowerCase().includes("hot")) {
      return "🔥 Hot";
    }

    if (score.toLowerCase().includes("warm")) {
      return "🟡 Warm";
    }

    if (score.toLowerCase().includes("cold")) {
      return "❄️ Cold";
    }

    return score;
  }

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <div className="topBar">
            <div>
              <h1>Leads</h1>
              <p className="helperText">
                Manage enquiries and AI-qualified website leads.
              </p>
            </div>

            <button
              className="primaryBtn"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Close" : "Add Lead"}
            </button>
          </div>

          {showForm && (
            <form className="leadForm" onSubmit={handleSubmit}>
              <input
                name="name"
                placeholder="Lead Name"
                value={formData.name}
                onChange={handleChange}
              />

              <input
                name="company"
                placeholder="Company"
                value={formData.company}
                onChange={handleChange}
              />

              <input
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
              />

              <input
                name="phone"
                placeholder="Phone"
                value={formData.phone}
                onChange={handleChange}
              />

              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option>New</option>
                <option>Contacted</option>
                <option>Proposal Sent</option>
                <option>Follow Up</option>
                <option>Won</option>
                <option>Lost</option>
              </select>

              <input
                name="value"
                placeholder="Value e.g. £2,500"
                value={formData.value}
                onChange={handleChange}
              />

              <button className="primaryBtn" type="submit">
                Save Lead
              </button>
            </form>
          )}

          {loading ? (
            <p>Loading leads...</p>
          ) : (
            <table className="leadTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Value</th>
                  <th>Source</th>
                  <th>AI Score</th>
                  <th>AI Recommendation</th>
                </tr>
              </thead>

              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan="9">No leads found. Add your first lead.</td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <Link href={`/leads/${lead.id}`} className="leadLink">
                          {lead.name}
                        </Link>
                      </td>

                      <td>{lead.company}</td>
                      <td>{lead.email}</td>
                      <td>{lead.phone}</td>

                      <td>
                        <StatusBadge status={lead.status} />
                      </td>

                      <td>{lead.value}</td>
                      <td>{lead.source || "Manual"}</td>

                      <td>
                        <strong>{getAiScoreLabel(lead.ai_score)}</strong>
                      </td>

                      <td>
                        {lead.ai_next_action ? (
                          <div>
                            <strong>{lead.ai_summary}</strong>
                            <p className="helperText">{lead.ai_next_action}</p>
                          </div>
                        ) : (
                          <span className="helperText">No AI analysis</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
