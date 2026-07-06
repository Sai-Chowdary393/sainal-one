"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import StatusBadge from "../../components/StatusBadge";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    client: "",
    service: "",
    subtotal: "",
    vat_rate: "0",
    due_date: "",
    payment_terms: "Payment due within 14 days of invoice date.",
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    try {
      const response = await fetch("/api/invoices");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load invoices.");
        return;
      }

      setInvoices(data || []);
    } catch (error) {
      console.error(error);
      alert("Error loading invoices.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  function getNumber(value) {
    return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
  }

  function formatCurrency(value) {
    return `£${Number(value || 0).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const subtotalNumber = getNumber(formData.subtotal);
  const vatRateNumber = getNumber(formData.vat_rate);
  const vatAmountNumber = subtotalNumber * (vatRateNumber / 100);
  const totalAmountNumber = subtotalNumber + vatAmountNumber;

  async function createInvoice(e) {
    e.preventDefault();

    if (!formData.client || !formData.service || !formData.subtotal) {
      alert("Please enter client, service and subtotal.");
      return;
    }

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: null,
          project_id: null,
          client: formData.client,
          service: formData.service,
          amount: formatCurrency(totalAmountNumber),
          subtotal: formatCurrency(subtotalNumber),
          vat_rate: `${vatRateNumber}%`,
          vat_amount: formatCurrency(vatAmountNumber),
          total_amount: formatCurrency(totalAmountNumber),
          due_date: formData.due_date || null,
          payment_terms: formData.payment_terms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to create invoice.");
        return;
      }

      setFormData({
        client: "",
        service: "",
        subtotal: "",
        vat_rate: "0",
        due_date: "",
        payment_terms: "Payment due within 14 days of invoice date.",
      });

      setShowForm(false);
      await fetchInvoices();

      alert("Invoice created successfully.");
    } catch (error) {
      console.error(error);
      alert("Error creating invoice.");
    }
  }

  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">
        <div className="topBar">
          <h1>Invoices</h1>

          <button className="primaryBtn" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Close" : "Add Invoice"}
          </button>
        </div>

        {showForm && (
          <form className="leadForm" onSubmit={createInvoice}>
            <input
              name="client"
              placeholder="Client / Company Name"
              value={formData.client}
              onChange={handleChange}
            />

            <input
              name="service"
              placeholder="Service / Project Description"
              value={formData.service}
              onChange={handleChange}
            />

            <input
              name="subtotal"
              placeholder="Subtotal e.g. £2,500"
              value={formData.subtotal}
              onChange={handleChange}
            />

            <input
              name="vat_rate"
              placeholder="VAT Rate e.g. 20"
              value={formData.vat_rate}
              onChange={handleChange}
            />

            <input
              type="date"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
            />

            <input
              name="payment_terms"
              placeholder="Payment Terms"
              value={formData.payment_terms}
              onChange={handleChange}
            />

            <div className="panel">
              <p>
                <strong>Subtotal:</strong> {formatCurrency(subtotalNumber)}
              </p>
              <p>
                <strong>VAT:</strong> {formatCurrency(vatAmountNumber)}
              </p>
              <p>
                <strong>Total:</strong> {formatCurrency(totalAmountNumber)}
              </p>
            </div>

            <button className="primaryBtn" type="submit">
              Save Invoice
            </button>
          </form>
        )}

        {loading ? (
          <p>Loading invoices...</p>
        ) : (
          <table className="leadTable">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Client</th>
                <th>Service</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="7">No invoices found yet.</td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link href={`/invoices/${invoice.id}`} className="leadLink">
                        {invoice.invoice_number || "Invoice"}
                      </Link>
                    </td>
                    <td>{invoice.client}</td>
                    <td>{invoice.service}</td>
                    <td>{invoice.total_amount || invoice.amount}</td>
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td>{invoice.due_date || "-"}</td>
                    <td>
                      {invoice.created_at
                        ? new Date(invoice.created_at).toLocaleDateString("en-GB")
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
