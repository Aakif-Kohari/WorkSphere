"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Layers,
  Coffee,
  PhoneCall,
  Users,
  DoorOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  generateAcousticField,
  decibelsToRgba,
  type SoundEmitter,
  type DeskSoundRating,
  type AcousticFieldMap,
} from "@/lib/spatial/acousticGradientEngine";

interface SpatialAcousticGradientViewerProps {
  venueId?: string;
  venueName?: string;
}

export default function SpatialAcousticGradientViewer({
  venueId = "venue-sf-01",
  venueName = "Mission Focus Coworking & Cafe",
}: SpatialAcousticGradientViewerProps) {
  const [emitters, setEmitters] = useState<SoundEmitter[]>([
    { id: "e1", name: "Espresso Bar & Steam Wand", type: "ESPRESSO_BAR", x: 80, y: 25, baseDecibels: 68, isActive: true },
    { id: "e2", name: "Street Entrance Door", type: "ENTRANCE_DOOR", x: 15, y: 85, baseDecibels: 58, isActive: true },
    { id: "e3", name: "Collaborative Team Lounge", type: "COLLABORATIVE_TABLE", x: 50, y: 60, baseDecibels: 54, isActive: true },
    { id: "e4", name: "Acoustic Phone Booths", type: "PHONE_BOOTH", x: 20, y: 20, baseDecibels: 38, isActive: true },
  ]);

  const defaultDesks = [
    { id: "d-1", seatNumber: "Desk 01 (Quiet North Nook)", x: 25, y: 15 },
    { id: "d-2", seatNumber: "Desk 02 (Center Hot Desk)", x: 45, y: 40 },
    { id: "d-3", seatNumber: "Desk 03 (Barista Adjacent)", x: 75, y: 35 },
    { id: "d-4", seatNumber: "Desk 04 (Lounge Perimeter)", x: 55, y: 75 },
    { id: "d-5", seatNumber: "Desk 05 (East Glass Wall)", x: 85, y: 70 },
  ];

  const [fieldMap, setFieldMap] = useState<AcousticFieldMap | null>(null);
  const [selectedDeskId, setSelectedDeskId] = useState<string>("d-1");
  const [hoveredDesk, setHoveredDesk] = useState<DeskSoundRating | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Recalculate field map on emitter toggles
  useEffect(() => {
    const computed = generateAcousticField(emitters, defaultDesks, 50, 30);
    setFieldMap(computed);
  }, [emitters]);

  // Draw smooth acoustic gradient canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fieldMap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { gridWidth, gridHeight, grid } = fieldMap;
    const width = canvas.width;
    const height = canvas.height;

    const cellW = width / gridWidth;
    const cellH = height / gridHeight;

    ctx.clearRect(0, 0, width, height);

    // Draw interpolated cells
    for (let r = 0; r < gridHeight; r++) {
      for (let c = 0; c < gridWidth; c++) {
        const db = grid[r][c];
        const [red, green, blue, alpha] = decibelsToRgba(db);
        ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
      }
    }

    // Draw grid overlay lines
    ctx.strokeStyle = "rgba(15, 23, 42, 0.25)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [fieldMap]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const toggleEmitter = (id: string) => {
    setEmitters((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isActive: !e.isActive } : e))
    );
  };

  const selectedDesk = fieldMap?.desks.find((d) => d.seatId === selectedDeskId);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" /> 3D Spatial Acoustic Gradient
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Spatial Sound Zoning & Floorplan Heatmap
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Continuous spatial decay modeling and acoustic sound pressure interpolation. Pinpoint quiet reading nooks and avoid noisy coffee grinders.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Decibel Legend */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &lt;38 dB (Silent Focus)
              </div>
              <div className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> 39-46 dB (Soft Ambient)
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 47-56 dB (Buzz Lounge)
              </div>
              <div className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &gt;56 dB (High Noise)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Canvas Map (7 cols) + Emitter Toggles & Desk Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Canvas Map Overlay */}
        <div className="lg:col-span-7 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-cyan-400" /> Workspace Acoustic Sound Field
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">Real-Time Gaussian Decay</span>
          </div>

          {/* Canvas Viewport */}
          <div className="relative w-full h-[360px] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              width={500}
              height={360}
              className="w-full h-full object-cover"
            />

            {/* Emitter Map Icons */}
            {emitters.map((emitter) => (
              <div
                key={emitter.id}
                style={{ left: `${emitter.x}%`, top: `${emitter.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 rounded-xl border flex items-center justify-center transition-all ${
                  emitter.isActive
                    ? "bg-slate-950/90 border-rose-500 text-rose-400 shadow-lg shadow-rose-950/40"
                    : "bg-slate-900/60 border-slate-700 text-slate-500 opacity-40"
                }`}
                title={`${emitter.name} (${emitter.baseDecibels} dB)`}
              >
                {emitter.type === "ESPRESSO_BAR" ? (
                  <Coffee className="w-4 h-4" />
                ) : emitter.type === "PHONE_BOOTH" ? (
                  <PhoneCall className="w-4 h-4" />
                ) : emitter.type === "ENTRANCE_DOOR" ? (
                  <DoorOpen className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
              </div>
            ))}

            {/* Desk Map Pins */}
            {fieldMap?.desks.map((desk) => {
              const isSelected = selectedDeskId === desk.seatId;

              return (
                <button
                  key={desk.seatId}
                  onClick={() => setSelectedDeskId(desk.seatId)}
                  onMouseEnter={() => setHoveredDesk(desk)}
                  onMouseLeave={() => setHoveredDesk(null)}
                  style={{ left: `${desk.x}%`, top: `${desk.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl border text-[10px] font-mono font-bold transition-all ${
                    isSelected
                      ? "bg-white text-slate-950 border-white shadow-xl scale-110 z-20"
                      : "bg-slate-950/90 text-white border-slate-600 hover:scale-105 z-10"
                  }`}
                >
                  {desk.predictedDecibels} dB
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Emitter Controllers & Selected Desk Inspector */}
        <div className="lg:col-span-5 space-y-5">
          {/* Emitter Toggles */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3 backdrop-blur-md shadow-lg">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" /> Active Noise Sources
            </h3>

            <div className="space-y-2">
              {emitters.map((e) => (
                <div
                  key={e.id}
                  onClick={() => toggleEmitter(e.id)}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition text-xs ${
                    e.isActive
                      ? "bg-slate-950/80 border-slate-700 text-white"
                      : "bg-slate-950/40 border-slate-800 text-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {e.type === "ESPRESSO_BAR" ? (
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span className="font-semibold">{e.name}</span>
                  </div>

                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                    {e.isActive ? `${e.baseDecibels} dB (Active)` : "Muted"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Desk Inspector */}
          {selectedDesk && (
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 backdrop-blur-md shadow-lg">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Acoustic Micro-Climate
                </span>
                <h3 className="text-base font-bold text-white">{selectedDesk.seatNumber}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block font-sans">Predicted Decibels</span>
                  <strong className="text-emerald-400 text-lg font-bold">
                    {selectedDesk.predictedDecibels} dB
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block font-sans">Call Suitability</span>
                  <strong className="text-cyan-400 text-lg font-bold">
                    {selectedDesk.callSuitabilityScore}%
                  </strong>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Nearest Sound Source: <strong className="text-slate-200">{selectedDesk.nearestEmitter}</strong> (~{selectedDesk.distanceToEmitterMeters}m away).
              </p>

              <a
                href={`/reserve?venueId=${venueId}&seat=${selectedDesk.seatNumber}`}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
              >
                <CheckCircle2 className="w-4 h-4" /> Reserve This Quiet Desk
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
