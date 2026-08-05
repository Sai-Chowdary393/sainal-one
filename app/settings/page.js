"use client";

import { useEffect, useState } from "react";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import styles from "./settings.module.css";

const INITIAL_SETTINGS = {
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
  payment_terms:
    "Payment due within 14 days of invoice date.",

  industry: "",
  business_type: "",
  services: "",
  target_customers: "",
  ai_instructions: "",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const [formData, setFormData] =
    useState(INITIAL_SETTINGS);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/company-settings",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load company settings."
        );
      }

      if (data) {
        setFormData({
          company_name:
            data.company_name || "",

          company_email:
            data.company_email || "",

          company_phone:
            data.company_phone || "",

          website:
            data.website || "",

          address:
            data.address || "",

          company_registration_number:
            data.company_registration_number ||
            "",

          vat_number:
            data.vat_number || "",

          default_currency:
            data.default_currency || "GBP",

          default_vat_rate:
            data.default_vat_rate || "20",

          invoice_prefix:
            data.invoice_prefix || "SNI",

          bank_name:
            data.bank_name || "",

          bank_account_name:
            data.bank_account_name || "",

          bank_sort_code:
            data.bank_sort_code || "",

          bank_account_number:
            data.bank_account_number || "",

          payment_terms:
            data.payment_terms ||
            "Payment due within 14 days of invoice date.",

          industry:
            data.industry || "",

          business_type:
            data.business_type || "",

          services:
            data.services || "",

          target_customers:
            data.target_customers || "",

          ai_instructions:
            data.ai_instructions || "",
        });
      }
    } catch (error) {
      console.error(
        "Company settings loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to load company settings."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setSavedMessage("");

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function saveSettings(event) {
    event.preventDefault();

    if (!formData.company_name.trim()) {
      alert("Please enter the company name.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSavedMessage("");

      const response = await fetch(
        "/api/company-settings",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            formData
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save company settings."
        );
      }

      setSavedMessage(
        "Company settings saved successfully."
      );

      window.setTimeout(() => {
        setSavedMessage("");
      }, 5000);
    } catch (error) {
      console.error(
        "Company settings save error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to save company settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="Company Settings"
        description="Manage company identity, AI context, legal details, invoicing and payment information."
      >
        <div className={styles.page}>
          <section
            className={styles.pageHeader}
          >
            <div
              className={
                styles.pageHeaderCopy
              }
            >
              <span
                className={
                  styles.eyebrow
                }
              >
                Administration
              </span>

              <h2>
                Company configuration
              </h2>

              <p>
                Maintain the organisation
                profile used across quotations,
                proposals, invoices, AI
                recommendations and customer
                communication.
              </p>
            </div>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={saveSettings}
              disabled={saving || loading}
            >
              {saving
                ? "Saving settings..."
                : "Save changes"}
            </button>
          </section>

          {savedMessage && (
            <section
              className={
                styles.successPanel
              }
            >
              <span
                className={
                  styles.successIcon
                }
              >
                ✓
              </span>

              <div>
                <strong>
                  Settings saved
                </strong>

                <p>{savedMessage}</p>
              </div>
            </section>
          )}

          {errorMessage && (
            <section
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to complete the
                  request
                </strong>

                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={fetchSettings}
              >
                Try again
              </button>
            </section>
          )}

          {loading ? (
            <LoadingState />
          ) : (
            <form
              className={styles.form}
              onSubmit={saveSettings}
            >
              <SettingsSection
                icon="▣"
                eyebrow="Organisation"
                title="Company profile"
                description="Core company information used across SaiNal One records and customer-facing documents."
              >
                <div
                  className={
                    styles.formGrid
                  }
                >
                  <FormField
                    label="Company name"
                    name="company_name"
                    value={
                      formData.company_name
                    }
                    onChange={handleChange}
                    placeholder="Example: SaiNal Technologies Ltd"
                    required
                  />

                  <FormField
                    label="Company email"
                    name="company_email"
                    type="email"
                    value={
                      formData.company_email
                    }
                    onChange={handleChange}
                    placeholder="Example: info@company.com"
                  />

                  <FormField
                    label="Company phone"
                    name="company_phone"
                    type="tel"
                    value={
                      formData.company_phone
                    }
                    onChange={handleChange}
                    placeholder="Example: 0191 000 0000"
                  />

                  <FormField
                    label="Website"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="Example: www.company.com"
                  />

                  <FormField
                    label="Registered or trading address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter the company address"
                    textarea
                    rows={5}
                    fullWidth
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                icon="✦"
                eyebrow="Artificial intelligence"
                title="AI business profile"
                description="Help SaiNal One understand the organisation, its services and preferred way of working."
                tone="dark"
              >
                <div
                  className={
                    styles.formGrid
                  }
                >
                  <FormField
                    label="Industry"
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    placeholder="Example: Technology Services"
                    dark
                  />

                  <FormField
                    label="Business type"
                    name="business_type"
                    value={
                      formData.business_type
                    }
                    onChange={handleChange}
                    placeholder="Example: IT consultancy and software solutions company"
                    dark
                  />

                  <FormField
                    label="Services offered"
                    name="services"
                    value={formData.services}
                    onChange={handleChange}
                    placeholder="Describe your main products and services"
                    textarea
                    rows={5}
                    fullWidth
                    dark
                  />

                  <FormField
                    label="Target customers"
                    name="target_customers"
                    value={
                      formData.target_customers
                    }
                    onChange={handleChange}
                    placeholder="Describe the organisations and customers you serve"
                    textarea
                    rows={4}
                    fullWidth
                    dark
                  />

                  <FormField
                    label="Custom AI instructions"
                    name="ai_instructions"
                    value={
                      formData.ai_instructions
                    }
                    onChange={handleChange}
                    placeholder="Example: Use professional UK business language and prioritise recurring customer relationships."
                    textarea
                    rows={6}
                    fullWidth
                    dark
                  />
                </div>
              </SettingsSection>

              <div
                className={
                  styles.twoColumnGrid
                }
              >
                <SettingsSection
                  icon="◇"
                  eyebrow="Compliance"
                  title="Legal and tax"
                  description="Company registration, VAT and default financial configuration."
                >
                  <div
                    className={
                      styles.singleColumnGrid
                    }
                  >
                    <FormField
                      label="Company registration number"
                      name="company_registration_number"
                      value={
                        formData.company_registration_number
                      }
                      onChange={handleChange}
                      placeholder="Example: 12345678"
                    />

                    <FormField
                      label="VAT number"
                      name="vat_number"
                      value={
                        formData.vat_number
                      }
                      onChange={handleChange}
                      placeholder="Example: GB123456789"
                    />

                    <FormField
                      label="Default currency"
                      name="default_currency"
                      value={
                        formData.default_currency
                      }
                      onChange={handleChange}
                      placeholder="Example: GBP"
                    />

                    <FormField
                      label="Default VAT rate"
                      name="default_vat_rate"
                      value={
                        formData.default_vat_rate
                      }
                      onChange={handleChange}
                      placeholder="Example: 20"
                      suffix="%"
                    />
                  </div>
                </SettingsSection>

                <SettingsSection
                  icon="£"
                  eyebrow="Finance"
                  title="Invoice preferences"
                  description="Default document numbering, bank details and customer payment terms."
                >
                  <div
                    className={
                      styles.singleColumnGrid
                    }
                  >
                    <FormField
                      label="Invoice prefix"
                      name="invoice_prefix"
                      value={
                        formData.invoice_prefix
                      }
                      onChange={handleChange}
                      placeholder="Example: SNI"
                    />

                    <FormField
                      label="Bank name"
                      name="bank_name"
                      value={
                        formData.bank_name
                      }
                      onChange={handleChange}
                      placeholder="Enter bank name"
                    />

                    <FormField
                      label="Bank account name"
                      name="bank_account_name"
                      value={
                        formData.bank_account_name
                      }
                      onChange={handleChange}
                      placeholder="Enter account holder name"
                    />

                    <div
                      className={
                        styles.inlineGrid
                      }
                    >
                      <FormField
                        label="Sort code"
                        name="bank_sort_code"
                        value={
                          formData.bank_sort_code
                        }
                        onChange={handleChange}
                        placeholder="00-00-00"
                      />

                      <FormField
                        label="Account number"
                        name="bank_account_number"
                        value={
                          formData.bank_account_number
                        }
                        onChange={handleChange}
                        placeholder="Account number"
                      />
                    </div>

                    <FormField
                      label="Payment terms"
                      name="payment_terms"
                      value={
                        formData.payment_terms
                      }
                      onChange={handleChange}
                      placeholder="Example: Payment due within 14 days."
                      textarea
                      rows={4}
                    />
                  </div>
                </SettingsSection>
              </div>

              <section
                className={
                  styles.bottomActions
                }
              >
                <div>
                  <strong>
                    Save organisation
                    configuration
                  </strong>

                  <p>
                    Changes will be used by
                    future quotations,
                    proposals, invoices and AI
                    recommendations.
                  </p>
                </div>

                <button
                  type="submit"
                  className={
                    styles.primaryButton
                  }
                  disabled={saving}
                >
                  {saving
                    ? "Saving settings..."
                    : "Save company settings"}
                </button>
              </section>
            </form>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function SettingsSection({
  icon,
  eyebrow,
  title,
  description,
  tone = "light",
  children,
}) {
  const dark = tone === "dark";

  return (
    <section
      className={`${styles.sectionPanel} ${
        dark
          ? styles.sectionPanelDark
          : ""
      }`}
    >
      <div
        className={styles.sectionHeader}
      >
        <span
          className={styles.sectionIcon}
          aria-hidden="true"
        >
          {icon}
        </span>

        <div>
          <span
            className={
              styles.sectionEyebrow
            }
          >
            {eyebrow}
          </span>

          <h3>{title}</h3>

          <p>{description}</p>
        </div>
      </div>

      <div
        className={
          styles.sectionContent
        }
      >
        {children}
      </div>
    </section>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  textarea = false,
  rows = 4,
  required = false,
  fullWidth = false,
  dark = false,
  suffix = "",
}) {
  return (
    <label
      className={`${styles.field} ${
        fullWidth
          ? styles.fieldFull
          : ""
      } ${
        dark ? styles.fieldDark : ""
      }`}
    >
      <span>
        {label}
        {required ? " *" : ""}
      </span>

      <div
        className={
          suffix
            ? styles.inputWithSuffix
            : undefined
        }
      >
        {textarea ? (
          <textarea
            name={name}
            rows={rows}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
          />
        ) : (
          <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
          />
        )}

        {suffix && (
          <span
            className={
              styles.inputSuffix
            }
          >
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function LoadingState() {
  return (
    <div
      className={styles.loadingGrid}
    >
      <div
        className={styles.loadingPanel}
      />

      <div
        className={styles.loadingPanel}
      />

      <div
        className={styles.loadingPanel}
      />
    </div>
  );
}
