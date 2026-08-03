"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import StatusBadge from "../../components/StatusBadge";
import ProtectedRoute from "../../components/ProtectedRoute";
import styles from "./customers.module.css";

const INITIAL_FORM_DATA = {
  customer_name: "",
  company: "",
  email: "",
  phone: "",
  status: "Active",
};

const STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Prospect",
  "On Hold",
];

const COMPLETED_PROJECT_STATUSES = [
  "completed",
  "complete",
  "done",
];

const PAID_INVOICE_STATUSES = [
  "paid",
  "cancelled",
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [healthFilter, setHealthFilter] = useState("All");

  const [formData, setFormData] = useState(
    INITIAL_FORM_DATA
  );

  useEffect(() => {
    fetchCustomerWorkspace();
  }, []);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(
        window.location.search
      );

      if (searchParams.get("create") === "true") {
        setShowForm(true);

        window.history.replaceState(
          {},
          "",
          window.location.pathname
        );
      }
    } catch (error) {
      console.error(
        "Unable to read customer page parameters:",
        error
      );
    }
  }, []);

  async function fetchCustomerWorkspace() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        customersResponse,
        projectsResponse,
        invoicesResponse,
      ] = await Promise.all([
        fetch("/api/customers", {
          cache: "no-store",
        }),

        fetch("/api/projects", {
          cache: "no-store",
        }),

        fetch("/api/invoices", {
          cache: "no-store",
        }),
      ]);

      const [
        customersData,
        projectsData,
        invoicesData,
      ] = await Promise.all([
        customersResponse.json(),
        projectsResponse.ok
          ? projectsResponse.json()
          : Promise.resolve([]),
        invoicesResponse.ok
          ? invoicesResponse.json()
          : Promise.resolve([]),
      ]);

      if (!customersResponse.ok) {
        throw new Error(
          customersData.error ||
            "Failed to load customers."
        );
      }

      setCustomers(
        Array.isArray(customersData)
          ? customersData
          : []
      );

      setProjects(
        Array.isArray(projectsData)
          ? projectsData
          : []
      );

      setInvoices(
        Array.isArray(invoicesData)
          ? invoicesData
          : []
      );
    } catch (error) {
      console.error(
        "Customer workspace loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load the customer workspace."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function openCreateForm() {
    setFormData(INITIAL_FORM_DATA);
    setShowForm(true);
  }

  function closeCreateForm() {
    setFormData(INITIAL_FORM_DATA);
    setShowForm(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanCustomerName =
      formData.customer_name.trim();

    if (!cleanCustomerName) {
      alert("Please enter a customer name.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/customers",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            customer_name:
              cleanCustomerName,

            company:
              formData.company.trim(),

            email:
              formData.email.trim(),

            phone:
              formData.phone.trim(),

            status:
              formData.status || "Active",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create customer."
        );
      }

      const createdCustomer =
        Array.isArray(data)
          ? data[0]
          : data;

      if (createdCustomer) {
        setCustomers(
          (currentCustomers) => [
            createdCustomer,
            ...currentCustomers,
          ]
        );
      } else {
        await fetchCustomerWorkspace();
      }

      closeCreateForm();
    } catch (error) {
      console.error(
        "Customer creation error:",
        error
      );

      alert(
        error.message ||
          "Error creating customer."
      );
    } finally {
      setSaving(false);
    }
  }

  function normaliseStatus(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getMoneyValue(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    return (
      Number(
        String(value).replace(
          /[^0-9.-]/g,
          ""
        )
      ) || 0
    );
  }

  function getCustomerProjects(customerId) {
    return projects.filter(
      (project) =>
        String(project.customer_id) ===
        String(customerId)
    );
  }

  function getCustomerInvoices(customerId) {
    return invoices.filter(
      (invoice) =>
        String(invoice.customer_id) ===
        String(customerId)
    );
  }

  function getCustomerMetrics(customer) {
    const customerProjects =
      getCustomerProjects(customer.id);

    const customerInvoices =
      getCustomerInvoices(customer.id);

    const activeProjects =
      customerProjects.filter(
        (project) =>
          !COMPLETED_PROJECT_STATUSES.includes(
            normaliseStatus(
              project.status
            )
          )
      );

    const openInvoices =
      customerInvoices.filter(
        (invoice) =>
          !PAID_INVOICE_STATUSES.includes(
            normaliseStatus(
              invoice.status
            )
          )
      );

    const overdueInvoices =
      customerInvoices.filter(
        (invoice) =>
          normaliseStatus(
            invoice.status
          ) === "overdue"
      );

    const outstandingValue =
      openInvoices.reduce(
        (total, invoice) =>
          total +
          getMoneyValue(
            invoice.total_amount ||
              invoice.amount
          ),
        0
      );

    const health = getCustomerHealth({
      customer,
      activeProjects:
        activeProjects.length,
      openInvoices:
        openInvoices.length,
      overdueInvoices:
        overdueInvoices.length,
    });

    return {
      totalProjects:
        customerProjects.length,

      activeProjects:
        activeProjects.length,

      totalInvoices:
        customerInvoices.length,

      openInvoices:
        openInvoices.length,

      overdueInvoices:
        overdueInvoices.length,

      outstandingValue,

      health,
    };
  }

  const customerRecords = useMemo(() => {
    return customers.map((customer) => ({
      ...customer,
      metrics:
        getCustomerMetrics(customer),
    }));
  }, [customers, projects, invoices]);

  const filteredCustomers = useMemo(() => {
    const normalisedSearchValue =
      searchValue
        .trim()
        .toLowerCase();

    return customerRecords.filter(
      (customer) => {
        const matchesSearch =
          !normalisedSearchValue ||
          [
            customer.customer_name,
            customer.company,
            customer.status,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(
                normalisedSearchValue
              )
          );

        const matchesStatus =
          statusFilter === "All" ||
          normaliseStatus(
            customer.status
          ) ===
            normaliseStatus(
              statusFilter
            );

        const matchesHealth =
          healthFilter === "All" ||
          customer.metrics.health.label ===
            healthFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesHealth
        );
      }
    );
  }, [
    customerRecords,
    searchValue,
    statusFilter,
    healthFilter,
  ]);

  const activeCustomers =
    customerRecords.filter(
      (customer) =>
        normaliseStatus(
          customer.status
        ) === "active"
    ).length;

  const totalActiveProjects =
    customerRecords.reduce(
      (total, customer) =>
        total +
        customer.metrics.activeProjects,
      0
    );

  const totalOutstanding =
    customerRecords.reduce(
      (total, customer) =>
        total +
        customer.metrics.outstandingValue,
      0
    );

  function clearFilters() {
    setSearchValue("");
    setStatusFilter("All");
    setHealthFilter("All");
  }

  const filtersActive =
    Boolean(searchValue) ||
    statusFilter !== "All" ||
    healthFilter !== "All";

  return (
    <ProtectedRoute>
      <AppLayout
        title="Customers"
        description="Manage customer relationships, delivery and account health."
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
                CRM workspace
              </span>

              <h2>
                Customer relationships
              </h2>

              <p>
                Review customer accounts,
                active delivery and account
                health. Sensitive contact and
                financial details remain inside
                each customer record.
              </p>
            </div>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={
                showForm
                  ? closeCreateForm
                  : openCreateForm
              }
            >
              <span>
                {showForm ? "×" : "+"}
              </span>

              {showForm
                ? "Close form"
                : "Add customer"}
            </button>
          </section>

          {showForm && (
            <section
              className={
                styles.formPanel
              }
            >
              <div
                className={
                  styles.formHeading
                }
              >
                <div>
                  <h3>
                    Create a new customer
                  </h3>

                  <p>
                    Contact details will remain
                    inside the secure customer
                    record.
                  </p>
                </div>
              </div>

              <form
                className={
                  styles.customerForm
                }
                onSubmit={handleSubmit}
              >
                <div
                  className={
                    styles.formGrid
                  }
                >
                  <FormField
                    label="Customer name"
                    name="customer_name"
                    value={
                      formData.customer_name
                    }
                    onChange={handleChange}
                    placeholder="Example: James Smith"
                    required
                  />

                  <FormField
                    label="Company"
                    name="company"
                    value={
                      formData.company
                    }
                    onChange={handleChange}
                    placeholder="Example: NorthStar Logistics"
                  />

                  <FormField
                    label="Email"
                    name="email"
                    type="email"
                    value={
                      formData.email
                    }
                    onChange={handleChange}
                    placeholder="name@company.com"
                  />

                  <FormField
                    label="Phone"
                    name="phone"
                    type="tel"
                    value={
                      formData.phone
                    }
                    onChange={handleChange}
                    placeholder="Telephone number"
                  />

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="customer-status"
                    >
                      Status
                    </label>

                    <select
                      id="customer-status"
                      name="status"
                      value={
                        formData.status
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {STATUS_OPTIONS.map(
                        (status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div
                  className={
                    styles.formActions
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={
                      closeCreateForm
                    }
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={
                      styles.primaryButton
                    }
                    disabled={saving}
                  >
                    {saving
                      ? "Saving customer..."
                      : "Save customer"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="▣"
              label="Total customers"
              value={customers.length}
              detail="All customer records"
              tone="gold"
            />

            <SummaryCard
              icon="●"
              label="Active customers"
              value={activeCustomers}
              detail="Currently active accounts"
              tone="green"
            />

            <SummaryCard
              icon="▰"
              label="Active projects"
              value={totalActiveProjects}
              detail="Delivery currently running"
              tone="blue"
            />

            <SummaryCard
              icon="£"
              label="Outstanding"
              value={formatCurrency(
                totalOutstanding
              )}
              detail="Open invoice value"
              tone="purple"
            />
          </section>

          <section
            className={
              styles.toolbarPanel
            }
          >
            <label
              className={
                styles.searchBox
              }
            >
              <span aria-hidden="true">
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search by customer, company or status..."
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                aria-label="Search customers"
              />
            </label>

            <div
              className={
                styles.filters
              }
            >
              <select
                className={
                  styles.filterSelect
                }
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                aria-label="Filter customers by status"
              >
                <option value="All">
                  All statuses
                </option>

                {STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={healthFilter}
                onChange={(event) =>
                  setHealthFilter(
                    event.target.value
                  )
                }
                aria-label="Filter customers by health"
              >
                <option value="All">
                  All health levels
                </option>

                <option value="Excellent">
                  Excellent
                </option>

                <option value="Attention">
                  Attention
                </option>

                <option value="At Risk">
                  At Risk
                </option>
              </select>

              {filtersActive && (
                <button
                  type="button"
                  className={
                    styles.clearButton
                  }
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          {loading ? (
            <LoadingState />
          ) : errorMessage ? (
            <section
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to load customers
                </strong>

                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  fetchCustomerWorkspace
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              className={
                styles.tablePanel
              }
            >
              <div
                className={
                  styles.tableHeading
                }
              >
                <div>
                  <h3>
                    Customer accounts
                  </h3>

                  <p>
                    Contact information and
                    detailed financial records
                    are visible only inside each
                    customer workspace.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {filteredCustomers.length}{" "}
                  result
                  {filteredCustomers.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredCustomers.length ===
              0 ? (
                <EmptyState
                  hasFilters={
                    filtersActive
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onAddCustomer={
                    openCreateForm
                  }
                />
              ) : (
                <div
                  className={
                    styles.tableWrapper
                  }
                >
                  <table
                    className={
                      styles.customerTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>
                          Active projects
                        </th>
                        <th>
                          Open invoices
                        </th>
                        <th>Health</th>
                        <th>Created</th>
                        <th
                          aria-label="Actions"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredCustomers.map(
                        (customer) => (
                          <tr
                            key={
                              customer.id
                            }
                          >
                            <td>
                              <div
                                className={
                                  styles.customerIdentity
                                }
                              >
                                <span
                                  className={
                                    styles.customerAvatar
                                  }
                                >
                                  {getInitials(
                                    customer.customer_name ||
                                      customer.company
                                  )}
                                </span>

                                <div
                                  className={
                                    styles.customerIdentityCopy
                                  }
                                >
                                  <Link
                                    href={`/customers/${customer.id}`}
                                    className={
                                      styles.customerLink
                                    }
                                  >
                                    {customer.customer_name ||
                                      "Unnamed customer"}
                                  </Link>

                                  <small>
                                    Open customer
                                    workspace
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span
                                className={
                                  styles.companyName
                                }
                              >
                                {customer.company ||
                                  "Individual customer"}
                              </span>
                            </td>

                            <td
                              className={
                                styles.statusCell
                              }
                            >
                              <StatusBadge
                                status={
                                  customer.status ||
                                  "Active"
                                }
                              />
                            </td>

                            <td>
                              <span
                                className={
                                  styles.relationshipCount
                                }
                              >
                                {
                                  customer
                                    .metrics
                                    .activeProjects
                                }
                              </span>
                            </td>

                            <td>
                              <span
                                className={
                                  styles.relationshipCount
                                }
                              >
                                {
                                  customer
                                    .metrics
                                    .openInvoices
                                }
                              </span>
                            </td>

                            <td>
                              <HealthBadge
                                health={
                                  customer
                                    .metrics
                                    .health
                                }
                              />
                            </td>

                            <td>
                              <span
                                className={
                                  styles.createdDate
                                }
                              >
                                {formatDate(
                                  customer.created_at
                                )}
                              </span>
                            </td>

                            <td>
                              <Link
                                href={`/customers/${customer.id}`}
                                className={
                                  styles.openButton
                                }
                                aria-label={`Open ${
                                  customer.customer_name ||
                                  "customer"
                                }`}
                              >
                                Open
                                <span>→</span>
                              </Link>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) {
  return (
    <div className={styles.field}>
      <label
        htmlFor={`customer-${name}`}
      >
        {label}
        {required ? " *" : ""}
      </label>

      <input
        id={`customer-${name}`}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone,
}) {
  return (
    <div
      className={`${styles.summaryCard} ${
        styles[
          `summary${capitalise(tone)}`
        ] || ""
      }`}
    >
      <div
        className={styles.summaryTop}
      >
        <span
          className={styles.summaryIcon}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function HealthBadge({ health }) {
  const className =
    health.tone === "excellent"
      ? styles.healthExcellent
      : health.tone === "attention"
        ? styles.healthAttention
        : health.tone === "risk"
          ? styles.healthRisk
          : styles.healthNeutral;

  return (
    <span
      className={`${styles.healthBadge} ${className}`}
    >
      <span
        className={styles.healthDot}
        aria-hidden="true"
      />

      {health.label}
    </span>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onAddCustomer,
}) {
  return (
    <div className={styles.emptyState}>
      <span
        className={styles.emptyIcon}
      >
        ▣
      </span>

      <h3>
        {hasFilters
          ? "No matching customers"
          : "No customers yet"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current search and filters."
          : "Create your first customer to begin managing relationships, projects and invoices."}
      </p>

      <button
        type="button"
        className={styles.primaryButton}
        onClick={
          hasFilters
            ? onClearFilters
            : onAddCustomer
        }
      >
        {hasFilters
          ? "Clear filters"
          : "Add customer"}
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <section
      className={styles.loadingPanel}
    >
      {Array.from({
        length: 5,
      }).map((_, index) => (
        <div
          key={index}
          className={styles.loadingRow}
        />
      ))}
    </section>
  );
}

function getCustomerHealth({
  customer,
  activeProjects,
  openInvoices,
  overdueInvoices,
}) {
  const customerStatus =
    String(customer.status || "")
      .trim()
      .toLowerCase();

  if (
    customerStatus === "inactive" ||
    overdueInvoices > 1
  ) {
    return {
      label: "At Risk",
      tone: "risk",
    };
  }

  if (
    customerStatus === "on hold" ||
    overdueInvoices === 1 ||
    openInvoices > 2
  ) {
    return {
      label: "Attention",
      tone: "attention",
    };
  }

  if (
    customerStatus === "active" ||
    activeProjects > 0
  ) {
    return {
      label: "Excellent",
      tone: "excellent",
    };
  }

  return {
    label: "Attention",
    tone: "attention",
  };
}

function getInitials(value = "") {
  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "CU";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function capitalise(value) {
  const text = String(value || "");

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}
