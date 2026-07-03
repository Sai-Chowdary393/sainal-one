export default function ProgressBar({ value }) {
  const progress = Math.min(Math.max(value || 0, 0), 100);

  return (
    <div className="progressWrapper">
      <div className="progressTrack">
        <div className="progressFill" style={{ width: `${progress}%` }} />
      </div>
      <span>{progress}%</span>
    </div>
  );
}
