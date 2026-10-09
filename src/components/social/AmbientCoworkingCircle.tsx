"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Headphones,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Users,
  CheckCircle2,
  Circle,
  Plus,
  CloudRain,
  Coffee,
  Disc,
  Activity,
  Sliders,
  Radio,
  Flame,
} from "lucide-react";
import {
  AmbientAudioSynthesizer,
  type PomodoroState,
  type SoundTrackState,
  type PeerSprintIntention,
} from "@/lib/audio/ambientFocusEngine";

export default function AmbientCoworkingCircle() {
  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    phase: "FOCUS_SPRINT",
    durationMinutes: 25,
    remainingSeconds: 25 * 60,
    isRunning: true,
    sprintCount: 3,
  });

  const [tracks, setTracks] = useState<SoundTrackState[]>([
    { id: "rain", name: "Rain on Window", volume: 0.6, pan: -0.4, enabled: true },
    { id: "cafe", name: "Cafe Ambience", volume: 0.4, pan: 0.3, enabled: true },
    { id: "vinyl", name: "Vinyl Crackle", volume: 0.3, pan: 0.0, enabled: false },
    { id: "binaural", name: "14Hz Alpha Beats", volume: 0.5, pan: 0.0, enabled: true },
  ]);

  const [isMuted, setIsMuted] = useState(false);
  const [intentions, setIntentions] = useState<PeerSprintIntention[]>([
    { id: "1", userId: "u1", userName: "Elena R.", taskText: "Finish geometric median PR", isCompleted: true },
    { id: "2", userId: "u2", userName: "David K.", taskText: "Refactor rate limiter middleware", isCompleted: false },
    { id: "3", userId: "u3", userName: "Alex P.", taskText: "Draft nomad tax documentation", isCompleted: false },
  ]);
  const [newIntentionText, setNewIntentionText] = useState("");

  const synthRef = useRef<AmbientAudioSynthesizer | null>(null);

  // Initialize synth
  useEffect(() => {
    synthRef.current = new AmbientAudioSynthesizer();
    return () => {
      synthRef.current?.setMuted(true);
    };
  }, []);

  // Update playing tracks in audio engine
  useEffect(() => {
    if (!synthRef.current) return;
    synthRef.current.setMuted(isMuted);

    tracks.forEach((t) => {
      if (t.enabled && !isMuted) {
        synthRef.current?.playTrack(t.id, t.volume, t.pan);
      } else {
        synthRef.current?.stopTrack(t.id);
      }
    });
  }, [tracks, isMuted]);

  // Pomodoro countdown timer loop
  useEffect(() => {
    if (!pomodoro.isRunning) return;

    const timer = setInterval(() => {
      setPomodoro((prev) => {
        if (prev.remainingSeconds <= 1) {
          synthRef.current?.playChime();
          const nextPhase = prev.phase === "FOCUS_SPRINT" ? "SHORT_BREAK" : "FOCUS_SPRINT";
          const nextDuration = nextPhase === "FOCUS_SPRINT" ? 25 : 5;
          return {
            ...prev,
            phase: nextPhase,
            durationMinutes: nextDuration,
            remainingSeconds: nextDuration * 60,
            sprintCount: nextPhase === "FOCUS_SPRINT" ? prev.sprintCount + 1 : prev.sprintCount,
          };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pomodoro.isRunning]);

  const handleToggleTimer = () => {
    setPomodoro((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const handleResetTimer = () => {
    setPomodoro((prev) => ({
      ...prev,
      remainingSeconds: prev.durationMinutes * 60,
      isRunning: false,
    }));
  };

  const handleToggleTrack = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const handleVolumeChange = (id: string, vol: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, volume: vol } : t))
    );
  };

  const handleAddIntention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIntentionText.trim()) return;
    setIntentions((prev) => [
      {
        id: `int-${Date.now()}`,
        userId: "self",
        userName: "You",
        taskText: newIntentionText.trim(),
        isCompleted: false,
      },
      ...prev,
    ]);
    setNewIntentionText("");
  };

  const handleToggleIntention = (id: string) => {
    setIntentions((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isCompleted: !i.isCompleted } : i))
    );
  };

  const formatMinutes = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPct =
    ((pomodoro.durationMinutes * 60 - pomodoro.remainingSeconds) /
      (pomodoro.durationMinutes * 60)) *
    100;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <Headphones className="w-3.5 h-3.5" /> Ambient Virtual Coworking
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Virtual Focus Circle & Spatial Soundscape
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Synchronized Pomodoro sprints, spatial ambient audio mixing (Rain, Cafe, Binaural Alpha Beats), and shared accountability with remote peers.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-2xl border transition ${
                isMuted
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Pomodoro & Virtual Table (7 cols) + Soundscape Mixer & Intentions (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Pomodoro Clock & Virtual Table */}
        <div className="lg:col-span-7 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-6 backdrop-blur-md shadow-lg flex flex-col items-center">
          {/* Pomodoro Header */}
          <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Sprint #{pomodoro.sprintCount} • {pomodoro.phase === "FOCUS_SPRINT" ? "Deep Focus" : "Rest Break"}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">8 Peers Focused</span>
          </div>

          {/* Radial Countdown Clock */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* SVG Circular Progress */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#1e293b"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="url(#pomoGrad)"
                strokeWidth="6"
                strokeDasharray="276"
                strokeDashoffset={276 - (276 * progressPct) / 100}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id="pomoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#6366f1" />
                  <stop offset="100%" stop-color="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>

            {/* Inner Clock Text */}
            <div className="absolute flex flex-col items-center justify-center space-y-1">
              <span className="text-4xl font-black text-white font-mono tracking-tight">
                {formatMinutes(pomodoro.remainingSeconds)}
              </span>
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest">
                {pomodoro.phase === "FOCUS_SPRINT" ? "Focus Sprint" : "Break Time"}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleTimer}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
            >
              {pomodoro.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{pomodoro.isRunning ? "Pause Sprint" : "Resume Sprint"}</span>
            </button>
            <button
              onClick={handleResetTimer}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Virtual Coworking Round Table Presence */}
          <div className="w-full pt-4 border-t border-slate-800 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
              Coworking Circle Presence (Live)
            </span>
            <div className="flex flex-wrap gap-2">
              {["Elena R. (Berlin)", "David K. (Lisbon)", "Marco P. (Tokyo)", "Sophia T. (SF)", "You"].map(
                (peer, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{peer}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Spatial Audio Mixer & Sprint Intentions */}
        <div className="lg:col-span-5 space-y-5">
          {/* Spatial Soundscape Mixer */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 backdrop-blur-md shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" /> Spatial Soundscape Mixer
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Web Audio Synthesizer</span>
            </div>

            <div className="space-y-3">
              {tracks.map((track) => (
                <div key={track.id} className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{track.name}</span>
                    <button
                      onClick={() => handleToggleTrack(track.id)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                        track.enabled
                          ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                          : "bg-slate-800 border-slate-700 text-slate-500"
                      }`}
                    >
                      {track.enabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={track.volume}
                    disabled={!track.enabled}
                    onChange={(e) => handleVolumeChange(track.id, Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Micro-Sprint Intentions Board */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 backdrop-blur-md shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Sprint Micro-Intentions
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">{intentions.length} Goals</span>
            </div>

            <form onSubmit={handleAddIntention} className="flex gap-2">
              <input
                type="text"
                value={newIntentionText}
                onChange={(e) => setNewIntentionText(e.target.value)}
                placeholder="What will you ship this sprint?..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {intentions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleIntention(item.id)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition text-xs ${
                    item.isCompleted
                      ? "bg-slate-950/40 border-slate-800 text-slate-500 line-through"
                      : "bg-slate-800/40 border-slate-700/60 text-slate-200 hover:border-slate-600"
                  }`}
                >
                  {item.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span className="truncate">
                    <strong className="text-slate-400 font-normal">{item.userName}: </strong>
                    {item.taskText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
