"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";

// =========================================================
// INITIAL FORM
// =========================================================

const INITIAL_FORM_DATA = {
  customer_id: "",
  project_id: "",
  quote_id: "",

  client: "",
  service: "",
  subtotal: "",

  vat_rate: "20",
  due_date: "",

  payment_terms:
    "Payment due within 14 days of invoice date.",

  owner_employee_id: "",
};

// =========================================================
// STATUS OPTIONS
// =========================================================

const STATUS_OPTIONS = [
  "Draft Invoice",
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
];

// =========================================================
// PAGE
// =========================================================

export default function InvoicesPage() {
  // =======================================================
  // DATA
  // =======================================================

  const [
    invoices,
    setInvoices,
  ] = useState([]);

  const [
    customers,
    setCustomers,
  ] = useState([]);

  const [
    projects,
    setProjects,
  ] = useState([]);

  const [
    quotes,
    setQuotes,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

  // =======================================================
  // ACCESS
  // =======================================================

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
    canSend: false,
    canApprove: false,
  });

  // =======================================================
  // UI
  // =======================================================

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    loadingReferences,
    setLoadingReferences,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  // =======================================================
  // FILTERS
  // =======================================================

  const [
    searchValue,
    setSearchValue,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All");

  // =======================================================
  // FORM
  // =======================================================

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
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      setLoading(true);
      setErrorMessage("");

      // ===================================================
      // LOAD INVOICES FIRST
      // ===================================================

      const response =
        await fetch(
          "/api/invoices",
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to load invoices."
        );
      }

      const nextAccess = {
        isOwner:
          Boolean(
            data.access
              ?.isOwner
          ),

        canViewAll:
          Boolean(
            data.access
              ?.canViewAll
          ),

        canViewTeam:
          Boolean(
            data.access
              ?.canViewTeam
          ),

        canViewOwn:
          Boolean(
            data.access
              ?.canViewOwn
          ),

        canCreate:
          Boolean(
            data.access
              ?.canCreate
          ),

        canEdit:
          Boolean(
            data.access
              ?.canEdit
          ),

        canDelete:
          Boolean(
            data.access
              ?.canDelete
          ),

        canAssign:
          Boolean(
            data.access
              ?.canAssign
          ),

        canSend:
          Boolean(
            data.access
              ?.canSend
          ),

        canApprove:
          Boolean(
            data.access
              ?.canApprove
          ),
      };

      setAccess(
        nextAccess
      );

      setInvoices(
        Array.isArray(
          data.invoices
        )
          ? data.invoices
          : []
      );

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setCurrentEmployee(
        data.currentEmployee ||
          null
      );

      // ===================================================
      // LOAD LINKED CRM RECORDS
      // ===================================================

      await loadReferenceData();

      // ===================================================
      // QUICK CREATE
      // ===================================================

      try {
        const params =
          new URLSearchParams(
            window.location.search
          );

        if (
          params.get(
            "create"
          ) ===
            "true" &&
          nextAccess.canCreate
        ) {
          setFormData({
            ...INITIAL_FORM_DATA,

            owner_employee_id:
              nextAccess.canAssign
                ? data
                    .currentEmployee
                    ?.id ||
                  ""
                : "",
          });

          setShowForm(
            true
          );

          window.history.replaceState(
            {},
            "",
            window.location
              .pathname
          );
        }
      } catch {
        // Ignore URL helper errors.
      }
    } catch (
      error
    ) {
      console.error(
        "Invoice loading error:",
        error
      );

      setInvoices(
        []
      );

      setErrorMessage(
        error.message ||
          "Unable to load invoices."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // =======================================================
  // LOAD CUSTOMER / PROJECT / QUOTE OPTIONS
  // =======================================================

  async function loadReferenceData() {
    try {
      setLoadingReferences(
        true
      );

      const [
        customerResponse,
        projectResponse,
        quoteResponse,
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
            "/api/quotes",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      // ===================================================
      // CUSTOMERS
      // ===================================================

      if (
        customerResponse.ok
      ) {
        const customerData =
          await customerResponse.json();

        setCustomers(
          Array.isArray(
            customerData.customers
          )
            ? customerData.customers
            : []
        );
      } else {
        setCustomers(
          []
        );
      }

      // ===================================================
      // PROJECTS
      // ===================================================

      if (
        projectResponse.ok
      ) {
        const projectData =
          await projectResponse.json();

        setProjects(
          Array.isArray(
            projectData.projects
          )
            ? projectData.projects
            : []
        );
      } else {
        setProjects(
          []
        );
      }

      // ===================================================
      // QUOTES
      // ===================================================

      if (
        quoteResponse.ok
      ) {
        const quoteData =
          await quoteResponse.json();

        setQuotes(
          Array.isArray(
            quoteData.quotes
          )
            ? quoteData.quotes
            : []
        );
      } else {
        setQuotes(
          []
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Invoice reference loading error:",
        error
      );

      setCustomers(
        []
      );

      setProjects(
        []
      );

      setQuotes(
        []
      );
    } finally {
      setLoadingReferences(
        false
      );
    }
  }

  // =======================================================
  // FORM HELPERS
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
        current
      ) => ({
        ...current,

        [name]:
          value,
      })
    );
  }

  // =======================================================
  // CUSTOMER CHANGE
  // =======================================================

  function handleCustomerChange(
    event
  ) {
    const customerId =
      event.target.value;

    const customer =
      customers.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            customerId
          )
      );

    setFormData(
      (
        current
      ) => ({
        ...current,

        customer_id:
          customerId,

        project_id:
          "",

        quote_id:
          "",

        client:
          customer
            ? getCustomerDisplayName(
                customer
              )
            : "",

        service:
          "",

        subtotal:
          "",
      })
    );
  }

  // =======================================================
  // PROJECT CHANGE
  // =======================================================

  function handleProjectChange(
    event
  ) {
    const projectId =
      event.target.value;

    if (
      !projectId
    ) {
      setFormData(
        (
          current
        ) => ({
          ...current,

          project_id:
            "",

          quote_id:
            "",

          service:
            "",

          subtotal:
            "",
        })
      );

      return;
    }

    const project =
      projects.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            projectId
          )
      );

    if (
      !project
    ) {
      return;
    }

    const linkedCustomer =
      customers.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            project.customer_id
          )
      );

    const linkedQuote =
      quotes.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            project.quote_id
          )
      );

    const nextCustomerId =
      project.customer_id ||
      formData.customer_id ||
      "";

    const nextQuoteId =
      project.quote_id ||
      "";

    const client =
      linkedCustomer
        ? getCustomerDisplayName(
            linkedCustomer
          )
        : formData.client;

    const service =
      linkedQuote
        ?.service ||
      project.description ||
      project.project_name ||
      "";

    const subtotal =
      project.amount ||
      linkedQuote?.amount ||
      "";

    const paymentTerms =
      linkedQuote
        ?.payment_terms ||
      formData.payment_terms ||
      INITIAL_FORM_DATA.payment_terms;

    setFormData(
      (
        current
      ) => ({
        ...current,

        customer_id:
          nextCustomerId,

        project_id:
          project.id,

        quote_id:
          nextQuoteId,

        client,

        service,

        subtotal,

        payment_terms:
          paymentTerms,
      })
    );
  }

  // =======================================================
  // QUOTE CHANGE
  // =======================================================

  function handleQuoteChange(
    event
  ) {
    const quoteId =
      event.target.value;

    if (
      !quoteId
    ) {
      setFormData(
        (
          current
        ) => ({
          ...current,

          quote_id:
            "",
        })
      );

      return;
    }

    const selectedQuote =
      quotes.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            quoteId
          )
      );

    if (
      !selectedQuote
    ) {
      return;
    }

    const linkedCustomer =
      customers.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            selectedQuote.customer_id
          )
      );

    const linkedProject =
      projects.find(
        (
          item
        ) =>
          String(
            item.quote_id
          ) ===
          String(
            selectedQuote.id
          )
      );

    setFormData(
      (
        current
      ) => ({
        ...current,

        quote_id:
          selectedQuote.id,

        customer_id:
          selectedQuote.customer_id ||
          current.customer_id ||
          "",

        project_id:
          linkedProject
            ?.id ||
          current.project_id ||
          "",

        client:
          linkedCustomer
            ? getCustomerDisplayName(
                linkedCustomer
              )
            : selectedQuote.client ||
              current.client,

        service:
          selectedQuote.service ||
          current.service,

        subtotal:
          linkedProject
            ?.amount ||
          selectedQuote.amount ||
          current.subtotal,

        payment_terms:
          selectedQuote.payment_terms ||
          current.payment_terms ||
          INITIAL_FORM_DATA.payment_terms,
      })
    );
  }

  // =======================================================
  // OPEN FORM
  // =======================================================

  function openForm() {
    if (
      !access.canCreate
    ) {
      return;
    }

    setFormData({
      ...INITIAL_FORM_DATA,

      owner_employee_id:
        access.canAssign
          ? currentEmployee
              ?.id ||
            ""
          : "",
    });

    setShowForm(
      true
    );

    window.scrollTo({
      top:
        0,

      behavior:
        "smooth",
    });
  }

  // =======================================================
  // CLOSE FORM
  // =======================================================

  function closeForm() {
    setFormData(
      INITIAL_FORM_DATA
    );

    setShowForm(
      false
    );
  }

  // =======================================================
  // CREATE INVOICE
  // =======================================================

  async function createInvoice(
    event
  ) {
    event.preventDefault();

    if (
      !access.canCreate
    ) {
      alert(
        "You do not have permission to create invoices."
      );

      return;
    }

    // =====================================================
    // CUSTOMER REQUIRED
    // =====================================================

    if (
      !formData.customer_id
    ) {
      alert(
        "Please select a customer."
      );

      return;
    }

    const client =
      formData.client
        .trim();

    const service =
      formData.service
        .trim();

    if (
      !client ||
      !service
    ) {
      alert(
        "Client and service are required."
      );

      return;
    }

    const subtotal =
      getMoneyValue(
        formData.subtotal
      );

    if (
      subtotal <
      0
    ) {
      alert(
        "Subtotal cannot be negative."
      );

      return;
    }

    if (
      subtotal ===
      0
    ) {
      const confirmed =
        window.confirm(
          "The invoice subtotal is £0.00. Continue?"
        );

      if (
        !confirmed
      ) {
        return;
      }
    }

    try {
      setSaving(
        true
      );

      // ===================================================
      // REAL LINKED RELATIONSHIPS
      // ===================================================

      const payload = {
        customer_id:
          formData.customer_id,

        project_id:
          formData.project_id ||
          null,

        quote_id:
          formData.quote_id ||
          null,

        client,

        service,

        subtotal:
          formData.subtotal,

        vat_rate:
          formData.vat_rate,

        due_date:
          formData.due_date ||
          null,

        payment_terms:
          formData.payment_terms
            .trim(),

        status:
          "Draft Invoice",
      };

      if (
        access.canAssign &&
        formData
          .owner_employee_id
      ) {
        payload.owner_employee_id =
          formData.owner_employee_id;
      }

      const response =
        await fetch(
          "/api/invoices",
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
            "Failed to create invoice."
        );
      }

      if (
        data.invoice
      ) {
        setInvoices(
          (
            current
          ) => [
            data.invoice,
            ...current,
          ]
        );
      } else {
        await loadInvoices();
      }

      closeForm();

      alert(
        data.message ||
          "Invoice created successfully."
      );
    } catch (
      error
    ) {
      console.error(
        "Invoice creation error:",
        error
      );

      alert(
        error.message ||
          "Unable to create invoice."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // =======================================================
  // FILTERED PROJECT OPTIONS
  // =======================================================

  const availableProjects =
    useMemo(
      () => {
        if (
          !formData.customer_id
        ) {
          return [];
        }

        return projects.filter(
          (
            project
          ) =>
            String(
              project.customer_id ||
                ""
            ) ===
            String(
              formData.customer_id
            )
        );
      },
      [
        projects,
        formData.customer_id,
      ]
    );

  // =======================================================
  // FILTERED QUOTE OPTIONS
  // =======================================================

  const availableQuotes =
    useMemo(
      () => {
        if (
          !formData.customer_id
        ) {
          return [];
        }

        return quotes.filter(
          (
            quote
          ) => {
            const sameCustomer =
              String(
                quote.customer_id ||
                  ""
              ) ===
              String(
                formData.customer_id
              );

            const status =
              normaliseStatus(
                quote.status
              );

            const usableStatus =
              [
                "approved",
                "accepted",
              ].includes(
                status
              );

            return (
              sameCustomer &&
              usableStatus
            );
          }
        );
      },
      [
        quotes,
        formData.customer_id,
      ]
    );

  // =======================================================
  // SELECTED RECORDS
  // =======================================================

  const selectedCustomer =
    useMemo(
      () =>
        customers.find(
          (
            customer
          ) =>
            String(
              customer.id
            ) ===
            String(
              formData.customer_id
            )
        ) ||
        null,
      [
        customers,
        formData.customer_id,
      ]
    );

  const selectedProject =
    useMemo(
      () =>
        projects.find(
          (
            project
          ) =>
            String(
              project.id
            ) ===
            String(
              formData.project_id
            )
        ) ||
        null,
      [
        projects,
        formData.project_id,
      ]
    );

  const selectedQuote =
    useMemo(
      () =>
        quotes.find(
          (
            quote
          ) =>
            String(
              quote.id
            ) ===
            String(
              formData.quote_id
            )
        ) ||
        null,
      [
        quotes,
        formData.quote_id,
      ]
    );

  // =======================================================
  // FILTER INVOICE LIST
  // =======================================================

  const filteredInvoices =
    useMemo(
      () => {
        const search =
          searchValue
            .trim()
            .toLowerCase();

        return invoices.filter(
          (
            invoice
          ) => {
            const matchesSearch =
              !search ||
              [
                invoice.invoice_number,
                invoice.client,
                invoice.service,
                invoice.status,
                invoice.owner
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
                invoice.status
              ) ===
                normaliseStatus(
                  statusFilter
                );

            return (
              matchesSearch &&
              matchesStatus
            );
          }
        );
      },
      [
        invoices,
        searchValue,
        statusFilter,
      ]
    );

  // =======================================================
  // METRICS
  // =======================================================

  const totalValue =
    invoices.reduce(
      (
        total,
        invoice
      ) =>
        total +
        getInvoiceTotal(
          invoice
        ),
      0
    );

  const paidInvoices =
    invoices.filter(
      (
        invoice
      ) =>
        normaliseStatus(
          invoice.status
        ) ===
        "paid"
    );

  const paidValue =
    paidInvoices.reduce(
      (
        total,
        invoice
      ) =>
        total +
        getInvoiceTotal(
          invoice
        ),
      0
    );

  const overdueInvoices =
    invoices.filter(
      (
        invoice
      ) =>
        normaliseStatus(
          invoice.status
        ) ===
          "overdue" ||
        (
          isOverdue(
            invoice.due_date
          ) &&
          ![
            "paid",
            "cancelled",
          ].includes(
            normaliseStatus(
              invoice.status
            )
          )
        )
    );

  const outstandingValue =
    invoices
      .filter(
        (
          invoice
        ) =>
          ![
            "paid",
            "cancelled",
          ].includes(
            normaliseStatus(
              invoice.status
            )
          )
      )
      .reduce(
        (
          total,
          invoice
        ) =>
          total +
          getInvoiceTotal(
            invoice
          ),
        0
      );

  // =======================================================
  // VISIBILITY
  // =======================================================

  const visibilityLabel =
    access.canViewAll
      ? "All organisation invoices"
      : access.canViewTeam
        ? "Team invoices"
        : access.canViewOwn
          ? "My invoices"
          : "Invoice access";

  const filtersActive =
    Boolean(
      searchValue
    ) ||
    statusFilter !==
      "All";

  function clearFilters() {
    setSearchValue(
      ""
    );

    setStatusFilter(
      "All"
    );
  }

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Invoices"
        description="Manage billing, payment status and customer invoices."
      >
        <div
          style={
            pageStyles.page
          }
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <section
            style={
              pageStyles.header
            }
          >
            <div>
              <span
                style={
                  pageStyles.eyebrow
                }
              >
                Finance workspace
              </span>

              <h2
                style={
                  pageStyles.heading
                }
              >
                Invoice management
              </h2>

              <p
                style={
                  pageStyles.description
                }
              >
                Create linked customer invoices,
                monitor payment status and maintain
                secure ownership of financial records.
              </p>
            </div>

            {access.canCreate && (
              <button
                type="button"
                style={
                  pageStyles.primaryButton
                }
                onClick={
                  showForm
                    ? closeForm
                    : openForm
                }
              >
                {showForm
                  ? "× Close form"
                  : "+ Create invoice"}
              </button>
            )}
          </section>

          {/* =================================================
              CREATE FORM
          ================================================= */}

          {showForm &&
            access.canCreate && (
              <section
                style={
                  pageStyles.panel
                }
              >
                <div
                  style={
                    pageStyles.panelHeader
                  }
                >
                  <div>
                    <h3
                      style={
                        pageStyles.panelTitle
                      }
                    >
                      Create invoice
                    </h3>

                    <p
                      style={
                        pageStyles.panelDescription
                      }
                    >
                      Link the invoice to a customer,
                      project and approved quote where applicable.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={
                    createInvoice
                  }
                >
                  <div
                    style={
                      pageStyles.formGrid
                    }
                  >
                    {/* ======================================
                        CUSTOMER
                    ====================================== */}

                    <label
                      style={
                        pageStyles.field
                      }
                    >
                      <span
                        style={
                          pageStyles.label
                        }
                      >
                        Customer *
                      </span>

                      <select
                        name="customer_id"
                        value={
                          formData.customer_id
                        }
                        onChange={
                          handleCustomerChange
                        }
                        style={
                          pageStyles.input
                        }
                        required
                        disabled={
                          loadingReferences
                        }
                      >
                        <option value="">
                          {loadingReferences
                            ? "Loading customers..."
                            : "Select customer"}
                        </option>

                        {customers.map(
                          (
                            customer
                          ) => (
                            <option
                              key={
                                customer.id
                              }
                              value={
                                customer.id
                              }
                            >
                              {getCustomerDisplayName(
                                customer
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    {/* ======================================
                        PROJECT
                    ====================================== */}

                    <label
                      style={
                        pageStyles.field
                      }
                    >
                      <span
                        style={
                          pageStyles.label
                        }
                      >
                        Project
                      </span>

                      <select
                        name="project_id"
                        value={
                          formData.project_id
                        }
                        onChange={
                          handleProjectChange
                        }
                        style={
                          pageStyles.input
                        }
                        disabled={
                          !formData.customer_id ||
                          loadingReferences
                        }
                      >
                        <option value="">
                          {!formData.customer_id
                            ? "Select customer first"
                            : availableProjects.length ===
                                0
                              ? "No projects available"
                              : "Select project"}
                        </option>

                        {availableProjects.map(
                          (
                            project
                          ) => (
                            <option
                              key={
                                project.id
                              }
                              value={
                                project.id
                              }
                            >
                              {getProjectDisplayName(
                                project
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    {/* ======================================
                        QUOTE
                    ====================================== */}

                    <label
                      style={
                        pageStyles.field
                      }
                    >
                      <span
                        style={
                          pageStyles.label
                        }
                      >
                        Source quote
                      </span>

                      <select
                        name="quote_id"
                        value={
                          formData.quote_id
                        }
                        onChange={
                          handleQuoteChange
                        }
                        style={
                          pageStyles.input
                        }
                        disabled={
                          !formData.customer_id ||
                          loadingReferences
                        }
                      >
                        <option value="">
                          {!formData.customer_id
                            ? "Select customer first"
                            : availableQuotes.length ===
                                0
                              ? "No approved quotes available"
                              : "Select approved quote"}
                        </option>

                        {availableQuotes.map(
                          (
                            quote
                          ) => (
                            <option
                              key={
                                quote.id
                              }
                              value={
                                quote.id
                              }
                            >
                              {getQuoteDisplayName(
                                quote
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    {/* ======================================
                        OWNER
                    ====================================== */}

                    {access.canAssign && (
                      <label
                        style={
                          pageStyles.field
                        }
                      >
                        <span
                          style={
                            pageStyles.label
                          }
                        >
                          Invoice owner
                        </span>

                        <select
                          name="owner_employee_id"
                          value={
                            formData.owner_employee_id
                          }
                          onChange={
                            handleChange
                          }
                          style={
                            pageStyles.input
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
                      </label>
                    )}

                    {/* ======================================
                        CLIENT
                    ====================================== */}

                    <Field
                      label="Client"
                      name="client"
                      value={
                        formData.client
                      }
                      onChange={
                        handleChange
                      }
                      required
                      readOnly={
                        Boolean(
                          selectedCustomer
                        )
                      }
                    />

                    {/* ======================================
                        SERVICE
                    ====================================== */}

                    <Field
                      label="Service"
                      name="service"
                      value={
                        formData.service
                      }
                      onChange={
                        handleChange
                      }
                      required
                    />

                    {/* ======================================
                        SUBTOTAL
                    ====================================== */}

                    <Field
                      label="Subtotal"
                      name="subtotal"
                      value={
                        formData.subtotal
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: 1125"
                    />

                    {/* ======================================
                        VAT
                    ====================================== */}

                    <Field
                      label="VAT rate (%)"
                      name="vat_rate"
                      type="number"
                      value={
                        formData.vat_rate
                      }
                      onChange={
                        handleChange
                      }
                    />

                    {/* ======================================
                        DUE DATE
                    ====================================== */}

                    <Field
                      label="Due date"
                      name="due_date"
                      type="date"
                      value={
                        formData.due_date
                      }
                      onChange={
                        handleChange
                      }
                    />

                    {/* ======================================
                        LINK SUMMARY
                    ====================================== */}

                    <div
                      style={
                        pageStyles.relationshipCard
                      }
                    >
                      <span
                        style={
                          pageStyles.relationshipLabel
                        }
                      >
                        Invoice relationship
                      </span>

                      <strong>
                        {selectedCustomer
                          ? getCustomerDisplayName(
                              selectedCustomer
                            )
                          : "No customer selected"}
                      </strong>

                      <small>
                        Project:{" "}
                        {selectedProject
                          ? getProjectDisplayName(
                              selectedProject
                            )
                          : "Not linked"}
                      </small>

                      <small>
                        Quote:{" "}
                        {selectedQuote
                          ? selectedQuote.quote_number ||
                            "Linked quote"
                          : "Not linked"}
                      </small>
                    </div>

                    {/* ======================================
                        PAYMENT TERMS
                    ====================================== */}

                    <label
                      style={{
                        ...pageStyles.field,

                        gridColumn:
                          "1 / -1",
                      }}
                    >
                      <span
                        style={
                          pageStyles.label
                        }
                      >
                        Payment terms
                      </span>

                      <textarea
                        name="payment_terms"
                        rows={
                          4
                        }
                        value={
                          formData.payment_terms
                        }
                        onChange={
                          handleChange
                        }
                        style={
                          pageStyles.textarea
                        }
                      />
                    </label>
                  </div>

                  {/* ========================================
                      ACTIONS
                  ======================================== */}

                  <div
                    style={
                      pageStyles.actions
                    }
                  >
                    <button
                      type="button"
                      style={
                        pageStyles.secondaryButton
                      }
                      onClick={
                        closeForm
                      }
                      disabled={
                        saving
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      style={
                        pageStyles.primaryButton
                      }
                      disabled={
                        saving ||
                        loadingReferences
                      }
                    >
                      {saving
                        ? "Creating..."
                        : "Create invoice"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* =================================================
              SUMMARY
          ================================================= */}

          <section
            style={
              pageStyles.summaryGrid
            }
          >
            <SummaryCard
              label="Invoices"
              value={
                invoices.length
              }
              description={
                visibilityLabel
              }
            />

            <SummaryCard
              label="Invoice value"
              value={
                formatCurrency(
                  totalValue
                )
              }
              description="Total invoice value"
            />

            <SummaryCard
              label="Paid"
              value={
                formatCurrency(
                  paidValue
                )
              }
              description={`${paidInvoices.length} paid invoice${
                paidInvoices.length ===
                1
                  ? ""
                  : "s"
              }`}
            />

            <SummaryCard
              label="Outstanding"
              value={
                formatCurrency(
                  outstandingValue
                )
              }
              description={`${overdueInvoices.length} overdue`}
            />
          </section>

          {/* =================================================
              TOOLBAR
          ================================================= */}

          <section
            style={
              pageStyles.toolbar
            }
          >
            <div
              style={
                pageStyles.searchBox
              }
            >
              <span>
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search invoice, client, owner or service..."
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
                style={
                  pageStyles.searchInput
                }
              />
            </div>

            <div
              style={
                pageStyles.toolbarActions
              }
            >
              <select
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
                style={
                  pageStyles.filter
                }
              >
                <option value="All">
                  All statuses
                </option>

                {STATUS_OPTIONS.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {item}
                    </option>
                  )
                )}
              </select>

              {filtersActive && (
                <button
                  type="button"
                  style={
                    pageStyles.secondaryButton
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
              style={
                pageStyles.error
              }
            >
              <div>
                <strong>
                  Unable to load invoices
                </strong>

                <p>
                  {errorMessage}
                </p>
              </div>

              <button
                type="button"
                style={
                  pageStyles.secondaryButton
                }
                onClick={
                  loadInvoices
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              style={
                pageStyles.panel
              }
            >
              <div
                style={
                  pageStyles.tableHeader
                }
              >
                <div>
                  <h3
                    style={
                      pageStyles.panelTitle
                    }
                  >
                    Invoice records
                  </h3>

                  <p
                    style={
                      pageStyles.panelDescription
                    }
                  >
                    Open an invoice to review billing,
                    payment terms and document details.
                  </p>
                </div>

                <span
                  style={
                    pageStyles.resultCount
                  }
                >
                  {
                    filteredInvoices.length
                  }{" "}
                  result
                  {filteredInvoices.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredInvoices.length ===
              0 ? (
                <div
                  style={
                    pageStyles.empty
                  }
                >
                  <span
                    style={
                      pageStyles.emptyIcon
                    }
                  >
                    £
                  </span>

                  <h3>
                    No invoices found
                  </h3>

                  <p>
                    {filtersActive
                      ? "Try clearing the current filters."
                      : access.canCreate
                        ? "Create your first invoice to begin tracking customer billing."
                        : "There are no invoices available within your current access."}
                  </p>

                  {filtersActive ? (
                    <button
                      type="button"
                      style={
                        pageStyles.primaryButton
                      }
                      onClick={
                        clearFilters
                      }
                    >
                      Clear filters
                    </button>
                  ) : access.canCreate ? (
                    <button
                      type="button"
                      style={
                        pageStyles.primaryButton
                      }
                      onClick={
                        openForm
                      }
                    >
                      Create invoice
                    </button>
                  ) : null}
                </div>
              ) : (
                <div
                  style={
                    pageStyles.tableWrapper
                  }
                >
                  <table
                    style={
                      pageStyles.table
                    }
                  >
                    <thead>
                      <tr>
                        <TableHead>
                          Invoice
                        </TableHead>

                        <TableHead>
                          Client
                        </TableHead>

                        <TableHead>
                          Owner
                        </TableHead>

                        <TableHead>
                          Service
                        </TableHead>

                        <TableHead>
                          Total
                        </TableHead>

                        <TableHead>
                          Due
                        </TableHead>

                        <TableHead>
                          Status
                        </TableHead>

                        <TableHead>
                          Created
                        </TableHead>

                        <TableHead />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredInvoices.map(
                        (
                          invoice
                        ) => (
                          <tr
                            key={
                              invoice.id
                            }
                          >
                            <TableCell>
                              <div
                                style={
                                  pageStyles.identity
                                }
                              >
                                <span
                                  style={
                                    pageStyles.invoiceIcon
                                  }
                                >
                                  £
                                </span>

                                <div>
                                  <Link
                                    href={`/invoices/${invoice.id}`}
                                    style={
                                      pageStyles.recordLink
                                    }
                                  >
                                    {invoice.invoice_number ||
                                      "Invoice"}
                                  </Link>

                                  <small
                                    style={
                                      pageStyles.smallText
                                    }
                                  >
                                    {invoice.project_id
                                      ? "Project invoice"
                                      : "Billing record"}
                                  </small>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              {
                                invoice.client ||
                                "No client"
                              }
                            </TableCell>

                            <TableCell>
                              {invoice.owner
                                ?.full_name ||
                                "Unassigned"}
                            </TableCell>

                            <TableCell>
                              {invoice.service ||
                                "Not specified"}
                            </TableCell>

                            <TableCell>
                              <strong>
                                {formatInvoiceAmount(
                                  invoice
                                )}
                              </strong>
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                invoice.due_date
                              )}
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={
                                  getDisplayStatus(
                                    invoice
                                  )
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                invoice.created_at
                              )}
                            </TableCell>

                            <TableCell>
                              <Link
                                href={`/invoices/${invoice.id}`}
                                style={
                                  pageStyles.openButton
                                }
                              >
                                Open →
                              </Link>
                            </TableCell>
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

// =========================================================
// FIELD
// =========================================================

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  readOnly = false,
}) {
  return (
    <label
      style={
        pageStyles.field
      }
    >
      <span
        style={
          pageStyles.label
        }
      >
        {label}
        {required
          ? " *"
          : ""}
      </span>

      <input
        name={
          name
        }
        type={
          type
        }
        value={
          value ||
          ""
        }
        onChange={
          onChange
        }
        placeholder={
          placeholder
        }
        required={
          required
        }
        readOnly={
          readOnly
        }
        style={{
          ...pageStyles.input,

          background:
            readOnly
              ? "#f7f5ef"
              : "#ffffff",
        }}
      />
    </label>
  );
}

// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({
  label,
  value,
  description,
}) {
  return (
    <article
      style={
        pageStyles.summaryCard
      }
    >
      <span
        style={
          pageStyles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          pageStyles.summaryValue
        }
      >
        {value}
      </strong>

      <small
        style={
          pageStyles.summaryDescription
        }
      >
        {description}
      </small>
    </article>
  );
}

// =========================================================
// TABLE HEAD
// =========================================================

function TableHead({
  children,
}) {
  return (
    <th
      style={
        pageStyles.th
      }
    >
      {children}
    </th>
  );
}

// =========================================================
// TABLE CELL
// =========================================================

function TableCell({
  children,
}) {
  return (
    <td
      style={
        pageStyles.td
      }
    >
      {children}
    </td>
  );
}

// =========================================================
// LOADING
// =========================================================

function LoadingState() {
  return (
    <section
      style={
        pageStyles.loading
      }
    >
      {Array.from({
        length:
          6,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={
              index
            }
            style={
              pageStyles.loadingRow
            }
          />
        )
      )}
    </section>
  );
}

// =========================================================
// HELPERS
// =========================================================

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

// =========================================================
// CUSTOMER DISPLAY
// =========================================================

function getCustomerDisplayName(
  customer
) {
  if (
    !customer
  ) {
    return "";
  }

  return (
    customer.company ||
    customer.customer_name ||
    customer.email ||
    "Customer"
  );
}

// =========================================================
// PROJECT DISPLAY
// =========================================================

function getProjectDisplayName(
  project
) {
  if (
    !project
  ) {
    return "";
  }

  return (
    project.description ||
    project.project_name ||
    "Project"
  );
}

// =========================================================
// QUOTE DISPLAY
// =========================================================

function getQuoteDisplayName(
  quote
) {
  if (
    !quote
  ) {
    return "";
  }

  const number =
    quote.quote_number ||
    "Quote";

  const status =
    quote.status ||
    "";

  const amount =
    quote.amount
      ? ` — ${formatMoneyValue(
          quote.amount
        )}`
      : "";

  return `${number}${
    status
      ? ` — ${status}`
      : ""
  }${amount}`;
}

// =========================================================
// MONEY
// =========================================================

function getMoneyValue(
  value
) {
  const parsed =
    Number(
      String(
        value ||
          ""
      )
        .replace(
          /,/g,
          ""
        )
        .replace(
          /[^0-9.-]/g,
          ""
        )
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

// =========================================================
// INVOICE TOTAL
// =========================================================

function getInvoiceTotal(
  invoice
) {
  return getMoneyValue(
    invoice.total_amount ||
      invoice.amount ||
      invoice.subtotal
  );
}

// =========================================================
// CURRENCY
// =========================================================

function formatCurrency(
  value
) {
  return Number(
    value ||
      0
  ).toLocaleString(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}

function formatMoneyValue(
  value
) {
  return formatCurrency(
    getMoneyValue(
      value
    )
  );
}

// =========================================================
// INVOICE AMOUNT
// =========================================================

function formatInvoiceAmount(
  invoice
) {
  const value =
    invoice.total_amount ||
    invoice.amount ||
    invoice.subtotal;

  if (
    !value
  ) {
    return "£0.00";
  }

  if (
    String(
      value
    ).includes(
      "£"
    )
  ) {
    return value;
  }

  return formatCurrency(
    getMoneyValue(
      value
    )
  );
}

// =========================================================
// DATE
// =========================================================

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "Not set";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not set";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  );
}

// =========================================================
// OVERDUE
// =========================================================

function isOverdue(
  value
) {
  if (
    !value
  ) {
    return false;
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    date.getTime() <
    Date.now()
  );
}

// =========================================================
// DISPLAY STATUS
// =========================================================

function getDisplayStatus(
  invoice
) {
  const status =
    normaliseStatus(
      invoice.status
    );

  if (
    ![
      "paid",
      "cancelled",
      "overdue",
    ].includes(
      status
    ) &&
    isOverdue(
      invoice.due_date
    )
  ) {
    return "Overdue";
  }

  return (
    invoice.status ||
    "Draft Invoice"
  );
}

// =========================================================
// STYLES
// =========================================================

const pageStyles = {
  page: {
    display:
      "grid",

    gap:
      "20px",

    color:
      "#24221d",

    fontSize:
      "13px",
  },

  header: {
    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "24px",
  },

  eyebrow: {
    display:
      "block",

    marginBottom:
      "7px",

    color:
      "#a17800",

    fontSize:
      "11px",

    fontWeight:
      800,

    letterSpacing:
      "1px",

    textTransform:
      "uppercase",
  },

  heading: {
    margin:
      0,

    fontSize:
      "28px",

    lineHeight:
      1.15,
  },

  description: {
    maxWidth:
      "720px",

    margin:
      "8px 0 0",

    color:
      "#7c786e",

    fontSize:
      "13px",

    lineHeight:
      1.6,
  },

  panel: {
    overflow:
      "hidden",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "16px",

    background:
      "#ffffff",
  },

  panelHeader: {
    padding:
      "20px 22px",

    borderBottom:
      "1px solid #ece9e2",
  },

  panelTitle: {
    margin:
      0,

    fontSize:
      "17px",
  },

  panelDescription: {
    margin:
      "5px 0 0",

    color:
      "#89857b",

    fontSize:
      "12px",
  },

  primaryButton: {
    minHeight:
      "40px",

    padding:
      "0 16px",

    border:
      "1px solid #b98700",

    borderRadius:
      "10px",

    background:
      "#dda900",

    color:
      "#17130a",

    fontSize:
      "12px",

    fontWeight:
      750,

    cursor:
      "pointer",
  },

  secondaryButton: {
    minHeight:
      "40px",

    padding:
      "0 15px",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "10px",

    background:
      "#ffffff",

    color:
      "#403d36",

    fontSize:
      "12px",

    fontWeight:
      700,

    cursor:
      "pointer",
  },

  formGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",

    gap:
      "16px",

    padding:
      "22px",
  },

  field: {
    display:
      "grid",

    gap:
      "7px",
  },

  label: {
    color:
      "#39362f",

    fontSize:
      "12px",

    fontWeight:
      750,
  },

  input: {
    width:
      "100%",

    minHeight:
      "42px",

    padding:
      "0 12px",

    border:
      "1px solid #dcd8ce",

    borderRadius:
      "9px",

    outline:
      0,

    background:
      "#ffffff",

    color:
      "#292722",

    fontSize:
      "13px",
  },

  textarea: {
    width:
      "100%",

    padding:
      "11px 12px",

    border:
      "1px solid #dcd8ce",

    borderRadius:
      "9px",

    outline:
      0,

    resize:
      "vertical",

    fontFamily:
      "inherit",

    fontSize:
      "13px",
  },

  relationshipCard: {
    display:
      "grid",

    alignContent:
      "center",

    gap:
      "5px",

    minHeight:
      "94px",

    padding:
      "14px",

    border:
      "1px solid #e3ddca",

    borderRadius:
      "11px",

    background:
      "#fbf8ee",

    color:
      "#4b463b",
  },

  relationshipLabel: {
    color:
      "#957000",

    fontSize:
      "10px",

    fontWeight:
      850,

    letterSpacing:
      ".6px",

    textTransform:
      "uppercase",
  },

  actions: {
    display:
      "flex",

    justifyContent:
      "flex-end",

    gap:
      "10px",

    padding:
      "0 22px 22px",
  },

  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",

    gap:
      "14px",
  },

  summaryCard: {
    display:
      "grid",

    gap:
      "8px",

    minHeight:
      "132px",

    padding:
      "18px",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "15px",

    background:
      "#ffffff",
  },

  summaryLabel: {
    color:
      "#756f64",

    fontSize:
      "10px",

    fontWeight:
      800,

    letterSpacing:
      ".7px",

    textTransform:
      "uppercase",
  },

  summaryValue: {
    fontSize:
      "25px",
  },

  summaryDescription: {
    marginTop:
      "auto",

    color:
      "#938e84",

    fontSize:
      "11px",
  },

  toolbar: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "16px",

    padding:
      "12px",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "14px",

    background:
      "#ffffff",
  },

  searchBox: {
    display:
      "flex",

    width:
      "480px",

    maxWidth:
      "100%",

    minHeight:
      "42px",

    alignItems:
      "center",

    gap:
      "8px",

    padding:
      "0 12px",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "10px",
  },

  searchInput: {
    width:
      "100%",

    border:
      0,

    outline:
      0,

    fontSize:
      "13px",
  },

  toolbarActions: {
    display:
      "flex",

    gap:
      "10px",
  },

  filter: {
    minHeight:
      "42px",

    padding:
      "0 12px",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "10px",

    background:
      "#ffffff",

    fontSize:
      "12px",
  },

  tableHeader: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "20px",

    padding:
      "18px 20px",

    borderBottom:
      "1px solid #ece9e2",
  },

  resultCount: {
    padding:
      "5px 9px",

    borderRadius:
      "999px",

    background:
      "#f7efd2",

    color:
      "#8a6500",

    fontSize:
      "10px",

    fontWeight:
      800,
  },

  tableWrapper: {
    overflowX:
      "auto",
  },

  table: {
    width:
      "100%",

    borderCollapse:
      "collapse",
  },

  th: {
    padding:
      "12px 15px",

    borderBottom:
      "1px solid #ebe8e0",

    color:
      "#827d72",

    fontSize:
      "10px",

    fontWeight:
      800,

    letterSpacing:
      ".6px",

    textAlign:
      "left",

    textTransform:
      "uppercase",

    whiteSpace:
      "nowrap",
  },

  td: {
    padding:
      "14px 15px",

    borderBottom:
      "1px solid #efede7",

    color:
      "#444039",

    fontSize:
      "12px",

    verticalAlign:
      "middle",

    whiteSpace:
      "nowrap",
  },

  identity: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "10px",
  },

  invoiceIcon: {
    display:
      "grid",

    width:
      "34px",

    height:
      "34px",

    placeItems:
      "center",

    borderRadius:
      "9px",

    background:
      "#29271f",

    color:
      "#e2b83a",

    fontWeight:
      800,
  },

  recordLink: {
    color:
      "#7f5e00",

    fontWeight:
      800,

    textDecoration:
      "none",
  },

  smallText: {
    display:
      "block",

    marginTop:
      "3px",

    color:
      "#9a958b",

    fontSize:
      "10px",
  },

  openButton: {
    display:
      "inline-flex",

    minHeight:
      "34px",

    alignItems:
      "center",

    padding:
      "0 11px",

    border:
      "1px solid #ded8c6",

    borderRadius:
      "9px",

    background:
      "#fffdf6",

    color:
      "#8a6500",

    fontSize:
      "11px",

    fontWeight:
      800,

    textDecoration:
      "none",
  },

  error: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "20px",

    padding:
      "20px",

    border:
      "1px solid #efcaca",

    borderRadius:
      "14px",

    background:
      "#fff7f7",

    color:
      "#9d3939",
  },

  empty: {
    display:
      "grid",

    minHeight:
      "300px",

    placeItems:
      "center",

    alignContent:
      "center",

    gap:
      "10px",

    padding:
      "30px",

    textAlign:
      "center",
  },

  emptyIcon: {
    display:
      "grid",

    width:
      "52px",

    height:
      "52px",

    placeItems:
      "center",

    borderRadius:
      "14px",

    background:
      "#f4ebca",

    color:
      "#947000",

    fontSize:
      "20px",

    fontWeight:
      800,
  },

  loading: {
    display:
      "grid",

    gap:
      "10px",
  },

  loadingRow: {
    height:
      "70px",

    borderRadius:
      "12px",

    background:
      "#eeece6",
  },
};
