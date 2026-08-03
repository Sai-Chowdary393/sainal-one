"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";
import styles from "./customer-details.module.css";

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
];

const PAID_STATUSES = ["paid"];

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
    label: "Tasks",
  },
  {
    id: "follow-ups",
    label: "Follow-ups",
  },
];

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const customerId = params?.id;

  const [data, setData] = useState(null);
  const [draftCustomer, setDraftCustomer] =
    useState(null);

  const [activeTab, setActiveTab] =
    useState("overview");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [startingProject, setStartingProject] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (customerId) {
      fetchCustomerDetails();
    }
  }, [customerId]);

  async function fetchCustomerDetails() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        `/api/customers/${customerId}`,
        {
          cache: "no-store",
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.error ||
            "Failed to load customer."
        );
      }

      setData(responseData);
      setDraftCustomer(
        responseData.customer
      );
    } catch (error) {
      console.error(
        "Customer details loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load this customer."
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setDraftCustomer({
      ...data.customer,
    });

    setEditing(true);
    setActiveTab("overview");
  }

  function cancelEditing() {
    setDraftCustomer({
      ...data.customer,
    });

    setEditing(false);
  }

  function handleCustomerChange(event) {
    const { name, value } = event.target;

    setDraftCustomer(
      (currentCustomer) => ({
        ...currentCustomer,
        [name]: value,
      })
    );
  }

  async function saveCustomer() {
    if (
      !draftCustomer?.customer_name?.trim()
    ) {
      alert("Customer name is required.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/customers/${customerId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            customer_name:
              draftCustomer.customer_name.trim(),

            company:
              String(
                draftCustomer.company || ""
              ).trim(),

            email:
              String(
                draftCustomer.email || ""
              ).trim(),

            phone:
              String(
                draftCustomer.phone || ""
              ).trim(),

            status:
              draftCustomer.status || "Active",
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.error ||
            "Failed to save customer."
        );
      }

      const updatedCustomer =
        Array.isArray(responseData)
          ? responseData[0]
          : responseData;

      setData((currentData) => ({
        ...currentData,
        customer:
          updatedCustomer ||
          draftCustomer,
      }));

      setDraftCustomer(
        updatedCustomer ||
          draftCustomer
      );

      setEditing(false);

      alert(
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

  async function startProject() {
    if (!data?.customer) {
      return;
    }

    const customer = data.customer;
    const quotes = data.quotes || [];

    if (quotes.length === 0) {
      alert(
        "No quote was found for this customer. Create a quote first."
      );
      return;
    }

    const acceptedQuote =
      quotes.find((quote) =>
        normaliseStatus(
          quote.status
        ).includes("accepted")
      ) || quotes[0];

    try {
      setStartingProject(true);

      const response = await fetch(
        "/api/projects/from-customer",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            customer_id: customer.id,
            quote_id: acceptedQuote.id,
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.error ||
            "Failed to start project."
        );
      }

      if (!responseData.project?.id) {
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
      setStartingProject(false);
    }
  }

  if (loading) {
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

  if (errorMessage) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Customer Workspace"
          description="Manage an individual customer account."
        >
          <section
            className={styles.errorPanel}
          >
            <div>
              <strong>
                Unable to load customer
              </strong>

              <p>{errorMessage}</p>
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

  if (!data?.customer) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Customer Workspace"
          description="Manage an individual customer account."
        >
          <section
            className={styles.notFound}
          >
            <span
              className={
                styles.notFoundIcon
              }
            >
              ▣
            </span>

            <h2>Customer not found</h2>

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

  const {
    customer,
    lead,
    quotes = [],
    proposals = [],
    projects = [],
    tasks = [],
    invoices = [],
    followUps = [],
    financialSummary,
    recordCounts,
    summary,
  } = data;

  const visibleCustomer =
    editing
      ? draftCustomer
      : customer;

  const paidInvoices =
    invoices.filter((invoice) =>
      PAID_STATUSES.includes(
        normaliseStatus(
          invoice.status
        )
      )
    );

  const overdueInvoices =
    invoices.filter((invoice) =>
      OVERDUE_STATUSES.includes(
        normaliseStatus(
          invoice.status
        )
      )
    );

  const activeProjects =
    projects.filter(
      (project) =>
        !COMPLETED_STATUSES.includes(
          normaliseStatus(
            project.status
          )
        )
    );

  const pendingTasks =
    tasks.filter(
      (task) =>
        !COMPLETED_STATUSES.includes(
          normaliseStatus(
            task.status
          )
        )
    );

  const customerHealth =
    getCustomerHealth({
      customer,
      overdueInvoices:
        overdueInvoices.length,
      pendingTasks:
        pendingTasks.length,
      activeProjects:
        activeProjects.length,
    });

  const totalInvoiced =
    financialSummary
      ?.totalInvoicedFormatted ||
    formatCurrency(
      invoices.reduce(
        (total, invoice) =>
          total +
          getMoneyValue(
            invoice.total_amount ||
              invoice.amount
          ),
        0
      )
    );

  const totalPaid =
    financialSummary
      ?.totalPaidFormatted ||
    formatCurrency(
      paidInvoices.reduce(
        (total, invoice) =>
          total +
          getMoneyValue(
            invoice.total_amount ||
              invoice.amount
          ),
        0
      )
    );

  const outstanding =
    financialSummary
      ?.outstandingFormatted ||
    formatCurrency(
      invoices
        .filter(
          (invoice) =>
            !PAID_STATUSES.includes(
              normaliseStatus(
                invoice.status
              )
            )
        )
        .reduce(
          (total, invoice) =>
            total +
            getMoneyValue(
              invoice.total_amount ||
                invoice.amount
            ),
          0
        )
    );

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          customer.customer_name ||
          "Customer Workspace"
        }
        description="Customer relationship, projects, finance and activity in one secure workspace."
      >
        <div className={styles.page}>
          <section
            className={styles.pageHeader}
          >
            <div
              className={styles.headerCopy}
            >
              <Link
                href="/customers"
                className={styles.backLink}
              >
                ← Back to customers
              </Link>

              <span
                className={styles.eyebrow}
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
              {!editing ? (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={startEditing}
                >
                  Edit customer
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    disabled={saving}
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
                    disabled={saving}
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

              <Link
                href={`/quotes?create=true&customer=${customer.id}`}
                className={
                  styles.actionButton
                }
              >
                New quote
              </Link>

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                disabled={
                  startingProject
                }
                onClick={startProject}
              >
                {startingProject
                  ? "Starting..."
                  : "Start project"}
              </button>
            </div>
          </section>

          <section
            className={styles.heroCard}
          >
            <div
              className={styles.identity}
            >
              <span
                className={styles.avatar}
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
                    Customer since{" "}
                    {formatDate(
                      customer.created_at
                    )}
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
                label="Total invoiced"
                value={totalInvoiced}
              />

              <HeroMetric
                label="Outstanding"
                value={outstanding}
                warning={
                  overdueInvoices.length >
                  0
                }
              />

              <HeroMetric
                label="Active projects"
                value={
                  activeProjects.length
                }
              />
            </div>
          </section>

          <nav
            className={styles.tabs}
            aria-label="Customer sections"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`${styles.tabButton} ${
                  activeTab === tab.id
                    ? styles.tabButtonActive
                    : ""
                }`}
                onClick={() =>
                  setActiveTab(tab.id)
                }
              >
                {tab.label}

                <TabCount
                  tabId={tab.id}
                  counts={{
                    quotes: quotes.length,
                    projects:
                      projects.length,
                    invoices:
                      invoices.length,
                    tasks: tasks.length,
                    "follow-ups":
                      followUps.length,
                  }}
                />
              </button>
            ))}
          </nav>

          {activeTab === "overview" && (
            <OverviewTab
              visibleCustomer={
                visibleCustomer
              }
              customer={customer}
              editing={editing}
              saving={saving}
              onChange={
                handleCustomerChange
              }
              summary={summary}
              lead={lead}
              recordCounts={recordCounts}
              totalInvoiced={
                totalInvoiced
              }
              totalPaid={totalPaid}
              outstanding={outstanding}
              paidInvoices={
                paidInvoices.length
              }
              overdueInvoices={
                overdueInvoices.length
              }
              activeProjects={
                activeProjects.length
              }
              pendingTasks={
                pendingTasks.length
              }
            />
          )}

          {activeTab === "quotes" && (
            <RecordsTab
              title="Quotes and proposals"
              description="Commercial documents linked to this customer."
              emptyMessage="No quotes or proposals have been created for this customer."
            >
              <div
                className={
                  styles.recordsGrid
                }
              >
                <RecordsPanel
                  title="Quotes"
                  count={quotes.length}
                >
                  {quotes.length === 0 ? (
                    <EmptyMessage>
                      No quotes found.
                    </EmptyMessage>
                  ) : (
                    <RecordsTable
                      headings={[
                        "Quote",
                        "Service",
                        "Amount",
                        "Status",
                        "Created",
                      ]}
                    >
                      {quotes.map(
                        (quote) => (
                          <tr key={quote.id}>
                            <td>
                              <Link
                                href={`/quotes/${quote.id}`}
                                className={
                                  styles.recordLink
                                }
                              >
                                {quote.quote_number ||
                                  "Quote"}
                              </Link>
                            </td>

                            <td>
                              {quote.service ||
                                "Not specified"}
                            </td>

                            <td>
                              {quote.amount ||
                                "Not set"}
                            </td>

                            <td>
                              <StatusBadge
                                status={
                                  quote.status ||
                                  "Draft"
                                }
                              />
                            </td>

                            <td>
                              {formatDate(
                                quote.created_at
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </RecordsTable>
                  )}
                </RecordsPanel>

                <RecordsPanel
                  title="Proposals"
                  count={
                    proposals.length
                  }
                >
                  {proposals.length ===
                  0 ? (
                    <EmptyMessage>
                      No proposals found.
                    </EmptyMessage>
                  ) : (
                    <RecordsTable
                      headings={[
                        "Proposal",
                        "Service",
                        "Amount",
                        "Status",
                        "Created",
                      ]}
                    >
                      {proposals.map(
                        (proposal) => (
                          <tr
                            key={
                              proposal.id
                            }
                          >
                            <td>
                              <Link
                                href={`/proposals/${proposal.id}`}
                                className={
                                  styles.recordLink
                                }
                              >
                                {proposal.proposal_number ||
                                  "Proposal"}
                              </Link>
                            </td>

                            <td>
                              {proposal.service ||
                                "Not specified"}
                            </td>

                            <td>
                              {proposal.amount ||
                                "Not set"}
                            </td>

                            <td>
                              <StatusBadge
                                status={
                                  proposal.status ||
                                  "Draft"
                                }
                              />
                            </td>

                            <td>
                              {formatDate(
                                proposal.created_at
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </RecordsTable>
                  )}
                </RecordsPanel>
              </div>
            </RecordsTab>
          )}

          {activeTab === "projects" && (
            <RecordsTab
              title="Projects"
              description="Delivery work linked to this customer."
              emptyMessage="No projects found for this customer."
            >
              {projects.length === 0 ? (
                <EmptyMessage>
                  No projects found.
                </EmptyMessage>
              ) : (
                <RecordsTable
                  headings={[
                    "Project",
                    "Status",
                    "Amount",
                    "Start date",
                    "Due date",
                  ]}
                >
                  {projects.map(
                    (project) => (
                      <tr key={project.id}>
                        <td>
                          <Link
                            href={`/projects/${project.id}`}
                            className={
                              styles.recordLink
                            }
                          >
                            {project.project_name ||
                              "Unnamed project"}
                          </Link>
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              project.status ||
                              "Not Started"
                            }
                          />
                        </td>

                        <td>
                          {project.amount ||
                            "Not set"}
                        </td>

                        <td>
                          {formatDate(
                            project.start_date
                          )}
                        </td>

                        <td>
                          {formatDate(
                            project.due_date
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </RecordsTable>
              )}
            </RecordsTab>
          )}

          {activeTab === "invoices" && (
            <RecordsTab
              title="Invoices"
              description="Billing and payment records for this customer."
              emptyMessage="No invoices found for this customer."
            >
              {invoices.length === 0 ? (
                <EmptyMessage>
                  No invoices found.
                </EmptyMessage>
              ) : (
                <RecordsTable
                  headings={[
                    "Invoice",
                    "Service",
                    "Amount",
                    "Status",
                    "Due date",
                  ]}
                >
                  {invoices.map(
                    (invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className={
                              styles.recordLink
                            }
                          >
                            {invoice.invoice_number ||
                              "Invoice"}
                          </Link>
                        </td>

                        <td>
                          {invoice.service ||
                            "Not specified"}
                        </td>

                        <td>
                          {invoice.total_amount ||
                            invoice.amount ||
                            "Not set"}
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              invoice.status ||
                              "Pending"
                            }
                          />
                        </td>

                        <td>
                          {formatDate(
                            invoice.due_date
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </RecordsTable>
              )}
            </RecordsTab>
          )}

          {activeTab === "tasks" && (
            <RecordsTab
              title="Tasks"
              description="Project tasks associated with this customer."
              emptyMessage="No tasks found for this customer."
            >
              {tasks.length === 0 ? (
                <EmptyMessage>
                  No tasks found.
                </EmptyMessage>
              ) : (
                <RecordsTable
                  headings={[
                    "Task",
                    "Status",
                    "Due date",
                    "Created",
                  ]}
                >
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        {task.task_name ||
                          "Unnamed task"}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            task.status ||
                            "Not Started"
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          task.due_date
                        )}
                      </td>

                      <td>
                        {formatDate(
                          task.created_at
                        )}
                      </td>
                    </tr>
                  ))}
                </RecordsTable>
              )}
            </RecordsTab>
          )}

          {activeTab === "follow-ups" && (
            <RecordsTab
              title="Follow-ups"
              description="Planned communication and customer actions."
              emptyMessage="No follow-ups found for this customer."
            >
              {followUps.length === 0 ? (
                <EmptyMessage>
                  No follow-ups found.
                </EmptyMessage>
              ) : (
                <RecordsTable
                  headings={[
                    "Follow-up",
                    "Status",
                    "Due date",
                    "Note",
                  ]}
                >
                  {followUps.map(
                    (followUp) => (
                      <tr
                        key={followUp.id}
                      >
                        <td>
                          {followUp.title ||
                            "Follow-up"}
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              followUp.status ||
                              "Pending"
                            }
                          />
                        </td>

                        <td>
                          {formatDate(
                            followUp.due_date
                          )}
                        </td>

                        <td>
                          {followUp.note ||
                            "No note"}
                        </td>
                      </tr>
                    )
                  )}
                </RecordsTable>
              )}
            </RecordsTab>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function OverviewTab({
  visibleCustomer,
  customer,
  editing,
  saving,
  onChange,
  summary,
  lead,
  recordCounts,
  totalInvoiced,
  totalPaid,
  outstanding,
  paidInvoices,
  overdueInvoices,
  activeProjects,
  pendingTasks,
}) {
  const recommendations =
    Array.isArray(
      summary?.recommendations
    )
      ? summary.recommendations
      : [];

  return (
    <div className={styles.overviewGrid}>
      <section
        className={styles.panel}
      >
        <div
          className={styles.panelHeader}
        >
          <div>
            <h3>
              Customer information
            </h3>

            <p>
              Contact and account details
            </p>
          </div>
        </div>

        {editing ? (
          <div
            className={styles.formGrid}
          >
            <CustomerField
              label="Customer name"
              name="customer_name"
              value={
                visibleCustomer.customer_name
              }
              disabled={saving}
              onChange={onChange}
            />

            <CustomerField
              label="Company"
              name="company"
              value={
                visibleCustomer.company
              }
              disabled={saving}
              onChange={onChange}
            />

            <CustomerField
              label="Email"
              name="email"
              type="email"
              value={
                visibleCustomer.email
              }
              disabled={saving}
              onChange={onChange}
            />

            <CustomerField
              label="Phone"
              name="phone"
              type="tel"
              value={
                visibleCustomer.phone
              }
              disabled={saving}
              onChange={onChange}
            />

            <div
              className={styles.field}
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
                  visibleCustomer.status ||
                  "Active"
                }
                disabled={saving}
                onChange={onChange}
              >
                {CUSTOMER_STATUS_OPTIONS.map(
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
        ) : (
          <div
            className={styles.detailList}
          >
            <DetailRow
              label="Customer name"
              value={
                visibleCustomer.customer_name
              }
            />

            <DetailRow
              label="Company"
              value={
                visibleCustomer.company
              }
            />

            <DetailRow
              label="Email"
              value={
                visibleCustomer.email
              }
              href={
                visibleCustomer.email
                  ? `mailto:${visibleCustomer.email}`
                  : null
              }
            />

            <DetailRow
              label="Phone"
              value={
                visibleCustomer.phone
              }
              href={
                visibleCustomer.phone
                  ? `tel:${visibleCustomer.phone}`
                  : null
              }
            />

            <DetailRow
              label="Status"
              customValue={
                <StatusBadge
                  status={
                    visibleCustomer.status ||
                    "Active"
                  }
                />
              }
            />

            <DetailRow
              label="Created"
              value={formatDate(
                customer.created_at
              )}
            />
          </div>
        )}
      </section>

      <section
        className={styles.aiPanel}
      >
        <div
          className={styles.aiHeader}
        >
          <span
            className={styles.aiIcon}
          >
            ✦
          </span>

          <div>
            <span>
              AI customer intelligence
            </span>

            <h3>
              Customer summary
            </h3>
          </div>
        </div>

        <div
          className={styles.aiSummary}
        >
          <p>
            {summary?.overview ||
              "No AI customer summary is currently available."}
          </p>
        </div>

        <div
          className={
            styles.recommendations
          }
        >
          <span>
            Recommended actions
          </span>

          {recommendations.length ===
          0 ? (
            <p
              className={
                styles.emptyRecommendation
              }
            >
              No AI recommendations are
              currently available.
            </p>
          ) : (
            recommendations.map(
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
                  <span>→</span>
                  <p>
                    {recommendation}
                  </p>
                </div>
              )
            )
          )}
        </div>
      </section>

      <section
        className={styles.financePanel}
      >
        <div
          className={styles.panelHeader}
        >
          <div>
            <h3>
              Financial overview
            </h3>

            <p>
              Customer billing performance
            </p>
          </div>
        </div>

        <div
          className={styles.financeGrid}
        >
          <FinanceMetric
            label="Total invoiced"
            value={totalInvoiced}
          />

          <FinanceMetric
            label="Paid"
            value={totalPaid}
            positive
          />

          <FinanceMetric
            label="Outstanding"
            value={outstanding}
            warning={
              overdueInvoices > 0
            }
          />

          <FinanceMetric
            label="Paid invoices"
            value={paidInvoices}
          />
        </div>
      </section>

      <section
        className={styles.panel}
      >
        <div
          className={styles.panelHeader}
        >
          <div>
            <h3>
              Account overview
            </h3>

            <p>
              Connected customer records
            </p>
          </div>
        </div>

        <div
          className={styles.accountGrid}
        >
          <AccountMetric
            label="Quotes"
            value={
              recordCounts?.quotes || 0
            }
          />

          <AccountMetric
            label="Proposals"
            value={
              recordCounts?.proposals ||
              0
            }
          />

          <AccountMetric
            label="Projects"
            value={
              recordCounts?.projects ||
              activeProjects ||
              0
            }
          />

          <AccountMetric
            label="Tasks"
            value={
              recordCounts?.tasks ||
              pendingTasks ||
              0
            }
          />

          <AccountMetric
            label="Invoices"
            value={
              recordCounts?.invoices ||
              0
            }
          />

          <AccountMetric
            label="Follow-ups"
            value={
              recordCounts?.followUps ||
              0
            }
          />
        </div>
      </section>

      {lead && (
        <section
          className={styles.panel}
        >
          <div
            className={
              styles.panelHeader
            }
          >
            <div>
              <h3>Original lead</h3>

              <p>
                Source CRM opportunity
              </p>
            </div>
          </div>

          <div
            className={
              styles.originalLead
            }
          >
            <div>
              <strong>
                {lead.name ||
                  "Unnamed lead"}
              </strong>

              <p>
                {lead.company ||
                  "No company"}
              </p>
            </div>

            <StatusBadge
              status={
                lead.status || "New"
              }
            />

            <Link
              href={`/leads/${lead.id}`}
              className={
                styles.recordButton
              }
            >
              Open lead
              <span>→</span>
            </Link>
          </div>
        </section>
      )}

      <section
        className={styles.panel}
      >
        <div
          className={styles.panelHeader}
        >
          <div>
            <h3>
              Customer activity
            </h3>

            <p>
              Current relationship timeline
            </p>
          </div>
        </div>

        <div className={styles.timeline}>
          <TimelineItem
            title="Customer created"
            description={formatDateTime(
              customer.created_at
            )}
          />

          <TimelineItem
            title="Customer status"
            description={
              customer.status ||
              "Active"
            }
          />

          <TimelineItem
            title="Active delivery"
            description={`${activeProjects} active project${
              activeProjects === 1
                ? ""
                : "s"
            }`}
          />

          <TimelineItem
            title="Pending actions"
            description={`${pendingTasks} incomplete task${
              pendingTasks === 1
                ? ""
                : "s"
            }`}
          />
        </div>
      </section>
    </div>
  );
}

function RecordsTab({
  title,
  description,
  children,
}) {
  return (
    <section
      className={styles.recordsSection}
    >
      <div
        className={
          styles.recordsSectionHeader
        }
      >
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function RecordsPanel({
  title,
  count,
  children,
}) {
  return (
    <section
      className={styles.recordsPanel}
    >
      <div
        className={
          styles.recordsPanelHeader
        }
      >
        <h3>{title}</h3>
        <span>{count}</span>
      </div>

      {children}
    </section>
  );
}

function RecordsTable({
  headings,
  children,
}) {
  return (
    <div
      className={styles.tableWrapper}
    >
      <table
        className={styles.recordsTable}
      >
        <thead>
          <tr>
            {headings.map(
              (heading) => (
                <th key={heading}>
                  {heading}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function CustomerField({
  label,
  name,
  value,
  onChange,
  disabled,
  type = "text",
}) {
  return (
    <div className={styles.field}>
      <label
        htmlFor={`customer-${name}`}
      >
        {label}
      </label>

      <input
        id={`customer-${name}`}
        name={name}
        type={type}
        value={value || ""}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  href,
  customValue,
}) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>

      {customValue ? (
        customValue
      ) : href && value ? (
        <a href={href}>{value}</a>
      ) : (
        <strong
          className={
            value
              ? ""
              : styles.emptyValue
          }
        >
          {value || "Not available"}
        </strong>
      )}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  warning = false,
}) {
  return (
    <div
      className={`${styles.heroMetric} ${
        warning
          ? styles.heroMetricWarning
          : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FinanceMetric({
  label,
  value,
  positive = false,
  warning = false,
}) {
  return (
    <div
      className={`${styles.financeMetric} ${
        positive
          ? styles.financePositive
          : ""
      } ${
        warning
          ? styles.financeWarning
          : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AccountMetric({
  label,
  value,
}) {
  return (
    <div
      className={styles.accountMetric}
    >
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function HealthBadge({ health }) {
  const className =
    health.tone === "excellent"
      ? styles.healthExcellent
      : health.tone === "attention"
        ? styles.healthAttention
        : styles.healthRisk;

  return (
    <span
      className={`${styles.healthBadge} ${className}`}
    >
      <span
        className={styles.healthDot}
      />

      {health.label}
    </span>
  );
}

function TimelineItem({
  title,
  description,
}) {
  return (
    <div
      className={styles.timelineItem}
    >
      <span
        className={styles.timelineDot}
      />

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function EmptyMessage({ children }) {
  return (
    <div className={styles.emptyState}>
      <span>—</span>
      <p>{children}</p>
    </div>
  );
}

function TabCount({
  tabId,
  counts,
}) {
  const count = counts[tabId];

  if (
    count === undefined ||
    tabId === "overview"
  ) {
    return null;
  }

  return (
    <span
      className={styles.tabCount}
    >
      {count}
    </span>
  );
}

function LoadingState() {
  return (
    <section
      className={styles.loadingPanel}
    >
      {Array.from({
        length: 6,
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
  overdueInvoices,
  pendingTasks,
  activeProjects,
}) {
  const status = normaliseStatus(
    customer.status
  );

  if (
    status === "inactive" ||
    overdueInvoices > 1
  ) {
    return {
      label: "At Risk",
      tone: "risk",
    };
  }

  if (
    status === "on hold" ||
    overdueInvoices === 1 ||
    pendingTasks > 5
  ) {
    return {
      label: "Attention",
      tone: "attention",
    };
  }

  if (
    status === "active" ||
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

function formatDateTime(value) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleString(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}
