"use client";

import React, { useState, useEffect } from "react";
import {
  Leaf,
  TreePine,
  Footprints,
  Bike,
  Train,
  Car,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Award,
  RefreshCw,
  TrendingDown,
  Sun,
  Globe,
} from "lucide-react";
import type {
  CarbonFootprintSummary,
  CommuteMode,
} from "@/lib/sustainability/carbonEngine";

export default function CarbonFootprintTracker() {
  const [summary, setSummary] = useState<CarbonFootprintSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchCarbonAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/carbon-footprint");
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to load carbon analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarbonAnalytics();
  }, []);

  const handleExportESG = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const res = await fetch("/api/analytics/carbon-footprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, format: "csv" }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `WorkSphere-Scope3-ESG-Report-${summary.periodMonth.replace(" ", "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  const getModeIcon = (mode: CommuteMode) => {
    switch (mode) {
      case "WALKING":
        return <Footprints className="w-4 h-4 text-emerald-400" />;
      case "BICYCLING":
        return <Bike className="w-4 h-4 text-cyan-400" />;
      case "PUBLIC_TRANSIT":
        return <Train className="w-4 h-4 text-blue-400" />;
      case "ELECTRIC_VEHICLE":
        return <Sparkles className="w-4 h-4 text-teal-400" />;
      case "GASOLINE_CAR":
      default:
        return <Car className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <Leaf className="w-3.5 h-3.5" /> Scope 3 ESG Sustainability
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Remote Work Carbon Footprint & Eco-Tracker
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Track commuter $\text{CO}_2$ emissions across walking, cycling, and transit. Certify green workspace visits and export corporate Scope 3 ESG carbon audit reports.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleExportESG}
              disabled={exporting || !summary}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exporting ? "Generating..." : "Export Scope 3 ESG CSV"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <p className="text-sm">Calculating multimodal transit emissions and tree offset equivalencies...</p>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* Top 3 Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Avoided Emissions */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Avoided Emissions
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                  vs Driving
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                {summary.totalAvoidedKgCo2} <span className="text-sm text-slate-300">kg CO₂</span>
              </div>
              <p className="text-[11px] text-slate-400">Saved by choosing low-carbon transit & walking</p>
            </div>

            {/* Trees Offset Equivalency */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TreePine className="w-4 h-4" /> Tree Equivalency
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300">
                  {summary.periodMonth}
                </span>
              </div>
              <div className="text-3xl font-black text-white font-mono">
                🌲 {summary.treesEquivalentOffset} <span className="text-sm text-slate-300">Trees</span>
              </div>
              <p className="text-[11px] text-slate-400">Monthly carbon absorption equivalent</p>
            </div>

            {/* Eco Workspace Visits */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sun className="w-4 h-4" /> Green Certified Hubs
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                  Solar / Zero Waste
                </span>
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {summary.greenVenuesVisitedCount} <span className="text-sm text-slate-300">Visits</span>
              </div>
              <p className="text-[11px] text-slate-400">Workspaces powered by verified green grids</p>
            </div>
          </div>

          {/* Multimodal Commute Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Mode Breakdown Bars (7 cols) */}
            <div className="lg:col-span-7 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 backdrop-blur-md shadow-lg">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" /> Commute Distance & Emissions by Mode
              </h2>

              <div className="space-y-3 pt-2">
                {summary.modeBreakdown.map((item) => (
                  <div
                    key={item.mode}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-white">
                        {getModeIcon(item.mode)}
                        <span>{item.label}</span>
                      </div>
                      <span className="font-mono text-slate-300">
                        {item.distanceKm} km ({item.percentage}%)
                      </span>
                    </div>

                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>Emissions: {item.emissionsKgCo2} kg CO₂</span>
                      <span>
                        {item.mode === "WALKING" || item.mode === "BICYCLING" ? "✨ 100% Zero Emissions" : "Low Impact"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Eco-Badges Roster (5 cols) */}
            <div className="lg:col-span-5 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 backdrop-blur-md shadow-lg">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-400" /> Verified Sustainability Badges
              </h2>

              <div className="space-y-3">
                {summary.ecoBadgesEarned.map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      badge.verified
                        ? "bg-emerald-950/20 border-emerald-500/40"
                        : "bg-slate-950/40 border-slate-800 opacity-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${badge.verified ? "text-emerald-400" : "text-slate-600"}`}
                        />
                        {badge.name}
                      </h3>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-slate-300">
                        {badge.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{badge.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
