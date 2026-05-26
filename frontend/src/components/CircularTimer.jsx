export default function CircularTimer({ seconds, total, size = 110, stroke = 10, label }) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = total ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const offset = circ * (1 - pct);

  // Required colors:
  // normal #534AB7, <=10s #F97316 (orange), <=5s #EF4444 (red) + pulse
  let color = "#534AB7";
  let critical = false;
  if (seconds <= 5) {
    color = "#EF4444";
    critical = true;
  } else if (seconds <= 10) {
    color = "#F97316";
  }

  return (
    <div
      data-testid="circular-timer"
      className={`relative inline-flex flex-col items-center justify-center ${critical ? "hf-pulse" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(83,74,183,0.12)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-stat text-2xl font-semibold" style={{ color }}>{seconds}</span>
        {label && <span className="text-[10px] uppercase tracking-wider" style={{ color }}>{label}</span>}
      </div>
    </div>
  );
}
