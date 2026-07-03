import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="badge">SaiNal Technologies Ltd</div>

        <h1>SaiNal One</h1>

        <p>
          AI-powered Business Operating System for managing leads, quotes,
          customers, projects, tasks, invoices and business automation in one
          platform.
        </p>

        <div className="heroButtons">
          <Link href="/dashboard" className="primaryBtn">
            View Dashboard
          </Link>

          <Link href="/leads" className="secondaryBtn">
            Manage Leads
          </Link>
        </div>

        <div className="featureGrid">
          <div className="featureCard">
            <h3>Lead Management</h3>
            <p>Capture, track and manage every business opportunity.</p>
          </div>

          <div className="featureCard">
            <h3>Quote Generator</h3>
            <p>Create professional quotes and convert them into customers.</p>
          </div>

          <div className="featureCard">
            <h3>Customer CRM</h3>
            <p>Store customer details, quotes, projects and activity.</p>
          </div>

          <div className="featureCard">
            <h3>Project Tracking</h3>
            <p>Start projects, add tasks and monitor progress.</p>
          </div>

          <div className="featureCard">
            <h3>Invoices</h3>
            <p>Generate invoices and track payments in the future.</p>
          </div>

          <div className="featureCard">
            <h3>AI Assistant</h3>
            <p>Use AI to generate emails, quotes, tasks and insights.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
