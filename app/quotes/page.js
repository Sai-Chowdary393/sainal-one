"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuotes();
  }, []);

  async function fetchQuotes() {
    try {
      const response = await fetch("/api/quotes");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load quotes.");
        return;
      }

      setQuotes(data);
    } catch (error) {
      console.error(error);
      alert("Error loading quotes.");
    } finally {
      setLoading(false);
    }
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
        <div className="topBar">
          <h1>Quotes</h1>
        </div>

        {loading ? (
          <p>Loading quotes...</p>
        ) : (
          <table className="leadTable">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan="6">No quotes found yet.</td>
                </tr>
              ) : (
                quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <Link href={`/quotes/${quote.id}`} className="leadLink">
                        {quote.client}
                      </Link>
                    </td>
                    <td>{quote.contact}</td>
                    <td>{quote.email}</td>
                    <td>{quote.amount}</td>
                    <td>{quote.status}</td>
                    <td>
                      {quote.created_at
                        ? new Date(quote.created_at).toLocaleDateString("en-GB")
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
