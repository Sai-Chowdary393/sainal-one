"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProjectDetailsPage() {
  const params = useParams();
  const projectId = params.id;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  async function fetchProject() {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();

      const selectedProject = data.find(
        (item) => String(item.id) === String(projectId)
      );

      setProject(selectedProject || null);
    } catch (error) {
      console.error(error);
      alert("Error loading project.");
    } finally {
      setLoading(false);
    }
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
            <h3>Project Summary</h3>
            <p>{project.description || "No description added yet."}</p>
          </div>
        </section>

        <section className="panel">
          <h3>Project Tasks</h3>
          <p>No tasks added yet.</p>
        </section>
      </main>
    </div>
  );
}
