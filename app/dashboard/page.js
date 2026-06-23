import Link from "next/link";

const cards = [
  { title: "Total Leads", value: "145" },
  { title: "Open Deals", value: "18" },
  { title: "Revenue", value: "£12,500" },
  { title: "AI Insights", value: "7" },
];

const leads = ["ABC Builders", "XYZ Plumbing", "Acme Services"];

export default function Dashboard() {
  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">
        <div className="topBar">
          <h1>Dashboard</h1>
          <input placeholder="Search leads, customers..." />
        </div>

        <section className="cardGrid">
          {cards.map((card) => (
            <div className="statCard" key={card.title}>
              <p>{card.title}</p>
              <h2>{card.value}</h2>
            </div>
          ))}
        </section>

        <section className="dashboardGrid">
          <div className="panel">
            <h3>Recent Leads</h3>
            {leads.map((lead) => (
              <p key={lead}>{lead}</p>
            ))}
          </div>

          <div className="panel">
            <h3>AI Recommendations</h3>
            <p>Follow up ABC Builders</p>
            <p>Potential Revenue: £4,200</p>
            <p>Send proposal</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>SaiNal One</h2>

      <nav>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/leads">Leads</Link>
        <Link href="#">Customers</Link>
        <Link href="#">Quotes</Link>
        <Link href="/ai-assistant">AI Assistant</Link>
        <Link href="#">Settings</Link>
      </nav>
    </aside>
  );
}
