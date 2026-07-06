"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import StatusBadge from "../../components/StatusBadge";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">
        <div className="topBar">
          <h1>Invoices</h1>
        </div>

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
                    <td>{invoice.amount}</td>
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
