"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "../../components/layout/AppLayout";
import StatusBadge from "../../components/StatusBadge";
import ProgressBar from "../../components/ProgressBar";
import ProtectedRoute from "../../components/ProtectedRoute";
import styles from "./dashboard.module.css";

const COMPLETED_STATUSES = ["completed", "complete", "done"];
const PAID_STATUSES = ["paid"];
const OVERDUE_STATUSES = ["overdue", "late"];
const ACTIVE_PROJECT_STATUSES = [
  "active",
  "in progress",
  "in-progress",
  "started",
];

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [aiInsights, setAiInsights] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setErrorMessage("");

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
              insights: "No AI insights are currently available.",
            }),
      ]);

      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      setCustomers(
        Array.isArray(customersData) ? customersData : []
      );
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setAiInsights(
        insightsData?.insights ||
          "No AI insights are currently available."
      );
    } catch (error) {
      console.error("Dashboard loading error:", error);

      setErrorMessage(
        "We could not load all dashboard information. Please refresh and try again."
      );
    } finally {
      setLoading(false);
    }
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
      Number(String(value).replace(/[^0-9.-]/g, "")) || 0
    );
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  function normaliseStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase();
  }

  function isCompleted(status) {
    return COMPLETED_STATUSES.includes(
      normaliseStatus(status)
    );
  }

  function isPaid(status) {
    return PAID_STATUSES.includes(normaliseStatus(status));
  }

  function isOverdue(status) {
    return OVERDUE_STATUSES.includes(
      normaliseStatus(status)
    );
  }

  function isActiveProject(status) {
    const normalisedStatus = normaliseStatus(status);

    if (!normalisedStatus) {
      return true;
    }

    return (
      ACTIVE_PROJECT_STATUSES.includes(normalisedStatus) ||
      !isCompleted(normalisedStatus)
    );
  }

  function getProjectProgress(projectId) {
    const projectTasks = tasks.filter(
      (task) =>
        String(task.project_id) === String(projectId)
    );

    if (projectTasks.length === 0) {
      return 0;
    }

    const completedProjectTasks = projectTasks.filter(
      (task) => isCompleted(task.status)
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
    (total, quote) =>
      total + getMoneyValue(quote.amount),
    0
  );

  const paidInvoices = invoices.filter((invoice) =>
    isPaid(invoice.status)
  );

  const overdueInvoices = invoices.filter((invoice) =>
    isOverdue(invoice.status)
  );

  const pendingInvoices = invoices.filter(
    (invoice) =>
      !isPaid(invoice.status) &&
      !isOverdue(invoice.status)
  );

  const paidRevenue = paidInvoices.reduce(
    (total, invoice) =>
      total + getMoneyValue(invoice.amount),
    0
  );

  const pendingPayments = [...pendingInvoices, ...overdueInvoices].reduce(
    (total, invoice) =>
      total + getMoneyValue(invoice.amount),
    0
  );

  const completedTasks = tasks.filter((task) =>
    isCompleted(task.status)
  ).length;

  const pendingTasks = tasks.filter(
    (task) => !isCompleted(task.status)
  ).length;

  const activeProjects = projects.filter((project) =>
    isActiveProject(project.status)
  );

  const completedProjects = projects.filter((project) =>
    isCompleted(project.status)
  );

  const activeProjectsCount = activeProjects.length;
  const completedProjectsCount = completedProjects.length;

  const taskCompletionRate =
    tasks.length === 0
      ? 0
      : Math.round(
          (completedTasks / tasks.length) * 100
        );

  const invoicePaidRate =
    totalInvoices === 0
      ? 0
      : Math.round(
          (paidInvoices.length / totalInvoices) * 100
        );

  const projectCompletionRate =
    totalProjects === 0
      ? 0
      : Math.round(
          (completedProjectsCount / totalProjects) * 100
        );

  const businessHealthScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        invoicePaidRate * 0.35 +
          taskCompletionRate * 0.3 +
          projectCompletionRate * 0.2 +
          Math.min(totalLeads * 4, 100) * 0.15
      )
    )
  );

  const latestLeads = leads.slice(0, 4);
  const latestQuotes = quotes.slice(0, 4);
  const latestProjects = activeProjects.slice(0, 4);
  const latestTasks = tasks.slice(0, 5);
  const latestInvoices = invoices.slice(0, 5);

  const aiSummaryItems = useMemo(() => {
    const lines = String(aiInsights || "")
      .split("\n")
      .map((line) =>
        line
          .replace(/^[-•*]\s*/, "")
          .replace(/^#+\s*/, "")
          .trim()
      )
      .filter(Boolean)
      .filter(
        (line) =>
          line.length > 18 &&
          !line.toLowerCase().includes("management summary")
      );

    const uniqueLines = [...new Set(lines)];

    if (uniqueLines.length > 0) {
      return uniqueLines.slice(0, 4);
    }

    return [
      `${paidInvoices.length} invoices are currently paid.`,
      `${pendingTasks} tasks still require attention.`,
      `${activeProjectsCount} projects are currently active.`,
      `${totalLeads} leads are available in your pipeline.`,
    ];
  }, [
    aiInsights,
    paidInvoices.length,
    pendingTasks,
    activeProjectsCount,
    totalLeads,
  ]);

  const quoteStatusData = buildStatusData(
    quotes,
    [
      "Draft",
      "Sent",
      "Accepted",
      "Rejected",
    ]
  );

  const revenueChartData = buildMonthlyRevenueData(
    invoices,
    getMoneyValue
  );

  return (
    <ProtectedRoute>
      <AppLayout
        title="Dashboard"
        description="Welcome back. Here is your SaiNal One business overview."
      >
        {loading ? (
          <DashboardLoading />
        ) : errorMessage ? (
          <section className={styles.errorPanel}>
            <div>
              <strong>Dashboard unavailable</strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={fetchDashboardData}
              className={styles.retryButton}
            >
              Try again
            </button>
          </section>
        ) : (
          <div className={styles.dashboard}>
            <section className={styles.executiveHeader}>
              <div>
                <span className={styles.eyebrow}>
                  Executive overview
                </span>

                <h2>Your business at a glance</h2>

                <p>
                  Monitor sales, revenue, delivery and actions
                  requiring attention.
                </p>
              </div>

              <div className={styles.healthCard}>
                <div
                  className={styles.healthRing}
                  style={{
                    "--health-score": `${businessHealthScore * 3.6}deg`,
                  }}
                >
                  <div>
                    <strong>{businessHealthScore}</strong>
                    <span>/100</span>
                  </div>
                </div>

                <div>
                  <span>Business health</span>

                  <strong>
                    {getHealthLabel(businessHealthScore)}
                  </strong>

                  <small>
                    Based on invoices, projects and tasks
                  </small>
                </div>
              </div>
            </section>

            <section className={styles.kpiGrid}>
              <KpiCard
                icon="£"
                label="Paid revenue"
                value={formatCurrency(paidRevenue)}
                supporting={`${paidInvoices.length} paid invoices`}
                tone="gold"
                href="/invoices"
              />

              <KpiCard
                icon="↗"
                label="Sales pipeline"
                value={formatCurrency(pipelineValue)}
                supporting={`${totalQuotes} total quotes`}
                tone="blue"
                href="/quotes"
              />

              <KpiCard
                icon="◎"
                label="Total leads"
                value={totalLeads}
                supporting={`${totalCustomers} customers`}
                tone="purple"
                href="/leads"
              />

              <KpiCard
                icon="▰"
                label="Active projects"
                value={activeProjectsCount}
                supporting={`${completedProjectsCount} completed`}
                tone="green"
                href="/projects"
              />

              <KpiCard
                icon="✓"
                label="Tasks completed"
                value={`${taskCompletionRate}%`}
                supporting={`${pendingTasks} still pending`}
                tone="teal"
                href="/tasks"
              />

              <KpiCard
                icon="!"
                label="Pending payments"
                value={formatCurrency(pendingPayments)}
                supporting={`${overdueInvoices.length} overdue`}
                tone={
                  overdueInvoices.length > 0 ? "red" : "orange"
                }
                href="/invoices"
              />
            </section>

            <section className={styles.primaryChartsGrid}>
              <ChartPanel
                title="Revenue trend"
                description="Paid invoice value during the last six months"
                actionHref="/invoices"
                actionText="View invoices"
              >
                <RevenueLineChart
                  data={revenueChartData}
                  formatCurrency={formatCurrency}
                />
              </ChartPanel>

              <ChartPanel
                title="Sales pipeline"
                description="Quotes grouped by their current status"
                actionHref="/quotes"
                actionText="View quotes"
              >
                <PipelineBarChart data={quoteStatusData} />
              </ChartPanel>
            </section>

            <section className={styles.secondaryChartsGrid}>
              <ChartPanel
                title="Invoice status"
                description={`${totalInvoices} invoices currently recorded`}
                actionHref="/invoices"
                actionText="View invoices"
              >
                <InvoiceDonutChart
                  paid={paidInvoices.length}
                  pending={pendingInvoices.length}
                  overdue={overdueInvoices.length}
                  total={totalInvoices}
                />
              </ChartPanel>

              <ChartPanel
                title="Delivery progress"
                description="Current project and task completion"
                actionHref="/projects"
                actionText="View projects"
              >
                <div className={styles.progressOverview}>
                  <ProgressMetric
                    label="Project completion"
                    value={projectCompletionRate}
                    detail={`${completedProjectsCount} of ${totalProjects} completed`}
                  />

                  <ProgressMetric
                    label="Task completion"
                    value={taskCompletionRate}
                    detail={`${completedTasks} of ${tasks.length} completed`}
                  />

                  <ProgressMetric
                    label="Invoices paid"
                    value={invoicePaidRate}
                    detail={`${paidInvoices.length} of ${totalInvoices} paid`}
                  />
                </div>
              </ChartPanel>

              <section className={styles.aiSummaryCard}>
                <div className={styles.aiSummaryHeader}>
                  <div className={styles.aiIcon}>✦</div>

                  <div>
                    <span>AI Executive Summary</span>
                    <h3>Business priorities</h3>
                  </div>
                </div>

                <div className={styles.aiSummaryList}>
                  {aiSummaryItems.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className={styles.aiSummaryItem}
                    >
                      <span
                        className={`${styles.summaryIndicator} ${
                          index === 0
                            ? styles.summaryIndicatorPositive
                            : index === 1
                              ? styles.summaryIndicatorWarning
                              : styles.summaryIndicatorNeutral
                        }`}
                      />

                      <p>{item}</p>
                    </div>
                  ))}
                </div>

                <Link
                  href="/business-insights"
                  className={styles.insightsButton}
                >
                  View full Business Insights
                  <span>→</span>
                </Link>
              </section>
            </section>

            <section className={styles.activitySection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.eyebrow}>
                    Recent activity
                  </span>

                  <h2>Latest business updates</h2>
                </div>
              </div>

              <div className={styles.activityGrid}>
                <ActivityPanel
                  title="Recent leads"
                  href="/leads"
                >
                  {latestLeads.length === 0 ? (
                    <EmptyState message="No leads yet." />
                  ) : (
                    latestLeads.map((lead) => (
                      <ActivityRow
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        title={lead.name || "Unnamed lead"}
                        description={
                          lead.company || "No company"
                        }
                        status={lead.status}
                      />
                    ))
                  )}
                </ActivityPanel>

                <ActivityPanel
                  title="Recent quotes"
                  href="/quotes"
                >
                  {latestQuotes.length === 0 ? (
                    <EmptyState message="No quotes yet." />
                  ) : (
                    latestQuotes.map((quote) => (
                      <ActivityRow
                        key={quote.id}
                        href={`/quotes/${quote.id}`}
                        title={
                          quote.quote_number || "Quote"
                        }
                        description={`${
                          quote.client || "No client"
                        } · ${formatCurrency(
                          getMoneyValue(quote.amount)
                        )}`}
                        status={quote.status}
                      />
                    ))
                  )}
                </ActivityPanel>

                <ActivityPanel
                  title="Active projects"
                  href="/projects"
                >
                  {latestProjects.length === 0 ? (
                    <EmptyState message="No active projects yet." />
                  ) : (
                    latestProjects.map((project) => (
                      <div
                        key={project.id}
                        className={styles.projectActivityItem}
                      >
                        <div className={styles.activityRowTop}>
                          <div>
                            <Link
                              href={`/projects/${project.id}`}
                              className={styles.activityLink}
                            >
                              {project.project_name ||
                                "Unnamed project"}
                            </Link>

                            <p>
                              {formatCurrency(
                                getMoneyValue(project.amount)
                              )}
                            </p>
                          </div>

                          <StatusBadge
                            status={
                              project.status || "Not Started"
                            }
                          />
                        </div>

                        <ProgressBar
                          value={getProjectProgress(project.id)}
                        />
                      </div>
                    ))
                  )}
                </ActivityPanel>

                <ActivityPanel
                  title="Recent tasks"
                  href="/tasks"
                >
                  {latestTasks.length === 0 ? (
                    <EmptyState message="No tasks yet." />
                  ) : (
                    latestTasks.map((task) => (
                      <ActivityRow
                        key={task.id}
                        title={
                          task.task_name || "Unnamed task"
                        }
                        description={`Due: ${
                          task.due_date || "No due date"
                        }`}
                        status={
                          task.status || "Not Started"
                        }
                      />
                    ))
                  )}
                </ActivityPanel>

                <ActivityPanel
                  title="Recent invoices"
                  href="/invoices"
                  className={styles.wideActivityPanel}
                >
                  {latestInvoices.length === 0 ? (
                    <EmptyState message="No invoices yet." />
                  ) : (
                    latestInvoices.map((invoice) => (
                      <ActivityRow
                        key={invoice.id}
                        href={`/invoices/${invoice.id}`}
                        title={
                          invoice.invoice_number || "Invoice"
                        }
                        description={`${
                          invoice.client || "No client"
                        } · ${formatCurrency(
                          getMoneyValue(invoice.amount)
                        )}`}
                        status={invoice.status || "Pending"}
                      />
                    ))
                  )}
                </ActivityPanel>
              </div>
            </section>
          </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}

function KpiCard({
  icon,
  label,
  value,
  supporting,
  tone,
  href,
}) {
  return (
    <Link
      href={href}
      className={`${styles.kpiCard} ${
        styles[`kpiTone${capitalise(tone)}`] || ""
      }`}
    >
      <div className={styles.kpiTopRow}>
        <span className={styles.kpiIcon}>{icon}</span>
        <span className={styles.kpiArrow}>↗</span>
      </div>

      <p>{label}</p>
      <h3>{value}</h3>
      <small>{supporting}</small>
    </Link>
  );
}

function ChartPanel({
  title,
  description,
  actionHref,
  actionText,
  children,
}) {
  return (
    <section className={styles.chartPanel}>
      <div className={styles.panelHeading}>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        <Link href={actionHref}>{actionText}</Link>
      </div>

      {children}
    </section>
  );
}

function RevenueLineChart({ data, formatCurrency }) {
  const width = 640;
  const height = 230;
  const paddingX = 38;
  const paddingTop = 24;
  const paddingBottom = 42;

  const maximumValue = Math.max(
    ...data.map((item) => item.value),
    1
  );

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((item, index) => {
    const x =
      paddingX +
      (index / Math.max(data.length - 1, 1)) * chartWidth;

    const y =
      paddingTop +
      chartHeight -
      (item.value / maximumValue) * chartHeight;

    return {
      ...item,
      x,
      y,
    };
  });

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${
          points[points.length - 1].x
        } ${paddingTop + chartHeight} L ${
          points[0].x
        } ${paddingTop + chartHeight} Z`
      : "";

  return (
    <div className={styles.lineChart}>
      <div className={styles.chartTotal}>
        <span>Six-month revenue</span>
        <strong>
          {formatCurrency(
            data.reduce(
              (total, item) => total + item.value,
              0
            )
          )}
        </strong>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Revenue trend chart"
        className={styles.lineChartSvg}
      >
        <defs>
          <linearGradient
            id="revenueArea"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="currentColor"
              stopOpacity="0.24"
            />
            <stop
              offset="100%"
              stopColor="currentColor"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((line) => {
          const y =
            paddingTop +
            (line / 3) * chartHeight;

          return (
            <line
              key={line}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              className={styles.chartGridLine}
            />
          );
        })}

        {areaPath && (
          <path
            d={areaPath}
            fill="url(#revenueArea)"
            className={styles.chartArea}
          />
        )}

        {linePath && (
          <path
            d={linePath}
            fill="none"
            className={styles.chartLine}
          />
        )}

        {points.map((point) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              className={styles.chartPoint}
            />

            <text
              x={point.x}
              y={height - 14}
              textAnchor="middle"
              className={styles.chartLabel}
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PipelineBarChart({ data }) {
  const maximumValue = Math.max(
    ...data.map((item) => item.value),
    1
  );

  return (
    <div className={styles.pipelineChart}>
      {data.map((item) => {
        const width =
          item.value === 0
            ? 4
            : Math.max(
                (item.value / maximumValue) * 100,
                8
              );

        return (
          <div
            className={styles.pipelineRow}
            key={item.label}
          >
            <div className={styles.pipelineLabel}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>

            <div className={styles.pipelineTrack}>
              <div
                className={styles.pipelineFill}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InvoiceDonutChart({
  paid,
  pending,
  overdue,
  total,
}) {
  const safeTotal = Math.max(total, 1);
  const paidPercentage = (paid / safeTotal) * 100;
  const pendingPercentage =
    (pending / safeTotal) * 100;

  const donutBackground =
    total === 0
      ? "#ece9df"
      : `conic-gradient(
          #3f8f67 0% ${paidPercentage}%,
          #d3a42c ${paidPercentage}% ${
            paidPercentage + pendingPercentage
          }%,
          #b95050 ${
            paidPercentage + pendingPercentage
          }% 100%
        )`;

  return (
    <div className={styles.donutLayout}>
      <div
        className={styles.donutChart}
        style={{ background: donutBackground }}
      >
        <div className={styles.donutCentre}>
          <strong>{total}</strong>
          <span>Invoices</span>
        </div>
      </div>

      <div className={styles.donutLegend}>
        <LegendItem
          label="Paid"
          value={paid}
          type="paid"
        />

        <LegendItem
          label="Pending"
          value={pending}
          type="pending"
        />

        <LegendItem
          label="Overdue"
          value={overdue}
          type="overdue"
        />
      </div>
    </div>
  );
}

function LegendItem({ label, value, type }) {
  return (
    <div className={styles.legendItem}>
      <span
        className={`${styles.legendDot} ${
          styles[`legend${capitalise(type)}`]
        }`}
      />

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ProgressMetric({ label, value, detail }) {
  return (
    <div className={styles.progressMetric}>
      <div className={styles.progressMetricHeader}>
        <div>
          <strong>{label}</strong>
          <span>{detail}</span>
        </div>

        <strong>{value}%</strong>
      </div>

      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ActivityPanel({
  title,
  href,
  children,
  className = "",
}) {
  return (
    <section
      className={`${styles.activityPanel} ${className}`}
    >
      <div className={styles.activityPanelHeader}>
        <h3>{title}</h3>

        <Link href={href}>View all</Link>
      </div>

      <div className={styles.activityPanelContent}>
        {children}
      </div>
    </section>
  );
}

function ActivityRow({
  href,
  title,
  description,
  status,
}) {
  const titleContent = href ? (
    <Link href={href} className={styles.activityLink}>
      {title}
    </Link>
  ) : (
    <strong className={styles.activityTitle}>
      {title}
    </strong>
  );

  return (
    <div className={styles.activityRow}>
      <div>
        {titleContent}
        <p>{description}</p>
      </div>

      {status && <StatusBadge status={status} />}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className={styles.emptyState}>
      <span>—</span>
      <p>{message}</p>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className={styles.loadingDashboard}>
      <div className={styles.loadingHero} />

      <div className={styles.loadingCards}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={styles.loadingCard}
          />
        ))}
      </div>

      <div className={styles.loadingCharts}>
        <div />
        <div />
      </div>
    </div>
  );
}

function buildStatusData(items, expectedStatuses) {
  return expectedStatuses.map((expectedStatus) => {
    const value = items.filter(
      (item) =>
        normaliseText(item.status) ===
        normaliseText(expectedStatus)
    ).length;

    return {
      label: expectedStatus,
      value,
    };
  });
}

function buildMonthlyRevenueData(
  invoices,
  getMoneyValue
) {
  const months = [];

  const today = new Date();

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() - index,
      1
    );

    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleDateString("en-GB", {
        month: "short",
      }),
      value: 0,
    });
  }

  invoices.forEach((invoice) => {
    const dateValue =
      invoice.paid_date ||
      invoice.invoice_date ||
      invoice.created_at;

    if (!dateValue || !isPaidStatus(invoice.status)) {
      return;
    }

    const invoiceDate = new Date(dateValue);

    if (Number.isNaN(invoiceDate.getTime())) {
      return;
    }

    const matchingMonth = months.find(
      (month) =>
        month.year === invoiceDate.getFullYear() &&
        month.month === invoiceDate.getMonth()
    );

    if (matchingMonth) {
      matchingMonth.value += getMoneyValue(
        invoice.amount
      );
    }
  });

  return months;
}

function normaliseText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isPaidStatus(status) {
  return normaliseText(status) === "paid";
}

function getHealthLabel(score) {
  if (score >= 80) {
    return "Strong";
  }

  if (score >= 60) {
    return "Healthy";
  }

  if (score >= 40) {
    return "Needs attention";
  }

  return "At risk";
}

function capitalise(value) {
  const text = String(value || "");

  return text.charAt(0).toUpperCase() + text.slice(1);
}
