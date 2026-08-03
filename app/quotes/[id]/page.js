"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";
import styles from "./quote-details.module.css";

export default function QuoteDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const quoteId = params?.id;

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (quoteId) {
      fetchQuote();
    }
  }, [quoteId]);

  async function fetchQuote() {
    try {
      setLoading(true);
      setErrorMessage("");

      const directResponse = await fetch(
        `/api/quotes/${quoteId}`,
        {
          cache: "no-store",
        }
      );

      if (directResponse.ok) {
        const directData =
          await directResponse.json();

        const selectedQuote = Array.isArray(
          directData
        )
          ? directData[0]
          : directData;

        setQuote(selectedQuote || null);
        return;
      }

      const response = await fetch("/api/quotes", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load quote."
        );
      }

      const selectedQuote = (
        Array.isArray(data) ? data : []
      ).find(
        (item) =>
          String(item.id) === String(quoteId)
      );

      setQuote(selectedQuote || null);
    } catch (error) {
      console.error("Quote loading error:", error);

      setErrorMessage(
        error.message ||
          "We could not load this quote."
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadPDF() {
    window.print();
  }

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(
        quote?.quote_text || ""
      );

      alert("Quote copied successfully.");
    } catch (error) {
      console.error("Quote copy error:", error);
      alert("Unable to copy the quote.");
    }
  }

  async function convertToCustomer() {
    if (!quote || converting) {
      return;
    }

    if (quote.customer_id) {
      router.push(
        `/customers/${quote.customer_id}`
      );
      return;
    }

    try {
      setConverting(true);

      const response = await fetch(
        `/api/quotes/${quote.id}/convert`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to convert quote to customer."
        );
      }

      if (!data.customer?.id) {
        throw new Error(
          "Customer conversion completed, but no customer ID was returned."
        );
      }

      setQuote(data.quote || quote);

      alert(
        data.message ||
          "Quote converted successfully."
      );

      router.push(
        `/customers/${data.customer.id}`
      );
    } catch (error) {
      console.error(
        "Quote conversion error:",
        error
      );

      alert(
        error.message ||
          "Error converting quote to customer."
      );
    } finally {
      setConverting(false);
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Quote Workspace"
          description="Loading quotation information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (errorMessage) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Quote Workspace"
          description="Review a commercial quotation."
        >
          <section className={styles.errorPanel}>
            <div>
              <strong>Unable to load quote</strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={fetchQuote}
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!quote) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Quote Workspace"
          description="Review a commercial quotation."
        >
          <section className={styles.notFound}>
            <span className={styles.notFoundIcon}>
              ◇
            </span>

            <h2>Quote not found</h2>

            <p>
              This quotation may have been deleted or
              you may not have access to it.
            </p>

            <Link
              href="/quotes"
              className={styles.primaryButton}
            >
              Return to quotes
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const amount = formatQuoteAmount(
    quote.amount
  );

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          quote.quote_number || "Quote Workspace"
        }
        description="Quotation details, client information and conversion actions."
      >
        <div className={styles.page}>
          <section
            className={`${styles.pageHeader} ${styles.noPrint}`}
          >
            <div className={styles.headerCopy}>
              <Link
                href="/quotes"
                className={styles.backLink}
              >
                ← Back to quotes
              </Link>

              <span className={styles.eyebrow}>
                Quote workspace
              </span>

              <h2>
                {quote.quote_number || "Quote"}
              </h2>

              <p>
                Review the full quotation and continue
                the customer conversion workflow.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={copyQuote}
              >
                Copy quote
              </button>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={downloadPDF}
              >
                Download PDF
              </button>

              <button
                type="button"
                className={styles.primaryButton}
                disabled={converting}
                onClick={convertToCustomer}
              >
                {converting
                  ? "Converting..."
                  : quote.customer_id
                    ? "View customer"
                    : "Convert to customer"}
              </button>
            </div>
          </section>

          <section className={styles.heroCard}>
            <div className={styles.quoteIdentity}>
              <span className={styles.quoteIcon}>◇</span>

              <div className={styles.quoteIdentityCopy}>
                <span className={styles.heroLabel}>
                  Commercial quotation
                </span>

                <h3>
                  {quote.client || "Unnamed client"}
                </h3>

                <p>
                  {quote.service ||
                    "Professional services"}
                </p>

                <div className={styles.identityMeta}>
                  <StatusBadge
                    status={quote.status || "Draft"}
                  />

                  <span className={styles.metaBadge}>
                    Created{" "}
                    {formatDate(quote.created_at)}
                  </span>

                  {quote.customer_id && (
                    <span className={styles.linkedBadge}>
                      Linked customer
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.amountCard}>
              <span>Quote value</span>
              <strong>{amount}</strong>
              <small>
                {quote.status || "Draft"}
              </small>
            </div>
          </section>

          <section className={styles.detailsGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>Client information</h3>
                  <p>
                    Sensitive contact information
                  </p>
                </div>
              </div>

              <div className={styles.detailList}>
                <DetailRow
                  label="Client"
                  value={quote.client}
                />

                <DetailRow
                  label="Primary contact"
                  value={quote.contact}
                />

                <DetailRow
                  label="Email"
                  value={quote.email}
                  href={
                    quote.email
                      ? `mailto:${quote.email}`
                      : null
                  }
                />

                <DetailRow
                  label="Phone"
                  value={quote.phone}
                  href={
                    quote.phone
                      ? `tel:${quote.phone}`
                      : null
                  }
                />
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>Quote information</h3>
                  <p>
                    Commercial and workflow details
                  </p>
                </div>
              </div>

              <div className={styles.detailList}>
                <DetailRow
                  label="Quote number"
                  value={quote.quote_number}
                />

                <DetailRow
                  label="Service"
                  value={quote.service}
                />

                <DetailRow
                  label="Amount"
                  value={amount}
                />

                <DetailRow
                  label="Status"
                  customValue={
                    <StatusBadge
                      status={quote.status || "Draft"}
                    />
                  }
                />

                <DetailRow
                  label="Created"
                  value={formatDate(
                    quote.created_at
                  )}
                />

                <DetailRow
                  label="Customer link"
                  customValue={
                    quote.customer_id ? (
                      <Link
                        href={`/customers/${quote.customer_id}`}
                        className={styles.customerLink}
                      >
                        Open linked customer →
                      </Link>
                    ) : (
                      <strong className={styles.emptyValue}>
                        Not converted
                      </strong>
                    )
                  }
                />
              </div>
            </section>
          </section>

          <section className={styles.documentPanel}>
            <div
              className={`${styles.documentToolbar} ${styles.noPrint}`}
            >
              <div>
                <span className={styles.eyebrow}>
                  Customer document
                </span>

                <h3>Full quotation</h3>
              </div>

              <div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={copyQuote}
                >
                  Copy
                </button>

                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={downloadPDF}
                >
                  Export PDF
                </button>
              </div>
            </div>

            <article className={styles.quoteDocument}>
              <header className={styles.documentHeader}>
                <div>
                  <span className={styles.documentBrandMark}>
                    SN
                  </span>

                  <div>
                    <strong>
                      SaiNal Technologies Ltd
                    </strong>
                    <p>Business technology solutions</p>
                  </div>
                </div>

                <div className={styles.documentTitle}>
                  <span>QUOTE</span>
                  <strong>
                    {quote.quote_number || "Quote"}
                  </strong>
                </div>
              </header>

              <section className={styles.documentMeta}>
                <div>
                  <span>Prepared for</span>
                  <strong>
                    {quote.client || "Client"}
                  </strong>
                  <p>
                    {quote.contact || ""}
                  </p>
                  <p>
                    {quote.email || ""}
                  </p>
                  <p>
                    {quote.phone || ""}
                  </p>
                </div>

                <div>
                  <span>Quote date</span>
                  <strong>
                    {formatDate(quote.created_at)}
                  </strong>

                  <span>Status</span>
                  <strong>
                    {quote.status || "Draft"}
                  </strong>
                </div>
              </section>

              <section className={styles.documentSummary}>
                <div>
                  <span>Service</span>
                  <strong>
                    {quote.service ||
                      "Professional Services"}
                  </strong>
                </div>

                <div>
                  <span>Total</span>
                  <strong>{amount}</strong>
                </div>
              </section>

              <pre className={styles.quotePreview}>
                {quote.quote_text ||
                  "No full quote content is available."}
              </pre>

              <footer className={styles.documentFooter}>
                <p>
                  SaiNal Technologies Ltd
                </p>

                <p>
                  www.sainaltechnologies.com
                </p>
              </footer>
            </article>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function DetailRow({
  label,
  value,
  href,
  customValue,
}) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>

      {customValue ? (
        customValue
      ) : href && value ? (
        <a href={href}>{value}</a>
      ) : (
        <strong
          className={
            value ? "" : styles.emptyValue
          }
        >
          {value || "Not available"}
        </strong>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <section className={styles.loadingPanel}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={styles.loadingRow}
        />
      ))}
    </section>
  );
}

function getMoneyValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  return (
    Number(
      String(value).replace(/[^0-9.-]/g, "")
    ) || 0
  );
}

function formatQuoteAmount(value) {
  if (!value) {
    return "Not set";
  }

  return getMoneyValue(value).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
