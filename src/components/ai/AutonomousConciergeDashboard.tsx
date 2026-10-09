"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  CloudRain,
  Volume2,
  Wind,
  Thermometer,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Compass,
  Layers,
  Activity,
  ChevronRight,
  User,
} from "lucide-react";
import {
  EnvironmentalSensorFeed,
  MemberWorkspaceSession,
  RebalanceRecommendation,
  AutonomousConciergeEngine,
} from "@/lib/ai/autonomousConciergeEngine";

const INITIAL_SENSORS: EnvironmentalSensorFeed[] = [
  {
    venueId: "venue-sf-01",
    zoneId: "zone-outdoor-terrace",
    zoneName: "Skyline Outdoor Terrace",
    zoneType: "outdoor_terrace",
    temperatureC: 17.5,
    humidityPercent: 88,
    co2Ppm: 420,
    decibelLevel: 58,
    weatherCondition: "rain_storm",
    isDirectSunlight: false,
    occupancyCount: 8,
    maxCapacity: 25,
  },
  {
    venueId: "venue-sf-01",
    zoneId: "zone-open-atrium",
    zoneName: "Central Glass Atrium",
    zoneType: "open_floor",
    temperatureC: 22.0,
    humidityPercent: 45,
    co2Ppm: 1250,
    decibelLevel: 74,
    weatherCondition: "clear",
    isDirectSunlight: true,
    occupancyCount: 38,
    maxCapacity: 45,
  },
  {
    venueId: "venue-sf-01",
    zoneId: "zone-quiet-library",
    zoneName: "Deep Focus Acoustic Library",
    zoneType: "quiet_library",
    temperatureC: 21.5,
    humidityPercent: 42,
    co2Ppm: 680,
    decibelLevel: 42,
    weatherCondition: "clear",
    isDirectSunlight: false,
    occupancyCount: 14,
    maxCapacity: 30,
  },
  {
    venueId: "venue-sf-01",
    zoneId: "zone-biophilic-bay",
    zoneName: "Biophilic Garden Bay",
    zoneType: "window_bay",
    temperatureC: 22.2,
    humidityPercent: 48,
    co2Ppm: 540,
    decibelLevel: 48,
    weatherCondition: "clear",
    isDirectSunlight: true,
    occupancyCount: 12,
    maxCapacity: 20,
  },
];

const INITIAL_MEMBERS: MemberWorkspaceSession[] = [
  {
    memberId: "mem-101",
    memberName: "Sarah Jenkins",
    currentDeskId: "Desk-Terrace-04",
    currentZoneId: "zone-outdoor-terrace",
    assignedZoneName: "Skyline Outdoor Terrace",
    deskType: "outdoor_terrace",
    preferences: {
      autoPilotEnabled: true,
      preferredNoiseLevel: "moderate",
      prefersNaturalLight: true,
      temperatureComfortC: 22,
    },
    currentComfortIndex: 20,
  },
  {
    memberId: "mem-102",
    memberName: "David Kim",
    currentDeskId: "Desk-Atrium-19",
    currentZoneId: "zone-open-atrium",
    assignedZoneName: "Central Glass Atrium",
    deskType: "open_desk",
    preferences: {
      autoPilotEnabled: true,
      preferredNoiseLevel: "silent",
      prefersNaturalLight: false,
      temperatureComfortC: 21,
    },
    currentComfortIndex: 45,
  },
  {
    memberId: "mem-103",
    memberName: "Elena Rostova",
    currentDeskId: "Desk-Library-08",
    currentZoneId: "zone-quiet-library",
    assignedZoneName: "Deep Focus Acoustic Library",
    deskType: "quiet_booth",
    preferences: {
      autoPilotEnabled: false,
      preferredNoiseLevel: "silent",
      prefersNaturalLight: false,
      temperatureComfortC: 21.5,
    },
    currentComfortIndex: 94,
  },
];

/**
 * Props for the {@link AutonomousConciergeDashboard} component.
 */
export interface AutonomousConciergeDashboardProps {
  /**
   * Initial environmental telemetry sensor feeds across workspace zones.
   * If not provided, default mock sensors (Terrace, Atrium, Quiet Library, Biophilic Bay) are used.
   */
  initialSensors?: EnvironmentalSensorFeed[];

  /**
   * Initial workspace member sessions and preferences.
   * If not provided, default active member sessions are used.
   */
  initialMembers?: MemberWorkspaceSession[];

  /**
   * Default state for the global autonomous re-balancing auto-pilot.
   * When true, high-priority migrations are auto-applied without manual confirmation.
   * @default true
   */
  defaultAutoPilot?: boolean;

  /**
   * Callback invoked whenever a desk migration recommendation is confirmed or auto-applied.
   * @param recommendation The rebalancing recommendation that was applied.
   */
  onMigrationApplied?: (recommendation: RebalanceRecommendation) => void;

  /**
   * Callback invoked when the user toggles the global Auto-Pilot switch.
   * @param enabled True if auto-pilot was enabled, false if prompt-only mode.
   */
  onAutoPilotToggle?: (enabled: boolean) => void;

  /**
   * Callback invoked when an environmental event simulation is triggered.
   * @param scenario The injected event type ('rain' | 'noise' | 'hvac_reset').
   */
  onScenarioTriggered?: (scenario: "rain" | "noise" | "hvac_reset") => void;

  /**
   * Optional custom CSS class names to apply to the root container.
   */
  className?: string;
}

/**
 * Autonomous AI Concierge & Weather/Noise Re-Balancing Dashboard.
 *
 * Renders real-time zone micro-climate telemetry, computes dynamic comfort scores,
 * detects sudden weather storms and acoustic spikes, and provides automated or one-click
 * desk migration proposals to maintain optimal focus equilibrium.
 */
export default function AutonomousConciergeDashboard({
  initialSensors = INITIAL_SENSORS,
  initialMembers = INITIAL_MEMBERS,
  defaultAutoPilot = true,
  onMigrationApplied,
  onAutoPilotToggle,
  onScenarioTriggered,
  className = "",
}: AutonomousConciergeDashboardProps = {}) {
  const [sensors, setSensors] = useState<EnvironmentalSensorFeed[]>(initialSensors);
  const [members, setMembers] = useState<MemberWorkspaceSession[]>(initialMembers);
  const [autoPilotGlobal, setAutoPilotGlobal] = useState(defaultAutoPilot);
  const [appliedMigrations, setAppliedMigrations] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Compute rebalance recommendations
  const analysis = AutonomousConciergeEngine.runRebalanceOptimizationPass(sensors, members);

  // Trigger sudden scenario simulator
  const triggerScenario = (type: "rain" | "noise" | "hvac_reset") => {
    setIsSimulating(true);
    onScenarioTriggered?.(type);

    setTimeout(() => {
      setSensors((prev) => {
        return prev.map((s) => {
          if (type === "rain" && s.zoneType === "outdoor_terrace") {
            return { ...s, weatherCondition: "rain_storm", temperatureC: 16.0, humidityPercent: 92 };
          }
          if (type === "noise" && s.zoneType === "open_floor") {
            return { ...s, decibelLevel: 78, co2Ppm: 1400 };
          }
          if (type === "hvac_reset") {
            return {
              ...s,
              weatherCondition: "clear",
              decibelLevel: s.zoneType === "quiet_library" ? 40 : 54,
              co2Ppm: 600,
              temperatureC: 21.8,
            };
          }
          return s;
        });
      });
      setIsSimulating(false);
    }, 600);
  };

  const handleToggleAutoPilot = () => {
    const nextState = !autoPilotGlobal;
    setAutoPilotGlobal(nextState);
    onAutoPilotToggle?.(nextState);
  };

  const applyMigration = (rec: RebalanceRecommendation) => {
    setAppliedMigrations((prev) => [...prev, rec.id]);
    onMigrationApplied?.(rec);
  };

  return (
    <div className={`w-full max-w-6xl mx-auto space-y-6 text-slate-100 ${className}`}>

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20 shadow-sm">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Autonomous AI Concierge
              <BoundarySafeTooltip
                content="Continuous 15-second multi-sensor scanning & automated desk migration engine."
                align="left"
              >
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono cursor-help">
                  AUTO-PILOT ACTIVE
                </span>
              </BoundarySafeTooltip>
            </h2>
            <p className="text-sm text-slate-400">
              Proactive micro-climate, sudden weather shift & acoustic noise re-balancing agent
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleAutoPilot}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
              autoPilotGlobal
                ? "Auto-Pilot: High-priority migrations (rain, noise spikes) are automatically confirmed."
                : "Prompt Mode: You will receive one-click notification prompts before desk migration."
            }
            align="right"
          >
            <button
              onClick={handleToggleAutoPilot}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                autoPilotGlobal
                  ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              Auto-Pilot {autoPilotGlobal ? "Engaged (Auto-Migrate)" : "Prompt Only"}
            </button>
          </BoundarySafeTooltip>
        </div>
      </div>

      {/* Scenario Simulator Buttons */}
      <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-bold text-slate-300 flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-cyan-400" /> Environmental Event Injector:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => triggerScenario("rain")}
            disabled={isSimulating}
            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg font-semibold transition-all flex items-center gap-1.5"
          >
            <CloudRain className="w-3.5 h-3.5" /> Simulate Sudden Rainstorm
          </button>
          <button
            onClick={() => triggerScenario("noise")}
            disabled={isSimulating}
            className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 rounded-lg font-semibold transition-all flex items-center gap-1.5"
          >
            <Volume2 className="w-3.5 h-3.5" /> Inject Noise Spike (78dB)
          </button>
          <button
            onClick={() => triggerScenario("hvac_reset")}
            disabled={isSimulating}
            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg font-semibold transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Normalize Climate & Noise
          </button>
        </div>
      </div>

      {/* Live Environmental Zones Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sensors.map((sensor, idx) => {
          const comfort = AutonomousConciergeEngine.calculateZoneComfort(sensor);
          const isOptimal = comfort >= 75;
          const isWarning = comfort < 50;
          const tooltipAlign = idx === 0 ? "left" : idx === sensors.length - 1 ? "right" : "center";

          return (
            <div
              key={sensor.zoneId}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                isWarning
                  ? "bg-rose-950/20 border-rose-500/40"
                  : isOptimal
                  ? "bg-slate-900/80 border-slate-800"
                  : "bg-amber-950/20 border-amber-500/40"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {sensor.zoneType.replace("_", " ")}
                  </span>
                  <BoundarySafeTooltip
                    content={`Comfort Index: ${comfort}%. Evaluates temperature, decibel levels, CO2 concentration, and weather.`}
                    align={tooltipAlign}
                  >
                    <span
                      className={`text-xs font-mono font-bold cursor-help ${
                        isWarning
                          ? "text-rose-400"
                          : isOptimal
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {comfort}% Comfort
                    </span>
                  </BoundarySafeTooltip>
                </div>

                <h3 className="font-bold text-white text-sm">{sensor.zoneName}</h3>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-300">
                  <BoundarySafeTooltip content="Optimal thermal zone: 21-23°C" align={tooltipAlign}>
                    <div className="flex items-center gap-1.5 cursor-help">
                      <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                      <span>{sensor.temperatureC}°C</span>
                    </div>
                  </BoundarySafeTooltip>

                  <BoundarySafeTooltip content="Acoustic focus threshold: <55dB" align={tooltipAlign}>
                    <div className="flex items-center gap-1.5 cursor-help">
                      <Volume2 className="w-3.5 h-3.5 text-yellow-400" />
                      <span>{sensor.decibelLevel} dB</span>
                    </div>
                  </BoundarySafeTooltip>

                  <BoundarySafeTooltip content="CO2 concentration. Levels >1000ppm induce cognitive fatigue." align={tooltipAlign}>
                    <div className="flex items-center gap-1.5 cursor-help">
                      <Wind className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{sensor.co2Ppm} ppm</span>
                    </div>
                  </BoundarySafeTooltip>

                  <BoundarySafeTooltip content="Real-time localized micro-climate radar" align={tooltipAlign}>
                    <div className="flex items-center gap-1.5 cursor-help">
                      <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                      <span className="capitalize">{sensor.weatherCondition.replace("_", " ")}</span>
                    </div>
                  </BoundarySafeTooltip>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Occupancy: {sensor.occupancyCount} / {sensor.maxCapacity}
                </span>
                {sensor.weatherCondition === "rain_storm" && sensor.zoneType === "outdoor_terrace" && (
                  <BoundarySafeTooltip content="Critical rain alert! Terrace is actively exposed." align="right">
                    <span className="text-rose-400 font-bold flex items-center gap-1 animate-pulse cursor-help">
                      <AlertTriangle className="w-3 h-3" /> Rain Hazard
                    </span>
                  </BoundarySafeTooltip>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Autonomous Rebalancing Recommendations Section */}
      <div className="p-6 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Autonomous Re-Balancing Proposals ({analysis.recommendations.length})
            </h3>
            <p className="text-xs text-slate-400">
              Avg. comfort delta: +{analysis.avgComfortImprovement} points across affected coworkers
            </p>
          </div>
        </div>

        {analysis.recommendations.length === 0 ? (
          <div className="p-8 text-center bg-slate-800/30 rounded-xl border border-slate-800 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-bold text-white">All Workspaces in Optimal Equilibrium</div>
            <p className="text-xs text-slate-400">
              No sudden precipitation, noise spikes, or thermal drift detected.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {analysis.recommendations.map((rec) => {
              const isApplied = appliedMigrations.includes(rec.id) || rec.isAutoApplied;

              return (
                <div
                  key={rec.id}
                  className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <BoundarySafeTooltip
                        content={`Urgency: ${rec.urgency}. ${rec.conciergeExplanation}`}
                        align="left"
                      >
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full cursor-help ${
                            rec.urgency === "critical"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {rec.urgency} Urgency
                        </span>
                      </BoundarySafeTooltip>
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {rec.memberName}
                      </span>
                      <span className="text-xs text-emerald-400 font-mono font-bold">
                        +{rec.comfortDelta}% Comfort
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                      <span className="line-through text-slate-500">
                        {rec.currentZoneName} ({rec.currentDeskId})
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-bold text-cyan-300">
                        {rec.recommendedZoneName} ({rec.recommendedDeskId})
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">{rec.conciergeExplanation}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isApplied ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Auto-Relocated
                      </span>
                    ) : (
                      <button
                        onClick={() => applyMigration(rec)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-all shadow"
                      >
                        Confirm Relocation
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Concierge Autonomous Reasoning Log */}
      <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" /> Real-Time Concierge Agent Telemetry Stream
        </div>
        <div className="p-3.5 bg-black/40 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1">
          <div>[AI-ENGINE] Continuous environmental scan interval: 15,000ms</div>
          <div>[SENSORS] Multi-sensor ingest: 4 zones, 12 environmental metrics loaded</div>
          <div>[DECISION] Optimization algorithm: Weiszfeld-Weighted Thermal & Acoustic Comfort Matrix</div>
          <div className="text-emerald-400">
            [STATUS] Autonomous Rebalancing Auto-Pilot operational. High-priority migrations auto-dispatched.
          </div>
        </div>
      </div>
    </div>
  );
}
