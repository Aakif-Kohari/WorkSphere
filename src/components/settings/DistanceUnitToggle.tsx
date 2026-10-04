"use client";

import React, { useEffect, useState } from "react";
import { Compass, Check } from "lucide-react";
import {
  getStoredDistanceUnit,
  setStoredDistanceUnit,
  type DistanceUnit,
} from "@/lib/geo/formatDistance";

export function DistanceUnitToggle() {
  const [unit, setUnit] = useState<DistanceUnit>("METRIC");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUnit(getStoredDistanceUnit());
    setMounted(true);

    const handleUnitChange = (e: Event) => {
      const customEvent = e as CustomEvent<DistanceUnit>;
      if (customEvent.detail) {
        setUnit(customEvent.detail);
      }
    };

    window.addEventListener("worksphere_distance_unit_change", handleUnitChange);
    return () => {
      window.removeEventListener("worksphere_distance_unit_change", handleUnitChange);
    };
  }, []);

  const handleSelect = (newUnit: DistanceUnit) => {
    setUnit(newUnit);
    setStoredDistanceUnit(newUnit);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Distance Units
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Choose how walking and driving distances are formatted across WorkSphere.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <button
          type="button"
          onClick={() => handleSelect("METRIC")}
          className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            unit === "METRIC"
              ? "border-blue-600 bg-blue-50/50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
          }`}
        >
          <div className="flex flex-col text-left">
            <span>Kilometers (km)</span>
            <span className="text-[11px] text-zinc-400">e.g. 1.2 km, 500 m</span>
          </div>
          {unit === "METRIC" && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
        </button>

        <button
          type="button"
          onClick={() => handleSelect("IMPERIAL")}
          className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            unit === "IMPERIAL"
              ? "border-blue-600 bg-blue-50/50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
          }`}
        >
          <div className="flex flex-col text-left">
            <span>Miles (mi)</span>
            <span className="text-[11px] text-zinc-400">e.g. 0.8 mi, 350 ft</span>
          </div>
          {unit === "IMPERIAL" && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
        </button>
      </div>
    </div>
  );
}
