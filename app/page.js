import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="badge">SaiNal Technologies Ltd</div>

        <h1>SaiNal One</h1>

        <p>
          AI-powered CRM for managing leads, customers, quotes and business
          follow-ups in one simple platform.
        </p>

        <div className="heroButtons">
          <Link href="/dashboard" className="primaryBtn">
            View Dashboard
          </Link>

          <Link href="/leads" className="secondaryBtn">
            Manage Leads
          </Link>
        </div>
      </section>
    </main>
  );
}
