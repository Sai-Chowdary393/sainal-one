import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>SaiNal One</h2>

      <nav>
        <Link href="/dashboard">🏠 Dashboard</Link>
        <Link href="/leads">👥 Leads</Link>
        <Link href="/quotes">📄 Quotes</Link>
        <Link href="/customers">🏢 Customers</Link>
        <Link href="/projects">📁 Projects</Link>
        <Link href="/ai-assistant">🤖 AI Assistant</Link>
      </nav>
    </aside>
  );
}
