"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";
import ProgressBar from "../../../components/ProgressBar";
import ProtectedRoute from "../../../components/ProtectedRoute";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(
    `${value}T12:00:00`
  ).toLocaleDateString("en-GB");
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = params.id;

  const [project, setProject] =
    useState(null);

  const [tasks, setTasks] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    showTaskForm,
    setShowTaskForm,
  ] = useState(false);

  const [
    addingTask,
    setAddingTask,
  ] = useState(false);

  const [
    generatingTasks,
    setGeneratingTasks,
  ] = useState(false);

  const [
    generatingInvoice,
    setGeneratingInvoice,
  ] = useState(false);

  const [
    updatingTaskId,
    setUpdatingTaskId,
  ] = useState(null);

  const [
    deletingTaskId,
    setDeletingTaskId,
  ] = useState(null);

  const [taskForm, setTaskForm] =
    useState({
      task_name: "",
      description: "",
      status: "To Do",
      due_date: "",
    });

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  async function fetchProjectDetails() {
    try {
      const [
        projectsResponse,
        tasksResponse,
      ] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/tasks"),
      ]);

      const projectsData =
        await projectsResponse.json();

      const tasksData =
        await tasksResponse.json();

      if (!projectsResponse.ok) {
        alert(
          projectsData.error ||
            "Failed to load projects."
        );
        return;
      }

      if (!tasksResponse.ok) {
        alert(
          tasksData.error ||
            "Failed to load tasks."
        );
        return;
      }

      const selectedProject = (
        Array.isArray(projectsData)
          ? projectsData
          : []
      ).find(
        (item) =>
          String(item.id) ===
          String(projectId)
      );

      setProject(
        selectedProject || null
      );

      const projectTasks = (
        Array.isArray(tasksData)
          ? tasksData
          : []
      )
        .filter(
          (task) =>
            String(task.project_id) ===
            String(projectId)
        )
        .sort((firstTask, secondTask) => {
          const firstDate =
            firstTask.due_date || "";

          const secondDate =
            secondTask.due_date || "";

          return firstDate.localeCompare(
            secondDate
          );
        });

      setTasks(projectTasks);
    } catch (error) {
      console.error(error);

      alert(
        "Error loading project details."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleTaskChange(event) {
    const { name, value } =
      event.target;

    setTaskForm(
      (currentTaskForm) => ({
        ...currentTaskForm,
        [name]: value,
      })
    );
  }

  async function addTask(event) {
    event.preventDefault();

    if (!taskForm.task_name.trim()) {
      alert(
        "Please enter task name."
      );
      return;
    }

    setAddingTask(true);

    try {
      const response = await fetch(
        "/api/tasks",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            project_id: projectId,

            task_name:
              taskForm.task_name.trim(),

            description:
              taskForm.description.trim(),

            status:
              taskForm.status,

            due_date:
              taskForm.due_date || null,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to add task."
        );
        return;
      }

      setTaskForm({
        task_name: "",
        description: "",
        status: "To Do",
        due_date: "",
      });

      setShowTaskForm(false);

      await fetchProjectDetails();
      await updateProjectStatus();

      alert(
        "Task added successfully."
      );
    } catch (error) {
      console.error(error);

      alert(
        "Error adding task."
      );
    } finally {
      setAddingTask(false);
    }
  }

  async function generateDefaultTasks() {
    if (
      !project ||
      generatingTasks
    ) {
      return;
    }

    if (tasks.length > 0) {
      const confirmed = window.confirm(
        "This project already has tasks. Default tasks will not be added to prevent duplicates. Continue checking?"
      );

      if (!confirmed) {
        return;
      }
    }

    setGeneratingTasks(true);

    try {
      const response = await fetch(
        `/api/projects/${project.id}/generate-tasks`,
        {
          method: "POST",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to generate default tasks."
        );
        return;
      }

      alert(data.message);

      await fetchProjectDetails();
      await updateProjectStatus();
    } catch (error) {
      console.error(error);

      alert(
        "Error generating default tasks."
      );
    } finally {
      setGeneratingTasks(false);
    }
  }

  async function updateTaskStatus(
    taskId,
    newStatus
  ) {
    setUpdatingTaskId(taskId);

    try {
      const response = await fetch(
        `/api/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to update task."
        );
        return;
      }

      await fetchProjectDetails();
      await updateProjectStatus();
    } catch (error) {
      console.error(error);

      alert(
        "Error updating task."
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function deleteTask(taskId) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this task?"
      );

    if (!confirmed) {
      return;
    }

    setDeletingTaskId(taskId);

    try {
      const response = await fetch(
        `/api/tasks/${taskId}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to delete task."
        );
        return;
      }

      await fetchProjectDetails();
      await updateProjectStatus();

      alert(
        "Task deleted successfully."
      );
    } catch (error) {
      console.error(error);

      alert(
        "Error deleting task."
      );
    } finally {
      setDeletingTaskId(null);
    }
  }

  async function updateProjectStatus() {
    try {
      const tasksResponse =
        await fetch("/api/tasks");

      const tasksData =
        await tasksResponse.json();

      if (!tasksResponse.ok) {
        return;
      }

      const projectTasks = (
        Array.isArray(tasksData)
          ? tasksData
          : []
      ).filter(
        (task) =>
          String(task.project_id) ===
          String(projectId)
      );

      let newStatus = "Planning";

      if (projectTasks.length > 0) {
        const completedTasks =
          projectTasks.filter(
            (task) =>
              task.status ===
              "Completed"
          ).length;

        const hasInProgressTasks =
          projectTasks.some(
            (task) =>
              task.status ===
              "In Progress"
          );

        const hasBlockedTasks =
          projectTasks.some(
            (task) =>
              task.status ===
              "Blocked"
          );

        if (
          completedTasks ===
          projectTasks.length
        ) {
          newStatus = "Completed";
        } else if (
          completedTasks > 0 ||
          hasInProgressTasks ||
          hasBlockedTasks
        ) {
          newStatus = "In Progress";
        }
      }

      const response = await fetch(
        `/api/projects/${projectId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          data.error ||
            "Failed to update project status."
        );
        return;
      }

      setProject(
        (currentProject) => ({
          ...currentProject,
          status: newStatus,
        })
      );
    } catch (error) {
      console.error(
        "Project status update error:",
        error
      );
    }
  }

  async function generateInvoice() {
    if (
      !project ||
      generatingInvoice
    ) {
      return;
    }

    setGeneratingInvoice(true);

    try {
      const response = await fetch(
        "/api/invoices",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            project_id:
              project.id,

            customer_id:
              project.customer_id,

            quote_id:
              project.quote_id || null,

            client:
              project.project_name,

            service:
              project.description ||
              "Project Service",

            amount:
              project.amount,

            subtotal:
              project.amount,

            vat_rate:
              "0%",

            vat_amount:
              "£0.00",

            total_amount:
              project.amount,

            status:
              "Draft Invoice",

            due_date:
              null,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Failed to create invoice."
        );
        return;
      }

      alert(
        "Invoice generated successfully."
      );
    } catch (error) {
      console.error(error);

      alert(
        "Error generating invoice."
      );
    } finally {
      setGeneratingInvoice(false);
    }
  }

  function calculateProgress() {
    if (tasks.length === 0) {
      return 0;
    }

    const completedTasks =
      tasks.filter(
        (task) =>
          task.status === "Completed"
      ).length;

    return Math.round(
      (completedTasks /
        tasks.length) *
        100
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <p>
              Loading project...
            </p>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <div className="appLayout">
          <Sidebar />

          <main className="mainContent">
            <Link
              href="/projects"
              className="backLink"
            >
              ← Back to Projects
            </Link>

            <h1>
              Project not found
            </h1>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const progress =
    calculateProgress();

  const completedTaskCount =
    tasks.filter(
      (task) =>
        task.status === "Completed"
    ).length;

  const blockedTaskCount =
    tasks.filter(
      (task) =>
        task.status === "Blocked"
    ).length;

  const overdueTaskCount =
    tasks.filter((task) => {
      if (
        !task.due_date ||
        task.status === "Completed"
      ) {
        return false;
      }

      const dueDate = new Date(
        `${task.due_date}T23:59:59`
      );

      return dueDate < new Date();
    }).length;

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <Link
            href="/projects"
            className="backLink"
          >
            ← Back to Projects
          </Link>

          <div className="topBar">
            <div>
              <h1>
                {project.project_name}
              </h1>

              <p className="helperText">
                Manage project tasks,
                progress and invoicing.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="primaryBtn"
                onClick={() =>
                  setShowTaskForm(
                    !showTaskForm
                  )
                }
              >
                {showTaskForm
                  ? "Close Task Form"
                  : "Add Task"}
              </button>

              <button
                type="button"
                className="primaryBtn"
                disabled={
                  generatingTasks
                }
                onClick={
                  generateDefaultTasks
                }
              >
                {generatingTasks
                  ? "Generating..."
                  : tasks.length > 0
                  ? "Check Default Tasks"
                  : "Generate Default Tasks"}
              </button>

              {project.status ===
                "Completed" && (
                <button
                  type="button"
                  className="primaryBtn"
                  disabled={
                    generatingInvoice
                  }
                  onClick={
                    generateInvoice
                  }
                >
                  {generatingInvoice
                    ? "Generating..."
                    : "Generate Invoice"}
                </button>
              )}
            </div>
          </div>

          <section className="detailsGrid">
            <div className="panel">
              <h3>
                Project Information
              </h3>

              <p>
                <strong>
                  Status:
                </strong>{" "}

                <StatusBadge
                  status={project.status}
                />
              </p>

              <p>
                <strong>
                  Amount:
                </strong>{" "}
                {project.amount || "-"}
              </p>

              <p>
                <strong>
                  Start Date:
                </strong>{" "}
                {formatDate(
                  project.start_date
                )}
              </p>

              <p>
                <strong>
                  Due Date:
                </strong>{" "}
                {formatDate(
                  project.due_date
                )}
              </p>

              <p>
                <strong>
                  Description:
                </strong>{" "}
                {project.description ||
                  "-"}
              </p>
            </div>

            <div className="panel">
              <h3>
                Project Progress
              </h3>

              <ProgressBar
                value={progress}
              />

              <p>
                <strong>
                  {progress}%
                </strong>{" "}
                complete
              </p>

              <p>
                {tasks.length} total
                tasks
              </p>

              <p>
                {completedTaskCount}{" "}
                completed
              </p>

              <p>
                {blockedTaskCount}{" "}
                blocked
              </p>

              <p>
                {overdueTaskCount}{" "}
                overdue
              </p>
            </div>
          </section>

          {showTaskForm && (
            <form
              className="leadForm"
              onSubmit={addTask}
            >
              <input
                name="task_name"
                placeholder="Task Name"
                value={
                  taskForm.task_name
                }
                disabled={addingTask}
                onChange={
                  handleTaskChange
                }
              />

              <textarea
                name="description"
                placeholder="Task Description"
                value={
                  taskForm.description
                }
                disabled={addingTask}
                onChange={
                  handleTaskChange
                }
                rows={4}
              />

              <select
                name="status"
                value={
                  taskForm.status
                }
                disabled={addingTask}
                onChange={
                  handleTaskChange
                }
              >
                <option>
                  To Do
                </option>

                <option>
                  In Progress
                </option>

                <option>
                  Completed
                </option>

                <option>
                  Blocked
                </option>
              </select>

              <input
                type="date"
                name="due_date"
                value={
                  taskForm.due_date
                }
                disabled={addingTask}
                onChange={
                  handleTaskChange
                }
              />

              <button
                className="primaryBtn"
                type="submit"
                disabled={addingTask}
              >
                {addingTask
                  ? "Saving..."
                  : "Save Task"}
              </button>
            </form>
          )}

          <section className="panel">
            <h3>
              Project Tasks
            </h3>

            {tasks.length === 0 ? (
              <p className="helperText">
                No tasks added yet. Add
                a task manually or use
                Generate Default Tasks.
              </p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table className="leadTable">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>
                        Description
                      </th>
                      <th>Status</th>
                      <th>Due Date</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tasks.map(
                      (task) => {
                        const isOverdue =
                          task.due_date &&
                          task.status !==
                            "Completed" &&
                          new Date(
                            `${task.due_date}T23:59:59`
                          ) < new Date();

                        return (
                          <tr
                            key={task.id}
                          >
                            <td>
                              <strong>
                                {
                                  task.task_name
                                }
                              </strong>

                              {isOverdue && (
                                <p
                                  className="helperText"
                                  style={{
                                    margin:
                                      "4px 0 0",
                                  }}
                                >
                                  Overdue
                                </p>
                              )}
                            </td>

                            <td>
                              {task.description ||
                                "-"}
                            </td>

                            <td>
                              <select
                                value={
                                  task.status ||
                                  "To Do"
                                }
                                disabled={
                                  updatingTaskId ===
                                  task.id
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateTaskStatus(
                                    task.id,
                                    event
                                      .target
                                      .value
                                  )
                                }
                              >
                                <option>
                                  To Do
                                </option>

                                <option>
                                  In Progress
                                </option>

                                <option>
                                  Completed
                                </option>

                                <option>
                                  Blocked
                                </option>
                              </select>
                            </td>

                            <td>
                              {formatDate(
                                task.due_date
                              )}
                            </td>

                            <td>
                              {task.created_at
                                ? new Date(
                                    task.created_at
                                  ).toLocaleDateString(
                                    "en-GB"
                                  )
                                : "-"}
                            </td>

                            <td>
                              <button
                                type="button"
                                className="primaryBtn"
                                disabled={
                                  deletingTaskId ===
                                  task.id
                                }
                                onClick={() =>
                                  deleteTask(
                                    task.id
                                  )
                                }
                              >
                                {deletingTaskId ===
                                task.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
