"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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

  async function updateLead() {
    if (!lead) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
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

  function generateEmail() {
    if (!lead) return;

    setEmailDraft(`Hi ${lead.name},

Thank you for your interest in SaiNal Technologies.

Based on your enquiry, I believe we can help ${lead.company} with a professional digital solution tailored to your business needs.

I would be happy to schedule a short call to discuss your requirements and provide a suitable proposal.

Kind Regards,
Sai Kumar
SaiNal Technologies Ltd`);
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quote_number: quoteNumber,
          lead_id: lead.id,
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
      <div className="appLayout">
        <aside className="sidebar">
          <h2>SaiNal One</h2>
        </aside>
        <main className="mainContent">
          <p>Loading lead...</p>
        </main>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="appLayout">
        <aside className="sidebar">
          <h2>SaiNal One</h2>
        </aside>
        <main className="mainContent">
          <Link href="/leads" className="backLink">
            ← Back to Leads
          </Link>
          <h1>Lead not found</h1>
        </main>
      </div>
    );
  }

  return (
    <div className="appLayout">
      <aside className="sidebar">
        <h2>SaiNal One</h2>

        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/leads">Leads</Link>
          <Link href="/quotes">Quotes</Link>
          <Link href="/ai-assistant">AI Assistant</Link>
        </nav>
      </aside>

      <main className="mainContent">
        <Link href="/leads" className="backLink">
          ← Back to Leads
        </Link>

        <div className="topBar">
          <h1>{editMode ? "Edit Lead" : lead.name}</h1>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="primaryBtn"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? "Cancel" : "Edit Lead"}
            </button>

            {editMode && (
              <button
                className="primaryBtn"
                onClick={updateLead}
                disabled={saving}
              >
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

                <textarea
                  name="notes"
                  value={lead.notes || ""}
                  onChange={handleChange}
                  placeholder="Lead Notes"
                  rows={5}
                />
              </div>
            ) : (
              <>
                <p><strong>Company:</strong> {lead.company}</p>
                <p><strong>Email:</strong> {lead.email}</p>
                <p><strong>Phone:</strong> {lead.phone}</p>
                <p><strong>Status:</strong> {lead.status}</p>
                <p><strong>Value:</strong> {lead.value}</p>
              </>
            )}
          </div>

          <div className="panel">
            <h3>AI Recommendations</h3>
            <p>Prepare a follow-up email for this lead.</p>
            <p>Suggest a quote based on project value.</p>
            <p>Schedule follow-up in 2 days.</p>

            <button className="primaryBtn" onClick={generateEmail}>
              Generate Email
            </button>
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
                Quote saved successfully to Supabase.
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
            <p>Email draft generated</p>
            <p>Quote pending</p>
          </div>
        </section>
      </main>
    </div>
  );
}
