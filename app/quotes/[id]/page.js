"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function QuoteDetailsPage() {
  const params = useParams();
  const quoteId = params.id;

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

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
          <Link href="/ai-assistant">AI Assistant</Link>
        </nav>
      </aside>

      <main className="mainContent">
        <Link href="/quotes" className="backLink noPrint">
          ← Back to Quotes
        </Link>

        <div className="topBar">
          <h1>Quote Details</h1>

          <button className="primaryBtn noPrint" onClick={downloadPDF}>
            Download PDF
          </button>
        </div>

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
