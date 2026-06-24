import Link from "next/link";

const leads = [
  {
    id: "1",
    name: "John Smith",
    company: "ABC Builders",
    email: "john@abcbuilders.co.uk",
    phone: "07123456789",
    status: "New",
    value: "£2,500",
  },
  {
    id: "2",
    name: "Jane Brown",
    company: "XYZ Plumbing",
    email: "jane@xyzplumbing.co.uk",
    phone: "07987654321",
    status: "Proposal Sent",
    value: "£4,000",
  },
  {
    id: "3",
    name: "Michael Lee",
    company: "Acme Services",
    email: "michael@acme.co.uk",
    phone: "07444555666",
    status: "Follow Up",
    value: "£1,800",
  },
];

export default function LeadDetails({ params }) {
  const lead = leads.find((item) => item.id === params.id) || leads[0];

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
        <Link href="/leads" className="backLink">
          ← Back to Leads
        </Link>

        <div className="topBar">
          <h1>{lead.name}</h1>
          <button className="primaryBtn">Generate Quote</button>
        </div>

        <section className="detailsGrid">
          <div className="panel">
            <h3>Lead Information</h3>
            <p><strong>Company:</strong> {lead.company}</p>
            <p><strong>Email:</strong> {lead.email}</p>
            <p><strong>Phone:</strong> {lead.phone}</p>
            <p><strong>Status:</strong> {lead.status}</p>
            <p><strong>Value:</strong> {lead.value}</p>
          </div>

          <div className="panel">
            <h3>AI Recommendations</h3>
            <p>Prepare a follow-up email for this lead.</p>
            <p>Suggest a quote based on project value.</p>
            <p>Schedule follow-up in 2 days.</p>

            <button className="primaryBtn">Generate Email</button>
          </div>
        </section>

        <section className="detailsGrid">
          <div className="panel">
            <h3>Notes</h3>
            <p>Initial enquiry received from website contact form.</p>
            <p>Customer interested in business website and automation.</p>
          </div>

          <div className="panel">
            <h3>Activity Timeline</h3>
            <p>Lead created</p>
            <p>Email draft generated</p>
            <p>Quote pending</p>
          </div>
        </section>
      </main>
    </div>
  );
}
