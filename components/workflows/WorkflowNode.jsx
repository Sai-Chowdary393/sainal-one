"use client";

import {
  Handle,
  Position,
} from "@xyflow/react";

const NODE_ICONS = {
  Trigger: "⚡",
  Approval: "✓",
  Condition: "◇",
  Email: "✉",
  Notification: "◉",
  "Create Task": "▤",
  "Update Record": "↻",
  Wait: "◷",
  "AI Action": "✦",
};

export default function WorkflowNode({
  data,
  selected,
}) {
  const stepType =
    data?.step_type || "Action";

  const icon =
    NODE_ICONS[stepType] || "⌘";

  const isCondition =
    stepType === "Condition";

  const isTrigger =
    stepType === "Trigger";

  return (
    <div
      style={{
        width: 235,
        border: selected
          ? "2px solid #c8940b"
          : "1px solid #ddd8cc",
        borderRadius: 14,
        overflow: "hidden",
        background: "#ffffff",
        boxShadow: selected
          ? "0 12px 32px rgba(181, 134, 8, 0.20)"
          : "0 8px 22px rgba(43, 36, 17, 0.08)",
      }}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            width: 10,
            height: 10,
            border: "2px solid #ffffff",
            background: "#b88a0a",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "13px 14px",
          borderBottom:
            "1px solid #eeeae1",
        }}
      >
        <span
          style={{
            display: "grid",
            width: 36,
            height: 36,
            placeItems: "center",
            flex: "0 0 36px",
            borderRadius: 10,
            background:
              isTrigger
                ? "#d3a51d"
                : "#292720",
            color:
              isTrigger
                ? "#1d1b16"
                : "#deb840",
            fontSize: 15,
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
              color: "#987000",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {stepType}
          </span>

          <strong
            style={{
              display: "block",
              marginTop: 3,
              overflow: "hidden",
              color: "#28251f",
              fontSize: 13,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data?.label ||
              data?.name ||
              "Untitled"}
          </strong>
        </div>
      </div>

      <div
        style={{
          padding: "9px 14px 11px",
          color: "#8c887f",
          fontSize: 10,
          lineHeight: 1.45,
        }}
      >
        {isTrigger
          ? data?.trigger_label ||
            "Workflow trigger"
          : data?.description ||
            `Step ${data?.step_order || ""}`}
      </div>

      {isCondition ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{
              left: "32%",
              width: 10,
              height: 10,
              border:
                "2px solid #ffffff",
              background: "#4d8a64",
            }}
          />

          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{
              left: "68%",
              width: 10,
              height: 10,
              border:
                "2px solid #ffffff",
              background: "#b55b5b",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              padding: "0 38px 7px",
              fontSize: 8,
              fontWeight: 800,
              textTransform:
                "uppercase",
            }}
          >
            <span
              style={{
                color: "#4d8a64",
              }}
            >
              Yes
            </span>

            <span
              style={{
                color: "#b55b5b",
              }}
            >
              No
            </span>
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            width: 10,
            height: 10,
            border: "2px solid #ffffff",
            background: "#b88a0a",
          }}
        />
      )}
    </div>
  );
}
