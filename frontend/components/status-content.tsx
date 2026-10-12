"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/room-api";

type HealthStatus = "ok" | "error" | "loading";

type ComponentStatus = { status: string; message?: string };

type HealthResponse = {
  status: "ok" | "error";
  info?: Record<string, ComponentStatus>;
  error?: Record<string, ComponentStatus>;
};

export function StatusContent() {
  const [status, setStatus] = useState<HealthStatus>("loading");
  const [details, setDetails] = useState<HealthResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await fetch(`${API_URL}/health`);
        const data: HealthResponse = await response.json();
        setDetails(data);
        setStatus(data.status === "ok" ? "ok" : "error");
      } catch {
        setStatus("error");
        setDetails(null);
      } finally {
        setLastChecked(new Date());
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const components = { ...details?.info, ...details?.error };

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div
        className={`rounded-xl border p-6 text-center ${
          status === "ok"
            ? "border-lime-300 bg-lime-50"
            : status === "error"
              ? "border-violet-300 bg-violet-50"
              : "border-zinc-200 bg-zinc-50"
        }`}
      >
        <p className="text-xl font-semibold text-zinc-950">
          {status === "loading" && "Checking status..."}
          {status === "ok" && "All systems operational"}
          {status === "error" && "Some systems are experiencing issues"}
        </p>
        {lastChecked && (
          <p className="mt-1 text-sm text-zinc-500">
            Last checked at {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {Object.entries(components).map(([name, value]) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
          >
            <span className="text-sm font-medium capitalize text-zinc-800">{name}</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                value.status === "up"
                  ? "bg-lime-100 text-lime-800"
                  : "bg-violet-100 text-violet-700"
              }`}
            >
              {value.status === "up" ? "Operational" : "Down"}
            </span>
          </div>
        ))}
        {Object.keys(components).length === 0 && status !== "loading" && (
          <p className="text-center text-sm text-zinc-400">Could not reach the API.</p>
        )}
      </div>
    </div>
  );
}
