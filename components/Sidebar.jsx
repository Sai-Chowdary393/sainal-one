"use client";

import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Sidebar() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="sidebar">
      <h2>SaiNal One</h2>

      <nav>
        <Link href="/dashboard">🏠 Dashboard</Link>
        <Link href="/leads">👥 Leads</Link>
        <Link href="/quotes">📄 Quotes</Link>
        <Link href="/proposals">📑 Proposals</Link>
        <Link href="/customers">🏢 Customers</Link>
        <Link href="/projects">📁 Projects</Link>
        <Link href="/invoices">💷 Invoices</Link>
        <Link href="/emails">✉️ Emails</Link>
        <Link href="/follow-ups">⏰ Follow-ups</Link>
        <Link href="/ai-assistant">🤖 AI Assistant</Link>
        <Link href="/profile">👤 Profile</Link>
        <Link href="/settings">⚙️ Settings</Link>

        <button className="logoutBtn" onClick={handleLogout}>
          Logout
        </button>
      </nav>
    </aside>
  );
}
