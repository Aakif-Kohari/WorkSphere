"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Award,
  Sparkles,
  Lock,
  Download,
  CheckCircle2,
  Cpu,
  FileCheck,
  Compass,
  Zap,
  Globe,
  RefreshCw,
} from "lucide-react";
import {
  generateClientNomadProof,
  type NomadProductivityStatement,
  type PassportStamp,
} from "@/lib/zkp/nomadProof";
import { downloadSVG } from "@/lib/qr/svgQr";

const AVAILABLE_STATEMENTS: NomadProductivityStatement[] = [
  {
    badgeType: "NOMAD_100_HOURS",
    tierTitle: "100-Hour Deep Work Focus Master",
    minThresholdStreak: 14,
    minThresholdHours: 100,
    epoch: 2026,
  },
  {
    badgeType: "STREAK_30_DAYS",
    tierTitle: "30-Day Workspace Streak Champion",
    minThresholdStreak: 30,
    minThresholdHours: 60,
    epoch: 2026,
  },
  {
    badgeType: "MULTI_CITY_EXPLORER",
    tierTitle: "Multi-City Global Nomad Explorer",
    minThresholdStreak: 10,
    minThresholdHours: 40,
    epoch: 2026,
  },
];

export default function NomadPassportGallery() {
  const [selectedStatement, setSelectedStatement] = useState<NomadProductivityStatement>(
    AVAILABLE_STATEMENTS[0]
  );
  const [generatingProof, setGeneratingProof] = useState(false);
  const [mintedStamps, setMintedStamps] = useState<PassportStamp[]>([
    {
      stampId: "STAMP-NOMAD_50_HOURS-2026-A89B4C21",
      badgeType: "NOMAD_50_HOURS",
      tierTitle: "50-Hour Focus Veteran",
      epoch: 2026,
      issuedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      nullifierHash: "e4d909c290d0fb1ca068ffaddf22cbd0ffd823ef45a2789123456789abcdef01",
      verificationSignature: "8f7e2a9b3c4d5e6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
      svgMarkup: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="stampGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
  </defs>
  <circle cx="200" cy="200" r="185" fill="#0f172a" stroke="url(#stampGrad1)" stroke-width="8" stroke-dasharray="12,6" />
  <circle cx="200" cy="200" r="155" fill="none" stroke="#334155" stroke-width="2" />
  <text x="200" y="85" text-anchor="middle" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" letter-spacing="3">WORKSPHERE NOMAD PASSPORT</text>
  <text x="200" y="145" text-anchor="middle" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="20" font-weight="900">50-HOUR FOCUS VETERAN</text>
  <text x="200" y="175" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="12">EPOCH 2026 • ZERO-KNOWLEDGE VERIFIED</text>
  <circle cx="200" cy="230" r="32" fill="#1e293b" stroke="#38bdf8" stroke-width="3" />
  <path d="M190 230 l8 8 l16 -16" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  <text x="200" y="295" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="10">NULLIFIER: e4d909c290d0fb1c...</text>
  <text x="200" y="325" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="11" font-weight="bold">ID: STAMP-NOMAD_50_HOURS-2026</text>
</svg>
      `.trim(),
    },
  ]);

  const [activeStamp, setActiveStamp] = useState<PassportStamp | null>(mintedStamps[0]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGenerateAndVerifyProof = async () => {
    setGeneratingProof(true);
    setSuccessMsg(null);
    try {
      // Simulate user holding 32 streak days and 120 verified work hours
      const identitySecret = "user_nomad_secret_seed_99812";
      const actualStreak = 32;
      const actualHours = 124;

      // 1. Generate client-side ZK proof
      const payload = await generateClientNomadProof(
        identitySecret,
        actualStreak,
        actualHours,
        selectedStatement
      );

      // 2. Submit to verification endpoint
      const res = await fetch("/api/auth/zkp/nomad-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.stamp) {
        setMintedStamps((prev) => [data.stamp, ...prev]);
        setActiveStamp(data.stamp);
        setSuccessMsg(`Minted Zero-Knowledge Passport Stamp: ${data.stamp.tierTitle}!`);
      }
    } catch (err: any) {
      console.error("ZK Proof error:", err);
    } finally {
      setGeneratingProof(false);
    }
  };

  const handleDownloadStamp = (stamp: PassportStamp) => {
    downloadSVG(stamp.svgMarkup, `${stamp.stampId}.svg`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Zero-Knowledge Identity Credentials
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Proof-of-Productivity & Digital Nomad Passport
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Cryptographically prove your working streaks and deep focus hours to employers, clients, and nomad communities using Circom ZK-SNARKs without revealing private location histories.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-1 font-mono">
              <span className="text-slate-400 block text-[10px]">Verified Credentials</span>
              <strong className="text-cyan-400 text-base">{mintedStamps.length} Stamps Minted</strong>
            </div>
          </div>
        </div>

        {/* Privacy Highlight Pill */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Privacy Guaranteed: Merkle leaf commitments prevent timeline & venue doxxing.</span>
        </div>
      </div>

      {/* Main Grid: Proof Builder & Passport Stamp Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: ZK Proof Minting (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-5 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" /> Unlock Zero-Knowledge Credentials
            </h2>
            <span className="text-[11px] text-slate-400">Epoch 2026</span>
          </div>

          {/* Statement Selectors */}
          <div className="space-y-3">
            {AVAILABLE_STATEMENTS.map((stmt) => {
              const isSelected = selectedStatement.badgeType === stmt.badgeType;
              return (
                <div
                  key={stmt.badgeType}
                  onClick={() => setSelectedStatement(stmt)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-indigo-500/10 border-cyan-400 shadow-md shadow-indigo-950/40"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-white">{stmt.tierTitle}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                        <span>Min Streak: {stmt.minThresholdStreak} Days</span>
                        <span>•</span>
                        <span>Min Focus: {stmt.minThresholdHours} Hours</span>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <Award className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mint Action Button */}
          <button
            onClick={handleGenerateAndVerifyProof}
            disabled={generatingProof}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {generatingProof ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Computing Poseidon Commitments & SNARK Proof...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate ZK Proof & Mint Passport Stamp
              </>
            )}
          </button>

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Right Column: Active Stamp Visualizer (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {activeStamp ? (
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5 backdrop-blur-md shadow-lg flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 self-start">
                Passport Stamp Attestation
              </span>

              {/* Stamp SVG Container */}
              <div
                dangerouslySetInnerHTML={{ __html: activeStamp.svgMarkup }}
                className="w-56 h-56 rounded-full drop-shadow-2xl flex items-center justify-center"
              />

              {/* Stamp Metadata */}
              <div className="w-full space-y-2 text-xs font-mono pt-2 border-t border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Stamp ID:</span>
                  <span className="text-cyan-300 font-bold">{activeStamp.stampId.slice(0, 22)}...</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Issued:</span>
                  <span className="text-slate-200">{new Date(activeStamp.issuedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Nullifier:</span>
                  <span className="text-slate-400">{activeStamp.nullifierHash.slice(0, 14)}...</span>
                </div>
              </div>

              {/* Download Stamp */}
              <button
                onClick={() => handleDownloadStamp(activeStamp)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" /> Export Signed SVG Stamp
              </button>
            </div>
          ) : (
            <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
              Select or mint a passport stamp to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
