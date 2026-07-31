"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../../components/layout/AppLayout";
import StatusBadge from "../../components/StatusBadge";
import ProgressBar from "../../components/ProgressBar";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [aiInsights, setAiInsights] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      const [
        leadsResponse,
        quotesResponse,
        customersResponse,
        projectsResponse,
        tasksResponse,
        invoicesResponse,
        insightsResponse,
      ] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/quotes"),
        fetch("/api/customers"),
        fetch("/api/projects"),
        fetch("/api/tasks"),
        fetch("/api/invoices"),
        fetch("/api/ai-insights"),
      ]);

      if (
        !leadsResponse.ok ||
        !quotesResponse.ok ||
        !customersResponse.ok ||
        !projectsResponse.ok ||
        !tasksResponse.ok ||
        !invoicesResponse.ok
      ) {
        throw new Error("One or more dashboard requests failed.");
      }

      const [
        leadsData,
        quotesData,
        customersData,
        projectsData,
        tasksData,
        invoicesData,
        insightsData,
      ] = await Promise.all([
        leadsResponse.json(),
        quotesResponse.json(),
        customersResponse.json(),
        projectsResponse.json(),
        tasksResponse.json(),
        invoicesResponse.json(),
        insightsResponse.ok
          ? insightsResponse.json()
          : Promise.resolve({
              insights: "No AI insights available.",
            }),
      ]);

      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);

      setAiInsights(
        insightsData?.insights || "No AI insights available."
      );
    } catch (error) {
      console.error("Dashboard loading error:", error);
      alert("Error loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  function getMoneyValue(value) {
    if (value === null || value === undefined || value === "") {
      return 0;
    }

    return Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function getProjectProgress(projectId) {
    const projectTasks = tasks.filter(
      (task) => String(task.project_id) === String(projectId)
    );

    if (projectTasks.length === 0) {
      return 0;
    }

    const completedProjectTasks = projectTasks.filter(
      (task) => task.status === "Completed"
    ).length;

    return Math.round(
      (completedProjectTasks / projectTasks.length) * 100
    );
  }

  const totalLeads = leads.length;
  const totalQuotes = quotes.length;
  const totalCustomers = customers.length;
  const totalProjects = projects.length;
  const totalInvoices = invoices.length;

  const pipelineValue = quotes.reduce(
    (total, quote) => total + getMoneyValue(quote.amount),
    0
  );

  const paidInvoices = invoices.filter(
    (invoice) => invoice.status === "Paid"
  );

  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status !== "Paid"
  );

  const paidRevenue = paidInvoices.reduce(
    (total, invoice) => total + getMoneyValue(invoice.amount),
    0
  );

  const pendingPayments = pendingInvoices.reduce(
    (total, invoice) => total + getMoneyValue(invoice.amount),
    0
  );

  const completedTasks = tasks.filter(
    (task) => task.status === "Completed"
  ).length;

  const pendingTasks = tasks.filter(
    (task) => task.status !== "Completed"
  ).length;

  const activeProjects = projects.filter(
    (project) => project.status !== "Completed"
  ).length;

  const completedProjects = projects.filter(
    (project) => project.status === "Completed"
  ).length;

  const latestLeads = leads.slice(0, 4);
  const latestQuotes = quotes.slice(0, 4);
  const latestProjects = projects
    .filter((project) => project.status !== "Completed")
    .slice(0, 4);
  const latestTasks = tasks.slice(0, 5);
  const latestInvoices = invoices.slice(0, 5);

  return (
    <ProtectedRoute>
      <AppLayout
        title="Dashboard"
        description="Welcome back. Here is your SaiNal One business overview."
      >
        {loading ? (
          <section className="panel">
            <p>Loading dashboard...</p>
          </section>
        ) : (
          <>
            <section className="panel">
              <h3>AI Business Insights</h3>

              <p className="helperText">
                Today&apos;s management summary across revenue, leads,
                invoices, projects and follow-ups.
              </p>

              <div className="aiInsightBox">
                {String(aiInsights)
                  .split("\n")
                  .filter((line) => line.trim())
                  .map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
              </div>
            </section>

            <section className="dashboardCards secondaryStats">
              <DashboardStatCard
                label="Total Leads"
                value={totalLeads}
              />

              <DashboardStatCard
                label="Total Quotes"
                value={totalQuotes}
              />

              <DashboardStatCard
                label="Customers"
                value={totalCustomers}
              />

              <DashboardStatCard
                label="Projects"
                value={totalProjects}
              />
            </section>

            <section className="dashboardCards secondaryStats">
              <DashboardStatCard
                label="Pipeline Value"
                value={formatCurrency(pipelineValue)}
              />

              <DashboardStatCard
                label="Total Invoices"
                value={totalInvoices}
              />

              <DashboardStatCard
                label="Paid Revenue"
                value={formatCurrency(paidRevenue)}
              />

              <DashboardStatCard
                label="Pending Payments"
                value={formatCurrency(pendingPayments)}
              />
            </section>

            <section className="dashboardCards secondaryStats">
              <DashboardStatCard
                label="Active Projects"
                value={activeProjects}
              />

              <DashboardStatCard
                label="Completed Projects"
                value={completedProjects}
              />

              <DashboardStatCard
                label="Pending Tasks"
                value={pendingTasks}
              />

              <DashboardStatCard
                label="Paid Invoices"
                value={paidInvoices.length}
              />
            </section>

            <section className="dashboardGrid">
              <div className="panel">
                <PanelHeader
                  title="Recent Leads"
                  href="/leads"
                  linkText="View all"
                />

                {latestLeads.length === 0 ? (
                  <EmptyState message="No leads yet." />
                ) : (
                  latestLeads.map((lead) => (
                    <div key={lead.id} className="taskRow">
                      <div>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="leadLink"
                        >
                          {lead.name || "Unnamed lead"}
                        </Link>

                        <p className="helperText">
                          {lead.company || "No company"}
                        </p>
                      </div>

                      {lead.status && (
                        <StatusBadge status={lead.status} />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="panel">
                <PanelHeader
                  title="Recent Quotes"
                  href="/quotes"
                  linkText="View all"
                />

                {latestQuotes.length === 0 ? (
                  <EmptyState message="No quotes yet." />
                ) : (
                  latestQuotes.map((quote) => (
                    <div key={quote.id} className="taskRow">
                      <div>
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="leadLink"
                        >
                          {quote.quote_number || "Quote"}
                        </Link>

                        <p className="helperText">
                          {quote.client || "No client"} ·{" "}
                          {quote.amount || formatCurrency(0)}
                        </p>
                      </div>

                      {quote.status && (
                        <StatusBadge status={quote.status} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="dashboardGrid">
              <div className="panel">
                <PanelHeader
                  title="Active Projects"
                  href="/projects"
                  linkText="View all"
                />

                {latestProjects.length === 0 ? (
                  <EmptyState message="No active projects yet." />
                ) : (
                  latestProjects.map((project) => (
                    <div
                      key={project.id}
                      className="dashboardProjectItem"
                    >
                      <div>
                        <Link
                          href={`/projects/${project.id}`}
                          className="leadLink"
                        >
                          {project.project_name || "Unnamed project"}
                        </Link>

                        <p className="helperText">
                          {project.amount || "No project value"}
                        </p>
                      </div>

                      <StatusBadge
                        status={project.status || "Not Started"}
                      />

                      <ProgressBar
                        value={getProjectProgress(project.id)}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="panel">
                <PanelHeader
                  title="Recent Tasks"
                  href="/tasks"
                  linkText="View all"
                />

                {latestTasks.length === 0 ? (
                  <EmptyState message="No tasks yet." />
                ) : (
                  latestTasks.map((task) => (
                    <div key={task.id} className="taskRow">
                      <div>
                        <strong>
                          {task.task_name || "Unnamed task"}
                        </strong>

                        <p className="helperText">
                          Due: {task.due_date || "No due date"}
                        </p>
                      </div>

                      <StatusBadge
                        status={task.status || "Not Started"}
                      />
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="dashboardGrid">
              <div className="panel">
                <PanelHeader
                  title="Recent Invoices"
                  href="/invoices"
                  linkText="View all"
                />

                {latestInvoices.length === 0 ? (
                  <EmptyState message="No invoices yet." />
                ) : (
                  latestInvoices.map((invoice) => (
                    <div key={invoice.id} className="taskRow">
                      <div>
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="leadLink"
                        >
                          {invoice.invoice_number || "Invoice"}
                        </Link>

                        <p className="helperText">
                          {invoice.client || "No client"} ·{" "}
                          {invoice.amount || formatCurrency(0)}
                        </p>
                      </div>

                      <StatusBadge
                        status={invoice.status || "Pending"}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="panel">
                <h3>Finance Summary</h3>

                <div className="activityGrid">
                  <ActivityItem
                    value={totalInvoices}
                    label="Total Invoices"
                  />

                  <ActivityItem
                    value={paidInvoices.length}
                    label="Paid"
                  />

                  <ActivityItem
                    value={pendingInvoices.length}
                    label="Pending"
                  />

                  <ActivityItem
                    value={formatCurrency(paidRevenue)}
                    label="Revenue"
                  />
                </div>
              </div>
            </section>

            <section className="panel dashboardActivity">
              <h3>Business Activity</h3>

              <div className="activityGrid">
                <ActivityItem
                  value={completedTasks}
                  label="Tasks Completed"
                />

                <ActivityItem
                  value={pendingTasks}
                  label="Tasks Pending"
                />

                <ActivityItem
                  value={activeProjects}
                  label="Projects Running"
                />

                <ActivityItem
                  value={formatCurrency(pipelineValue)}
                  label="Total Quote Pipeline"
                />
              </div>
            </section>
          </>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}

function DashboardStatCard({ label, value }) {
  return (
    <div className="statCard">
      <p>{label}</p>
      <h2>{value}</h2>
    </div>
  );
}

function ActivityItem({ value, label }) {
  return (
    <div>
      <strong>{value}</strong>
      <p>{label}</p>
    </div>
  );
}

function PanelHeader({ title, href, linkText }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "12px",
      }}
    >
      <h3 style={{ margin: 0 }}>{title}</h3>

      <Link href={href} className="leadLink">
        {linkText}
      </Link>
    </div>
  );
}

function EmptyState({ message }) {
  return <p className="helperText">{message}</p>;
}
