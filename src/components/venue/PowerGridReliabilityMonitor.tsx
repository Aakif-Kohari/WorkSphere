"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  Plug,
  BatteryCharging,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Laptop,
  Smartphone,
  Tablet,
  Flag,
} from "lucide-react";
import type {
  VenuePowerGridSummary,
  DeskPowerNode,
  OutletHealthStatus,
} from "@/lib/telemetry/powerGridEngine";

interface PowerGridReliabilityMonitorProps {
  venueId?: string;
  venueName?: string;
}

export default function PowerGridReliabilityMonitor({
  venueId = "venue-sf-01",
  venueName = "Mission Focus Coworking & Cafe",
}: PowerGridReliabilityMonitorProps) {
  const [summary, setSummary] = useState<VenuePowerGridSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportingNode, setReportingNode] = useState<DeskPowerNode | null>(null);
  const [reportSuccessMsg, setReportSuccessMsg] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchPowerGrid = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/telemetry/outlets?venueId=${venueId}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to load power grid telemetry:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPowerGrid();
  }, [venueId]);

  const handleReportDeadPlug = async (node: DeskPowerNode, issueType: string) => {
    setSubmittingReport(true);
    try {
      const res = await fetch("/api/telemetry/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatId: node.seatId,
          issueType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReportingNode(null);
        setReportSuccessMsg(`Issue logged for ${node.seatNumber}. Facility ops notified!`);
        setTimeout(() => setReportSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Report error:", err);
    } finally {
      setSubmittingReport(false);
    }
  };

  const getStatusBadge = (status: OutletHealthStatus) => {
    switch (status) {
      case "OPERATIONAL_OPTIMAL":
        return {
          label: "⚡ Verified Operational",
          color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case "THROTTLED_LOW_WATTAGE":
        return {
          label: "⚠️ Throttled (Low Wattage)",
          color: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
        };
      case "DEAD_NO_POWER":
      default:
        return {
          label: "🔴 Dead Socket (No Voltage)",
          color: "bg-rose-500/10 border-rose-500/30 text-rose-400",
          icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
        };
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/30 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" /> Real-Time Power Grid Telemetry
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Smart Power Grid & Outlet Voltage Monitor
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Crowdsourced and IoT-verified socket wattage delivery (140W/100W USB-C PD), circuit reliability ratings, and dead-plug reporting across workspace desks.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchPowerGrid}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh Grid
            </button>
          </div>
        </div>

        {reportSuccessMsg && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{reportSuccessMsg}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <p className="text-sm">Querying venue smart breaker telemetry & socket voltage feeds...</p>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* Top 3 Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Overall Grid Health */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 backdrop-blur-md shadow-lg">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <BatteryCharging className="w-4 h-4" /> Grid Reliability Score
              </span>
              <div className="text-3xl font-black text-white font-mono">
                {summary.overallGridHealthScore}%
              </div>
              <p className="text-[11px] text-slate-400">
                {summary.workingSocketsCount} of {summary.totalSocketsCount} Outlets Operational
              </p>
            </div>

            {/* Fast PD Coverage */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 backdrop-blur-md shadow-lg">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> 100W+ Fast PD Desks
              </span>
              <div className="text-3xl font-black text-cyan-400 font-mono">
                {summary.fastChargingCoveragePct}% <span className="text-sm text-slate-300">Coverage</span>
              </div>
              <p className="text-[11px] text-slate-400">Full 100W/140W USB-C laptop power delivery</p>
            </div>

            {/* Nominal Line Voltage */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 backdrop-blur-md shadow-lg">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> Clean AC Voltage
              </span>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                {summary.nominalVoltageV}V <span className="text-sm text-slate-300">RMS</span>
              </div>
              <p className="text-[11px] text-slate-400">Stable sine-wave grid with surge protection</p>
            </div>
          </div>

          {/* Sockets Grid */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 backdrop-blur-md shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plug className="w-5 h-5 text-amber-400" /> Desk Power Socket Roster
              </h2>
              <span className="text-xs text-slate-400 font-mono">Live Circuit Sensor Feed</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.nodes.map((node) => {
                const badge = getStatusBadge(node.status);

                return (
                  <div
                    key={node.seatId}
                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{node.seatNumber}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                          {node.maxWattageW}W Max
                        </span>
                      </div>

                      <div className={`p-2 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 ${badge.color}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">Socket Type</span>
                          <strong className="text-slate-200">{node.socketType.replace(/_/g, " ")}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">Measured V</span>
                          <strong className="text-slate-200">{node.measuredVoltageV} V</strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {node.reliabilityScorePct}% Reliable
                      </span>

                      <button
                        onClick={() => setReportingNode(node)}
                        className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
                      >
                        <Flag className="w-3 h-3" /> Report Issue
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Report Dead Plug Modal */}
      {reportingNode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Report Broken Socket
              </h3>
              <button
                onClick={() => setReportingNode(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">Affected Workspace</span>
                <strong className="text-white text-sm block">{reportingNode.seatNumber}</strong>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block">Select Observed Issue</label>
                <div className="space-y-1.5">
                  {[
                    { id: "DEAD_NO_POWER", label: "Dead Socket (Zero power / no charging)" },
                    { id: "THROTTLED_LOW_WATTAGE", label: "Slow Charging (Wattage throttled < 15W)" },
                    { id: "LOOSE_PHYSICAL_FAULT", label: "Loose Plug (Charger falls out of socket)" },
                  ].map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => handleReportDeadPlug(reportingNode, issue.id)}
                      disabled={submittingReport}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-left text-slate-300 text-xs transition"
                    >
                      {issue.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setReportingNode(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
