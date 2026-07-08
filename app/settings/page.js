"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    company_name: "SaiNal Technologies Ltd",
    company_email: "",
    company_phone: "",
    website: "www.sainaltechnologies.com",
    address: "United Kingdom",
    company_registration_number: "",
    vat_number: "",
    default_currency: "GBP",
    default_vat_rate: "20",
    invoice_prefix: "SNI",
    bank_name: "",
    bank_account_name: "",
    bank_sort_code: "",
    bank_account_number: "",
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
          company_email: data.company_email || "",
          company_phone: data.company_phone || "",
          website: data.website || "",
          address: data.address || "",
          company_registration_number: data.company_registration_number || "",
          vat_number: data.vat_number || "",
          default_currency: data.default_currency || "GBP",
          default_vat_rate: data.default_vat_rate || "20",
          invoice_prefix: data.invoice_prefix || "SNI",
          bank_name: data.bank_name || "",
          bank_account_name: data.bank_account_name || "",
          bank_sort_code: data.bank_sort_code || "",
          bank_account_number: data.bank_account_number || "",
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
                Manage branding, invoice details, payment terms and business
                information.
              </p>
            </div>
          </div>

          {loading ? (
            <p>Loading settings...</p>
          ) : (
            <form onSubmit={saveSettings}>
              <section className="panel settingsSection">
                <h3>Company Profile</h3>

                <div className="settingsGrid">
                  <label>
                    Company Name
                    <input
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Company Email
                    <input
                      name="company_email"
                      value={formData.company_email}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Company Phone
                    <input
                      name="company_phone"
                      value={formData.company_phone}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Website
                    <input
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                    />
                  </label>

                  <label className="fullWidth">
                    Address
                    <textarea
                      name="address"
                      rows={4}
                      value={formData.address}
                      onChange={handleChange}
                    />
                  </label>
                </div>
              </section>

              <section className="panel settingsSection">
                <h3>Legal & Tax</h3>

                <div className="settingsGrid">
                  <label>
                    Company Registration Number
                    <input
                      name="company_registration_number"
                      value={formData.company_registration_number}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    VAT Number
                    <input
                      name="vat_number"
                      value={formData.vat_number}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Currency
                    <input
                      name="default_currency"
                      value={formData.default_currency}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Default VAT Rate
                    <input
                      name="default_vat_rate"
                      value={formData.default_vat_rate}
                      onChange={handleChange}
                    />
                  </label>
                </div>
              </section>

              <section className="panel settingsSection">
                <h3>Invoice Settings</h3>

                <div className="settingsGrid">
                  <label>
                    Invoice Prefix
                    <input
                      name="invoice_prefix"
                      value={formData.invoice_prefix}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Bank Name
                    <input
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Bank Account Name
                    <input
                      name="bank_account_name"
                      value={formData.bank_account_name}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Sort Code
                    <input
                      name="bank_sort_code"
                      value={formData.bank_sort_code}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Account Number
                    <input
                      name="bank_account_number"
                      value={formData.bank_account_number}
                      onChange={handleChange}
                    />
                  </label>

                  <label className="fullWidth">
                    Payment Terms
                    <textarea
                      name="payment_terms"
                      rows={4}
                      value={formData.payment_terms}
                      onChange={handleChange}
                    />
                  </label>
                </div>
              </section>

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
