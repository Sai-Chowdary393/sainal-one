"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import styles from "./business-insights.module.css";

const PAID_STATUSES = ["paid"];
const COMPLETED_STATUSES = ["completed", "complete", "done"];
const OVERDUE_STATUSES = ["overdue", "late"];

export default function BusinessInsightsPage() {
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [aiInsights, setAiInsights] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchBusinessInsights();
  }, []);

  async function fetchBusinessInsights(options = {}) {
    const isRegeneration = options.regenerate === true;

    try {
      if (isRegeneration) {
        setRegenerating(true);
      } else {
        setLoading(true);
      }

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
        fetch("/api/leads", {
          cache: "no-store",
        }),
        fetch("/api/quotes", {
          cache: "no-store",
        }),
        fetch("/api/customers", {
          cache: "no-store",
        }),
        fetch("/api/projects", {
          cache: "no-store",
        }),
        fetch("/api/tasks", {
          cache: "no-store",
        }),
        fetch("/api/invoices", {
          cache: "no-store",
        }),
        fetch(`/api/ai-insights?refresh=${Date.now()}`, {
          cache: "no-store",
        }),
      ]);

      if (
        !leadsResponse.ok ||
        !quotesResponse.ok ||
        !customersResponse.ok ||
        !projectsResponse.ok ||
        !tasksResponse.ok ||
        !invoicesResponse.ok
      ) {
        throw new Error(
          "One or more Business Insights requests failed."
        );
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
              insights:
                "No AI-generated business report is currently available.",
            }),
      ]);

      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      setCustomers(
        Array.isArray(customersData) ? customersData : []
      );
      setProjects(
        Array.isArray(projectsData) ? projectsData : []
      );
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setInvoices(
        Array.isArray(invoicesData) ? invoicesData : []
      );

      setAiInsights(
        insightsData?.insights ||
          "No AI-generated business report is currently available."
      );

      setGeneratedAt(new Date());
    } catch (error) {
      console.error("Business Insights loading error:", error);

      setErrorMessage(
        "We could not load the Business Insights report. Please try again."
      );
    } finally {
      setLoading(false);
      setRegenerating(false);
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

  function normaliseStatus(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function isPaid(status) {
    return PAID_STATUSES.includes(normaliseStatus(status));
  }

  function isCompleted(status) {
    return COMPLETED_STATUSES.includes(
      normaliseStatus(status)
    );
  }

  function isOverdue(status) {
    return OVERDUE_STATUSES.includes(
      normaliseStatus(status)
    );
  }

  function handlePrintReport() {
    window.print();
  }

  function handleEmailReport() {
    const subject = encodeURIComponent(
      "SaiNal One AI Business Insights Report"
    );

    const body = encodeURIComponent(
      createEmailReport({
        generatedAt,
        businessHealthScore,
        paidRevenue,
        pipelineValue,
        totalLeads,
        totalCustomers,
        activeProjectsCount,
        pendingTasks,
        overdueInvoicesCount,
        pendingPayments,
        reportLines,
        formatCurrency,
      })
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  const totalLeads = leads.length;
  const totalQuotes = quotes.length;
  const totalCustomers = customers.length;
  const totalProjects = projects.length;
  const totalInvoices = invoices.length;

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

  const activeProjects = projects.filter(
    (project) => !isCompleted(project.status)
  );

  const completedProjects = projects.filter((project) =>
    isCompleted(project.status)
  );

  const completedTasks = tasks.filter((task) =>
    isCompleted(task.status)
  );

  const pendingTasksList = tasks.filter(
    (task) => !isCompleted(task.status)
  );

  const paidRevenue = paidInvoices.reduce(
    (total, invoice) =>
      total + getMoneyValue(invoice.amount),
    0
  );

  const pipelineValue = quotes.reduce(
    (total, quote) =>
      total + getMoneyValue(quote.amount),
    0
  );

  const pendingPayments = [
    ...pendingInvoices,
    ...overdueInvoices,
  ].reduce(
    (total, invoice) =>
      total + getMoneyValue(invoice.amount),
    0
  );

  const activeProjectsCount = activeProjects.length;
  const completedProjectsCount = completedProjects.length;
  const overdueInvoicesCount = overdueInvoices.length;
  const pendingTasks = pendingTasksList.length;

  const invoicePaidRate =
    totalInvoices === 0
      ? 0
      : Math.round(
          (paidInvoices.length / totalInvoices) * 100
        );

  const taskCompletionRate =
    tasks.length === 0
      ? 0
      : Math.round(
          (completedTasks.length / tasks.length) * 100
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

  const averageQuoteValue =
    totalQuotes === 0
      ? 0
      : pipelineValue / totalQuotes;

  const averageInvoiceValue =
    totalInvoices === 0
      ? 0
      : invoices.reduce(
          (total, invoice) =>
            total + getMoneyValue(invoice.amount),
          0
        ) / totalInvoices;

  const leadToCustomerRate =
    totalLeads === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (totalCustomers / totalLeads) * 100
          )
        );

  const reportLines = useMemo(() => {
    return String(aiInsights || "")
      .split("\n")
      .map((line) =>
        line
          .replace(/^[-•*]\s*/, "")
          .replace(/^#+\s*/, "")
          .trim()
      )
      .filter(Boolean);
  }, [aiInsights]);

  const priorityItems = buildPriorityItems({
    overdueInvoicesCount,
    pendingPayments,
    pendingTasks,
    activeProjectsCount,
    totalLeads,
    totalQuotes,
    formatCurrency,
  });

  const opportunities = buildOpportunityItems({
    totalLeads,
    totalCustomers,
    totalQuotes,
    pipelineValue,
    pendingTasks,
    invoicePaidRate,
    averageQuoteValue,
    formatCurrency,
  });

  return (
    <ProtectedRoute>
      <AppLayout
        title="AI Business Insights"
        description="AI-powered analysis, risks, opportunities and executive recommendations."
      >
        {loading ? (
          <BusinessInsightsLoading />
        ) : errorMessage ? (
          <section className={styles.errorPanel}>
            <div>
              <strong>Business Insights unavailable</strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => fetchBusinessInsights()}
              className={styles.retryButton}
            >
              Try again
            </button>
          </section>
        ) : (
          <div className={styles.page}>
            <section className={styles.hero}>
              <div className={styles.heroContent}>
                <span className={styles.eyebrow}>
                  AI Executive Intelligence
                </span>

                <h2>Business Insights Report</h2>

                <p>
                  A consolidated AI-powered view of your sales,
                  revenue, customers, projects, tasks and cashflow.
                </p>

                <div className={styles.reportMetadata}>
                  <span>
                    Generated{" "}
                    {generatedAt
                      ? generatedAt.toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "just now"}
                  </span>

                  <span className={styles.liveStatus}>
                    <span />
                    Live business data
                  </span>
                </div>
              </div>

              <div className={styles.heroActions}>
                <button
                  type="button"
                  onClick={() =>
                    fetchBusinessInsights({
                      regenerate: true,
                    })
                  }
                  disabled={regenerating}
                  className={styles.primaryButton}
                >
                  <span
                    className={
                      regenerating ? styles.spinningIcon : ""
                    }
                  >
                    ↻
                  </span>

                  {regenerating
                    ? "Regenerating..."
                    : "Regenerate report"}
                </button>

                <button
                  type="button"
                  onClick={handlePrintReport}
                  className={styles.secondaryButton}
                >
                  <span>⇩</span>
                  Export PDF
                </button>

                <button
                  type="button"
                  onClick={handleEmailReport}
                  className={styles.secondaryButton}
                >
                  <span>✉</span>
                  Email report
                </button>
              </div>
            </section>

            <section className={styles.executiveOverview}>
              <div className={styles.healthScoreCard}>
                <div
                  className={styles.healthRing}
                  style={{
                    "--score-value": `${
                      businessHealthScore * 3.6
                    }deg`,
                  }}
                >
                  <div className={styles.healthRingCentre}>
                    <strong>{businessHealthScore}</strong>
                    <span>/100</span>
                  </div>
                </div>

                <div className={styles.healthCopy}>
                  <span>Business health</span>
                  <h3>
                    {getHealthLabel(businessHealthScore)}
                  </h3>
                  <p>
                    Calculated using invoice collection,
                    delivery, task completion and sales activity.
                  </p>
                </div>
              </div>

              <div className={styles.executiveMetrics}>
                <ExecutiveMetric
                  label="Paid revenue"
                  value={formatCurrency(paidRevenue)}
                  detail={`${paidInvoices.length} paid invoices`}
                />

                <ExecutiveMetric
                  label="Pipeline"
                  value={formatCurrency(pipelineValue)}
                  detail={`${totalQuotes} quotes`}
                />

                <ExecutiveMetric
                  label="Pending cash"
                  value={formatCurrency(pendingPayments)}
                  detail={`${overdueInvoicesCount} overdue`}
                  attention={overdueInvoicesCount > 0}
                />

                <ExecutiveMetric
                  label="Active delivery"
                  value={activeProjectsCount}
                  detail={`${pendingTasks} pending tasks`}
                />
              </div>
            </section>

            <section className={styles.insightGrid}>
              <InsightPanel
                icon="£"
                title="Revenue and cashflow"
                description="Current invoice and revenue performance"
              >
                <MetricList>
                  <MetricRow
                    label="Paid revenue"
                    value={formatCurrency(paidRevenue)}
                  />

                  <MetricRow
                    label="Pending payments"
                    value={formatCurrency(pendingPayments)}
                    warning={pendingPayments > 0}
                  />

                  <MetricRow
                    label="Average invoice"
                    value={formatCurrency(
                      averageInvoiceValue
                    )}
                  />

                  <MetricRow
                    label="Invoice paid rate"
                    value={`${invoicePaidRate}%`}
                  />
                </MetricList>

                <ProgressMetric
                  label="Invoice collection"
                  value={invoicePaidRate}
                />

                <Link
                  href="/invoices"
                  className={styles.panelLink}
                >
                  Open invoices
                  <span>→</span>
                </Link>
              </InsightPanel>

              <InsightPanel
                icon="↗"
                title="Sales performance"
                description="Lead, quote and customer activity"
              >
                <MetricList>
                  <MetricRow
                    label="Total leads"
                    value={totalLeads}
                  />

                  <MetricRow
                    label="Customers"
                    value={totalCustomers}
                  />

                  <MetricRow
                    label="Quote pipeline"
                    value={formatCurrency(pipelineValue)}
                  />

                  <MetricRow
                    label="Average quote"
                    value={formatCurrency(
                      averageQuoteValue
                    )}
                  />
                </MetricList>

                <ProgressMetric
                  label="Lead to customer ratio"
                  value={leadToCustomerRate}
                />

                <Link
                  href="/leads"
                  className={styles.panelLink}
                >
                  Open sales pipeline
                  <span>→</span>
                </Link>
              </InsightPanel>

              <InsightPanel
                icon="▰"
                title="Project delivery"
                description="Projects and task execution"
              >
                <MetricList>
                  <MetricRow
                    label="Active projects"
                    value={activeProjectsCount}
                  />

                  <MetricRow
                    label="Completed projects"
                    value={completedProjectsCount}
                  />

                  <MetricRow
                    label="Pending tasks"
                    value={pendingTasks}
                    warning={pendingTasks > 0}
                  />

                  <MetricRow
                    label="Completed tasks"
                    value={completedTasks.length}
                  />
                </MetricList>

                <ProgressMetric
                  label="Task completion"
                  value={taskCompletionRate}
                />

                <Link
                  href="/projects"
                  className={styles.panelLink}
                >
                  Open projects
                  <span>→</span>
                </Link>
              </InsightPanel>
            </section>

            <section className={styles.analysisGrid}>
              <section className={styles.aiReportPanel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelHeaderIcon}>✦</div>

                  <div>
                    <span>AI-generated analysis</span>
                    <h3>Executive report</h3>
                  </div>
                </div>

                <div className={styles.reportContent}>
                  {reportLines.length === 0 ? (
                    <p className={styles.emptyReport}>
                      No AI report is currently available.
                    </p>
                  ) : (
                    reportLines.map((line, index) => {
                      const isHeading =
                        line.length < 70 &&
                        !/[.!?]$/.test(line) &&
                        index !== 0;

                      if (isHeading) {
                        return (
                          <h4 key={`${line}-${index}`}>
                            {line}
                          </h4>
                        );
                      }

                      return (
                        <p key={`${line}-${index}`}>
                          {line}
                        </p>
                      );
                    })
                  )}
                </div>
              </section>

              <aside className={styles.priorityColumn}>
                <section className={styles.priorityPanel}>
                  <div className={styles.compactPanelHeader}>
                    <div>
                      <span>Action required</span>
                      <h3>Executive priorities</h3>
                    </div>

                    <strong>{priorityItems.length}</strong>
                  </div>

                  <div className={styles.priorityList}>
                    {priorityItems.map((item, index) => (
                      <PriorityItem
                        key={`${item.title}-${index}`}
                        {...item}
                      />
                    ))}
                  </div>
                </section>

                <section className={styles.opportunityPanel}>
                  <div className={styles.compactPanelHeader}>
                    <div>
                      <span>Growth intelligence</span>
                      <h3>Opportunities</h3>
                    </div>

                    <strong>{opportunities.length}</strong>
                  </div>

                  <div className={styles.opportunityList}>
                    {opportunities.map(
                      (opportunity, index) => (
                        <div
                          key={`${opportunity}-${index}`}
                          className={styles.opportunityItem}
                        >
                          <span>↗</span>
                          <p>{opportunity}</p>
                        </div>
                      )
                    )}
                  </div>
                </section>
              </aside>
            </section>

            <section className={styles.forecastSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.eyebrow}>
                    Business forecast
                  </span>

                  <h2>Current outlook</h2>
                </div>

                <p>
                  Forecasts are indicative and based on current
                  records in SaiNal One.
                </p>
              </div>

              <div className={styles.forecastGrid}>
                <ForecastCard
                  label="Potential pipeline"
                  value={formatCurrency(pipelineValue)}
                  description="Current value of all recorded quotes."
                  tone="gold"
                />

                <ForecastCard
                  label="Expected collections"
                  value={formatCurrency(pendingPayments)}
                  description="Outstanding invoice value awaiting payment."
                  tone="blue"
                />

                <ForecastCard
                  label="Delivery workload"
                  value={`${activeProjectsCount} projects`}
                  description={`${pendingTasks} tasks remain incomplete.`}
                  tone="green"
                />

                <ForecastCard
                  label="Customer growth"
                  value={`${leadToCustomerRate}%`}
                  description="Current lead-to-customer relationship."
                  tone="purple"
                />
              </div>
            </section>
          </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}

function ExecutiveMetric({
  label,
  value,
  detail,
  attention = false,
}) {
  return (
    <div
      className={`${styles.executiveMetric} ${
        attention ? styles.executiveMetricAttention : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function InsightPanel({
  icon,
  title,
  description,
  children,
}) {
  return (
    <section className={styles.insightPanel}>
      <div className={styles.insightPanelHeader}>
        <div className={styles.insightIcon}>{icon}</div>

        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function MetricList({ children }) {
  return <div className={styles.metricList}>{children}</div>;
}

function MetricRow({
  label,
  value,
  warning = false,
}) {
  return (
    <div className={styles.metricRow}>
      <span>{label}</span>

      <strong
        className={warning ? styles.warningValue : ""}
      >
        {value}
      </strong>
    </div>
  );
}

function ProgressMetric({ label, value }) {
  return (
    <div className={styles.progressMetric}>
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>

      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{
            width: `${Math.min(
              100,
              Math.max(0, value)
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

function PriorityItem({
  title,
  description,
  tone,
  href,
}) {
  const content = (
    <>
      <span
        className={`${styles.priorityIndicator} ${
          styles[`priority${capitalise(tone)}`] || ""
        }`}
      />

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      {href && <span className={styles.priorityArrow}>→</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={styles.priorityItem}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={styles.priorityItem}>
      {content}
    </div>
  );
}

function ForecastCard({
  label,
  value,
  description,
  tone,
}) {
  return (
    <div
      className={`${styles.forecastCard} ${
        styles[`forecast${capitalise(tone)}`] || ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </div>
  );
}

function BusinessInsightsLoading() {
  return (
    <div className={styles.loadingPage}>
      <div className={styles.loadingHero} />

      <div className={styles.loadingOverview}>
        <div />
        <div />
      </div>

      <div className={styles.loadingCards}>
        <div />
        <div />
        <div />
      </div>

      <div className={styles.loadingAnalysis}>
        <div />
        <div />
      </div>
    </div>
  );
}

function buildPriorityItems({
  overdueInvoicesCount,
  pendingPayments,
  pendingTasks,
  activeProjectsCount,
  totalLeads,
  totalQuotes,
  formatCurrency,
}) {
  const priorities = [];

  if (overdueInvoicesCount > 0) {
    priorities.push({
      title: "Chase overdue invoices",
      description: `${overdueInvoicesCount} overdue invoice${
        overdueInvoicesCount === 1 ? "" : "s"
      } require attention.`,
      tone: "red",
      href: "/invoices",
    });
  }

  if (pendingPayments > 0) {
    priorities.push({
      title: "Review outstanding cash",
      description: `${formatCurrency(
        pendingPayments
      )} remains unpaid.`,
      tone: "orange",
      href: "/invoices",
    });
  }

  if (pendingTasks > 0) {
    priorities.push({
      title: "Complete pending tasks",
      description: `${pendingTasks} task${
        pendingTasks === 1 ? "" : "s"
      } remain incomplete.`,
      tone: "gold",
      href: "/tasks",
    });
  }

  if (activeProjectsCount > 0) {
    priorities.push({
      title: "Review project delivery",
      description: `${activeProjectsCount} active project${
        activeProjectsCount === 1 ? "" : "s"
      } should be monitored.`,
      tone: "blue",
      href: "/projects",
    });
  }

  if (totalLeads > 0 && totalQuotes === 0) {
    priorities.push({
      title: "Convert leads into quotes",
      description:
        "You have leads available but no current quotes.",
      tone: "purple",
      href: "/leads",
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      title: "Operations are under control",
      description:
        "No urgent issues were identified from current records.",
      tone: "green",
    });
  }

  return priorities.slice(0, 5);
}

function buildOpportunityItems({
  totalLeads,
  totalCustomers,
  totalQuotes,
  pipelineValue,
  pendingTasks,
  invoicePaidRate,
  averageQuoteValue,
  formatCurrency,
}) {
  const opportunities = [];

  if (totalLeads > 0) {
    opportunities.push(
      `Follow up with ${totalLeads} active lead${
        totalLeads === 1 ? "" : "s"
      } to improve conversion.`
    );
  }

  if (totalQuotes > 0) {
    opportunities.push(
      `${formatCurrency(
        pipelineValue
      )} is currently available in the quote pipeline.`
    );
  }

  if (averageQuoteValue > 0) {
    opportunities.push(
      `The average quote value is ${formatCurrency(
        averageQuoteValue
      )}; use this as a sales benchmark.`
    );
  }

  if (totalCustomers > 0) {
    opportunities.push(
      `Review upsell and repeat-business opportunities across ${totalCustomers} customer${
        totalCustomers === 1 ? "" : "s"
      }.`
    );
  }

  if (pendingTasks > 0) {
    opportunities.push(
      `Completing ${pendingTasks} outstanding task${
        pendingTasks === 1 ? "" : "s"
      } may accelerate project delivery.`
    );
  }

  if (invoicePaidRate < 80) {
    opportunities.push(
      "Improving invoice collection could strengthen short-term cashflow."
    );
  }

  if (opportunities.length === 0) {
    opportunities.push(
      "Continue monitoring business activity and maintain current performance."
    );
  }

  return opportunities.slice(0, 5);
}

function createEmailReport({
  generatedAt,
  businessHealthScore,
  paidRevenue,
  pipelineValue,
  totalLeads,
  totalCustomers,
  activeProjectsCount,
  pendingTasks,
  overdueInvoicesCount,
  pendingPayments,
  reportLines,
  formatCurrency,
}) {
  const formattedDate = generatedAt
    ? generatedAt.toLocaleString("en-GB")
    : new Date().toLocaleString("en-GB");

  return [
    "SaiNal One — AI Business Insights",
    "",
    `Generated: ${formattedDate}`,
    `Business health: ${businessHealthScore}/100`,
    "",
    "Executive metrics",
    `Paid revenue: ${formatCurrency(paidRevenue)}`,
    `Sales pipeline: ${formatCurrency(pipelineValue)}`,
    `Leads: ${totalLeads}`,
    `Customers: ${totalCustomers}`,
    `Active projects: ${activeProjectsCount}`,
    `Pending tasks: ${pendingTasks}`,
    `Overdue invoices: ${overdueInvoicesCount}`,
    `Pending payments: ${formatCurrency(
      pendingPayments
    )}`,
    "",
    "AI report",
    ...reportLines,
    "",
    "Generated by SaiNal One.",
  ].join("\n");
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
