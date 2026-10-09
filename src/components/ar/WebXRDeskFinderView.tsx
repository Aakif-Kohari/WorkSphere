"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Navigation,
  Compass,
  CheckCircle2,
  CornerDownRight,
  Sparkles,
  MapPin,
  Eye,
  Layers,
  ArrowUp,
  Volume2,
  Footprints,
  RotateCcw,
} from "lucide-react";
import type { ARNavigationPath, Vector3D } from "@/lib/spatial/arWayfindingEngine";

interface WebXRDeskFinderViewProps {
  venueId?: string;
  venueName?: string;
  targetSeatNumber?: string;
}

export default function WebXRDeskFinderView({
  venueId = "venue-sf-hub",
  venueName = "Mission Bay Coworking Hub",
  targetSeatNumber = "Desk B-08 (Window Pod)",
}: WebXRDeskFinderViewProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [userPose, setUserPose] = useState<Vector3D>({ x: 0, y: 0, z: 0 });
  const [navPath, setNavPath] = useState<ARNavigationPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [arActive, setArActive] = useState(true);
  const [arSupported, setArSupported] = useState(true);
  const [bearingDeg, setBearingDeg] = useState(35); // simulated bearing to target

  // Video feed ref for real camera if permissions granted
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchARRoute = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ar/wayfinding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          currentPosition: userPose,
          targetSeatNumber,
        }),
      });
      const data = await res.json();
      if (data.success && data.route) {
        setNavPath(data.route);
      }
    } catch (err) {
      console.error("Failed to load AR route:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchARRoute();
  }, [venueId, targetSeatNumber]);

  // Request real camera stream if available in browser
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // Camera permission denied or mock environment fallback
          setArSupported(false);
        });
    }
  }, []);

  // Simulate walking along the AR waypoints
  const handleNextStep = () => {
    if (!navPath) return;
    if (currentStep < navPath.waypoints.length - 1) {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      const nextWaypoint = navPath.waypoints[nextIdx];
      setUserPose(nextWaypoint.position);
      // Reduce distance and adjust angle
      setBearingDeg((prev) => Math.max(0, prev - 15));
    }
  };

  const handleResetWalk = () => {
    setCurrentStep(0);
    setUserPose({ x: 0, y: 0, z: 0 });
    setBearingDeg(35);
  };

  const activeWaypoint = navPath?.waypoints[currentStep];
  const isArrived = activeWaypoint?.turnAction === "ARRIVED" || currentStep === (navPath?.waypoints.length ?? 1) - 1;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
              <Camera className="w-3.5 h-3.5 animate-pulse" /> WebXR Indoor AR Wayfinding
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Indoor AR Desk Finder & Waypoint HUD
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Spatial anchor positioning and directional 3D path vectors guide you from the venue entrance directly to your reserved desk.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs font-mono space-y-1">
              <span className="text-slate-500 block text-[10px]">Target Destination</span>
              <strong className="text-cyan-400 text-sm block">{targetSeatNumber}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main AR Viewport Container */}
      <div className="relative w-full h-[520px] rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl flex flex-col justify-between">
        {/* Background Camera Feed / Mock Workspace Canvas */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover opacity-60"
          />

          {/* Perspective 3D Hallway Grid Simulation */}
          <div className="absolute inset-0 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

          {/* Floating Glowing AR Waypoint Markers */}
          <div className="absolute flex flex-col items-center justify-center space-y-3 transition-all duration-500">
            {/* 3D Glowing AR Arrow */}
            <div
              className={`flex items-center justify-center w-20 h-20 rounded-full transition-transform duration-500 ${
                isArrived
                  ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 scale-125 shadow-lg shadow-emerald-500/40"
                  : "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 animate-bounce shadow-lg shadow-cyan-500/30"
              }`}
              style={{
                transform: `rotate(${isArrived ? 0 : bearingDeg}deg)`,
              }}
            >
              {isArrived ? (
                <CheckCircle2 className="w-10 h-10" />
              ) : (
                <ArrowUp className="w-10 h-10 stroke-[2.5]" />
              )}
            </div>

            {/* Glowing Desk Bounding Box */}
            <div
              className={`px-6 py-4 rounded-2xl border-2 backdrop-blur-md transition-all duration-300 text-center ${
                isArrived
                  ? "bg-emerald-950/80 border-emerald-400 shadow-xl shadow-emerald-950/50"
                  : "bg-slate-900/80 border-cyan-400 shadow-xl shadow-cyan-950/40"
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-300 block">
                {isArrived ? "DESTINATION REACHED" : "SPATIAL ANCHOR LOCKED"}
              </span>
              <h3 className="text-base font-extrabold text-white">{targetSeatNumber}</h3>
              <span className="text-xs font-mono text-slate-300">
                {isArrived ? "Checked In at Desk" : `~${(activeWaypoint?.distanceToNextMeters || 4.2).toFixed(1)}m Ahead`}
              </span>
            </div>
          </div>
        </div>

        {/* Top HUD Overlay */}
        <div className="relative z-10 p-4 md:p-6 flex items-center justify-between pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-200 backdrop-blur-md">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>AR Heading: <strong className="font-mono text-cyan-300">{bearingDeg}° NNE</strong></span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-mono text-slate-200 backdrop-blur-md">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Floor 2 • West Wing</span>
          </div>
        </div>

        {/* Bottom Turn-by-Turn Instruction Banner */}
        <div className="relative z-10 p-4 md:p-6 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-8 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/95 border border-slate-800 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold shrink-0">
                {isArrived ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Navigation className="w-5 h-5" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Step {currentStep + 1} of {navPath?.waypoints.length || 3}
                </span>
                <p className="text-sm font-bold text-white">
                  {activeWaypoint?.instruction || "Follow AR trajectory to reserved workspace"}
                </p>
              </div>
            </div>

            {/* Navigation Stepper Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleResetWalk}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                title="Reset simulation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {!isArrived ? (
                <button
                  onClick={handleNextStep}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition"
                >
                  <Footprints className="w-4 h-4" /> Advance Step
                </button>
              ) : (
                <a
                  href="/venues"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
                >
                  <CheckCircle2 className="w-4 h-4" /> Done & Unlocked
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
