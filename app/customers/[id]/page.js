"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";

import styles from "./customer-details.module.css";

// =========================================================
// OPTIONS
// =========================================================

const CUSTOMER_STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Prospect",
  "On Hold",
];

const COMPLETED_STATUSES = [
  "completed",
  "complete",
  "done",
  "closed",
];

const PAID_STATUSES = [
  "paid",
  "settled",
];

const OVERDUE_STATUSES = [
  "overdue",
  "late",
];

const TABS = [
  {
    id: "overview",
    label: "Overview",
  },
  {
    id: "quotes",
    label: "Quotes",
  },
  {
    id: "projects",
    label: "Projects",
  },
  {
    id: "invoices",
    label: "Invoices",
  },
  {
    id: "tasks",
    label: "Related Work",
  },
  {
    id: "follow-ups",
    label: "Follow-ups",
  },
];

// =========================================================
// PAGE
// =========================================================

export default function CustomerDetailsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const customerId =
    params?.id;

  const [
    data,
    setData,
  ] = useState(null);

  const [
    draftCustomer,
    setDraftCustomer,
  ] = useState(null);

  const [
    activeTab,
    setActiveTab,
  ] = useState("overview");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    startingProject,
    setStartingProject,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    if (
      customerId
    ) {
      fetchCustomerDetails();
    }
  }, [
    customerId,
  ]);

  async function fetchCustomerDetails() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          `/api/customers/${customerId}`,
          {
            cache:
              "no-store",
          }
        );

      const responseData =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          responseData.error ||
            "Failed to load customer."
        );
      }

      setData(
        responseData
      );

      setDraftCustomer(
        responseData.customer ||
          null
      );
    } catch (error) {
      console.error(
        "Customer details loading error:",
        error
      );

      setData(null);

      setErrorMessage(
        error.message ||
          "We could not load this customer."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // ACCESS
  // =======================================================

  const access =
    data?.access ||
    {};

  const permissionKeys =
    Array.isArray(
      access.permissions
    )
      ? access.permissions
      : [];

  const canEditCustomer =
    Boolean(
      access.canEdit
    );

  const canDeleteCustomer =
    Boolean(
      access.canDelete
    );

  const canAssignCustomer =
    Boolean(
      access.canAssign
    );

  const canCreateQuote =
    Boolean(
      access.isOwner ||
        permissionKeys.includes(
          "quotes.create"
        )
    );

  const canCreateProject =
    Boolean(
      access.isOwner ||
        permissionKeys.includes(
          "projects.create"
        )
    );

  // =======================================================
  // EDIT
  // =======================================================

  function startEditing() {
    if (
      !canEditCustomer &&
      !canAssignCustomer
    ) {
      return;
    }

    setDraftCustomer({
      ...data.customer,
    });

    setEditing(true);

    setActiveTab(
      "overview"
    );
  }

  function cancelEditing() {
    setDraftCustomer({
      ...data.customer,
    });

    setEditing(false);
  }

  function handleCustomerChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setDraftCustomer(
      (
        currentCustomer
      ) => ({
        ...currentCustomer,

        [name]:
          value,
      })
    );
  }

  // =======================================================
  // SAVE
  // =======================================================

  async function saveCustomer() {
    if (
      !draftCustomer
    ) {
      return;
    }

    if (
      canEditCustomer &&
      !String(
        draftCustomer.customer_name ||
          ""
      ).trim()
    ) {
      alert(
        "Customer name is required."
      );

      return;
    }

    try {
      setSaving(true);

      const payload = {};

      if (
        canEditCustomer
      ) {
        payload.customer_name =
          String(
            draftCustomer.customer_name ||
              ""
          ).trim();

        payload.company =
          String(
            draftCustomer.company ||
              ""
          ).trim();

        payload.email =
          String(
            draftCustomer.email ||
              ""
          ).trim();

        payload.phone =
          String(
            draftCustomer.phone ||
              ""
          ).trim();

        payload.status =
          draftCustomer.status ||
          "Active";
      }

      if (
        canAssignCustomer
      ) {
        payload.owner_employee_id =
          draftCustomer.owner_employee_id ||
          "";
      }

      const response =
        await fetch(
          `/api/customers/${customerId}`,
          {
            method:
              "PATCH",

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

      const responseData =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          responseData.error ||
            "Failed to save customer."
        );
      }

      const updatedCustomer =
        responseData.customer ||
        draftCustomer;

      setData(
        (
          currentData
        ) => ({
          ...currentData,

          customer:
            updatedCustomer,
        })
      );

      setDraftCustomer(
        updatedCustomer
      );

      setEditing(false);

      alert(
        responseData.message ||
          "Customer updated successfully."
      );
    } catch (error) {
      console.error(
        "Customer update error:",
        error
      );

      alert(
        error.message ||
          "Error saving customer."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // DELETE
  // =======================================================

  async function deleteCustomer() {
    if (
      !data?.customer ||
      !canDeleteCustomer
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${
          data.customer.customer_name ||
          "this customer"
        }?\n\nCustomers with linked quotes, projects or invoices cannot be deleted.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeleting(true);

      const response =
        await fetch(
          `/api/customers/${customerId}`,
          {
            method:
              "DELETE",
          }
        );

      const responseData =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          responseData.error ||
            "Failed to delete customer."
        );
      }

      alert(
        responseData.message ||
          "Customer deleted successfully."
      );

      router.push(
        "/customers"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Customer deletion error:",
        error
      );

      alert(
        error.message ||
          "Unable to delete customer."
      );
    } finally {
      setDeleting(false);
    }
  }

  // =======================================================
  // START PROJECT
  // =======================================================

  async function startProject() {
    if (
      !data?.customer ||
      !canCreateProject
    ) {
      return;
    }

    const customer =
      data.customer;

    const quotes =
      data.quotes ||
      [];

    if (
      quotes.length ===
      0
    ) {
      alert(
        "No quote was found for this customer. Create a quote first."
      );

      return;
    }

    const acceptedQuote =
      quotes.find(
        (
          quote
        ) =>
          normaliseStatus(
            quote.status
          ) ===
          "accepted"
      ) ||
      quotes.find(
        (
          quote
        ) =>
          normaliseStatus(
            quote.status
          ) ===
          "approved"
      ) ||
      quotes[0];

    try {
      setStartingProject(
        true
      );

      const response =
        await fetch(
          "/api/projects/from-customer",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                customer_id:
                  customer.id,

                quote_id:
                  acceptedQuote.id,
              }),
          }
        );

      const responseData =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          responseData.error ||
            "Failed to start project."
        );
      }

      if (
        !responseData.project
          ?.id
      ) {
        throw new Error(
          "Project was processed, but no project ID was returned."
        );
      }

      alert(
        responseData.message ||
          "Project created successfully."
      );

      router.push(
        `/projects/${responseData.project.id}`
      );
    } catch (error) {
      console.error(
        "Project creation error:",
        error
      );

      alert(
        error.message ||
          "Error starting project."
      );
    } finally {
      setStartingProject(
        false
      );
    }
  }

  // =======================================================
  // STATES
  // =======================================================

  if (
    loading
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Customer Workspace"
          description="Loading customer information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    errorMessage
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Customer Workspace"
          description="Manage an individual customer account."
        >
          <section
            className={
              styles.errorPanel
            }
          >
            <div>
              <strong>
                Unable to load customer
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
                fetchCustomerDetails
              }
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    !data?.customer
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Customer Workspace"
          description="Manage an individual customer account."
        >
          <section
            className={
              styles.notFound
            }
          >
            <span
              className={
                styles.notFoundIcon
              }
            >
              ▣
            </span>

            <h2>
              Customer not found
            </h2>

            <p>
              This customer may have been
              deleted or you may not have
              permission to open it.
            </p>

            <Link
              href="/customers"
              className={
                styles.primaryButton
              }
            >
              Return to customers
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // DATA
  // =======================================================

  const {
    customer,
    lead,
    quotes = [],
    proposals = [],
    projects = [],
    tasks = [],
    invoices = [],
    followUps = [],
    financialSummary = {},
    recordCounts = {},
    summary = {},
    employees = [],
  } =
    data;

  const visibleCustomer =
    editing
      ? draftCustomer ||
        customer
      : customer;

  const paidInvoices =
    invoices.filter(
      (
        invoice
      ) =>
        PAID_STATUSES.includes(
          normaliseStatus(
            invoice.status
          )
        )
    );

  const overdueInvoices =
    invoices.filter(
      (
        invoice
      ) =>
        OVERDUE_STATUSES.includes(
          normaliseStatus(
            invoice.status
          )
        )
    );

  const activeProjects =
    projects.filter(
      (
        project
      ) =>
        !COMPLETED_STATUSES.includes(
          normaliseStatus(
            project.status
          )
        )
    );

  const pendingTasks =
    tasks.filter(
      (
        task
      ) =>
        !COMPLETED_STATUSES.includes(
          normaliseStatus(
            task.status
          )
        )
    );

  const customerHealth =
    getCustomerHealth({
      overdueInvoices:
        overdueInvoices.length,

      pendingTasks:
        pendingTasks.length,

      activeProjects:
        activeProjects.length,
    });

  const totalQuoted =
    financialSummary.totalQuoted ??
    quotes.reduce(
      (
        total,
        quote
      ) =>
        total +
        getMoneyValue(
          quote.amount
        ),
      0
    );

  const totalInvoiced =
    financialSummary.totalInvoiced ??
    invoices.reduce(
      (
        total,
        invoice
      ) =>
        total +
        getMoneyValue(
          invoice.total_amount ||
            invoice.amount ||
            invoice.total
        ),
      0
    );

  const paidAmount =
    financialSummary.paidAmount ??
    paidInvoices.reduce(
      (
        total,
        invoice
      ) =>
        total +
        getMoneyValue(
          invoice.total_amount ||
            invoice.amount ||
            invoice.total
        ),
      0
    );

  const outstandingAmount =
    financialSummary.outstandingAmount ??
    Math.max(
      0,
      totalInvoiced -
        paidAmount
    );

  // =======================================================
  // TABS
  // =======================================================

  const tabCounts = {
    overview:
      null,

    quotes:
      quotes.length,

    projects:
      projects.length,

    invoices:
      invoices.length,

    tasks:
      tasks.length,

    "follow-ups":
      followUps.length,
  };

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          customer.customer_name ||
          "Customer Workspace"
        }
        description="Customer relationship, projects, finance and activity in one secure workspace."
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
                styles.headerCopy
              }
            >
              <Link
                href="/customers"
                className={
                  styles.backLink
                }
              >
                ← Back to customers
              </Link>

              <span
                className={
                  styles.eyebrow
                }
              >
                Customer workspace
              </span>

              <h2>
                {visibleCustomer.customer_name ||
                  "Unnamed customer"}
              </h2>

              <p>
                {visibleCustomer.company ||
                  "Individual customer"}
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              {!editing &&
                (
                  canEditCustomer ||
                  canAssignCustomer
                ) && (
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={
                      startEditing
                    }
                  >
                    Edit customer
                  </button>
                )}

              {editing && (
                <>
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    disabled={
                      saving
                    }
                    onClick={
                      cancelEditing
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    disabled={
                      saving
                    }
                    onClick={
                      saveCustomer
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </>
              )}

              {!editing &&
                canCreateQuote && (
                  <Link
                    href={`/quotes?create=true&customer=${customer.id}`}
                    className={
                      styles.actionButton
                    }
                  >
                    New quote
                  </Link>
                )}

              {!editing &&
                canCreateProject && (
                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    disabled={
                      startingProject
                    }
                    onClick={
                      startProject
                    }
                  >
                    {startingProject
                      ? "Starting..."
                      : "Start project"}
                  </button>
                )}

              {!editing &&
                canDeleteCustomer && (
                  <button
                    type="button"
                    className={
                      styles.actionButton
                    }
                    disabled={
                      deleting
                    }
                    onClick={
                      deleteCustomer
                    }
                  >
                    {deleting
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                )}
            </div>
          </section>

          {/* =================================================
              HERO
          ================================================= */}

          <section
            className={
              styles.heroCard
            }
          >
            <div
              className={
                styles.identity
              }
            >
              <span
                className={
                  styles.avatar
                }
              >
                {getInitials(
                  visibleCustomer.customer_name ||
                    visibleCustomer.company
                )}
              </span>

              <div
                className={
                  styles.identityCopy
                }
              >
                <h3>
                  {visibleCustomer.customer_name ||
                    "Unnamed customer"}
                </h3>

                <p>
                  {visibleCustomer.company ||
                    "Individual customer"}
                </p>

                <div
                  className={
                    styles.identityMeta
                  }
                >
                  <StatusBadge
                    status={
                      visibleCustomer.status ||
                      "Active"
                    }
                  />

                  <HealthBadge
                    health={
                      customerHealth
                    }
                  />

                  <span
                    className={
                      styles.metaBadge
                    }
                  >
                    Owner:{" "}
                    {visibleCustomer.owner
                      ?.full_name ||
                      customer.owner
                        ?.full_name ||
                      "Unassigned"}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={
                styles.heroMetrics
              }
            >
              <HeroMetric
                label="Quotes"
                value={
                  quotes.length
                }
              />

              <HeroMetric
                label="Projects"
                value={
                  projects.length
                }
              />

              <HeroMetric
                label="Invoices"
                value={
                  invoices.length
                }
              />
            </div>
          </section>

          {/* =================================================
              EDIT FORM
          ================================================= */}

          {editing && (
            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <h3>
                    Edit customer
                  </h3>

                  <p>
                    Update customer details
                    and ownership.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.formGrid
                }
              >
                {canEditCustomer && (
                  <>
                    <CustomerField
                      label="Customer name"
                      name="customer_name"
                      value={
                        draftCustomer.customer_name
                      }
                      onChange={
                        handleCustomerChange
                      }
                    />

                    <CustomerField
                      label="Company"
                      name="company"
                      value={
                        draftCustomer.company
                      }
                      onChange={
                        handleCustomerChange
                      }
                    />

                    <CustomerField
                      label="Email"
                      name="email"
                      type="email"
                      value={
                        draftCustomer.email
                      }
                      onChange={
                        handleCustomerChange
                      }
                    />

                    <CustomerField
                      label="Phone"
                      name="phone"
                      type="tel"
                      value={
                        draftCustomer.phone
                      }
                      onChange={
                        handleCustomerChange
                      }
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
                          draftCustomer.status ||
                          "Active"
                        }
                        onChange={
                          handleCustomerChange
                        }
                      >
                        {CUSTOMER_STATUS_OPTIONS.map(
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
                  </>
                )}

                {canAssignCustomer && (
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
                        draftCustomer.owner_employee_id ||
                        ""
                      }
                      onChange={
                        handleCustomerChange
                      }
                    >
                      <option value="">
                        Unassigned
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
            </section>
          )}

          {/* =================================================
              ACCOUNT METRICS
          ================================================= */}

          <section
            className={
              styles.accountGrid
            }
          >
            <AccountMetric
              label="Total quoted"
              value={
                formatCurrency(
                  totalQuoted
                )
              }
            />

            <AccountMetric
              label="Total invoiced"
              value={
                formatCurrency(
                  totalInvoiced
                )
              }
            />

            <AccountMetric
              label="Paid"
              value={
                formatCurrency(
                  paidAmount
                )
              }
            />

            <AccountMetric
              label="Outstanding"
              value={
                formatCurrency(
                  outstandingAmount
                )
              }
            />
          </section>

          {/* =================================================
              TABS
          ================================================= */}

          <div
            className={
              styles.tabs
            }
          >
            {TABS.map(
              (
                tab
              ) => (
                <button
                  key={
                    tab.id
                  }
                  type="button"
                  className={`${styles.tabButton} ${
                    activeTab ===
                    tab.id
                      ? styles.tabButtonActive
                      : ""
                  }`}
                  onClick={() =>
                    setActiveTab(
                      tab.id
                    )
                  }
                >
                  {
                    tab.label
                  }

                  {tabCounts[
                    tab.id
                  ] !==
                    null && (
                    <span
                      className={
                        styles.tabCount
                      }
                    >
                      {
                        tabCounts[
                          tab.id
                        ]
                      }
                    </span>
                  )}
                </button>
              )
            )}
          </div>

          {/* =================================================
              OVERVIEW
          ================================================= */}

          {activeTab ===
            "overview" && (
            <section
              className={
                styles.overviewGrid
              }
            >
              <section
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <h3>
                      Customer information
                    </h3>

                    <p>
                      Core customer and
                      account information.
                    </p>
                  </div>
                </div>

                <div
                  className={
                    styles.detailList
                  }
                >
                  <DetailRow
                    label="Customer"
                    value={
                      customer.customer_name
                    }
                  />

                  <DetailRow
                    label="Company"
                    value={
                      customer.company
                    }
                  />

                  <DetailRow
                    label="Email"
                    value={
                      customer.email
                    }
                  />

                  <DetailRow
                    label="Phone"
                    value={
                      customer.phone
                    }
                  />

                  <DetailRow
                    label="Status"
                    value={
                      customer.status
                    }
                  />

                  <DetailRow
                    label="Account owner"
                    value={
                      customer.owner
                        ?.full_name ||
                      "Unassigned"
                    }
                  />
                </div>
              </section>

              <section
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <h3>
                      Relationship summary
                    </h3>

                    <p>
                      Current account
                      position and suggested
                      next actions.
                    </p>
                  </div>
                </div>

                <div
                  className={
                    styles.aiSummary
                  }
                >
                  <p>
                    {summary.headline ||
                      `${customer.customer_name} currently has ${quotes.length} quotes, ${projects.length} projects and ${invoices.length} invoices.`}
                  </p>

                  <div
                    className={
                      styles.recommendations
                    }
                  >
                    {(summary.recommendations ||
                      []).length >
                    0 ? (
                      summary.recommendations.map(
                        (
                          recommendation,
                          index
                        ) => (
                          <div
                            key={`${recommendation}-${index}`}
                            className={
                              styles.recommendationItem
                            }
                          >
                            <span>
                              ✦
                            </span>

                            <p>
                              {
                                recommendation
                              }
                            </p>
                          </div>
                        )
                      )
                    ) : (
                      <p
                        className={
                          styles.emptyRecommendation
                        }
                      >
                        No recommendations
                        are currently
                        available.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {lead && (
                <section
                  className={
                    styles.panel
                  }
                >
                  <div
                    className={
                      styles.panelHeader
                    }
                  >
                    <div>
                      <h3>
                        Original lead
                      </h3>

                      <p>
                        Lead record that
                        generated this
                        customer.
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      styles.detailList
                    }
                  >
                    <DetailRow
                      label="Lead"
                      value={
                        lead.name
                      }
                    />

                    <DetailRow
                      label="Company"
                      value={
                        lead.company
                      }
                    />

                    <DetailRow
                      label="Status"
                      value={
                        lead.status
                      }
                    />

                    <DetailRow
                      label="Source"
                      value={
                        lead.source
                      }
                    />
                  </div>

                  <Link
                    href={`/leads/${lead.id}`}
                    className={
                      styles.recordButton
                    }
                  >
                    Open lead
                  </Link>
                </section>
              )}
            </section>
          )}

          {/* =================================================
              QUOTES
          ================================================= */}

          {activeTab ===
            "quotes" && (
            <RecordsPanel
              title="Quotes"
              description="Commercial quotations linked to this customer."
              records={
                quotes
              }
              emptyMessage="No quotes are linked to this customer."
              renderRow={(
                quote
              ) => (
                <>
                  <span>
                    {quote.quote_number ||
                      "Quote"}
                  </span>

                  <span>
                    {quote.service ||
                      "No service"}
                  </span>

                  <span>
                    {quote.status ||
                      "Draft"}
                  </span>

                  <span>
                    {formatCurrency(
                      getMoneyValue(
                        quote.amount
                      )
                    )}
                  </span>

                  <Link
                    href={`/quotes/${quote.id}`}
                    className={
                      styles.recordLink
                    }
                  >
                    Open
                  </Link>
                </>
              )}
            />
          )}

          {/* =================================================
              PROJECTS
          ================================================= */}

          {activeTab ===
            "projects" && (
            <RecordsPanel
              title="Projects"
              description="Delivery projects linked to this customer."
              records={
                projects
              }
              emptyMessage="No projects are linked to this customer."
              renderRow={(
                project
              ) => (
                <>
                  <span>
                    {project.project_name ||
                      project.name ||
                      "Project"}
                  </span>

                  <span>
                    {project.status ||
                      "Not set"}
                  </span>

                  <span>
                    {project.progress ??
                      0}
                    %
                  </span>

                  <span>
                    {formatDate(
                      project.created_at
                    )}
                  </span>

                  <Link
                    href={`/projects/${project.id}`}
                    className={
                      styles.recordLink
                    }
                  >
                    Open
                  </Link>
                </>
              )}
            />
          )}

          {/* =================================================
              INVOICES
          ================================================= */}

          {activeTab ===
            "invoices" && (
            <RecordsPanel
              title="Invoices"
              description="Invoices associated with this customer."
              records={
                invoices
              }
              emptyMessage="No invoices are linked to this customer."
              renderRow={(
                invoice
              ) => (
                <>
                  <span>
                    {invoice.invoice_number ||
                      "Invoice"}
                  </span>

                  <span>
                    {invoice.status ||
                      "Draft"}
                  </span>

                  <span>
                    {formatCurrency(
                      getMoneyValue(
                        invoice.total_amount ||
                          invoice.amount ||
                          invoice.total
                      )
                    )}
                  </span>

                  <span>
                    {formatDate(
                      invoice.created_at
                    )}
                  </span>

                  <Link
                    href={`/invoices/${invoice.id}`}
                    className={
                      styles.recordLink
                    }
                  >
                    Open
                  </Link>
                </>
              )}
            />
          )}

          {/* =================================================
              TASKS
          ================================================= */}

          {activeTab ===
            "tasks" && (
            <RecordsPanel
              title="Related work"
              description="Tasks and internal work linked to this customer."
              records={
                tasks
              }
              emptyMessage="No related work is linked to this customer."
              renderRow={(
                task
              ) => (
                <>
                  <span>
                    {task.title ||
                      "Task"}
                  </span>

                  <span>
                    {task.status ||
                      "Pending"}
                  </span>

                  <span>
                    {task.assigned_employee
                      ?.full_name ||
                      "Unassigned"}
                  </span>

                  <span>
                    {formatDate(
                      task.due_date ||
                        task.created_at
                    )}
                  </span>

                  <span>
                    {isTaskOverdue(
                      task
                    )
                      ? "Overdue"
                      : "Open"}
                  </span>
                </>
              )}
            />
          )}

          {/* =================================================
              FOLLOW UPS
          ================================================= */}

          {activeTab ===
            "follow-ups" && (
            <RecordsPanel
              title="Follow-ups"
              description="Customer follow-up activity."
              records={
                followUps
              }
              emptyMessage="No follow-ups are linked to this customer."
              renderRow={(
                followUp
              ) => (
                <>
                  <span>
                    {followUp.title ||
                      "Follow-up"}
                  </span>

                  <span>
                    {followUp.status ||
                      "Pending"}
                  </span>

                  <span>
                    {formatDate(
                      followUp.due_date
                    )}
                  </span>

                  <span>
                    {followUp.note ||
                      "No note"}
                  </span>
                </>
              )}
            />
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// CUSTOMER FIELD
// =========================================================

function CustomerField({
  label,
  name,
  value,
  onChange,
  type = "text",
}) {
  return (
    <div
      className={
        styles.field
      }
    >
      <label
        htmlFor={`customer-${name}`}
      >
        {label}
      </label>

      <input
        id={`customer-${name}`}
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
      />
    </div>
  );
}

// =========================================================
// RECORDS PANEL
// =========================================================

function RecordsPanel({
  title,
  description,
  records,
  emptyMessage,
  renderRow,
}) {
  return (
    <section
      className={
        styles.recordsSection
      }
    >
      <div
        className={
          styles.recordsSectionHeader
        }
      >
        <div>
          <h3>
            {title}
          </h3>

          <p>
            {description}
          </p>
        </div>

        <span
          className={
            styles.tabCount
          }
        >
          {
            records.length
          }
        </span>
      </div>

      {records.length ===
      0 ? (
        <EmptyMessage
          text={
            emptyMessage
          }
        />
      ) : (
        <div
          className={
            styles.recordsGrid
          }
        >
          {records.map(
            (
              record
            ) => (
              <article
                key={
                  record.id
                }
                className={
                  styles.recordsPanel
                }
              >
                {renderRow(
                  record
                )}
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}

// =========================================================
// DETAIL ROW
// =========================================================

function DetailRow({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.detailRow
      }
    >
      <span>
        {label}
      </span>

      <strong
        className={
          value
            ? ""
            : styles.emptyValue
        }
      >
        {value ||
          "Not available"}
      </strong>
    </div>
  );
}

// =========================================================
// METRICS
// =========================================================

function HeroMetric({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.heroMetric
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function AccountMetric({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.accountMetric
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

// =========================================================
// HEALTH
// =========================================================

function HealthBadge({
  health,
}) {
  const className =
    health.tone ===
    "risk"
      ? styles.healthRisk
      : health.tone ===
          "attention"
        ? styles.healthAttention
        : styles.healthExcellent;

  return (
    <span
      className={`${styles.healthBadge} ${className}`}
    >
      <span
        className={
          styles.healthDot
        }
      />

      {
        health.label
      }
    </span>
  );
}

function getCustomerHealth({
  overdueInvoices,
  pendingTasks,
  activeProjects,
}) {
  if (
    overdueInvoices >
    0
  ) {
    return {
      label:
        "Needs attention",

      tone:
        "risk",
    };
  }

  if (
    pendingTasks >
      3 ||
    activeProjects >
      2
  ) {
    return {
      label:
        "Monitor",

      tone:
        "attention",
    };
  }

  return {
    label:
      "Healthy",

    tone:
      "excellent",
  };
}

// =========================================================
// EMPTY
// =========================================================

function EmptyMessage({
  text,
}) {
  return (
    <div
      className={
        styles.emptyState
      }
    >
      <span
        className={
          styles.notFoundIcon
        }
      >
        ◇
      </span>

      <p>
        {text}
      </p>
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

function isTaskOverdue(
  task
) {
  if (
    !task?.due_date
  ) {
    return false;
  }

  if (
    COMPLETED_STATUSES.includes(
      normaliseStatus(
        task.status
      )
    )
  ) {
    return false;
  }

  const due =
    new Date(
      task.due_date
    );

  if (
    Number.isNaN(
      due.getTime()
    )
  ) {
    return false;
  }

  return (
    due.getTime() <
    Date.now()
  );
}

function getMoneyValue(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return 0;
  }

  const number =
    Number(
      String(
        value
      ).replace(
        /[^0-9.-]/g,
        ""
      )
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

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
        0,

      maximumFractionDigits:
        2,
    }
  );
}

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "Not available";
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
    return "Not available";
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
