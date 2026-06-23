import Link from "next/link";

const leads = [
  {
    name: "John Smith",
    company: "ABC Builders",
    status: "New",
    value: "£2,500",
  },
  {
    name: "Jane Brown",
    company: "XYZ Plumbing",
    status: "Proposal Sent",
    value: "£4,000",
  },
  {
    name: "Michael Lee",
    company: "Acme Services",
    status: "Follow Up",
    value: "£1,800",
  },
];

export default function Leads() {
  return (
    <div className="appLayout">
      <aside className="sidebar">
        <h2>SaiNal One</h2>
        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/leads">Leads</Link>
          <Link href="/ai-assistant">AI Assistant</Link>
        </nav>
      </aside>

      <main className="mainContent">
        <div className="topBar">
          <h1>Leads</h1>
          <button className="primaryBtn">Add Lead</button>
        </div>

        <table className="leadTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Status</th>
              <th>Value</th>
            </tr>
          </thead>

          <tbody>
            {leads.map((lead) => (
              <tr key={lead.name}>
                <td>{lead.name}</td>
                <td>{lead.company}</td>
                <td>{lead.status}</td>
                <td>{lead.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
