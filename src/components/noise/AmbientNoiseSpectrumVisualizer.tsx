"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Volume2,
  VolumeX,
  Activity,
  Mic,
  Square,
  Sparkles,
  Info,
  Radio,
  Sliders,
} from "lucide-react";
import {
  analyzeFrequencyBands,
  getFrequencyProfile,
  type FrequencyBandSpectrum,
} from "@/lib/noise/spectrumAnalyzer";

export interface AmbientNoiseSpectrumVisualizerProps {
  venueId?: string;
  venueName?: string;
  noiseLevel?: string | null; // "quiet" | "moderate" | "loud" | etc.
  decibelBaseline?: number | null;
  className?: string;
}

// 24 standard 1/3 octave frequency bands (Hz)
const FREQUENCY_LABELS = [
  "32", "40", "50", "63", "80", "100", "125", "160",
  "200", "250", "315", "400", "500", "630", "800", "1k",
  "1.2k", "1.6k", "2k", "2.5k", "3.1k", "4k", "8k", "16k"
];

export function AmbientNoiseSpectrumVisualizer({
  venueId,
  venueName = "Venue",
  noiseLevel = "moderate",
  decibelBaseline,
  className = "",
}: AmbientNoiseSpectrumVisualizerProps) {
  const [isLiveMic, setIsLiveMic] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [bars, setBars] = useState<number[]>(() => new Array(24).fill(15));
  const [peaks, setPeaks] = useState<number[]>(() => new Array(24).fill(18));
  const [currentDb, setCurrentDb] = useState<number>(() => {
    if (typeof decibelBaseline === "number") return decibelBaseline;
    if (noiseLevel === "quiet") return 42;
    if (noiseLevel === "loud") return 74;
    return 56;
  });

  const [frequencySpectrum, setFrequencySpectrum] = useState<FrequencyBandSpectrum | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Derive target average dB from venue noise level
  const targetAvgDb = useMemo(() => {
    if (typeof decibelBaseline === "number") return decibelBaseline;
    const clean = (noiseLevel || "moderate").toLowerCase();
    if (clean.includes("quiet") || clean.includes("silent")) return 42;
    if (clean.includes("loud") || clean.includes("noisy")) return 76;
    return 58;
  }, [noiseLevel, decibelBaseline]);

  // Clean up WebAudio on unmount or toggle
  const stopLiveMic = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsLiveMic(false);
    setMicError(null);
  }, []);

  // Start live microphone WebAudio FFT analyzer
  const startLiveMic = useCallback(async () => {
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtx) {
        throw new Error("Web Audio API is not supported on this browser.");
      }

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsLiveMic(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const renderLiveFrame = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Group into 24 bands
        const step = Math.max(1, Math.floor(bufferLength / 24));
        const newBars: number[] = [];
        let totalEnergy = 0;

        for (let i = 0; i < 24; i++) {
          const startIdx = i * step;
          let sum = 0;
          for (let j = 0; j < step && startIdx + j < bufferLength; j++) {
            sum += dataArray[startIdx + j];
          }
          const avgByte = sum / step;
          const normalizedPct = Math.min(100, Math.max(4, Math.round((avgByte / 255) * 100)));
          newBars.push(normalizedPct);
          totalEnergy += avgByte;
        }

        const avgByteAll = totalEnergy / 24;
        const liveDbEst = Math.round(30 + (avgByteAll / 255) * 65);
        setCurrentDb(liveDbEst);

        setBars(newBars);
        setPeaks((prev) =>
          prev.map((p, idx) => Math.max(p * 0.95, newBars[idx] || 0)),
        );

        // Frequency band spectrum breakdown
        const spec = analyzeFrequencyBands(dataArray, audioCtx.sampleRate, analyser.fftSize);
        setFrequencySpectrum(spec);

        animFrameRef.current = requestAnimationFrame(renderLiveFrame);
      };

      animFrameRef.current = requestAnimationFrame(renderLiveFrame);
    } catch (err: any) {
      console.warn("[AmbientNoiseSpectrumVisualizer] Mic access denied:", err);
      setMicError("Microphone access unavailable. Using telemetry simulation.");
      setIsLiveMic(false);
    }
  }, []);

  // Simulated ambient acoustic spectrum when microphone is not active
  useEffect(() => {
    if (isLiveMic) return;

    const baseDb = targetAvgDb;
    const isQuiet = baseDb < 50;
    const isLoud = baseDb > 70;

    const generateSimulatedSpectrum = () => {
      const newBars: number[] = [];
      const baseHeight = (baseDb / 100) * 80;

      for (let i = 0; i < 24; i++) {
        // Natural pink-noise / acoustic curve: higher energy in low-mid vocal & bass, rolling off at high frequencies
        let bandWeight = 1.0;
        if (i < 4) bandWeight = isLoud ? 1.2 : 0.9; // Low rumble
        else if (i >= 4 && i <= 14) bandWeight = isQuiet ? 0.7 : 1.35; // Speech & cafe chatter
        else bandWeight = 0.55; // High clatter / steam

        const jitter = (Math.random() - 0.5) * 16;
        const val = Math.min(95, Math.max(8, Math.round(baseHeight * bandWeight + jitter)));
        newBars.push(val);
      }

      setBars(newBars);
      setPeaks((prev) =>
        prev.map((p, idx) => Math.max(p * 0.92, newBars[idx] || 0)),
      );

      // Synthesize 3-band breakdown
      const lowEnergy = newBars.slice(0, 6).reduce((a, b) => a + b, 0);
      const midEnergy = newBars.slice(6, 18).reduce((a, b) => a + b, 0);
      const highEnergy = newBars.slice(18).reduce((a, b) => a + b, 0);
      const sum = lowEnergy + midEnergy + highEnergy || 1;

      const lowPercentage = Math.round((lowEnergy / sum) * 100);
      const midPercentage = Math.round((midEnergy / sum) * 100);
      const highPercentage = 100 - lowPercentage - midPercentage;

      const profile = getFrequencyProfile(lowPercentage, midPercentage, highPercentage);
      setFrequencySpectrum({
        lowEnergy,
        midEnergy,
        highEnergy,
        lowPercentage,
        midPercentage,
        highPercentage,
        dominantBand: profile.dominantBand,
        profileTag: profile.tag,
        description: profile.description,
        badgeColor: profile.badgeColor,
      });

      const subtleDbJitter = Math.round(baseDb + (Math.random() - 0.5) * 4);
      setCurrentDb(subtleDbJitter);
    };

    generateSimulatedSpectrum();
    simIntervalRef.current = setInterval(generateSimulatedSpectrum, 250);

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, [isLiveMic, targetAvgDb]);

  useEffect(() => {
    return () => {
      stopLiveMic();
    };
  }, [stopLiveMic]);

  // Color generator for spectrum frequency bands (Violet -> Emerald -> Amber -> Cyan -> Rose)
  const getBarColor = (index: number) => {
    if (index < 6) return "from-purple-500 to-indigo-500 shadow-purple-500/20"; // Bass / Low (20-250Hz)
    if (index < 14) return "from-emerald-400 to-teal-500 shadow-teal-500/20"; // Mid Speech (250-2000Hz)
    if (index < 19) return "from-amber-400 to-orange-500 shadow-amber-500/20"; // High-Mid (2k-4kHz)
    return "from-cyan-400 to-rose-500 shadow-rose-500/20"; // Presence / Clatter (4k-16kHz)
  };

  const getNoiseStatusLabel = (db: number) => {
    if (db < 45) return { label: "Deep Focus (Quiet)", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    if (db <= 62) return { label: "Gentle Ambience (Moderate)", color: "text-teal-400 bg-teal-500/10 border-teal-500/30" };
    if (db <= 74) return { label: "Lively Workspace (Active)", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    return { label: "Energetic / High Energy (Loud)", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" };
  };

  const status = getNoiseStatusLabel(currentDb);

  return (
    <div
      data-testid="ambient-noise-spectrum-visualizer"
      className={`p-5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl shadow-lg backdrop-blur-md transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
            <Volume2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <span>Ambient Noise Spectrum</span>
              {isLiveMic ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Live Mic
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Radio className="w-3 h-3" />
                  Acoustic Telemetry
                </span>
              )}
            </h3>
            <p className="text-[11px] text-zinc-400">
              Real-time 24-band FFT frequency decibel analysis
            </p>
          </div>
        </div>

        {/* Live Mic Toggle Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={isLiveMic ? stopLiveMic : startLiveMic}
            data-testid="toggle-live-mic-btn"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
              isLiveMic
                ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-500/20"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
            }`}
          >
            {isLiveMic ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Mic</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-blue-400" />
                <span>Test Live Mic</span>
              </>
            )}
          </button>
        </div>
      </div>

      {micError && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
          {micError}
        </div>
      )}

      {/* Decibel & Classification Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 border border-white/5 rounded-xl p-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
            {currentDb}{" "}
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              dBA
            </span>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${status.color}`}
          >
            {status.label}
          </span>
        </div>

        {frequencySpectrum && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`font-semibold px-2 py-0.5 rounded-md border ${frequencySpectrum.badgeColor}`}
            >
              {frequencySpectrum.profileTag}
            </span>
          </div>
        )}
      </div>

      {/* 24-Band Frequency Bars Visualizer Canvas / Grid */}
      <div
        aria-label="Noise Frequency Spectrum Bars"
        role="img"
        className="relative h-32 sm:h-36 w-full bg-black/50 border border-zinc-800/80 rounded-xl p-3 flex items-end justify-between gap-1 overflow-hidden"
      >
        {/* Background Decibel Reference Grid Lines */}
        <div className="absolute inset-x-0 top-[25%] border-b border-white/5 pointer-events-none" />
        <div className="absolute inset-x-0 top-[50%] border-b border-white/5 pointer-events-none" />
        <div className="absolute inset-x-0 top-[75%] border-b border-white/5 pointer-events-none" />

        {bars.map((height, i) => {
          const peakHeight = peaks[i] || height;
          const bgGradient = getBarColor(i);

          return (
            <div
              key={`freq-bar-${i}`}
              className="relative flex-1 h-full flex items-end justify-center group"
            >
              {/* Peak indicator tick */}
              <div
                className="absolute w-full h-1 bg-white/90 rounded-xs shadow-xs transition-all duration-150 pointer-events-none"
                style={{ bottom: `${Math.min(98, peakHeight)}%` }}
              />

              {/* Dynamic Frequency Bar */}
              <div
                className={`w-full max-w-[12px] bg-gradient-to-t ${bgGradient} rounded-t-sm transition-all duration-100 ease-out`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Frequency Labels Scale */}
      <div className="flex justify-between items-center px-1 pt-2 text-[9px] font-mono text-zinc-500 uppercase tracking-tighter select-none">
        <span>32Hz</span>
        <span>125Hz</span>
        <span>500Hz</span>
        <span>2kHz</span>
        <span>8kHz</span>
        <span>16kHz</span>
      </div>

      {/* 3-Band Acoustic Distribution Summary */}
      {frequencySpectrum && (
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-800/80 text-center">
          <div className="p-2 bg-purple-500/5 border border-purple-500/15 rounded-xl">
            <span className="block text-[10px] font-bold text-purple-400 uppercase tracking-wider">
              Low (20-250Hz)
            </span>
            <span className="text-sm font-black text-white">
              {frequencySpectrum.lowPercentage}%
            </span>
            <span className="block text-[9px] text-zinc-400">Bass &amp; HVAC</span>
          </div>

          <div className="p-2 bg-teal-500/5 border border-teal-500/15 rounded-xl">
            <span className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider">
              Mid (250-4kHz)
            </span>
            <span className="text-sm font-black text-white">
              {frequencySpectrum.midPercentage}%
            </span>
            <span className="block text-[9px] text-zinc-400">Speech &amp; Vocals</span>
          </div>

          <div className="p-2 bg-cyan-500/5 border border-cyan-500/15 rounded-xl">
            <span className="block text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              High (4k-20kHz)
            </span>
            <span className="text-sm font-black text-white">
              {frequencySpectrum.highPercentage}%
            </span>
            <span className="block text-[9px] text-zinc-400">Clatter &amp; Hiss</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AmbientNoiseSpectrumVisualizer;
