"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import {
  useCallback,
  useEffect,
} from "react";

import WorkflowNode from "./WorkflowNode";

const nodeTypes = {
  workflowNode: WorkflowNode,
};

export default function WorkflowCanvas({
  workflow,
  steps,
  selectedStepId,
  onSelectStep,
  onNodesChanged,
  onConnectionsChanged,
}) {
  const [
    nodes,
    setNodes,
    handleNodesChange,
  ] = useNodesState([]);

  const [
    edges,
    setEdges,
    handleEdgesChange,
  ] = useEdgesState([]);

  useEffect(() => {
    const triggerNode = {
      id: "workflow-trigger",

      type: "workflowNode",

      position: {
        x: 280,
        y: 50,
      },

      draggable: false,

      selectable: false,

      data: {
        step_type: "Trigger",

        label:
          formatTrigger(
            workflow?.trigger_event
          ),

        trigger_label:
          `${workflow?.module || ""} workflow trigger`,
      },
    };

    const stepNodes =
      steps.map(
        (step, index) => ({
          id: step.id,

          type: "workflowNode",

          position: {
            x:
              Number(
                step.position_x
              ) || 280,

            y:
              Number(
                step.position_y
              ) ||
              220 +
                index * 170,
          },

          selected:
            step.id ===
            selectedStepId,

          data: {
            ...step,
            label: step.name,
          },
        })
      );

    setNodes([
      triggerNode,
      ...stepNodes,
    ]);

    setEdges(
      buildEdges(steps)
    );
  }, [
    workflow,
    steps,
    selectedStepId,
    setNodes,
    setEdges,
  ]);

  const onConnect =
    useCallback(
      (connection) => {
        if (
          connection.source ===
          "workflow-trigger"
        ) {
          return;
        }

        const sourceStep =
          steps.find(
            (step) =>
              step.id ===
              connection.source
          );

        if (!sourceStep) {
          return;
        }

        let branch = "next";

        if (
          sourceStep.step_type ===
          "Condition"
        ) {
          branch =
            connection.sourceHandle ===
            "true"
              ? "true"
              : connection.sourceHandle ===
                  "false"
                ? "false"
                : "next";
        }

        const nextEdges =
          addEdge(
            {
              ...connection,

              id: `${connection.source}-${branch}-${connection.target}`,

              label:
                branch === "true"
                  ? "Yes"
                  : branch ===
                      "false"
                    ? "No"
                    : undefined,

              animated: false,

              style: {
                stroke:
                  branch === "true"
                    ? "#4d8a64"
                    : branch ===
                        "false"
                      ? "#b55b5b"
                      : "#b88a0a",
              },
            },

            edges
          );

        setEdges(nextEdges);

        onConnectionsChanged(
          connection.source,
          branch,
          connection.target
        );
      },
      [
        edges,
        setEdges,
        steps,
        onConnectionsChanged,
      ]
    );

  const onNodeClick =
    useCallback(
      (event, node) => {
        if (
          node.id ===
          "workflow-trigger"
        ) {
          return;
        }

        onSelectStep(node.id);
      },
      [onSelectStep]
    );

  const onNodeDragStop =
    useCallback(
      (event, node) => {
        if (
          node.id ===
          "workflow-trigger"
        ) {
          return;
        }

        onNodesChanged(
          node.id,
          node.position.x,
          node.position.y
        );
      },
      [onNodesChanged]
    );

  return (
    <div
      style={{
        width: "100%",
        height: "720px",
        border:
          "1px solid #ddd9cf",
        borderRadius: 16,
        overflow: "hidden",
        background: "#f8f6f0",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={
          handleNodesChange
        }
        onEdgesChange={
          handleEdgesChange
        }
        onConnect={onConnect}
        onNodeClick={
          onNodeClick
        }
        onNodeDragStop={
          onNodeDragStop
        }
        fitView
        fitViewOptions={{
          padding: 0.25,
        }}
        minZoom={0.35}
        maxZoom={1.7}
        deleteKeyCode={null}
        proOptions={{
          hideAttribution: true,
        }}
      >
        <Background
          gap={22}
          size={1}
        />

        <Controls />

        <MiniMap
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

function buildEdges(steps) {
  const edges = [];

  const orderedSteps = [
    ...steps,
  ].sort(
    (first, second) =>
      Number(first.step_order) -
      Number(second.step_order)
  );

  /*
   * Trigger -> first step.
   */
  if (
    orderedSteps.length > 0
  ) {
    edges.push({
      id: `trigger-${orderedSteps[0].id}`,

      source:
        "workflow-trigger",

      target:
        orderedSteps[0].id,

      type: "smoothstep",

      style: {
        stroke: "#b88a0a",
      },
    });
  }

  steps.forEach((step) => {
    if (
      step.next_step_id
    ) {
      edges.push({
        id: `${step.id}-next-${step.next_step_id}`,

        source: step.id,

        target:
          step.next_step_id,

        type: "smoothstep",

        style: {
          stroke: "#b88a0a",
        },
      });
    }

    if (
      step.true_step_id
    ) {
      edges.push({
        id: `${step.id}-true-${step.true_step_id}`,

        source: step.id,

        sourceHandle:
          "true",

        target:
          step.true_step_id,

        label: "Yes",

        type: "smoothstep",

        style: {
          stroke: "#4d8a64",
        },
      });
    }

    if (
      step.false_step_id
    ) {
      edges.push({
        id: `${step.id}-false-${step.false_step_id}`,

        source: step.id,

        sourceHandle:
          "false",

        target:
          step.false_step_id,

        label: "No",

        type: "smoothstep",

        style: {
          stroke: "#b55b5b",
        },
      });
    }
  });

  return edges;
}

function formatTrigger(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}
