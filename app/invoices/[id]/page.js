"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";
import SendRecordEmail from "../../../components/SendRecordEmail";

function parseMoney(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleanedValue = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsedValue = Number.parseFloat(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function parseVatRate(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleanedValue = String(value)
    .replace("%", "")
    .trim();

  const parsedValue = Number.parseFloat(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-GB");
}

export default function InvoiceDetailsPage() {
  const params = useParams();
  const invoiceId = params.id;

  const [invoice, setInvoice] = useState(null);
  const [draftInvoice, setDraftInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  async function fetchInvoice() {
    setLoading(true);

    try {
      const [
        invoiceResponse,
        settingsResponse,
        quotesResponse,
      ] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch("/api/company-settings"),
        fetch("/api/quotes"),
      ]);

      const invoiceData = await invoiceResponse.json();
      const settingsData = await settingsResponse.json();
      const quotesData = await quotesResponse.json();

      if (!invoiceResponse.ok) {
        alert(
          invoiceData.error ||
            "Failed to load invoice."
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

      const relatedQuote = (
        Array.isArray(quotesData)
          ? quotesData
          : []
      ).find(
        (quote) =>
          String(quote.id) ===
          String(invoiceData.quote_id)
      );

      setInvoice(invoiceData);
      setDraftInvoice(invoiceData);
      setSettings(settingsData || null);

      setRecipientEmail(
        relatedQuote?.email ||
          invoiceData.email ||
          ""
      );
    } catch (error) {
      console.error(error);
      alert("Error loading invoice.");
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setDraftInvoice({
      ...invoice,
      subtotal:
        invoice.subtotal ||
        invoice.amount ||
        "",
      vat_rate:
        invoice.vat_rate || "0%",
    });

    setEditing(true);
  }

  function cancelEditing() {
    setDraftInvoice({
      ...invoice,
    });

    setEditing(false);
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setDraftInvoice((currentInvoice) => ({
      ...currentInvoice,
      [name]: value,
    }));
  }

  async function saveInvoice() {
    if (!draftInvoice.client?.trim()) {
      alert("Client name is required.");
      return;
    }

    if (!draftInvoice.service?.trim()) {
      alert("Service is required.");
      return;
    }

    const subtotalValue = parseMoney(
      draftInvoice.subtotal
    );

    const vatRateValue = parseVatRate(
      draftInvoice.vat_rate
    );

    if (subtotalValue < 0) {
      alert("Subtotal cannot be negative.");
      return;
    }

    if (vatRateValue < 0 || vatRateValue > 100) {
      alert("VAT rate must be between 0 and 100.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/invoices/${invoiceId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client: draftInvoice.client,
            service: draftInvoice.service,
            subtotal: subtotalValue,
            vat_rate: vatRateValue,
            due_date:
              draftInvoice.due_date || null,
            payment_terms:
              draftInvoice.payment_terms || "",
            status:
              draftInvoice.status ||
              "Draft Invoice",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to save invoice."
        );
        return;
      }

      setInvoice(data);
      setDraftInvoice(data);
      setEditing(false);

      alert("Invoice updated successfully.");
    } catch (error) {
      console.error(error);
      alert("Error saving invoice.");
    } finally {
      setSaving(false);
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

      setInvoice(data);
      setDraftInvoice(data);

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

  if (!invoice || !draftInvoice) {
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

  const visibleInvoice = editing
    ? draftInvoice
    : invoice;

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

  const createdDate = formatDate(
    invoice.created_at
  );

  const displayedDueDate = formatDate(
    visibleInvoice.due_date
  );

  const calculatedSubtotalValue = parseMoney(
    visibleInvoice.subtotal ||
      visibleInvoice.amount
  );

  const calculatedVatRateValue = parseVatRate(
    visibleInvoice.vat_rate
  );

  const calculatedVatAmountValue =
    calculatedSubtotalValue *
    (calculatedVatRateValue / 100);

  const calculatedTotalValue =
    calculatedSubtotalValue +
    calculatedVatAmountValue;

  const subtotal = editing
    ? formatCurrency(calculatedSubtotalValue)
    : visibleInvoice.subtotal ||
      visibleInvoice.amount ||
      "£0.00";

  const vatRate = editing
    ? `${calculatedVatRateValue}%`
    : visibleInvoice.vat_rate || "0%";

  const vatAmount = editing
    ? formatCurrency(calculatedVatAmountValue)
    : visibleInvoice.vat_amount ||
      "£0.00";

  const totalAmount = editing
    ? formatCurrency(calculatedTotalValue)
    : visibleInvoice.total_amount ||
      visibleInvoice.amount ||
      "£0.00";

  const paymentTerms =
    visibleInvoice.payment_terms ||
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
              {!editing && (
                <SendRecordEmail
                  endpoint={`/api/invoices/${invoice.id}/send`}
                  defaultEmail={recipientEmail}
                  defaultSubject={`Invoice ${invoice.invoice_number} from ${companyName}`}
                  recordLabel="invoice"
                  onSent={(data) => {
                    if (data.invoice) {
                      setInvoice(data.invoice);
                      setDraftInvoice(
                        data.invoice
                      );
                    } else {
                      setInvoice(
                        (currentInvoice) => ({
                          ...currentInvoice,
                          status:
                            currentInvoice.status ===
                            "Paid"
                              ? "Paid"
                              : "Sent",
                        })
                      );
                    }
                  }}
                />
              )}

              {!editing ? (
                <button
                  type="button"
                  className="primaryBtn"
                  onClick={startEditing}
                >
                  Edit Invoice
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="primaryBtn"
                    disabled={saving}
                    onClick={saveInvoice}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Invoice"}
                  </button>

                  <button
                    type="button"
                    className="primaryBtn"
                    disabled={saving}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                </>
              )}

              <button
                type="button"
                className="primaryBtn"
                onClick={downloadPDF}
              >
                Download PDF
              </button>

              {!editing && (
                <>
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
                </>
              )}
            </div>
          </div>

          {editing && (
            <section className="panel noPrint">
              <h3>Edit Invoice</h3>

              <div className="settingsGrid">
                <label>
                  Client

                  <input
                    name="client"
                    value={
                      draftInvoice.client || ""
                    }
                    disabled={saving}
                    onChange={handleFieldChange}
                  />
                </label>

                <label>
                  Service

                  <input
                    name="service"
                    value={
                      draftInvoice.service || ""
                    }
                    disabled={saving}
                    onChange={handleFieldChange}
                  />
                </label>

                <label>
                  Subtotal

                  <input
                    name="subtotal"
                    value={
                      draftInvoice.subtotal || ""
                    }
                    disabled={saving}
                    onChange={handleFieldChange}
                    placeholder="Example: £3,000"
                  />
                </label>

                <label>
                  VAT Rate

                  <input
                    name="vat_rate"
                    value={
                      draftInvoice.vat_rate || ""
                    }
                    disabled={saving}
                    onChange={handleFieldChange}
                    placeholder="Example: 20%"
                  />
                </label>

                <label>
                  VAT Amount

                  <input
                    value={vatAmount}
                    disabled
                  />
                </label>

                <label>
                  Total Amount

                  <input
                    value={totalAmount}
                    disabled
                  />
                </label>

                <label>
                  Due Date

                  <input
                    name="due_date"
                    type="date"
                    value={
                      draftInvoice.due_date ||
                      ""
                    }
                    disabled={saving}
                    onChange={handleFieldChange}
                  />
                </label>

                <label>
                  Status

                  <select
                    name="status"
                    value={
                      draftInvoice.status ||
                      "Draft Invoice"
                    }
                    disabled={saving}
                    onChange={handleFieldChange}
                  >
                    <option>Draft Invoice</option>
                    <option>Draft</option>
                    <option>Sent</option>
                    <option>
                      Partially Paid
                    </option>
                    <option>Paid</option>
                    <option>Overdue</option>
                    <option>Cancelled</option>
                  </select>
                </label>

                <label className="fullWidth">
                  Payment Terms

                  <textarea
                    name="payment_terms"
                    rows={4}
                    value={
                      draftInvoice.payment_terms ||
                      ""
                    }
                    disabled={saving}
                    onChange={handleFieldChange}
                  />
                </label>
              </div>
            </section>
          )}

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
                  {displayedDueDate}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  <StatusBadge
                    status={
                      visibleInvoice.status
                    }
                  />
                </p>
              </div>
            </div>

            <div className="invoiceDivider" />

            <div className="invoiceBillGrid">
              <div>
                <h3>Bill To</h3>

                <p>{visibleInvoice.client}</p>

                {recipientEmail && (
                  <p>{recipientEmail}</p>
                )}
              </div>

              <div>
                <h3>Project / Service</h3>

                <p>{visibleInvoice.service}</p>
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
                  <td>
                    {visibleInvoice.service}
                  </td>

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
