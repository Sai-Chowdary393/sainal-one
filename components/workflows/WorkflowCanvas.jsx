"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import WorkflowNode from "./WorkflowNode";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 92;

export default function WorkflowCanvas({
  steps,
  selectedStepId,
  onSelectStep,
  onChangePosition,
}) {
  const canvasRef = useRef(null);

  const dragRef = useRef(null);

  const [
    canvasSize,
    setCanvasSize,
  ] = useState({
    width: 1400,
    height: 900,
  });

  useEffect(() => {
    function handlePointerMove(
      event
    ) {
      const drag =
        dragRef.current;

      if (!drag) {
        return;
      }

      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const rect =
        canvas.getBoundingClientRect();

      const nextX =
        event.clientX -
        rect.left +
        canvas.scrollLeft -
        drag.offsetX;

      const nextY =
        event.clientY -
        rect.top +
        canvas.scrollTop -
        drag.offsetY;

      const x = Math.max(
        20,
        Math.round(nextX)
      );

      const y = Math.max(
        20,
        Math.round(nextY)
      );

      onChangePosition(
        drag.stepId,
        x,
        y
      );

      setCanvasSize(
        (current) => ({
          width: Math.max(
            current.width,
            x + 400
          ),

          height: Math.max(
            current.height,
            y + 300
          ),
        })
      );
    }

    function handlePointerUp() {
      dragRef.current = null;
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp
      );
    };
  }, [onChangePosition]);

  function handlePointerDown(
    event,
    stepId
  ) {
    if (
      event.button !== undefined &&
      event.button !== 0
    ) {
      return;
    }

    const step =
      steps.find(
        (item) =>
          item.id === stepId
      );

    if (!step) {
      return;
    }

    const targetRect =
      event.currentTarget.getBoundingClientRect();

    dragRef.current = {
      stepId,

      offsetX:
        event.clientX -
        targetRect.left,

      offsetY:
        event.clientY -
        targetRect.top,
    };

    onSelectStep(stepId);
  }

  const edges =
    buildEdges(steps);

  return (
    <div
      ref={canvasRef}
      style={{
        position: "relative",
        width: "100%",
        height: "720px",
        overflow: "auto",
        border: "1px solid #ddd9cf",
        borderRadius: 16,
        backgroundColor: "#f8f6f0",
        backgroundImage:
          "radial-gradient(#d9d4c7 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      >
        <svg
          width={canvasSize.width}
          height={canvasSize.height}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <defs>
            <marker
              id="workflow-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path
                d="M0,0 L0,6 L9,3 z"
                fill="#b49127"
              />
            </marker>
          </defs>

          {edges.map((edge) => (
            <WorkflowEdge
              key={edge.id}
              edge={edge}
            />
          ))}
        </svg>

        {steps.map((step) => (
          <WorkflowNode
            key={step.id}
            step={step}
            selected={
              step.id ===
              selectedStepId
            }
            onSelect={
              onSelectStep
            }
            onPointerDown={
              handlePointerDown
            }
          />
        ))}
      </div>
    </div>
  );
}

function WorkflowEdge({
  edge,
}) {
  const sourceX =
    edge.source.position_x +
    NODE_WIDTH / 2;

  const sourceY =
    edge.source.position_y +
    NODE_HEIGHT;

  const targetX =
    edge.target.position_x +
    NODE_WIDTH / 2;

  const targetY =
    edge.target.position_y;

  const middleY =
    sourceY +
    (targetY - sourceY) / 2;

  const path = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX} ${middleY}`,
    `${targetX} ${middleY}`,
    `${targetX} ${targetY}`,
  ].join(" ");

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke={
          edge.branch === "true"
            ? "#548b67"
            : edge.branch ===
                "false"
              ? "#b66363"
              : "#b49127"
        }
        strokeWidth="2"
        markerEnd="url(#workflow-arrow)"
      />

      {edge.label && (
        <text
          x={
            (sourceX + targetX) /
            2
          }
          y={middleY - 7}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="#716c61"
        >
          {edge.label}
        </text>
      )}
    </>
  );
}

function buildEdges(steps) {
  const byId = new Map(
    steps.map((step) => [
      step.id,
      step,
    ])
  );

  const edges = [];

  steps.forEach((step) => {
    if (
      step.next_step_id &&
      byId.has(step.next_step_id)
    ) {
      edges.push({
        id: `${step.id}-next`,
        source: step,
        target: byId.get(
          step.next_step_id
        ),
        branch: "next",
      });
    }

    if (
      step.true_step_id &&
      byId.has(step.true_step_id)
    ) {
      edges.push({
        id: `${step.id}-true`,
        source: step,
        target: byId.get(
          step.true_step_id
        ),
        branch: "true",
        label: "Yes",
      });
    }

    if (
      step.false_step_id &&
      byId.has(step.false_step_id)
    ) {
      edges.push({
        id: `${step.id}-false`,
        source: step,
        target: byId.get(
          step.false_step_id
        ),
        branch: "false",
        label: "No",
      });
    }
  });

  return edges;
}
