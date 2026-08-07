"use client";

export default function WorkflowNode({
  step,
  selected = false,
  onSelect,
  onPointerDown,
}) {
  const icon =
    getStepIcon(step.step_type);

  return (
    <button
      type="button"
      onClick={() => onSelect(step.id)}
      onPointerDown={(event) =>
        onPointerDown(event, step.id)
      }
      style={{
        position: "absolute",
        left: step.position_x || 0,
        top: step.position_y || 0,
        width: 220,
        minHeight: 92,
        padding: 0,
        border: selected
          ? "2px solid #c99611"
          : "1px solid #dedbd2",
        borderRadius: 14,
        background: "#ffffff",
        boxShadow: selected
          ? "0 10px 28px rgba(176, 130, 7, 0.18)"
          : "0 8px 22px rgba(43, 36, 17, 0.07)",
        cursor: "grab",
        textAlign: "left",
        overflow: "hidden",
        zIndex: selected ? 5 : 2,
        touchAction: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 13px",
          borderBottom:
            "1px solid #eeeae2",
        }}
      >
        <span
          style={{
            display: "grid",
            width: 34,
            height: 34,
            placeItems: "center",
            flex: "0 0 34px",
            borderRadius: 10,
            background: "#292720",
            color: "#dfb83e",
            fontWeight: 900,
          }}
        >
          {icon}
        </span>

        <div
          style={{
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: "block",
              color: "#9a7100",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 0.7,
              textTransform: "uppercase",
            }}
          >
            {step.step_type}
          </span>

          <strong
            style={{
              display: "block",
              marginTop: 3,
              overflow: "hidden",
              color: "#29261f",
              fontSize: 13,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {step.name || "Untitled step"}
          </strong>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: 10,
          padding: "9px 13px",
          color: "#8d8980",
          fontSize: 10,
        }}
      >
        <span>
          Step {step.step_order}
        </span>

        <span>
          {step.is_required
            ? "Required"
            : "Optional"}
        </span>
      </div>
    </button>
  );
}

function getStepIcon(type) {
  switch (type) {
    case "Approval":
      return "✓";

    case "Condition":
      return "◇";

    case "Email":
      return "✉";

    case "Notification":
      return "◉";

    case "Create Task":
      return "▤";

    case "Update Record":
      return "↻";

    case "Wait":
      return "◷";

    case "AI Action":
      return "✦";

    default:
      return "⌘";
  }
}
