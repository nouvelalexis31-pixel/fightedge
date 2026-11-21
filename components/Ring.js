// Jauge circulaire (probabilité, réussite…) en SVG pur : lisible en un coup d'œil.
export default function Ring({ value, size = 56, stroke = 6, label, color }) {
  const v = Math.max(0, Math.min(1, value ?? 0)), r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const col = color || (v >= 0.7 ? "#07875a" : v >= 0.55 ? "#1d4ed8" : "#c2410c");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label || `${Math.round(v * 100)} %`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-card2)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.26} fontWeight="800" fill="currentColor">{Math.round(v * 100)}%</text>
    </svg>
  );
}
