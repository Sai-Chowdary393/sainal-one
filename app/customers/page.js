"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import StatusBadge from "../../components/StatusBadge";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const response = await fetch("/api/customers");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load customers.");
        return;
      }

      setCustomers(data);
    } catch (error) {
      console.error(error);
      alert("Error loading customers.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">
        <div className="topBar">
          <h1>Customers</h1>
        </div>

        {loading ? (
          <p>Loading customers...</p>
        ) : (
          <table className="leadTable">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="6">No customers found yet.</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="leadLink"
                      >
                        {customer.customer_name}
                      </Link>
                    </td>
                    <td>{customer.company}</td>
                    <td>{customer.email}</td>
                    <td>{customer.phone}</td>
                    <td>
                      <StatusBadge status={customer.status} />
                    </td>
                    <td>
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString("en-GB")
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
