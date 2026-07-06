"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import StatusBadge from "../../components/StatusBadge";

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    related_type: "General",
    title: "",
    note: "",
    due_date: "",
    status: "Pending",
  });

  useEffect(() => {
    fetchFollowUps();
  }, []);

  async function fetchFollowUps() {
    try {
      const response = await fetch("/api/follow-ups");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load follow-ups.");
        return;
      }

      setFollowUps(data || []);
    } catch (error) {
      console.error(error);
      alert("Error loading follow-ups.");
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

  async function createFollowUp(e) {
    e.preventDefault();

    if (!formData.title) {
      alert("Please enter follow-up title.");
      return;
    }

    const response = await fetch("/api/follow-ups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Failed to create follow-up.");
      return;
    }

    setFormData({
      related_type: "General",
      title: "",
      note: "",
      due_date: "",
      status: "Pending",
    });

    setShowForm(false);
    await fetchFollowUps();

    alert("Follow-up created successfully.");
  }

  async function updateStatus(id, status) {
    const response = await fetch(`/api/follow-ups/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Failed to update follow-up.");
      return;
    }

    await fetchFollowUps();
  }

  async function deleteFollowUp(id) {
    const confirmed = confirm("Delete this follow-up?");
    if (!confirmed) return;

    const response = await fetch(`/api/follow-ups/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Failed to delete follow-up.");
      return;
    }

    await fetchFollowUps();
  }

  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">
        <div className="topBar">
          <h1>Follow-ups</h1>

          <button className="primaryBtn" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Close" : "Add Follow-up"}
          </button>
        </div>

        {showForm && (
          <form className="leadForm" onSubmit={createFollowUp}>
            <select
              name="related_type"
              value={formData.related_type}
              onChange={handleChange}
            >
              <option>General</option>
              <option>Lead</option>
              <option>Quote</option>
              <option>Customer</option>
              <option>Invoice</option>
            </select>

            <input
              name="title"
              placeholder="Follow-up Title"
              value={formData.title}
              onChange={handleChange}
            />

            <input
              name="note"
              placeholder="Notes"
              value={formData.note}
              onChange={handleChange}
            />

            <input
              type="date"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
            />

            <button className="primaryBtn" type="submit">
              Save Follow-up
            </button>
          </form>
        )}

        {loading ? (
          <p>Loading follow-ups...</p>
        ) : (
          <table className="leadTable">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Note</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {followUps.length === 0 ? (
                <tr>
                  <td colSpan="6">No follow-ups found yet.</td>
                </tr>
              ) : (
                followUps.map((item) => (
                  <tr key={item.id}>
                    <td>{item.related_type}</td>
                    <td>{item.title}</td>
                    <td>{item.note}</td>
                    <td>{item.due_date || "-"}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <select
                        value={item.status}
                        onChange={(e) => updateStatus(item.id, e.target.value)}
                      >
                        <option>Pending</option>
                        <option>Completed</option>
                      </select>

                      <button
                        className="primaryBtn"
                        onClick={() => deleteFollowUp(item.id)}
                        style={{ marginLeft: "10px" }}
                      >
                        Delete
                      </button>
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
