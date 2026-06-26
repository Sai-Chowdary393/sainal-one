import Link from "next/link";

export default function AIAssistant() {
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
        <h1>AI Assistant</h1>

        <div className="chatBox">
          <p className="aiMessage">
            Hello, I can help you write follow-up emails, generate quotes and
            analyse leads.
          </p>

          <input placeholder="Ask AI to create a quote or follow-up email..." />
        </div>
      </main>
    </div>
  );
}
