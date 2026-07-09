"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";

export default function LeadDetails() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id;

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailDraft, setEmailDraft] = useState("");
  const [quoteDraft, setQuoteDraft] = useState("");
  const [quoteSaved, setQuoteSaved] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [leadId]);

  async function fetchLead() {
    try {
      const response = await fetch("/api/leads");
      const data = await response.json();

      const selectedLead = data.find(
        (item) => String(item.id) === String(leadId)
      );

      setLead(selectedLead || null);
    } catch (error) {
      console.error(error);
      alert("Error loading lead.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setLead({
      ...lead,
      [e.target.name]: e.target.value,
    });
  }

  function getAiScoreLabel(score) {
    if (!score) return "No AI score";

    if (score.toLowerCase().includes("hot")) return "🔥 Hot Lead";
    if (score.toLowerCase().includes("warm")) return "🟡 Warm Lead";
    if (score.toLowerCase().includes("cold")) return "❄️ Cold Lead";

    return score;
  }

  async function updateLead() {
    if (!lead) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          company: lead.company,
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
          value: lead.value,
          notes: lead.notes || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to update lead.");
        return;
      }

      alert("Lead updated successfully.");
      setEditMode(false);
    } catch (error) {
      console.error(error);
      alert("Error updating lead.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead() {
    if (!lead) return;

    const confirmed = confirm("Are you sure you want to delete this lead?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to delete lead.");
        return;
      }

      alert("Lead deleted successfully.");
      router.push("/leads");
    } catch (error) {
      console.error(error);
      alert("Error deleting lead.");
    }
  }

  async function generateEmail() {
    if (!lead) return;

    setEmailDraft("Generating AI email...");

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `
Write a professional follow-up email for this lead.

Lead Name: ${lead.name}
Company: ${lead.company}
Email: ${lead.email}
Phone: ${lead.phone}
Source: ${lead.source || "Manual"}
Status: ${lead.status}
Lead Notes: ${lead.notes || "No notes"}
AI Score: ${lead.ai_score || "Not available"}
AI Summary: ${lead.ai_summary || "Not available"}
AI Recommended Action: ${lead.ai_next_action || "Not available"}

The email should:
- Be professional and friendly
- Mention their requirement
- Suggest a short discovery call
- Keep it concise
- Sign off as SaiNal Technologies Ltd
          `,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to generate email.");
        setEmailDraft("");
        return;
      }

      setEmailDraft(data.answer);
    } catch (error) {
      console.error(error);
      alert("Error generating AI email.");
      setEmailDraft("");
    }
  }

  async function createFollowUpTask() {
    if (!lead) return;

    try {
      const response = await fetch("/api/follow-ups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          related_type: "Lead",
          related_id: lead.id,
          title: `Follow up with ${lead.name}`,
          note:
            lead.ai_next_action ||
            `Follow up with ${lead.name} from ${lead.company}.`,
          due_date: null,
          status: "Pending",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to create follow-up.");
        return;
      }

      alert("Follow-up task created successfully.");
    } catch (error) {
      console.error(error);
      alert("Error creating follow-up task.");
    }
  }

  async function generateQuote() {
    if (!lead) return;

    const quoteNumber = `SNQ-${Date.now().toString().slice(-6)}`;

    const quoteText = `SAINAL TECHNOLOGIES LTD

QUOTE

Quote Number: ${quoteNumber}
Date: ${new Date().toLocaleDateString("en-GB")}

Client:
${lead.company}
${lead.name}
${lead.email}
${lead.phone}

Service:
Website Development & Business Automation

Estimated Cost:
${lead.value}

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

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_number: quoteNumber,
          lead_id: lead.id,
          customer_id: null,
          client: lead.company,
          contact: lead.name,
          email: lead.email,
          phone: lead.phone,
          service: "Website Development & Business Automation",
          amount: lead.value,
          status: "Draft Quote",
          quote_text: quoteText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to save quote.");
        return;
      }

      setQuoteSaved(true);
    } catch (error) {
      console.error(error);
      alert("Error saving quote.");
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />
          <main className="mainContent">
            <p>Loading lead...</p>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!lead) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />
          <main className="mainContent">
            <Link href="/leads" className="backLink">
              ← Back to Leads
            </Link>
            <h1>Lead not found</h1>
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
          <Link href="/leads" className="backLink">
            ← Back to Leads
          </Link>

          <div className="topBar">
            <h1>{editMode ? "Edit Lead" : lead.name}</h1>

            <div style={{ display: "flex", gap: "10px" }}>
              <button className="primaryBtn" onClick={() => setEditMode(!editMode)}>
                {editMode ? "Cancel" : "Edit Lead"}
              </button>

              {editMode && (
                <button className="primaryBtn" onClick={updateLead} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}

              <button className="primaryBtn" onClick={deleteLead}>
                Delete Lead
              </button>

              <button className="primaryBtn" onClick={generateQuote}>
                Generate Quote
              </button>
            </div>
          </div>

          <section className="detailsGrid">
            <div className="panel">
              <h3>Lead Information</h3>

              {editMode ? (
                <div className="editLeadForm">
                  <input name="name" value={lead.name || ""} onChange={handleChange} placeholder="Lead Name" />
                  <input name="company" value={lead.company || ""} onChange={handleChange} placeholder="Company" />
                  <input name="email" value={lead.email || ""} onChange={handleChange} placeholder="Email" />
                  <input name="phone" value={lead.phone || ""} onChange={handleChange} placeholder="Phone" />

                  <select name="status" value={lead.status || "New"} onChange={handleChange}>
                    <option>New</option>
                    <option>Contacted</option>
                    <option>Proposal Sent</option>
                    <option>Follow Up</option>
                    <option>Won</option>
                    <option>Lost</option>
                  </select>

                  <input name="value" value={lead.value || ""} onChange={handleChange} placeholder="Value e.g. £2,500" />

                  <textarea name="notes" value={lead.notes || ""} onChange={handleChange} placeholder="Lead Notes" rows={5} />
                </div>
              ) : (
                <>
                  <p><strong>Company:</strong> {lead.company}</p>
                  <p><strong>Email:</strong> {lead.email}</p>
                  <p><strong>Phone:</strong> {lead.phone}</p>
                  <p><strong>Status:</strong> <StatusBadge status={lead.status} /></p>
                  <p><strong>Value:</strong> {lead.value || "-"}</p>
                  <p><strong>Source:</strong> {lead.source || "Manual"}</p>
                </>
              )}
            </div>

            <div className="panel">
              <h3>AI Lead Analysis</h3>

              <p><strong>Score:</strong> {getAiScoreLabel(lead.ai_score)}</p>

              <p><strong>Summary:</strong></p>
              <p>{lead.ai_summary || "No AI summary available."}</p>

              <p><strong>Recommended Next Action:</strong></p>
              <p>{lead.ai_next_action || "No AI recommendation available."}</p>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button className="primaryBtn" onClick={generateEmail}>
                  Generate Follow-up Email
                </button>

                <button className="primaryBtn" onClick={createFollowUpTask}>
                  Create Follow-up Task
                </button>
              </div>
            </div>
          </section>

          {emailDraft && (
            <section className="panel emailDraftPanel">
              <h3>Email Draft</h3>
              <textarea value={emailDraft} readOnly rows={10} className="emailDraftBox" />
            </section>
          )}

          {quoteDraft && (
            <section className="panel quoteDraftPanel">
              <h3>Quote Draft</h3>
              <textarea value={quoteDraft} readOnly rows={16} className="emailDraftBox" />

              {quoteSaved && (
                <p className="helperText">
                  Quote saved successfully. Go to Quotes to convert it to a customer.
                </p>
              )}
            </section>
          )}

          <section className="detailsGrid">
            <div className="panel">
              <h3>Notes</h3>
              {lead.notes ? <p>{lead.notes}</p> : <p>No notes added yet.</p>}
            </div>

            <div className="panel">
              <h3>Activity Timeline</h3>
              <p>Lead created</p>
              <p>AI analysed lead</p>
              <p>Quote pending</p>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
