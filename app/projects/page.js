"use client";

import { useEffect, useMemo, useState } from "react";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

import ProjectCreateForm from "./components/ProjectCreateForm";
import ProjectSummaryCards from "./components/ProjectSummaryCards";
import ProjectToolbar from "./components/ProjectToolbar";
import ProjectsTable from "./components/ProjectsTable";

import {
  buildProjectRecords,
  getMoneyValue,
  normaliseStatus,
} from "./project-utils";

import styles from "./projects.module.css";

const INITIAL_FORM_DATA = {
  project_name: "",
  description: "",
  amount: "",
  status: "Planning",
  start_date: "",
  due_date: "",
};

export const PROJECT_STATUS_OPTIONS = [
  "Planning",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [searchValue, setSearchValue] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [formData, setFormData] = useState(
    INITIAL_FORM_DATA
  );

  useEffect(() => {
    fetchProjectWorkspace();
  }, []);

  useEffect(() => {
    try {
      const searchParams =
        new URLSearchParams(
          window.location.search
        );

      if (
        searchParams.get("create") ===
        "true"
      ) {
        setShowForm(true);

        window.history.replaceState(
          {},
          "",
          window.location.pathname
        );
      }
    } catch (error) {
      console.error(
        "Unable to read project parameters:",
        error
      );
    }
  }, []);

  async function fetchProjectWorkspace() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        projectsResponse,
        tasksResponse,
      ] = await Promise.all([
        fetch("/api/projects", {
          cache: "no-store",
        }),

        fetch("/api/tasks", {
          cache: "no-store",
        }),
      ]);

      const projectsData =
        await projectsResponse.json();

      const tasksData =
        tasksResponse.ok
          ? await tasksResponse.json()
          : [];

      if (!projectsResponse.ok) {
        throw new Error(
          projectsData.error ||
            "Failed to load projects."
        );
      }

      setProjects(
        Array.isArray(projectsData)
          ? projectsData
          : []
      );

      setTasks(
        Array.isArray(tasksData)
          ? tasksData
          : []
      );
    } catch (error) {
      console.error(
        "Project loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load the projects."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(event) {
    const { name, value } =
      event.target;

    setFormData(
      (currentFormData) => ({
        ...currentFormData,
        [name]: value,
      })
    );
  }

  function openCreateForm() {
    setFormData(INITIAL_FORM_DATA);
    setShowForm(true);
  }

  function closeCreateForm() {
    setFormData(INITIAL_FORM_DATA);
    setShowForm(false);
  }

  async function createProject(event) {
    event.preventDefault();

    const projectName =
      formData.project_name.trim();

    if (!projectName) {
      alert(
        "Please enter a project name."
      );

      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/projects",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            project_name: projectName,

            description:
              formData.description.trim(),

            amount:
              formData.amount.trim(),

            status:
              formData.status ||
              "Planning",

            start_date:
              formData.start_date || null,

            due_date:
              formData.due_date || null,

            customer_id: null,
            quote_id: null,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create project."
        );
      }

      const createdProject =
        Array.isArray(data)
          ? data[0]
          : data;

      if (createdProject) {
        setProjects(
          (currentProjects) => [
            createdProject,
            ...currentProjects,
          ]
        );
      } else {
        await fetchProjectWorkspace();
      }

      closeCreateForm();

      alert(
        "Project created successfully."
      );
    } catch (error) {
      console.error(
        "Project creation error:",
        error
      );

      alert(
        error.message ||
          "Error creating project."
      );
    } finally {
      setSaving(false);
    }
  }

  const projectRecords = useMemo(
    () =>
      buildProjectRecords(
        projects,
        tasks
      ),
    [projects, tasks]
  );

  const filteredProjects = useMemo(() => {
    const search = searchValue
      .trim()
      .toLowerCase();

    return projectRecords.filter(
      (project) => {
        const matchesSearch =
          !search ||
          [
            project.project_name,
            project.description,
            project.status,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search)
          );

        const matchesStatus =
          statusFilter === "All" ||
          normaliseStatus(
            project.status
          ) ===
            normaliseStatus(
              statusFilter
            );

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );
  }, [
    projectRecords,
    searchValue,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const active = projectRecords.filter(
      (project) =>
        [
          "planning",
          "in progress",
          "on hold",
        ].includes(
          normaliseStatus(
            project.status
          )
        )
    ).length;

    const completed =
      projectRecords.filter(
        (project) =>
          normaliseStatus(
            project.status
          ) === "completed"
      ).length;

    const delayed =
      projectRecords.filter(
        (project) =>
          project.metrics.delayed
      ).length;

    const totalValue =
      projectRecords.reduce(
        (total, project) =>
          total +
          getMoneyValue(
            project.amount
          ),
        0
      );

    return {
      total: projectRecords.length,
      active,
      completed,
      delayed,
      totalValue,
    };
  }, [projectRecords]);

  const filtersActive =
    Boolean(searchValue) ||
    statusFilter !== "All";

  function clearFilters() {
    setSearchValue("");
    setStatusFilter("All");
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="Projects"
        description="Manage delivery, progress, tasks and project risk."
      >
        <div className={styles.page}>
          <section
            className={
              styles.pageHeader
            }
          >
            <div
              className={
                styles.pageHeaderCopy
              }
            >
              <span
                className={
                  styles.eyebrow
                }
              >
                Delivery workspace
              </span>

              <h2>
                Project operations
              </h2>

              <p>
                Track active delivery,
                task progress, due dates
                and project value. Full
                customer and delivery
                details remain inside each
                project workspace.
              </p>
            </div>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={
                showForm
                  ? closeCreateForm
                  : openCreateForm
              }
            >
              <span>
                {showForm ? "×" : "+"}
              </span>

              {showForm
                ? "Close form"
                : "Create project"}
            </button>
          </section>

          {showForm && (
            <ProjectCreateForm
              formData={formData}
              saving={saving}
              statusOptions={
                PROJECT_STATUS_OPTIONS
              }
              onChange={
                handleFormChange
              }
              onSubmit={
                createProject
              }
              onCancel={
                closeCreateForm
              }
            />
          )}

          <ProjectSummaryCards
            summary={summary}
          />

          <ProjectToolbar
            searchValue={searchValue}
            statusFilter={
              statusFilter
            }
            statusOptions={
              PROJECT_STATUS_OPTIONS
            }
            filtersActive={
              filtersActive
            }
            onSearchChange={
              setSearchValue
            }
            onStatusChange={
              setStatusFilter
            }
            onClearFilters={
              clearFilters
            }
          />

          <ProjectsTable
            projects={
              filteredProjects
            }
            loading={loading}
            errorMessage={
              errorMessage
            }
            filtersActive={
              filtersActive
            }
            onRetry={
              fetchProjectWorkspace
            }
            onClearFilters={
              clearFilters
            }
            onCreateProject={
              openCreateForm
            }
          />
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
