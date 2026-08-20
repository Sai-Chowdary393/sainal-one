"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import StatusBadge from "../../components/StatusBadge";
import ProtectedRoute from "../../components/ProtectedRoute";

import styles from "./customers.module.css";

// =========================================================
// FORM
// =========================================================

const INITIAL_FORM_DATA = {
  customer_name: "",
  company: "",
  email: "",
  phone: "",
  status: "Active",
  owner_employee_id: "",
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
  "canceled",
  "void",
];

// =========================================================
// PAGE
// =========================================================

export default function CustomersPage() {
  const [
    customers,
    setCustomers,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    projects,
    setProjects,
  ] = useState([]);

  const [
    invoices,
    setInvoices,
  ] = useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

  const [
    access,
    setAccess,
  ] = useState({
    isOwner: false,
    canViewAll: false,
    canViewTeam: false,
    canViewOwn: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canAssign: false,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    searchValue,
    setSearchValue,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All");

  const [
    healthFilter,
    setHealthFilter,
  ] = useState("All");

  const [
    formData,
    setFormData,
  ] = useState(
    INITIAL_FORM_DATA
  );

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    fetchCustomerWorkspace();
  }, []);

  useEffect(() => {
    try {
      const searchParams =
        new URLSearchParams(
          window.location.search
        );

      /*
       * We wait for API permissions before actually
       * opening the create form.
       */
      if (
        searchParams.get(
          "create"
        ) === "true"
      ) {
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
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      const [
        customersResponse,
        projectsResponse,
        invoicesResponse,
      ] =
        await Promise.all([
          fetch(
            "/api/customers",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/projects",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/invoices",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      const customersData =
        await customersResponse.json();

      let projectsData = [];
      let invoicesData = [];

      if (
        projectsResponse.ok
      ) {
        projectsData =
          await projectsResponse.json();
      }

      if (
        invoicesResponse.ok
      ) {
        invoicesData =
          await invoicesResponse.json();
      }

      if (
        !customersResponse.ok
      ) {
        throw new Error(
          customersData.error ||
            "Failed to load customers."
        );
      }

      // ===================================================
      // CUSTOMERS
      // ===================================================

      setCustomers(
        Array.isArray(
          customersData.customers
        )
          ? customersData.customers
          : []
      );

      setEmployees(
        Array.isArray(
          customersData.employees
        )
          ? customersData.employees
          : []
      );

      setCurrentEmployee(
        customersData.currentEmployee ||
          null
      );

      const nextAccess = {
        isOwner:
          Boolean(
            customersData.access
              ?.isOwner
          ),

        canViewAll:
          Boolean(
            customersData.access
              ?.canViewAll
          ),

        canViewTeam:
          Boolean(
            customersData.access
              ?.canViewTeam
          ),

        canViewOwn:
          Boolean(
            customersData.access
              ?.canViewOwn
          ),

        canCreate:
          Boolean(
            customersData.access
              ?.canCreate
          ),

        canEdit:
          Boolean(
            customersData.access
              ?.canEdit
          ),

        canDelete:
          Boolean(
            customersData.access
              ?.canDelete
          ),

        canAssign:
          Boolean(
            customersData.access
              ?.canAssign
          ),
      };

      setAccess(
        nextAccess
      );

      // ===================================================
      // PROJECTS
      // SUPPORT CURRENT + FUTURE STRUCTURED RESPONSES
      // ===================================================

      setProjects(
        Array.isArray(
          projectsData
        )
          ? projectsData
          : Array.isArray(
                projectsData.projects
              )
            ? projectsData.projects
            : []
      );

      // ===================================================
      // INVOICES
      // ===================================================

      setInvoices(
        Array.isArray(
          invoicesData
        )
          ? invoicesData
          : Array.isArray(
                invoicesData.invoices
              )
            ? invoicesData.invoices
            : []
      );

      // ===================================================
      // ?create=true
      // ===================================================

      try {
        const searchParams =
          new URLSearchParams(
            window.location.search
          );

        if (
          searchParams.get(
            "create"
          ) ===
            "true" &&
          nextAccess.canCreate
        ) {
          openCreateFormWithAccess({
            currentEmployee:
              customersData.currentEmployee,

            canAssign:
              nextAccess.canAssign,
          });
        }
      } catch {
        // Ignore URL helper errors.
      }
    } catch (error) {
      console.error(
        "Customer workspace loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load the customer workspace."
      );

      setCustomers(
        []
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // =======================================================
  // FORM
  // =======================================================

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setFormData(
      (
        currentData
      ) => ({
        ...currentData,

        [name]:
          value,
      })
    );
  }

  function openCreateFormWithAccess({
    currentEmployee:
      selectedEmployee,
    canAssign:
      userCanAssign,
  }) {
    setFormData({
      ...INITIAL_FORM_DATA,

      owner_employee_id:
        userCanAssign
          ? selectedEmployee
              ?.id ||
            ""
          : "",
    });

    setShowForm(
      true
    );
  }

  function openCreateForm() {
    if (
      !access.canCreate
    ) {
      return;
    }

    openCreateFormWithAccess({
      currentEmployee,
      canAssign:
        access.canAssign,
    });

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  function closeCreateForm() {
    setFormData(
      INITIAL_FORM_DATA
    );

    setShowForm(
      false
    );
  }

  // =======================================================
  // CREATE
  // =======================================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      !access.canCreate
    ) {
      alert(
        "You do not have permission to create customers."
      );

      return;
    }

    const cleanCustomerName =
      formData.customer_name.trim();

    if (
      !cleanCustomerName
    ) {
      alert(
        "Please enter a customer name."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      const payload = {
        customer_name:
          cleanCustomerName,

        company:
          formData.company.trim(),

        email:
          formData.email.trim(),

        phone:
          formData.phone.trim(),

        status:
          formData.status ||
          "Active",
      };

      if (
        access.canAssign &&
        formData.owner_employee_id
      ) {
        payload.owner_employee_id =
          formData.owner_employee_id;
      }

      const response =
        await fetch(
          "/api/customers",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to create customer."
        );
      }

      if (
        data.customer
      ) {
        setCustomers(
          (
            currentCustomers
          ) => [
            data.customer,
            ...currentCustomers,
          ]
        );
      } else {
        await fetchCustomerWorkspace();
      }

      closeCreateForm();

      alert(
        data.message ||
          "Customer created successfully."
      );
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
      setSaving(
        false
      );
    }
  }

  // =======================================================
  // NORMALISE
  // =======================================================

  function normaliseStatus(
    value
  ) {
    return String(
      value ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  // =======================================================
  // CUSTOMER METRICS
  // =======================================================

  function getCustomerProjects(
    customer
  ) {
    return projects.filter(
      (
        project
      ) =>
        String(
          project.customer_id ||
            ""
        ) ===
        String(
          customer.id
        )
    );
  }

  function getCustomerInvoices(
    customer
  ) {
    return invoices.filter(
      (
        invoice
      ) =>
        String(
          invoice.customer_id ||
            ""
        ) ===
        String(
          customer.id
        )
    );
  }

  function getCustomerHealth(
    customer
  ) {
    const customerProjects =
      getCustomerProjects(
        customer
      );

    const customerInvoices =
      getCustomerInvoices(
        customer
      );

    const activeProjects =
      customerProjects.filter(
        (
          project
        ) =>
          !COMPLETED_PROJECT_STATUSES.includes(
            normaliseStatus(
              project.status
            )
          )
      );

    const overdueInvoices =
      customerInvoices.filter(
        (
          invoice
        ) =>
          [
            "overdue",
            "late",
          ].includes(
            normaliseStatus(
              invoice.status
            )
          )
      );

    const unpaidInvoices =
      customerInvoices.filter(
        (
          invoice
        ) =>
          !PAID_INVOICE_STATUSES.includes(
            normaliseStatus(
              invoice.status
            )
          )
      );

    if (
      overdueInvoices.length >
      0
    ) {
      return {
        label:
          "Needs attention",

        tone:
          "risk",

        detail:
          `${overdueInvoices.length} overdue invoice${
            overdueInvoices.length ===
            1
              ? ""
              : "s"
          }`,
      };
    }

    if (
      activeProjects.length >
      0
    ) {
      return {
        label:
          "Active",

        tone:
          "healthy",

        detail:
          `${activeProjects.length} active project${
            activeProjects.length ===
            1
              ? ""
              : "s"
          }`,
      };
    }

    if (
      unpaidInvoices.length >
      0
    ) {
      return {
        label:
          "Payment pending",

        tone:
          "watch",

        detail:
          `${unpaidInvoices.length} open invoice${
            unpaidInvoices.length ===
            1
              ? ""
              : "s"
          }`,
      };
    }

    return {
      label:
        "Stable",

      tone:
        "neutral",

      detail:
        customerProjects.length >
        0
          ? "No current delivery risks"
          : "No active delivery",
    };
  }

  // =======================================================
  // FILTER
  // =======================================================

  const filteredCustomers =
    useMemo(
      () => {
        const search =
          searchValue
            .trim()
            .toLowerCase();

        return customers.filter(
          (
            customer
          ) => {
            const health =
              getCustomerHealth(
                customer
              );

            const matchesSearch =
              !search ||
              [
                customer.customer_name,
                customer.company,
                customer.email,
                customer.phone,
                customer.status,
                customer.owner
                  ?.full_name,
              ].some(
                (
                  value
                ) =>
                  String(
                    value ||
                      ""
                  )
                    .toLowerCase()
                    .includes(
                      search
                    )
              );

            const matchesStatus =
              statusFilter ===
                "All" ||
              normaliseStatus(
                customer.status
              ) ===
                normaliseStatus(
                  statusFilter
                );

            const matchesHealth =
              healthFilter ===
                "All" ||
              health.label ===
                healthFilter;

            return (
              matchesSearch &&
              matchesStatus &&
              matchesHealth
            );
          }
        );
      },
      [
        customers,
        projects,
        invoices,
        searchValue,
        statusFilter,
        healthFilter,
      ]
    );

  // =======================================================
  // SUMMARY
  // =======================================================

  const activeCustomers =
    customers.filter(
      (
        customer
      ) =>
        normaliseStatus(
          customer.status
        ) ===
        "active"
    ).length;

  const customersWithProjects =
    customers.filter(
      (
        customer
      ) =>
        getCustomerProjects(
          customer
        ).some(
          (
            project
          ) =>
            !COMPLETED_PROJECT_STATUSES.includes(
              normaliseStatus(
                project.status
              )
            )
        )
    ).length;

  const customersAtRisk =
    customers.filter(
      (
        customer
      ) =>
        getCustomerHealth(
          customer
        ).tone ===
        "risk"
    ).length;

  // =======================================================
  // CLEAR FILTERS
  // =======================================================

  function clearFilters() {
    setSearchValue(
      ""
    );

    setStatusFilter(
      "All"
    );

    setHealthFilter(
      "All"
    );
  }

  // =======================================================
  // VISIBILITY
  // =======================================================

  const visibilityLabel =
    access.canViewAll
      ? "All organisation customers"
      : access.canViewTeam
        ? "Team customers"
        : access.canViewOwn
          ? "My customers"
          : "Customer access";

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Customers"
        description="Manage customer relationships, delivery activity and account health."
      >
        <div
          className={
            styles.page
          }
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <section
            className={
              styles.pageHeader
            }
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
                Customer portfolio
              </h2>

              <p>
                Review customer relationships,
                active delivery, invoices and
                account health from one place.
              </p>
            </div>

            {access.canCreate && (
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
                  {showForm
                    ? "×"
                    : "+"}
                </span>

                {showForm
                  ? "Close form"
                  : "Add customer"}
              </button>
            )}
          </section>

          {/* =================================================
              FORM
          ================================================= */}

          {showForm &&
            access.canCreate && (
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
                      Create a customer
                    </h3>

                    <p>
                      Create a customer record
                      and optionally assign an
                      account owner.
                    </p>
                  </div>
                </div>

                <form
                  className={
                    styles.customerForm
                  }
                  onSubmit={
                    handleSubmit
                  }
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="customer-name"
                      >
                        Customer name *
                      </label>

                      <input
                        id="customer-name"
                        name="customer_name"
                        value={
                          formData.customer_name
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="Example: James Smith"
                        required
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="customer-company"
                      >
                        Company
                      </label>

                      <input
                        id="customer-company"
                        name="company"
                        value={
                          formData.company
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="Example: NorthStar Logistics"
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="customer-email"
                      >
                        Email
                      </label>

                      <input
                        id="customer-email"
                        name="email"
                        type="email"
                        value={
                          formData.email
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="name@company.com"
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="customer-phone"
                      >
                        Phone
                      </label>

                      <input
                        id="customer-phone"
                        name="phone"
                        type="tel"
                        value={
                          formData.phone
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="Telephone number"
                      />
                    </div>

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
                          (
                            status
                          ) => (
                            <option
                              key={
                                status
                              }
                              value={
                                status
                              }
                            >
                              {
                                status
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {access.canAssign && (
                      <div
                        className={
                          styles.field
                        }
                      >
                        <label
                          htmlFor="customer-owner"
                        >
                          Account owner
                        </label>

                        <select
                          id="customer-owner"
                          name="owner_employee_id"
                          value={
                            formData.owner_employee_id
                          }
                          onChange={
                            handleChange
                          }
                        >
                          <option value="">
                            Assign to me
                          </option>

                          {employees.map(
                            (
                              employee
                            ) => (
                              <option
                                key={
                                  employee.id
                                }
                                value={
                                  employee.id
                                }
                              >
                                {
                                  employee.full_name
                                }

                                {employee.job_title
                                  ? ` — ${employee.job_title}`
                                  : ""}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}
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
                      disabled={
                        saving
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className={
                        styles.primaryButton
                      }
                      disabled={
                        saving
                      }
                    >
                      {saving
                        ? "Creating customer..."
                        : "Create customer"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* =================================================
              SUMMARY
          ================================================= */}

          <section
            className={
              styles.summaryRow
            }
          >
            <SummaryCard
              label="Customers"
              value={
                customers.length
              }
              detail={
                visibilityLabel
              }
            />

            <SummaryCard
              label="Active"
              value={
                activeCustomers
              }
              detail="Active customer accounts"
            />

            <SummaryCard
              label="Active delivery"
              value={
                customersWithProjects
              }
              detail="Customers with active projects"
            />

            <SummaryCard
              label="Needs attention"
              value={
                customersAtRisk
              }
              detail="Accounts with overdue invoices"
            />
          </section>

          {/* =================================================
              FILTERS
          ================================================= */}

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
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                value={
                  searchValue
                }
                onChange={(
                  event
                ) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                placeholder="Search customer, company, owner or email..."
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
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All statuses
                </option>

                {STATUS_OPTIONS.map(
                  (
                    status
                  ) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {
                        status
                      }
                    </option>
                  )
                )}
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={
                  healthFilter
                }
                onChange={(
                  event
                ) =>
                  setHealthFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All account health
                </option>

                <option value="Active">
                  Active
                </option>

                <option value="Needs attention">
                  Needs attention
                </option>

                <option value="Payment pending">
                  Payment pending
                </option>

                <option value="Stable">
                  Stable
                </option>
              </select>

              {(searchValue ||
                statusFilter !==
                  "All" ||
                healthFilter !==
                  "All") && (
                <button
                  type="button"
                  className={
                    styles.clearButton
                  }
                  onClick={
                    clearFilters
                  }
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          {/* =================================================
              CONTENT
          ================================================= */}

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

                <p>
                  {
                    errorMessage
                  }
                </p>
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
                    Customer records
                  </h3>

                  <p>
                    Open a customer to review
                    quotes, projects, invoices
                    and related work.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {
                    filteredCustomers.length
                  }{" "}
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
                    Boolean(
                      searchValue
                    ) ||
                    statusFilter !==
                      "All" ||
                    healthFilter !==
                      "All"
                  }
                  canCreate={
                    access.canCreate
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
                        <th>
                          Customer
                        </th>

                        <th>
                          Company
                        </th>

                        <th>
                          Owner
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Account health
                        </th>

                        <th>
                          Projects
                        </th>

                        <th>
                          Invoices
                        </th>

                        <th
                          aria-label="Actions"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredCustomers.map(
                        (
                          customer
                        ) => {
                          const health =
                            getCustomerHealth(
                              customer
                            );

                          const customerProjects =
                            getCustomerProjects(
                              customer
                            );

                          const customerInvoices =
                            getCustomerInvoices(
                              customer
                            );

                          return (
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
                                      {customer.email ||
                                        "No email"}
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
                                    "No company"}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={
                                    styles.companyName
                                  }
                                >
                                  {customer.owner
                                    ?.full_name ||
                                    "Unassigned"}
                                </span>
                              </td>

                              <td>
                                <StatusBadge
                                  status={
                                    customer.status ||
                                    "Active"
                                  }
                                />
                              </td>

                              <td>
                                <HealthBadge
                                  health={
                                    health
                                  }
                                />
                              </td>

                              <td>
                                <span
                                  className={
                                    styles.metricValue
                                  }
                                >
                                  {
                                    customerProjects.length
                                  }
                                </span>
                              </td>

                              <td>
                                <span
                                  className={
                                    styles.metricValue
                                  }
                                >
                                  {
                                    customerInvoices.length
                                  }
                                </span>
                              </td>

                              <td>
                                <Link
                                  href={`/customers/${customer.id}`}
                                  className={
                                    styles.openButton
                                  }
                                >
                                  Open
                                  <span>
                                    →
                                  </span>
                                </Link>
                              </td>
                            </tr>
                          );
                        }
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

// =========================================================
// SUMMARY
// =========================================================

function SummaryCard({
  label,
  value,
  detail,
}) {
  return (
    <div
      className={
        styles.summaryCard
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {detail}
      </small>
    </div>
  );
}

// =========================================================
// HEALTH
// =========================================================

function HealthBadge({
  health,
}) {
  const toneClass =
    health.tone ===
    "healthy"
      ? styles.healthHealthy
      : health.tone ===
          "risk"
        ? styles.healthRisk
        : health.tone ===
            "watch"
          ? styles.healthWatch
          : styles.healthNeutral;

  return (
    <span
      className={`${styles.healthBadge} ${toneClass}`}
      title={
        health.detail
      }
    >
      {
        health.label
      }
    </span>
  );
}

// =========================================================
// EMPTY
// =========================================================

function EmptyState({
  hasFilters,
  canCreate,
  onClearFilters,
  onAddCustomer,
}) {
  return (
    <div
      className={
        styles.emptyState
      }
    >
      <span
        className={
          styles.emptyIcon
        }
      >
        ▣
      </span>

      <h3>
        {hasFilters
          ? "No matching customers"
          : "No customers found"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current filters."
          : canCreate
            ? "Create your first customer to begin managing the customer lifecycle."
            : "There are no customer records available within your current access."}
      </p>

      {hasFilters ? (
        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={
            onClearFilters
          }
        >
          Clear filters
        </button>
      ) : canCreate ? (
        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={
            onAddCustomer
          }
        >
          Add customer
        </button>
      ) : null}
    </div>
  );
}

// =========================================================
// LOADING
// =========================================================

function LoadingState() {
  return (
    <section
      className={
        styles.loadingPanel
      }
    >
      {Array.from({
        length: 6,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={
              index
            }
            className={
              styles.loadingRow
            }
          />
        )
      )}
    </section>
  );
}

// =========================================================
// INITIALS
// =========================================================

function getInitials(
  value = ""
) {
  const words =
    String(
      value
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length ===
    0
  ) {
    return "CU";
  }

  if (
    words.length ===
    1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[
      words.length -
        1
    ][0]
  }`.toUpperCase();
}
