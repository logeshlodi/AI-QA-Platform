export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="aiqa-stat">
      <p className="aiqa-stat__label">{label}</p>
      <p className="aiqa-stat__value">{value}</p>
      {hint ? <p className="aiqa-stat__hint">{hint}</p> : null}
    </div>
  );
}
