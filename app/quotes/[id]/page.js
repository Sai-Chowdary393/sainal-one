"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";

import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";

export default function QuoteDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const quoteId = params.id;

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] =
    useState(true);

  const [converting, setConverting] =
    useState(false);

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  async function fetchQuote() {
    try {
      const response = await fetch(
        "/api/quotes"
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to load quote."
        );
        return;
      }

      const selectedQuote = (
        Array.isArray(data) ? data : []
      ).find(
        (item) =>
          String(item.id) ===
          String(quoteId)
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
    if (!quote || converting) {
      return;
    }

    /*
     * The quote may already be linked.
     */
    if (quote.customer_id) {
      router.push(
        `/customers/${quote.customer_id}`
      );
      return;
    }

    setConverting(true);

    try {
      const response = await fetch(
        `/api/quotes/${quote.id}/convert`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to convert quote to customer."
        );
        return;
      }

      if (!data.customer?.id) {
        alert(
          "Customer conversion completed, but no customer ID was returned."
        );
        return;
      }

      setQuote(data.quote || quote);

      alert(data.message);

      router.push(
        `/customers/${data.customer.id}`
      );
    } catch (error) {
      console.error(error);

      alert(
        "Error converting quote to customer."
      );
    } finally {
      setConverting(false);
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <p>Loading quote...</p>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!quote) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <Link
              href="/quotes"
              className="backLink"
            >
              ← Back to Quotes
            </Link>

            <h1>Quote not found</h1>
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
          <Link
            href="/quotes"
            className="backLink noPrint"
          >
            ← Back to Quotes
          </Link>

          <div className="topBar">
            <h1>Quote Details</h1>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="primaryBtn noPrint"
                onClick={downloadPDF}
              >
                Download PDF
              </button>

              <button
                type="button"
                className="primaryBtn noPrint"
                disabled={converting}
                onClick={convertToCustomer}
              >
                {converting
                  ? "Converting..."
                  : quote.customer_id
                  ? "View Customer"
                  : "Convert To Customer"}
              </button>
            </div>
          </div>

          {quote.customer_id && (
            <p className="helperText noPrint">
              This quote is linked to a customer.
            </p>
          )}

          <section className="detailsGrid">
            <div className="panel">
              <h3>Client Information</h3>

              <p>
                <strong>Client:</strong>{" "}
                {quote.client || "-"}
              </p>

              <p>
                <strong>Contact:</strong>{" "}
                {quote.contact || "-"}
              </p>

              <p>
                <strong>Email:</strong>{" "}
                {quote.email || "-"}
              </p>

              <p>
                <strong>Phone:</strong>{" "}
                {quote.phone || "-"}
              </p>
            </div>

            <div className="panel">
              <h3>Quote Information</h3>

              <p>
                <strong>
                  Quote Number:
                </strong>{" "}
                {quote.quote_number || "-"}
              </p>

              <p>
                <strong>Service:</strong>{" "}
                {quote.service || "-"}
              </p>

              <p>
                <strong>Amount:</strong>{" "}
                {quote.amount || "-"}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                <StatusBadge
                  status={quote.status}
                />
              </p>

              <p>
                <strong>Created:</strong>{" "}
                {quote.created_at
                  ? new Date(
                      quote.created_at
                    ).toLocaleDateString(
                      "en-GB"
                    )
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
    </ProtectedRoute>
  );
}
