"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = params.id;

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const [taskForm, setTaskForm] = useState({
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
      const projectsResponse = await fetch("/api/projects");
      const tasksResponse = await fetch("/api/tasks");

      const projectsData = await projectsResponse.json();
      const tasksData = await tasksResponse.json();

      const selectedProject = projectsData.find(
        (item) => String(item.id) === String(projectId)
      );

      setProject(selectedProject || null);

      const projectTasks = tasksData.filter(
        (task) => String(task.project_id) === String(projectId)
      );

      setTasks(projectTasks);
    } catch (error) {
      console.error(error);
      alert("Error loading project details.");
    } finally {
      setLoading(false);
    }
  }

  function handleTaskChange(e) {
    setTaskForm({
      ...taskForm,
      [e.target.name]: e.target.value,
    });
  }

  async function addTask(e) {
    e.preventDefault();

    if (!taskForm.task_name) {
      alert("Please enter task name.");
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: projectId,
          task_name: taskForm.task_name,
          description: taskForm.description,
          status: taskForm.status,
          due_date: taskForm.due_date || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to add task.");
        return;
      }

      setTaskForm({
        task_name: "",
        description: "",
        status: "To Do",
        due_date: "",
      });

      setShowTaskForm(false);
      fetchProjectDetails();
      alert("Task added successfully.");
    } catch (error) {
      console.error(error);
      alert("Error adding task.");
    }
  }

  async function updateTaskStatus(taskId, newStatus) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to update task.");
        return;
      }

      fetchProjectDetails();
    } catch (error) {
      console.error(error);
      alert("Error updating task.");
    }
  }

  async function deleteTask(taskId) {
    const confirmed = confirm("Are you sure you want to delete this task?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to delete task.");
        return;
      }

      fetchProjectDetails();
      alert("Task deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Error deleting task.");
    }
  }

  function calculateProgress() {
    if (tasks.length === 0) return 0;

    const completedTasks = tasks.filter(
      (task) => task.status === "Completed"
    ).length;

    return Math.round((completedTasks / tasks.length) * 100);
  }

  if (loading) {
    return (
      <div className="appLayout">
        <aside className="sidebar">
          <h2>SaiNal One</h2>
        </aside>

        <main className="mainContent">
          <p>Loading project...</p>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="appLayout">
        <aside className="sidebar">
          <h2>SaiNal One</h2>
        </aside>

        <main className="mainContent">
          <Link href="/projects" className="backLink">
            ← Back to Projects
          </Link>
          <h1>Project not found</h1>
        </main>
      </div>
    );
  }

  const progress = calculateProgress();

  return (
    <div className="appLayout">
      <aside className="sidebar">
        <h2>SaiNal One</h2>

        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/leads">Leads</Link>
          <Link href="/quotes">Quotes</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/ai-assistant">AI Assistant</Link>
        </nav>
      </aside>

      <main className="mainContent">
        <Link href="/projects" className="backLink">
          ← Back to Projects
        </Link>

        <div className="topBar">
          <h1>{project.project_name}</h1>

          <button
            className="primaryBtn"
            onClick={() => setShowTaskForm(!showTaskForm)}
          >
            {showTaskForm ? "Close" : "Add Task"}
          </button>
        </div>

        <section className="detailsGrid">
          <div className="panel">
            <h3>Project Information</h3>
            <p><strong>Status:</strong> {project.status}</p>
            <p><strong>Amount:</strong> {project.amount}</p>
            <p><strong>Start Date:</strong> {project.start_date || "-"}</p>
            <p><strong>Due Date:</strong> {project.due_date || "-"}</p>
          </div>

          <div className="panel">
            <h3>Project Progress</h3>
            <h2>{progress}%</h2>
            <p>{tasks.length} total tasks</p>
            <p>
              {tasks.filter((task) => task.status === "Completed").length} completed
            </p>
          </div>
        </section>

        {showTaskForm && (
          <form className="leadForm" onSubmit={addTask}>
            <input
              name="task_name"
              placeholder="Task Name"
              value={taskForm.task_name}
              onChange={handleTaskChange}
            />

            <textarea
              name="description"
              placeholder="Task Description"
              value={taskForm.description}
              onChange={handleTaskChange}
              rows={4}
            />

            <select
              name="status"
              value={taskForm.status}
              onChange={handleTaskChange}
            >
              <option>To Do</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Blocked</option>
            </select>

            <input
              type="date"
              name="due_date"
              value={taskForm.due_date}
              onChange={handleTaskChange}
            />

            <button className="primaryBtn" type="submit">
              Save Task
            </button>
          </form>
        )}

        <section className="panel">
          <h3>Project Tasks</h3>

          {tasks.length === 0 ? (
            <p>No tasks added yet.</p>
          ) : (
            <table className="leadTable">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.task_name}</td>
                    <td>{task.description || "-"}</td>
                    <td>
                      <select
                        value={task.status || "To Do"}
                        onChange={(e) =>
                          updateTaskStatus(task.id, e.target.value)
                        }
                      >
                        <option>To Do</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                        <option>Blocked</option>
                      </select>
                    </td>
                    <td>{task.due_date || "-"}</td>
                    <td>
                      {task.created_at
                        ? new Date(task.created_at).toLocaleDateString("en-GB")
                        : "-"}
                    </td>
                    <td>
                      <button
                        className="primaryBtn"
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
