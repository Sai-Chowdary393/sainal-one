"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CustomerDetailsPage() {
  const params = useParams();
  const customerId = params.id;

  const [customer, setCustomer] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerDetails();
  }, [customerId]);

  async function fetchCustomerDetails() {
    try {
      const customersResponse = await fetch("/api/customers");
      const quotesResponse = await fetch("/api/quotes");

      const customersData = await customersResponse.json();
      const quotesData = await quotesResponse.json();

      const selectedCustomer = customersData.find(
        (item) => String(item.id) === String(customerId)
      );

      setCustomer(selectedCustomer || null);

      if (selectedCustomer) {
        const customerQuotes = quotesData.filter(
          (quote) =>
            String(quote.customer_id) === String(selectedCustomer.id) ||
            String(quote.lead_id) === String(selectedCustomer.lead_id) ||
            quote.email === selectedCustomer.email ||
            quote.client === selectedCustomer.company
        );

        setQuotes(customerQuotes);
      }
    } catch (error) {
      console.error(error);
      alert("Error loading customer details.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="appLayout">
        <aside className="sidebar">
          <h2>SaiNal One</h2>
        </aside>

        <main className="mainContent">
          <p>Loading customer...</p>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="appLayout">
        <aside className="sidebar">
          <h2>SaiNal One</h2>
        </aside>

        <main className="mainContent">
          <Link href="/customers" className="backLink">
            ← Back to Customers
          </Link>
          <h1>Customer not found</h1>
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
          <Link href="/customers">Customers</Link>
          <Link href="/ai-assistant">AI Assistant</Link>
        </nav>
      </aside>

      <main className="mainContent">
        <Link href="/customers" className="backLink">
          ← Back to Customers
        </Link>

        <div className="topBar">
          <h1>{customer.customer_name}</h1>
        </div>

        <section className="detailsGrid">
          <div className="panel">
            <h3>Customer Information</h3>
            <p><strong>Company:</strong> {customer.company}</p>
            <p><strong>Email:</strong> {customer.email}</p>
            <p><strong>Phone:</strong> {customer.phone}</p>
            <p><strong>Status:</strong> {customer.status}</p>
          </div>

          <div className="panel">
            <h3>Activity Summary</h3>
            <p>Customer created</p>
            <p>Total Quotes: {quotes.length}</p>
            <p>Status: {customer.status}</p>
          </div>
        </section>

        <section className="panel">
          <h3>Customer Quotes</h3>

          {quotes.length === 0 ? (
            <p>No quotes found for this customer.</p>
          ) : (
            <table className="leadTable">
              <thead>
                <tr>
                  <th>Quote No</th>
                  <th>Service</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <Link href={`/quotes/${quote.id}`} className="leadLink">
                        {quote.quote_number || "Quote"}
                      </Link>
                    </td>
                    <td>{quote.service}</td>
                    <td>{quote.amount}</td>
                    <td>{quote.status}</td>
                    <td>
                      {quote.created_at
                        ? new Date(quote.created_at).toLocaleDateString("en-GB")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
