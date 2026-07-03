export default function PageHeader({ title, children }) {
  return (
    <div className="topBar">
      <h1>{title}</h1>

      {children && (
        <div style={{ display: "flex", gap: "10px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
