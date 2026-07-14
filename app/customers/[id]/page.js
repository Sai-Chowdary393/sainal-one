"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString(
    "en-GB"
  );
}

function EmptyMessage({ children }) {
  return (
    <p className="helperText">
      {children}
    </p>
  );
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const customerId = params.id;

  const [data, setData] = useState(null);
  const [draftCustomer, setDraftCustomer] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [startingProject, setStartingProject] =
    useState(false);

  useEffect(() => {
    fetchCustomerDetails();
  }, [customerId]);

  async function fetchCustomerDetails() {
    try {
      const response = await fetch(
        `/api/customers/${customerId}`
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        alert(
          responseData.error ||
            "Failed to load customer."
        );

        return;
      }

      setData(responseData);
      setDraftCustomer(
        responseData.customer
      );
    } catch (error) {
      console.error(error);
      alert(
        "Error loading customer details."
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
      !draftCustomer.customer_name?.trim()
    ) {
      alert("Customer name is required.");
      return;
    }

    setSaving(true);

    try {
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
              draftCustomer.customer_name,
            company:
              draftCustomer.company,
            email: draftCustomer.email,
            phone: draftCustomer.phone,
            status: draftCustomer.status,
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        alert(
          responseData.error ||
            "Failed to save customer."
        );

        return;
      }

      setData((currentData) => ({
        ...currentData,
        customer: responseData,
      }));

      setDraftCustomer(responseData);
      setEditing(false);

      alert(
        "Customer updated successfully."
      );
    } catch (error) {
      console.error(error);
      alert("Error saving customer.");
    } finally {
      setSaving(false);
    }
  }

  async function startProject() {
    const customer = data.customer;
    const quotes = data.quotes || [];
    const projects = data.projects || [];

    if (projects.length > 0) {
      alert(
        "A project already exists for this customer."
      );
      return;
    }

    if (quotes.length === 0) {
      alert(
        "No quote was found for this customer. Create a quote first."
      );
      return;
    }

    const acceptedQuote =
      quotes.find((quote) =>
        String(quote.status || "")
          .toLowerCase()
          .includes("accepted")
      ) || quotes[0];

    setStartingProject(true);

    try {
      const response = await fetch(
        "/api/projects",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            customer_id: customer.id,
            quote_id: acceptedQuote.id,

            project_name: `${
              customer.company ||
              customer.customer_name
            } - ${
              acceptedQuote.service ||
              "Project"
            }`,

            description: `Project created from quote ${
              acceptedQuote.quote_number ||
              acceptedQuote.id
            }.`,

            status: "Planning",

            start_date: new Date()
              .toISOString()
              .split("T")[0],

            due_date: null,

            amount:
              acceptedQuote.amount ||
              "To be confirmed",
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        alert(
          responseData.error ||
            "Failed to start project."
        );
        return;
      }

      alert(
        "Project started successfully."
      );

      await fetchCustomerDetails();
    } catch (error) {
      console.error(error);
      alert("Error starting project.");
    } finally {
      setStartingProject(false);
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <p>Loading customer...</p>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!data?.customer) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <Link
              href="/customers"
              className="backLink"
            >
              ← Back to Customers
            </Link>

            <h1>Customer not found</h1>
          </main>
        </div>
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

  const visibleCustomer = editing
    ? draftCustomer
    : customer;

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <Link
            href="/customers"
            className="backLink"
          >
            ← Back to Customers
          </Link>

          <div className="topBar">
            <div>
              <h1>
                {visibleCustomer.customer_name}
              </h1>

              <p className="helperText">
                {visibleCustomer.company ||
                  "Individual customer"}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {!editing ? (
                <button
                  type="button"
                  className="primaryBtn"
                  onClick={startEditing}
                >
                  Edit Customer
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="primaryBtn"
                    disabled={saving}
                    onClick={saveCustomer}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Customer"}
                  </button>

                  <button
                    type="button"
                    className="primaryBtn"
                    disabled={saving}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                </>
              )}

              <button
                type="button"
                className="primaryBtn"
                disabled={
                  startingProject ||
                  projects.length > 0
                }
                onClick={startProject}
              >
                {startingProject
                  ? "Starting..."
                  : projects.length > 0
                  ? "Project Exists"
                  : "Start Project"}
              </button>
            </div>
          </div>

          <section className="detailsGrid">
            <div className="panel">
              <h3>Customer Information</h3>

              <div className="settingsGrid">
                <label>
                  Customer Name

                  <input
                    name="customer_name"
                    value={
                      visibleCustomer.customer_name ||
                      ""
                    }
                    disabled={!editing || saving}
                    onChange={
                      handleCustomerChange
                    }
                  />
                </label>

                <label>
                  Company

                  <input
                    name="company"
                    value={
                      visibleCustomer.company || ""
                    }
                    disabled={!editing || saving}
                    onChange={
                      handleCustomerChange
                    }
                  />
                </label>

                <label>
                  Email

                  <input
                    name="email"
                    type="email"
                    value={
                      visibleCustomer.email || ""
                    }
                    disabled={!editing || saving}
                    onChange={
                      handleCustomerChange
                    }
                  />
                </label>

                <label>
                  Phone

                  <input
                    name="phone"
                    value={
                      visibleCustomer.phone || ""
                    }
                    disabled={!editing || saving}
                    onChange={
                      handleCustomerChange
                    }
                  />
                </label>

                <label>
                  Status

                  <select
                    name="status"
                    value={
                      visibleCustomer.status ||
                      "Active"
                    }
                    disabled={!editing || saving}
                    onChange={
                      handleCustomerChange
                    }
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Prospect</option>
                    <option>On Hold</option>
                  </select>
                </label>

                <label>
                  Created

                  <input
                    value={formatDate(
                      customer.created_at
                    )}
                    disabled
                  />
                </label>
              </div>
            </div>

            <div className="panel">
              <h3>AI Customer Summary</h3>

              <p>{summary?.overview}</p>

              <h4>Recommended Actions</h4>

              {summary?.recommendations?.map(
                (recommendation, index) => (
                  <p key={index}>
                    • {recommendation}
                  </p>
                )
              )}
            </div>
          </section>

          <section
            className="detailsGrid"
            style={{
              marginTop: "20px",
            }}
          >
            <div className="panel">
              <h3>Total Invoiced</h3>

              <h2>
                {
                  financialSummary.totalInvoicedFormatted
                }
              </h2>
            </div>

            <div className="panel">
              <h3>Paid</h3>

              <h2>
                {
                  financialSummary.totalPaidFormatted
                }
              </h2>
            </div>

            <div className="panel">
              <h3>Outstanding</h3>

              <h2>
                {
                  financialSummary.outstandingFormatted
                }
              </h2>
            </div>
          </section>

          <section className="panel">
            <h3>Account Overview</h3>

            <div className="settingsGrid">
              <p>
                <strong>Quotes:</strong>{" "}
                {recordCounts.quotes}
              </p>

              <p>
                <strong>Proposals:</strong>{" "}
                {recordCounts.proposals}
              </p>

              <p>
                <strong>Projects:</strong>{" "}
                {recordCounts.projects}
              </p>

              <p>
                <strong>Tasks:</strong>{" "}
                {recordCounts.tasks}
              </p>

              <p>
                <strong>Invoices:</strong>{" "}
                {recordCounts.invoices}
              </p>

              <p>
                <strong>Follow-ups:</strong>{" "}
                {recordCounts.followUps}
              </p>
            </div>
          </section>

          {lead && (
            <section className="panel">
              <h3>Original Lead</h3>

              <p>
                <strong>Name:</strong>{" "}
                {lead.name}
              </p>

              <p>
                <strong>Company:</strong>{" "}
                {lead.company}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                <StatusBadge
                  status={lead.status}
                />
              </p>

              <Link
                href={`/leads/${lead.id}`}
                className="leadLink"
              >
                View original lead
              </Link>
            </section>
          )}

          <section className="panel">
            <h3>Quotes</h3>

            {quotes.length === 0 ? (
              <EmptyMessage>
                No quotes found for this customer.
              </EmptyMessage>
            ) : (
              <table className="leadTable">
                <thead>
                  <tr>
                    <th>Quote</th>
                    <th>Service</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td>
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="leadLink"
                        >
                          {quote.quote_number ||
                            "Quote"}
                        </Link>
                      </td>

                      <td>
                        {quote.service || "-"}
                      </td>

                      <td>
                        {quote.amount || "-"}
                      </td>

                      <td>
                        <StatusBadge
                          status={quote.status}
                        />
                      </td>

                      <td>
                        {formatDate(
                          quote.created_at
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h3>Proposals</h3>

            {proposals.length === 0 ? (
              <EmptyMessage>
                No proposals found for this customer.
              </EmptyMessage>
            ) : (
              <table className="leadTable">
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Service</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {proposals.map(
                    (proposal) => (
                      <tr key={proposal.id}>
                        <td>
                          <Link
                            href={`/proposals/${proposal.id}`}
                            className="leadLink"
                          >
                            {proposal.proposal_number ||
                              "Proposal"}
                          </Link>
                        </td>

                        <td>
                          {proposal.service || "-"}
                        </td>

                        <td>
                          {proposal.amount || "-"}
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              proposal.status
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
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h3>Projects</h3>

            {projects.length === 0 ? (
              <EmptyMessage>
                No projects found for this customer.
              </EmptyMessage>
            ) : (
              <table className="leadTable">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Start Date</th>
                    <th>Due Date</th>
                  </tr>
                </thead>

                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <Link
                          href={`/projects/${project.id}`}
                          className="leadLink"
                        >
                          {project.project_name}
                        </Link>
                      </td>

                      <td>
                        <StatusBadge
                          status={project.status}
                        />
                      </td>

                      <td>
                        {project.amount || "-"}
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
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h3>Tasks</h3>

            {tasks.length === 0 ? (
              <EmptyMessage>
                No project tasks found.
              </EmptyMessage>
            ) : (
              <table className="leadTable">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        {task.task_name}
                      </td>

                      <td>
                        <StatusBadge
                          status={task.status}
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
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h3>Invoices</h3>

            {invoices.length === 0 ? (
              <EmptyMessage>
                No invoices found for this customer.
              </EmptyMessage>
            ) : (
              <table className="leadTable">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Service</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Due Date</th>
                  </tr>
                </thead>

                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="leadLink"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </td>

                      <td>
                        {invoice.service || "-"}
                      </td>

                      <td>
                        {invoice.total_amount ||
                          invoice.amount ||
                          "-"}
                      </td>

                      <td>
                        <StatusBadge
                          status={invoice.status}
                        />
                      </td>

                      <td>
                        {formatDate(
                          invoice.due_date
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h3>Follow-ups</h3>

            {followUps.length === 0 ? (
              <EmptyMessage>
                No follow-ups found for this customer.
              </EmptyMessage>
            ) : (
              <table className="leadTable">
                <thead>
                  <tr>
                    <th>Follow-up</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Note</th>
                  </tr>
                </thead>

                <tbody>
                  {followUps.map(
                    (followUp) => (
                      <tr key={followUp.id}>
                        <td>
                          {followUp.title}
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              followUp.status
                            }
                          />
                        </td>

                        <td>
                          {formatDate(
                            followUp.due_date
                          )}
                        </td>

                        <td>
                          {followUp.note || "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
