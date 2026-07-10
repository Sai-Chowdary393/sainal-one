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

    industry: "",
    business_type: "",
    services: "",
    target_customers: "",
    ai_instructions: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch("/api/company-settings");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load company settings.");
        return;
      }

      if (data) {
        setFormData({
          company_name: data.company_name || "",
          company_email: data.company_email || "",
          company_phone: data.company_phone || "",
          website: data.website || "",
          address: data.address || "",
          company_registration_number:
            data.company_registration_number || "",
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

          industry: data.industry || "",
          business_type: data.business_type || "",
          services: data.services || "",
          target_customers: data.target_customers || "",
          ai_instructions: data.ai_instructions || "",
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
    setFormData((currentData) => ({
      ...currentData,
      [e.target.name]: e.target.value,
    }));
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
                Manage company details, AI business context, invoice settings
                and payment information.
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
                      placeholder="Example: SaiNal Technologies Ltd"
                    />
                  </label>

                  <label>
                    Company Email
                    <input
                      name="company_email"
                      type="email"
                      value={formData.company_email}
                      onChange={handleChange}
                      placeholder="Example: info@company.com"
                    />
                  </label>

                  <label>
                    Company Phone
                    <input
                      name="company_phone"
                      value={formData.company_phone}
                      onChange={handleChange}
                      placeholder="Example: 0191 000 0000"
                    />
                  </label>

                  <label>
                    Website
                    <input
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="Example: www.company.com"
                    />
                  </label>

                  <label className="fullWidth">
                    Address
                    <textarea
                      name="address"
                      rows={4}
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Enter the registered or trading address"
                    />
                  </label>
                </div>
              </section>

              <section className="panel settingsSection">
                <h3>AI Business Profile</h3>

                <p className="helperText">
                  This information helps the AI Operations Manager understand
                  your business and provide industry-relevant advice.
                </p>

                <div className="settingsGrid">
                  <label>
                    Industry
                    <input
                      name="industry"
                      value={formData.industry}
                      onChange={handleChange}
                      placeholder="Example: Cleaning Services"
                    />
                  </label>

                  <label>
                    Business Type
                    <input
                      name="business_type"
                      value={formData.business_type}
                      onChange={handleChange}
                      placeholder="Example: Commercial Cleaning Company"
                    />
                  </label>

                  <label className="fullWidth">
                    Services Offered
                    <textarea
                      name="services"
                      rows={5}
                      value={formData.services}
                      onChange={handleChange}
                      placeholder="Example: Office cleaning, deep cleaning, end-of-tenancy cleaning, commercial contracts"
                    />
                  </label>

                  <label className="fullWidth">
                    Target Customers
                    <textarea
                      name="target_customers"
                      rows={4}
                      value={formData.target_customers}
                      onChange={handleChange}
                      placeholder="Example: Small offices, property managers, landlords and retail businesses"
                    />
                  </label>

                  <label className="fullWidth">
                    Custom AI Instructions
                    <textarea
                      name="ai_instructions"
                      rows={6}
                      value={formData.ai_instructions}
                      onChange={handleChange}
                      placeholder="Example: Prioritise recurring contracts, recommend site visits for large enquiries and use professional UK business language."
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
                      placeholder="Example: 12345678"
                    />
                  </label>

                  <label>
                    VAT Number
                    <input
                      name="vat_number"
                      value={formData.vat_number}
                      onChange={handleChange}
                      placeholder="Example: GB123456789"
                    />
                  </label>

                  <label>
                    Currency
                    <input
                      name="default_currency"
                      value={formData.default_currency}
                      onChange={handleChange}
                      placeholder="Example: GBP"
                    />
                  </label>

                  <label>
                    Default VAT Rate
                    <input
                      name="default_vat_rate"
                      value={formData.default_vat_rate}
                      onChange={handleChange}
                      placeholder="Example: 20"
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
                      placeholder="Example: SNI"
                    />
                  </label>

                  <label>
                    Bank Name
                    <input
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleChange}
                      placeholder="Enter bank name"
                    />
                  </label>

                  <label>
                    Bank Account Name
                    <input
                      name="bank_account_name"
                      value={formData.bank_account_name}
                      onChange={handleChange}
                      placeholder="Enter account name"
                    />
                  </label>

                  <label>
                    Sort Code
                    <input
                      name="bank_sort_code"
                      value={formData.bank_sort_code}
                      onChange={handleChange}
                      placeholder="Example: 00-00-00"
                    />
                  </label>

                  <label>
                    Account Number
                    <input
                      name="bank_account_number"
                      value={formData.bank_account_number}
                      onChange={handleChange}
                      placeholder="Enter account number"
                    />
                  </label>

                  <label className="fullWidth">
                    Payment Terms
                    <textarea
                      name="payment_terms"
                      rows={4}
                      value={formData.payment_terms}
                      onChange={handleChange}
                      placeholder="Example: Payment due within 14 days of invoice date."
                    />
                  </label>
                </div>
              </section>

              <button
                className="primaryBtn"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </form>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
