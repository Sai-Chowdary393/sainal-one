"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const invoiceId = params.id;

  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  async function fetchInvoice() {
    try {
      const invoiceResponse = await fetch("/api/invoices");
      const settingsResponse = await fetch("/api/company-settings");

      const invoicesData = await invoiceResponse.json();
      const settingsData = await settingsResponse.json();

      const selectedInvoice = invoicesData.find(
        (item) => String(item.id) === String(invoiceId)
      );

      setInvoice(selectedInvoice || null);
      setSettings(settingsData || null);
    } catch (error) {
      console.error(error);
      alert("Error loading invoice.");
    } finally {
      setLoading(false);
    }
  }

  async function updateInvoiceStatus(status) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed updating invoice.");
        return;
      }

      setInvoice({
        ...invoice,
        status: status,
      });

      alert(`Invoice marked as ${status}`);
    } catch (error) {
      console.error(error);
      alert("Error updating invoice.");
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
            <Link href="/invoices" className="backLink">
              ← Back to Invoices
            </Link>

            <h1>Invoice not found</h1>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const companyName = settings?.company_name || "SaiNal Technologies Ltd";
  const companyWebsite = settings?.website || "www.sainaltechnologies.com";
  const companyAddress = settings?.address || "United Kingdom";
  const vatNumber = settings?.vat_number || "";

  const createdDate = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString("en-GB")
    : "-";

  const subtotal = invoice.subtotal || invoice.amount || "£0.00";
  const vatRate = invoice.vat_rate || "0%";
  const vatAmount = invoice.vat_amount || "£0.00";
  const totalAmount = invoice.total_amount || invoice.amount || "£0.00";
  const paymentTerms =
    invoice.payment_terms ||
    settings?.payment_terms ||
    "Payment due within 14 days of invoice date.";

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <Link href="/invoices" className="backLink noPrint">
            ← Back to Invoices
          </Link>

          <div className="topBar noPrint">
            <h1>Invoice Details</h1>

            <div style={{ display: "flex", gap: "12px" }}>
              <button className="primaryBtn" onClick={downloadPDF}>
                Download PDF
              </button>

              <button
                className="primaryBtn"
                onClick={() => updateInvoiceStatus("Sent")}
              >
                Mark Sent
              </button>

              <button
                className="primaryBtn"
                onClick={() => updateInvoiceStatus("Paid")}
              >
                Mark Paid
              </button>
            </div>
          </div>

          <section className="invoiceDocument">
            <div className="invoiceHeader">
              <div>
                <h1>{companyName}</h1>
                <p>Digital Solutions & Automation</p>
                <p>{companyAddress}</p>
                <p>{companyWebsite}</p>

                {vatNumber && <p>VAT No: {vatNumber}</p>}
              </div>

              <div className="invoiceMeta">
                <h2>INVOICE</h2>
                <p>
                  <strong>Invoice No:</strong> {invoice.invoice_number}
                </p>
                <p>
                  <strong>Date:</strong> {createdDate}
                </p>
                <p>
                  <strong>Due Date:</strong> {invoice.due_date || "-"}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <StatusBadge status={invoice.status} />
                </p>
              </div>
            </div>

            <div className="invoiceDivider" />

            <div className="invoiceBillGrid">
              <div>
                <h3>Bill To</h3>
                <p>{invoice.client}</p>
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
                  <strong>Payment Terms:</strong>
                </p>
                <p>{paymentTerms}</p>
                <p>Thank you for your business.</p>
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
                This invoice was generated by SaiNal One — AI-powered Business
                Operating System.
              </p>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
