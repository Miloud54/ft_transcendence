"use client";

import { motion } from "framer-motion";

type StatTileProps = {
  label: string;
  value: string | number;
  trend?: string;
  accent?: string;
};

export function StatTile({ label, value, trend, accent = "#4d37fb" }: StatTileProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-xl border border-zinc-200 border-t-4 bg-white p-5"
      style={{ borderTopColor: accent }}
    >
      <p className="text-sm text-zinc-500">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-zinc-950">{value}</span>
        {trend && <span className="text-xs font-medium text-[#0ca30c]">{trend}</span>}
      </div>
    </motion.div>
  );
}
