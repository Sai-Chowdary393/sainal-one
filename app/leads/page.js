"use client";

import { useState } from "react";
import Link from "next/link";

export default function Leads() {
  const [showForm, setShowForm] = useState(false);

  const [leads, setLeads] = useState([
    {
      name: "John Smith",
      company: "ABC Builders",
      email: "john@abcbuilders.co.uk",
      phone: "07123456789",
      status: "New",
      value: "£2,500",
    },
    {
      name: "Jane Brown",
      company: "XYZ Plumbing",
      email: "jane@xyzplumbing.co.uk",
      phone: "07987654321",
      status: "Proposal Sent",
      value: "£4,000",
    },
    {
      name: "Michael Lee",
      company: "Acme Services",
      email: "michael@acme.co.uk",
      phone: "07444555666",
      status: "Follow Up",
      value: "£1,800",
    },
  ]);

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    status: "New",
    value: "",
  });

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!formData.name || !formData.company) {
      alert("Please enter lead name and company.");
      return;
    }

    setLeads([...leads, formData]);

    setFormData({
      name: "",
      company: "",
      email: "",
      phone: "",
      status: "New",
      value: "",
    });

    setShowForm(false);
  }

  return (
    <div className="appLayout">
      <aside className="sidebar">
        <h2>SaiNal One</h2>

        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/leads">Leads</Link>
          <Link href="/ai-assistant">AI Assistant</Link>
        </nav>
      </aside>

      <main className="mainContent">
        <div className="topBar">
          <h1>Leads</h1>

          <button className="primaryBtn" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Close" : "Add Lead"}
          </button>
        </div>

        {showForm && (
          <form className="leadForm" onSubmit={handleSubmit}>
            <input
              name="name"
              placeholder="Lead Name"
              value={formData.name}
              onChange={handleChange}
            />

            <input
              name="company"
              placeholder="Company"
              value={formData.company}
              onChange={handleChange}
            />

            <input
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
            />

            <input
              name="phone"
              placeholder="Phone"
              value={formData.phone}
              onChange={handleChange}
            />

            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option>New</option>
              <option>Contacted</option>
              <option>Proposal Sent</option>
              <option>Follow Up</option>
              <option>Won</option>
              <option>Lost</option>
            </select>

            <input
              name="value"
              placeholder="Value e.g. £2,500"
              value={formData.value}
              onChange={handleChange}
            />

            <button className="primaryBtn" type="submit">
              Save Lead
            </button>
          </form>
        )}

        <table className="leadTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Value</th>
            </tr>
          </thead>

          <tbody>
            {leads.map((lead, index) => (
              <tr key={index}>
                <td>
                  <Link href={`/leads/${index + 1}`} className="leadLink">
                    {lead.name}
                  </Link>
                </td>
                <td>{lead.company}</td>
                <td>{lead.email}</td>
                <td>{lead.phone}</td>
                <td>{lead.status}</td>
                <td>{lead.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
