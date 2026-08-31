"use client";

import { useState, type MouseEvent } from "react";

const COLOR = "#6d28d9";
const WIDTH = 480;
const HEIGHT = 160;
const PADDING = 16;

export function LineChart({ data }: { data: number[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = PADDING + (index / (data.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);
    return { x, y, value };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${HEIGHT - PADDING} L ${points[0].x} ${HEIGHT - PADDING} Z`;

  function handleMove(event: MouseEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (data.length - 1));
    setHoverIndex(Math.min(Math.max(index, 0), data.length - 1));
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Progression du nombre de parties jouées dans le temps"
      >
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={PADDING}
            x2={WIDTH - PADDING}
            y1={PADDING + fraction * (HEIGHT - PADDING * 2)}
            y2={PADDING + fraction * (HEIGHT - PADDING * 2)}
            stroke="#e7e3f0"
            strokeWidth={1}
          />
        ))}

        <path d={areaPath} fill={COLOR} fillOpacity={0.08} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke={COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {hovered && (
          <>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PADDING}
              y2={HEIGHT - PADDING}
              stroke={COLOR}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill={COLOR} stroke="white" strokeWidth={2} />
          </>
        )}

        <rect
          width={WIDTH}
          height={HEIGHT}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}
        >
          {hovered.value}
        </div>
      )}
    </div>
  );
}