"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";
import SendRecordEmail from "../../../components/SendRecordEmail";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const invoiceId = params.id;

  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [recipientEmail, setRecipientEmail] =
    useState("");
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  async function fetchInvoice() {
    try {
      const [
        invoiceResponse,
        settingsResponse,
        quotesResponse,
      ] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/company-settings"),
        fetch("/api/quotes"),
      ]);

      const invoicesData =
        await invoiceResponse.json();

      const settingsData =
        await settingsResponse.json();

      const quotesData =
        await quotesResponse.json();

      if (!invoiceResponse.ok) {
        alert(
          invoicesData.error ||
            "Failed to load invoices."
        );
        return;
      }

      if (!settingsResponse.ok) {
        alert(
          settingsData.error ||
            "Failed to load company settings."
        );
        return;
      }

      const selectedInvoice = (
        Array.isArray(invoicesData)
          ? invoicesData
          : []
      ).find(
        (item) =>
          String(item.id) === String(invoiceId)
      );

      if (!selectedInvoice) {
        setInvoice(null);
        return;
      }

      const relatedQuote = (
        Array.isArray(quotesData)
          ? quotesData
          : []
      ).find(
        (quote) =>
          String(quote.id) ===
          String(selectedInvoice.quote_id)
      );

      setInvoice(selectedInvoice);
      setSettings(settingsData || null);
      setRecipientEmail(
        relatedQuote?.email ||
          selectedInvoice.email ||
          ""
      );
    } catch (error) {
      console.error(error);
      alert("Error loading invoice.");
    } finally {
      setLoading(false);
    }
  }

  async function updateInvoiceStatus(status) {
    setUpdatingStatus(true);

    try {
      const response = await fetch(
        `/api/invoices/${invoiceId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed updating invoice."
        );
        return;
      }

      setInvoice((currentInvoice) => ({
        ...currentInvoice,
        status,
      }));

      alert(`Invoice marked as ${status}.`);
    } catch (error) {
      console.error(error);
      alert("Error updating invoice.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  function downloadPDF() {
    window.print();
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <p>Loading invoice...</p>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!invoice) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <Link
              href="/invoices"
              className="backLink"
            >
              ← Back to Invoices
            </Link>

            <h1>Invoice not found</h1>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const companyName =
    settings?.company_name ||
    "SaiNal Technologies Ltd";

  const companyWebsite =
    settings?.website ||
    "www.sainaltechnologies.com";

  const companyAddress =
    settings?.address ||
    "United Kingdom";

  const companyEmail =
    settings?.company_email || "";

  const companyPhone =
    settings?.company_phone || "";

  const vatNumber =
    settings?.vat_number || "";

  const companyRegistrationNumber =
    settings?.company_registration_number || "";

  const bankName =
    settings?.bank_name || "";

  const bankAccountName =
    settings?.bank_account_name || "";

  const bankSortCode =
    settings?.bank_sort_code || "";

  const bankAccountNumber =
    settings?.bank_account_number || "";

  const createdDate = invoice.created_at
    ? new Date(
        invoice.created_at
      ).toLocaleDateString("en-GB")
    : "-";

  const dueDate = invoice.due_date
    ? new Date(
        invoice.due_date
      ).toLocaleDateString("en-GB")
    : "-";

  const subtotal =
    invoice.subtotal ||
    invoice.amount ||
    "£0.00";

  const vatRate =
    invoice.vat_rate || "0%";

  const vatAmount =
    invoice.vat_amount || "£0.00";

  const totalAmount =
    invoice.total_amount ||
    invoice.amount ||
    "£0.00";

  const paymentTerms =
    invoice.payment_terms ||
    settings?.payment_terms ||
    "Payment due within 14 days of invoice date.";

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <Link
            href="/invoices"
            className="backLink noPrint"
          >
            ← Back to Invoices
          </Link>

          <div className="topBar noPrint">
            <div>
              <h1>Invoice Details</h1>

              <p className="helperText">
                {invoice.invoice_number}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <SendRecordEmail
                endpoint={`/api/invoices/${invoice.id}/send`}
                defaultEmail={recipientEmail}
                defaultSubject={`Invoice ${invoice.invoice_number} from ${companyName}`}
                recordLabel="invoice"
                onSent={() => {
                  setInvoice((currentInvoice) => ({
                    ...currentInvoice,
                    status:
                      currentInvoice.status === "Paid"
                        ? "Paid"
                        : "Sent",
                  }));
                }}
              />

              <button
                type="button"
                className="primaryBtn"
                onClick={downloadPDF}
              >
                Download PDF
              </button>

              <button
                type="button"
                className="primaryBtn"
                disabled={updatingStatus}
                onClick={() =>
                  updateInvoiceStatus("Sent")
                }
              >
                {updatingStatus
                  ? "Updating..."
                  : "Mark Sent"}
              </button>

              <button
                type="button"
                className="primaryBtn"
                disabled={updatingStatus}
                onClick={() =>
                  updateInvoiceStatus("Paid")
                }
              >
                {updatingStatus
                  ? "Updating..."
                  : "Mark Paid"}
              </button>
            </div>
          </div>

          <section className="invoiceDocument">
            <div className="invoiceHeader">
              <div>
                <h1>{companyName}</h1>

                <p>
                  Digital Solutions & Automation
                </p>

                <p>{companyAddress}</p>
                <p>{companyWebsite}</p>

                {companyEmail && (
                  <p>Email: {companyEmail}</p>
                )}

                {companyPhone && (
                  <p>Phone: {companyPhone}</p>
                )}

                {companyRegistrationNumber && (
                  <p>
                    Company No:{" "}
                    {companyRegistrationNumber}
                  </p>
                )}

                {vatNumber && (
                  <p>VAT No: {vatNumber}</p>
                )}
              </div>

              <div className="invoiceMeta">
                <h2>INVOICE</h2>

                <p>
                  <strong>Invoice No:</strong>{" "}
                  {invoice.invoice_number}
                </p>

                <p>
                  <strong>Date:</strong>{" "}
                  {createdDate}
                </p>

                <p>
                  <strong>Due Date:</strong>{" "}
                  {dueDate}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  <StatusBadge
                    status={invoice.status}
                  />
                </p>
              </div>
            </div>

            <div className="invoiceDivider" />

            <div className="invoiceBillGrid">
              <div>
                <h3>Bill To</h3>

                <p>{invoice.client}</p>

                {recipientEmail && (
                  <p>{recipientEmail}</p>
                )}
              </div>

              <div>
                <h3>Project / Service</h3>

                <p>{invoice.service}</p>
              </div>
            </div>

            <table className="invoiceTable">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Subtotal</th>
                  <th>VAT</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>{invoice.service}</td>
                  <td>1</td>
                  <td>{subtotal}</td>

                  <td>
                    {vatAmount} ({vatRate})
                  </td>

                  <td>{totalAmount}</td>
                </tr>
              </tbody>
            </table>

            <div className="invoiceTotals">
              <div>
                <p>
                  <strong>
                    Payment Terms:
                  </strong>
                </p>

                <p>{paymentTerms}</p>

                {(bankName ||
                  bankAccountName ||
                  bankSortCode ||
                  bankAccountNumber) && (
                  <div
                    style={{
                      marginTop: "24px",
                    }}
                  >
                    <p>
                      <strong>
                        Bank Details:
                      </strong>
                    </p>

                    {bankName && (
                      <p>Bank: {bankName}</p>
                    )}

                    {bankAccountName && (
                      <p>
                        Account Name:{" "}
                        {bankAccountName}
                      </p>
                    )}

                    {bankSortCode && (
                      <p>
                        Sort Code:{" "}
                        {bankSortCode}
                      </p>
                    )}

                    {bankAccountNumber && (
                      <p>
                        Account Number:{" "}
                        {bankAccountNumber}
                      </p>
                    )}

                    <p>
                      Payment Reference:{" "}
                      {invoice.invoice_number}
                    </p>
                  </div>
                )}

                <p>
                  Thank you for your business.
                </p>
              </div>

              <div className="totalBox">
                <p>Subtotal</p>
                <h3>{subtotal}</h3>

                <p>VAT</p>
                <h3>{vatAmount}</h3>

                <p>Total Amount</p>
                <h2>{totalAmount}</h2>
              </div>
            </div>

            <div className="invoiceFooter">
              <p>
                This invoice was generated by
                SaiNal One — AI-powered Business
                Operating System.
              </p>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
