"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import StatusBadge from "../../components/StatusBadge";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to load projects.");
        return;
      }

      setProjects(data);
    } catch (error) {
      console.error(error);
      alert("Error loading projects.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">

        <div className="topBar">
          <h1>Projects</h1>
        </div>

        {loading ? (
          <p>Loading projects...</p>
        ) : (
          <table className="leadTable">

            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Start Date</th>
                <th>Due Date</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>

              {projects.length === 0 ? (

                <tr>
                  <td colSpan="6">
                    No projects found yet.
                  </td>
                </tr>

              ) : (

                projects.map((project) => (

                  <tr key={project.id}>

                    <td>
                      <Link
                        href={`/projects/${project.id}`}
                        className="leadLink"
                      >
                        {project.project_name}
                      </Link>
                    </td>

                    <td>
                      <StatusBadge status={project.status} />
                    </td>

                    <td>{project.amount}</td>

                    <td>
                      {project.start_date || "-"}
                    </td>

                    <td>
                      {project.due_date || "-"}
                    </td>

                    <td>
                      {project.created_at
                        ? new Date(
                            project.created_at
                          ).toLocaleDateString("en-GB")
                        : "-"}
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>
        )}

      </main>
    </div>
  );
}
