import Sidebar from "../../components/Sidebar";

export default function AIAssistant() {
  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">
        <div className="topBar">
          <div>
            <h1>AI Assistant</h1>
            <p className="helperText">
              Generate emails, quotes, project plans and business insights.
            </p>
          </div>
        </div>

        <div className="chatBox">
          <p className="aiMessage">
            Hello, I can help you write follow-up emails, generate quotes,
            create project tasks and analyse your business workflow.
          </p>

          <input placeholder="Ask AI to create a quote, email, task list or follow-up..." />
        </div>
      </main>
    </div>
  );
}
