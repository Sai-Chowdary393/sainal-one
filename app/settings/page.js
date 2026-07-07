"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    company_name: "SaiNal Technologies Ltd",
    website: "www.sainaltechnologies.com",
    address: "United Kingdom",
    vat_number: "",
    default_currency: "GBP",
    default_vat_rate: "20",
    invoice_prefix: "SNI",
    payment_terms: "Payment due within 14 days of invoice date.",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch("/api/company-settings");
      const data = await response.json();

      if (data) {
        setFormData({
          company_name: data.company_name || "",
          website: data.website || "",
          address: data.address || "",
          vat_number: data.vat_number || "",
          default_currency: data.default_currency || "GBP",
          default_vat_rate: data.default_vat_rate || "20",
          invoice_prefix: data.invoice_prefix || "SNI",
          payment_terms:
            data.payment_terms || "Payment due within 14 days of invoice date.",
        });
      }
    } catch (error) {
      console.error(error);
      alert("Error loading company settings.");
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

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/company-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to save settings.");
        return;
      }

      alert("Company settings saved successfully.");
    } catch (error) {
      console.error(error);
      alert("Error saving company settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <div className="topBar">
            <div>
              <h1>Company Settings</h1>
              <p className="helperText">
                Manage your company details used across invoices and documents.
              </p>
            </div>
          </div>

          {loading ? (
            <p>Loading settings...</p>
          ) : (
            <form className="leadForm" onSubmit={saveSettings}>
              <input
                name="company_name"
                placeholder="Company Name"
                value={formData.company_name}
                onChange={handleChange}
              />

              <input
                name="website"
                placeholder="Website"
                value={formData.website}
                onChange={handleChange}
              />

              <input
                name="address"
                placeholder="Address"
                value={formData.address}
                onChange={handleChange}
              />

              <input
                name="vat_number"
                placeholder="VAT Number"
                value={formData.vat_number}
                onChange={handleChange}
              />

              <input
                name="default_currency"
                placeholder="Currency e.g. GBP"
                value={formData.default_currency}
                onChange={handleChange}
              />

              <input
                name="default_vat_rate"
                placeholder="Default VAT Rate e.g. 20"
                value={formData.default_vat_rate}
                onChange={handleChange}
              />

              <input
                name="invoice_prefix"
                placeholder="Invoice Prefix e.g. SNI"
                value={formData.invoice_prefix}
                onChange={handleChange}
              />

              <input
                name="payment_terms"
                placeholder="Payment Terms"
                value={formData.payment_terms}
                onChange={handleChange}
              />

              <button className="primaryBtn" type="submit">
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </form>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
