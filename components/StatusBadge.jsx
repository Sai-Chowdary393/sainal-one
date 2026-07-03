export default function StatusBadge({ status }) {
  return <span className={`statusBadge ${getStatusClass(status)}`}>{status}</span>;
}

function getStatusClass(status) {
  if (!status) return "statusDefault";

  const value = status.toLowerCase();

  if (value.includes("completed") || value.includes("won") || value.includes("active")) {
    return "statusSuccess";
  }

  if (value.includes("progress") || value.includes("sent")) {
    return "statusInfo";
  }

  if (value.includes("blocked") || value.includes("lost") || value.includes("cancelled")) {
    return "statusDanger";
  }

  if (value.includes("planning") || value.includes("new") || value.includes("draft")) {
    return "statusWarning";
  }

  return "statusDefault";
}
