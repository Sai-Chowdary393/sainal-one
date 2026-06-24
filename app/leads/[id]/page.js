"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LeadDetails({ params }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailDraft, setEmailDraft] = useState("");
  const [quoteDraft, setQuoteDraft] = useState("");

  useEffect(() => {
    fetchLead();
  }, []);

  async function fetchLead() {
    try {
      const response = await fetch("/api/leads");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load lead.");
        return;
      }

      const selectedLead = data.find((item) => item.id === params.id);

      if (!selectedLead) {
        alert("Lead not found.");
        return;
      }

      setLead(selectedLead);
    } catch (error) {
      alert("Error loading lead.");
      console.error(error);
    } finally {
      setLoading(false);
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

  function generateQuote() {
    if (!lead) return;

    setQuoteDraft(`QUOTE

Client: ${lead.company}
Contact: ${lead.name}
Email: ${lead.email}
Phone: ${lead.phone}

Service:
Website Development & Business Automation

Estimated Cost:
${lead.value}

Estimated Delivery:
2 Weeks

Status:
Draft Quote

Prepared By:
SaiNal Technologies Ltd`);
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
          <Link href="/ai-assistant">AI Assistant</Link>
        </nav>
      </aside>

      <main className="mainContent">
        <Link href="/leads" className="backLink">
          ← Back to Leads
        </Link>

        <div className="topBar">
          <h1>{lead.name}</h1>

          <button className="primaryBtn" onClick={generateQuote}>
            Generate Quote
          </button>
        </div>

        <section className="detailsGrid">
          <div className="panel">
            <h3>Lead Information</h3>

            <p>
              <strong>Company:</strong> {lead.company}
            </p>
            <p>
              <strong>Email:</strong> {lead.email}
            </p>
            <p>
              <strong>Phone:</strong> {lead.phone}
            </p>
            <p>
              <strong>Status:</strong> {lead.status}
            </p>
            <p>
              <strong>Value:</strong> {lead.value}
            </p>
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

            <textarea
              value={emailDraft}
              readOnly
              rows={10}
              className="emailDraftBox"
            />

            <p className="helperText">
              You can copy this email and send it to the customer manually.
            </p>
          </section>
        )}

        {quoteDraft && (
          <section className="panel quoteDraftPanel">
            <h3>Quote Draft</h3>

            <textarea
              value={quoteDraft}
              readOnly
              rows={16}
              className="emailDraftBox"
            />

            <p className="helperText">Quote generated successfully.</p>
          </section>
        )}

        <section className="detailsGrid">
          <div className="panel">
            <h3>Notes</h3>
            <p>Initial enquiry received from website contact form.</p>
            <p>Customer interested in business website and automation.</p>
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
