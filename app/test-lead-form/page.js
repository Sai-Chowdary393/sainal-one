"use client";

import { useState } from "react";

export default function TestLeadForm() {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    message: "",
  });

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function submitLead(e) {
    e.preventDefault();

    const response = await fetch("/api/public-leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Failed to submit lead.");
      return;
    }

    alert("Lead submitted successfully.");
  }

  return (
    <main style={{ padding: "40px" }}>
      <h1>Website Lead Test Form</h1>

      <form onSubmit={submitLead} style={{ display: "grid", gap: "12px", maxWidth: "500px" }}>
        <input name="name" placeholder="Name" onChange={handleChange} />
        <input name="company" placeholder="Company" onChange={handleChange} />
        <input name="email" placeholder="Email" onChange={handleChange} />
        <input name="phone" placeholder="Phone" onChange={handleChange} />
        <textarea name="message" placeholder="Message" onChange={handleChange} />

        <button type="submit">Submit Lead</button>
      </form>
    </main>
  );
}
