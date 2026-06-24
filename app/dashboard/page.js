"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const leadsResponse = await fetch("/api/leads");
      const quotesResponse = await fetch("/api/quotes");

      const leadsData = await leadsResponse.json();
      const quotesData = await quotesResponse.json();

      setLeads(leadsData || []);
      setQuotes(quotesData || []);
    } catch (error) {
      console.error(error);
      alert("Error loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  function getTotalQuoteValue() {
    return quotes.reduce((total, quote) => {
      const amount = quote.amount || "0";
      const number = Number(amount.replace(/[^0-9.]/g, ""));
      return total + number;
    }, 0);
  }

  const totalLeads = leads.length;
  const totalQuotes = quotes.length;
  const pipelineValue = getTotalQuoteValue();
  const latestLeads = leads.slice(0, 3);
  const latestQuotes = quotes.slice(0, 3);

  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">
        <div className="topBar">
          <h1>Dashboard</h1>

          <input
            className="searchBox"
            placeholder="Search leads, customers..."
          />
        </div>

        {loading ? (
          <p>Loading dashboard...</p>
        ) : (
          <>
            <section className="dashboardCards">
              <div className="statCard">
                <p>Total Leads</p>
                <h2>{totalLeads}</h2>
              </div>

              <div className="statCard">
                <p>Total Quotes</p>
                <h2>{totalQuotes}</h2>
              </div>

              <div className="statCard">
                <p>Pipeline Value</p>
                <h2>£{pipelineValue.toLocaleString("en-GB")}</h2>
              </div>

              <div className="statCard">
                <p>AI Insights</p>
                <h2>{totalLeads + totalQuotes}</h2>
              </div>
            </section>

            <section className="dashboardGrid">
              <div className="panel">
                <h3>Recent Leads</h3>

                {latestLeads.length === 0 ? (
                  <p>No leads yet.</p>
                ) : (
                  latestLeads.map((lead) => (
                    <p key={lead.id}>
                      <Link href={`/leads/${lead.id}`} className="leadLink">
                        {lead.name}
                      </Link>{" "}
                      - {lead.company}
                    </p>
                  ))
                )}
              </div>

              <div className="panel">
                <h3>Recent Quotes</h3>

                {latestQuotes.length === 0 ? (
                  <p>No quotes yet.</p>
                ) : (
                  latestQuotes.map((quote) => (
                    <p key={quote.id}>
                      <Link href={`/quotes/${quote.id}`} className="leadLink">
                        {quote.quote_number || "Quote"}
                      </Link>{" "}
                      - {quote.client} - {quote.amount}
                    </p>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>SaiNal One</h2>

      <nav>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/leads">Leads</Link>
        <Link href="/quotes">Quotes</Link>
        <Link href="/customers">Customers</Link>
        <Link href="/ai-assistant">AI Assistant</Link>
      </nav>
    </aside>
  );
}
