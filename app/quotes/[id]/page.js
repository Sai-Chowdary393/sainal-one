"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";

export default function QuoteDetailsPage() {
  const params = useParams();
  const quoteId = params.id;

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customerCreated, setCustomerCreated] = useState(false);

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

  async function convertToCustomer() {
    if (!quote) return;

    try {
      const customersResponse = await fetch("/api/customers");
      const customersData = await customersResponse.json();

      const existingCustomer = customersData.find(
        (customer) =>
          String(customer.lead_id) === String(quote.lead_id) ||
          customer.email === quote.email ||
          customer.company === quote.client
      );

      if (existingCustomer) {
        setCustomerCreated(true);
        alert("Customer already exists.");
        return;
      }

      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          lead_id: quote.lead_id || null,
          customer_name: quote.contact,
          company: quote.client,
          email: quote.email,
          phone: quote.phone,
          status: "Active",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to create customer.");
        return;
      }

      setCustomerCreated(true);
      alert("Customer created successfully.");
    } catch (error) {
      console.error(error);
      alert("Error creating customer.");
    }
  }


  if (loading) {
    return (
      <div className="appLayout">

        <Sidebar />

        <main className="mainContent">
          <p>Loading quote...</p>
        </main>

      </div>
    );
  }


  if (!quote) {
    return (
      <div className="appLayout">

        <Sidebar />

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

      <Sidebar />

      <main className="mainContent">

        <Link href="/quotes" className="backLink noPrint">
          ← Back to Quotes
        </Link>


        <div className="topBar">

          <h1>Quote Details</h1>


          <div style={{ display:"flex", gap:"10px" }}>

            <button 
              className="primaryBtn noPrint"
              onClick={downloadPDF}
            >
              Download PDF
            </button>


            <button
              className="primaryBtn noPrint"
              onClick={convertToCustomer}
            >
              Convert To Customer
            </button>

          </div>

        </div>


        {customerCreated && (
          <p className="helperText">
            Customer is ready. Go to Customers to start the project.
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

            <p>
              <strong>Quote Number:</strong>{" "}
              {quote.quote_number || "-"}
            </p>


            <p>
              <strong>Service:</strong>{" "}
              {quote.service}
            </p>


            <p>
              <strong>Amount:</strong>{" "}
              {quote.amount}
            </p>


            <p>
              <strong>Status:</strong>{" "}
              <StatusBadge status={quote.status} />
            </p>


            <p>
              <strong>Created:</strong>{" "}
              {quote.created_at
                ? new Date(
                    quote.created_at
                  ).toLocaleDateString("en-GB")
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
