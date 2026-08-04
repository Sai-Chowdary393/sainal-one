import {
  formatCurrency,
} from "../project-utils";

import styles from "../projects.module.css";

export default function ProjectSummaryCards({
  summary,
}) {
  return (
    <section
      className={
        styles.summaryGrid
      }
    >
      <SummaryCard
        icon="▰"
        label="Total projects"
        value={summary.total}
        detail="All delivery records"
        tone="Gold"
      />

      <SummaryCard
        icon="→"
        label="Active"
        value={summary.active}
        detail="Currently in delivery"
        tone="Blue"
      />

      <SummaryCard
        icon="✓"
        label="Completed"
        value={summary.completed}
        detail="Successfully delivered"
        tone="Green"
      />

      <SummaryCard
        icon="!"
        label="Delayed"
        value={summary.delayed}
        detail={formatCurrency(
          summary.totalValue
        )}
        tone="Red"
      />
    </section>
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
        styles[`summary${tone}`] ||
        ""
      }`}
    >
      <span
        className={
          styles.summaryIcon
        }
      >
        {icon}
      </span>

      <span
        className={
          styles.summaryLabel
        }
      >
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
