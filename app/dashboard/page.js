"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
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
        fetch("/api/business-insights"),
      ]);

      const leadsData = await leadsResponse.json();
      const quotesData = await quotesResponse.json();
      const customersData = await customersResponse.json();
      const projectsData = await projectsResponse.json();
      const tasksData = await tasksResponse.json();
      const invoicesData = await invoicesResponse.json();
      const insightsData = await insightsResponse.json();

      setLeads(leadsData || []);
      setQuotes(quotesData || []);
      setCustomers(customersData || []);
      setProjects(projectsData || []);
      setTasks(tasksData || []);
      setInvoices(invoicesData || []);
      setAiInsights(insightsData.insights || "No AI insights available.");
    } catch (error) {
      console.error(error);
      alert("Error loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  function getMoneyValue(value) {
    if (!value) return 0;
    return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
  }

  function getProjectProgress(projectId) {
    const projectTasks = tasks.filter(
      (task) => String(task.project_id) === String(projectId)
    );

    if (projectTasks.length === 0) return 0;

    const completedTasks = projectTasks.filter(
      (task) => task.status === "Completed"
    ).length;

    return Math.round((completedTasks / projectTasks.length) * 100);
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

  const paidInvoices = invoices.filter((invoice) => invoice.status === "Paid");
  const pendingInvoices = invoices.filter((invoice) => invoice.status !== "Paid");

  const paidRevenue = paidInvoices.reduce(
    (total, invoice) => total + getMoneyValue(invoice.amount),
    0
  );

  const pendingPayments = pendingInvoices.reduce(
    (total, invoice) => total + getMoneyValue(invoice.amount),
    0
  );

  const completedTasks = tasks.filter((task) => task.status === "Completed").length;
  const pendingTasks = tasks.filter((task) => task.status !== "Completed").length;

  const activeProjects = projects.filter(
    (project) => project.status !== "Completed"
  ).length;

  const completedProjects = projects.filter(
    (project) => project.status === "Completed"
  ).length;

  const latestLeads = leads.slice(0, 4);
  const latestQuotes = quotes.slice(0, 4);
  const latestProjects = projects.slice(0, 4);
  const latestTasks = tasks.slice(0, 5);
  const latestInvoices = invoices.slice(0, 5);

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <div className="topBar">
            <div>
              <h1>Dashboard</h1>
              <p className="helperText">
                Welcome back. Here is your SaiNal One business overview.
              </p>
            </div>

            <input
              className="searchBox"
              placeholder="Search leads, customers, projects..."
            />
          </div>

          {loading ? (
            <p>Loading dashboard...</p>
          ) : (
            <>
              <section className="panel dashboardActivity">
                <h3>🤖 AI Operations Manager</h3>
                <p className="helperText">
                  Actionable business insights based on your leads, quotes,
                  projects, invoices and follow-ups.
                </p>

                <pre className="quotePreview">{aiInsights}</pre>
              </section>

              <section className="dashboardCards">
                <div className="statCard">
                  <p>Total Leads</p>
                  <h2>{totalLeads}</h2>
                </div>

                <div className="statCard">
                  <p>Total Quotes</p>
                  <h2>{totalQuotes}</h2>
                </div>

                <div className="statCard">
                  <p>Customers</p>
                  <h2>{totalCustomers}</h2>
                </div>

                <div className="statCard">
                  <p>Projects</p>
                  <h2>{totalProjects}</h2>
                </div>
              </section>

              <section className="dashboardCards secondaryStats">
                <div className="statCard">
                  <p>Pipeline Value</p>
                  <h2>£{pipelineValue.toLocaleString("en-GB")}</h2>
                </div>

                <div className="statCard">
                  <p>Total Invoices</p>
                  <h2>{totalInvoices}</h2>
                </div>

                <div className="statCard">
                  <p>Paid Revenue</p>
                  <h2>£{paidRevenue.toLocaleString("en-GB")}</h2>
                </div>

                <div className="statCard">
                  <p>Pending Payments</p>
                  <h2>£{pendingPayments.toLocaleString("en-GB")}</h2>
                </div>
              </section>

              <section className="dashboardCards secondaryStats">
                <div className="statCard">
                  <p>Active Projects</p>
                  <h2>{activeProjects}</h2>
                </div>

                <div className="statCard">
                  <p>Completed Projects</p>
                  <h2>{completedProjects}</h2>
                </div>

                <div className="statCard">
                  <p>Pending Tasks</p>
                  <h2>{pendingTasks}</h2>
                </div>

                <div className="statCard">
                  <p>Paid Invoices</p>
                  <h2>{paidInvoices.length}</h2>
                </div>
              </section>

              <section className="dashboardGrid">
                <div className="panel">
                  <h3>Recent Leads</h3>

                  {latestLeads.length === 0 ? (
                    <p>No leads yet.</p>
                  ) : (
                    latestLeads.map((lead) => (
                      <p key={lead.id}>
                        <Link href={`/leads/${lead.id}`} className="leadLink">
                          {lead.name}
                        </Link>{" "}
                        - {lead.company}
                      </p>
                    ))
                  )}
                </div>

                <div className="panel">
                  <h3>Recent Quotes</h3>

                  {latestQuotes.length === 0 ? (
                    <p>No quotes yet.</p>
                  ) : (
                    latestQuotes.map((quote) => (
                      <p key={quote.id}>
                        <Link href={`/quotes/${quote.id}`} className="leadLink">
                          {quote.quote_number || "Quote"}
                        </Link>{" "}
                        - {quote.client} - {quote.amount}
                      </p>
                    ))
                  )}
                </div>
              </section>

              <section className="dashboardGrid">
                <div className="panel">
                  <h3>Active Projects</h3>

                  {latestProjects.length === 0 ? (
                    <p>No projects yet.</p>
                  ) : (
                    latestProjects.map((project) => (
                      <div key={project.id} className="dashboardProjectItem">
                        <div>
                          <Link
                            href={`/projects/${project.id}`}
                            className="leadLink"
                          >
                            {project.project_name}
                          </Link>
                          <p className="helperText">{project.amount}</p>
                        </div>

                        <StatusBadge status={project.status} />
                        <ProgressBar value={getProjectProgress(project.id)} />
                      </div>
                    ))
                  )}
                </div>

                <div className="panel">
                  <h3>Recent Tasks</h3>

                  {latestTasks.length === 0 ? (
                    <p>No tasks yet.</p>
                  ) : (
                    latestTasks.map((task) => (
                      <div key={task.id} className="taskRow">
                        <div>
                          <strong>{task.task_name}</strong>
                          <p className="helperText">
                            Due: {task.due_date || "No due date"}
                          </p>
                        </div>

                        <StatusBadge status={task.status} />
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="dashboardGrid">
                <div className="panel">
                  <h3>Recent Invoices</h3>

                  {latestInvoices.length === 0 ? (
                    <p>No invoices yet.</p>
                  ) : (
                    latestInvoices.map((invoice) => (
                      <div key={invoice.id} className="taskRow">
                        <div>
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="leadLink"
                          >
                            {invoice.invoice_number}
                          </Link>
                          <p className="helperText">
                            {invoice.client} - {invoice.amount}
                          </p>
                        </div>

                        <StatusBadge status={invoice.status} />
                      </div>
                    ))
                  )}
                </div>

                <div className="panel">
                  <h3>Finance Summary</h3>

                  <div className="activityGrid">
                    <div>
                      <strong>{totalInvoices}</strong>
                      <p>Total Invoices</p>
                    </div>

                    <div>
                      <strong>{paidInvoices.length}</strong>
                      <p>Paid</p>
                    </div>

                    <div>
                      <strong>{pendingInvoices.length}</strong>
                      <p>Pending</p>
                    </div>

                    <div>
                      <strong>£{paidRevenue.toLocaleString("en-GB")}</strong>
                      <p>Revenue</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel dashboardActivity">
                <h3>Business Activity</h3>

                <div className="activityGrid">
                  <div>
                    <strong>{completedTasks}</strong>
                    <p>Tasks Completed</p>
                  </div>

                  <div>
                    <strong>{pendingTasks}</strong>
                    <p>Tasks Pending</p>
                  </div>

                  <div>
                    <strong>{activeProjects}</strong>
                    <p>Projects Running</p>
                  </div>

                  <div>
                    <strong>£{pipelineValue.toLocaleString("en-GB")}</strong>
                    <p>Total Quote Pipeline</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
