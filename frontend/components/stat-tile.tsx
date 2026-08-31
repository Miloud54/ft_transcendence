type StatTileProps = {
  label: string;
  value: string | number;
  trend?: string;
};

export function StatTile({ label, value, trend }: StatTileProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-zinc-950">{value}</span>
        {trend && <span className="text-xs font-medium text-[#0ca30c]">{trend}</span>}
      </div>
    </div>
  );
}