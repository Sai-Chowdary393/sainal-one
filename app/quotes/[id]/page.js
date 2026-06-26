"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function QuoteDetailsPage() {
  const params = useParams();
  const quoteId = params.id;

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projectCreated, setProjectCreated] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  async function fetchQuote() {
    try {
      const response = await fetch("/api/quotes");
      const data = await response.json();

      const selectedQuote = data.find(
        (item) => String(item.id) === String(quoteId)
      );

      setQuote(selectedQuote || null);
    } catch (error) {
      console.error(error);
      alert("Error loading quote.");
    } finally {
      setLoading(false);
    }
  }

  function downloadPDF() {
    window.print();
  }

  async function startProject() {
    if (!quote) return;

    try {
      const customersResponse = await fetch("/api/customers");
      const customersData = await customersResponse.json();

      const matchedCustomer = customersData.find(
        (customer) =>
          String(customer.id) === String(quote.customer_id) ||
          String(customer.lead_id) === String(quote.lead_id) ||
          customer.email === quote.email ||
          customer.company === quote.client
      );

      if (!matchedCustomer) {
        alert("Please convert this lead to customer first, then start project.");
        return;
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: matchedCustomer.id,
          quote_id: quote.id,
          project_name: `${quote.client} - ${quote.service}`,
          description: `Project created from quote ${quote.quote_number || quote.id}.`,
          status: "Planning",
          start_date: new Date().toISOString().split("T")[0],
          due_date: null,
          amount: quote.amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to start project.");
        return;
      }

      setProjectCreated(true);
      alert("Project started successfully.");
    } catch (error) {
      console.error(error);
      alert("Error starting project.");
    }
  }

  if (loading) {
    return (
      <div className="appLayout">
        <aside className="sidebar">
          <h2>SaiNal One</h2>
        </aside>

        <main className="mainContent">
          <p>Loading quote...</p>
        </main>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="appLayout">
        <aside className="sidebar">
          <h2>SaiNal One</h2>
        </aside>

        <main className="mainContent">
          <Link href="/quotes" className="backLink">
            ← Back to Quotes
          </Link>
          <h1>Quote not found</h1>
        </main>
      </div>
    );
  }

  return (
    <div className="appLayout">
      <aside className="sidebar noPrint">
        <h2>SaiNal One</h2>

        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/leads">Leads</Link>
          <Link href="/quotes">Quotes</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/ai-assistant">AI Assistant</Link>
        </nav>
      </aside>

      <main className="mainContent">
        <Link href="/quotes" className="backLink noPrint">
          ← Back to Quotes
        </Link>

        <div className="topBar">
          <h1>Quote Details</h1>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="primaryBtn noPrint" onClick={downloadPDF}>
              Download PDF
            </button>

            <button className="primaryBtn noPrint" onClick={startProject}>
              Start Project
            </button>
          </div>
        </div>

        {projectCreated && (
          <p className="helperText">
            Project started successfully. You can view it in Projects.
          </p>
        )}

        <section className="detailsGrid">
          <div className="panel">
            <h3>Client Information</h3>
            <p><strong>Client:</strong> {quote.client}</p>
            <p><strong>Contact:</strong> {quote.contact}</p>
            <p><strong>Email:</strong> {quote.email}</p>
            <p><strong>Phone:</strong> {quote.phone}</p>
          </div>

          <div className="panel">
            <h3>Quote Information</h3>
            <p><strong>Quote Number:</strong> {quote.quote_number || "-"}</p>
            <p><strong>Service:</strong> {quote.service}</p>
            <p><strong>Amount:</strong> {quote.amount}</p>
            <p><strong>Status:</strong> {quote.status}</p>
            <p>
              <strong>Created:</strong>{" "}
              {quote.created_at
                ? new Date(quote.created_at).toLocaleDateString("en-GB")
                : "-"}
            </p>
          </div>
        </section>

        <section className="panel">
          <h3>Full Quote</h3>

          <pre className="quotePreview">
            {quote.quote_text || ""}
          </pre>
        </section>
      </main>
    </div>
  );
}
