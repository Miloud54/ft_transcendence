"use client";

const RADIUS = 60;
const STROKE = 18;
const GAP = 3;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

export function DonutChart({ data }: { data: DonutSlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-36 w-36 -rotate-90" role="img" aria-label="Répartition victoires et défaites">
        <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#e7e3f0" strokeWidth={STROKE} />
        {data.map((slice) => {
          const fraction = total === 0 ? 0 : slice.value / total;
          const dash = fraction * CIRCUMFERENCE;
          const visibleDash = Math.max(dash - GAP, 0);
          const element = (
            <circle
              key={slice.label}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeDasharray={`${visibleDash} ${CIRCUMFERENCE - visibleDash}`}
              strokeDashoffset={-offset - GAP / 2}
            />
          );
          offset += dash;
          return element;
        })}
        <text
          x="80"
          y="80"
          transform="rotate(90 80 80)"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-zinc-950 font-semibold tabular-nums"
          style={{ fontSize: "28px" }}
        >
          {total}
        </text>
      </svg>

      <ul className="space-y-2 text-sm">
        {data.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
            <span className="text-zinc-600">{slice.label}</span>
            <span className="font-medium tabular-nums text-zinc-950">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}