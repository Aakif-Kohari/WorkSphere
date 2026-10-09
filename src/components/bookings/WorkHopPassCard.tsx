"use client";

import React, { useState, useEffect } from "react";
import {
  Coffee,
  Building2,
  BookOpen,
  QrCode,
  Download,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Zap,
  Wifi,
  ShieldCheck,
  Ticket,
  ChevronRight,
} from "lucide-react";
import { generateQRCodeSVG, downloadSVG } from "@/lib/qr/svgQr";
import type { WorkHopBundle, WorkHopLeg } from "@/lib/bundles/workHopEngine";

interface WorkHopPassCardProps {
  initialBundle?: WorkHopBundle;
}

export default function WorkHopPassCard({ initialBundle }: WorkHopPassCardProps) {
  const defaultBundle: WorkHopBundle = {
    bundleId: "whop-782914-sprint",
    userId: "user_nomad_88",
    date: new Date().toISOString().split("T")[0],
    title: "San Francisco Nomad Tri-Hop Pass",
    tier: "NOMAD_PRO",
    totalPrice: 28.5,
    currency: "USD",
    discountPercentage: 25,
    status: "ACTIVE",
    qrToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyWorkHopToken",
    createdAt: new Date().toISOString(),
    legs: [
      {
        legIndex: 1,
        venueId: "v-cafe-bluebottle",
        venueName: "Sightglass Artisan Coffee & Lab",
        venueCategory: "cafe",
        venueAddress: "270 7th St, SoMa, San Francisco",
        seatNumber: "Bar-Island-04",
        startTime: "09:00",
        endTime: "12:00",
        durationHours: 3,
        amenities: ["Pour-Over Bar", "High-Density Outlets", "120 Mbps WiFi"],
        allocatedRevenue: 8.55,
        status: "CHECKED_IN",
        checkedInAt: "09:04 AM",
      },
      {
        legIndex: 2,
        venueId: "v-cowork-werq",
        venueName: "Workshop Cafe & Quiet Pods",
        venueCategory: "coworking",
        venueAddress: "180 Montgomery St, Financial District",
        seatNumber: "PhoneBooth-02",
        startTime: "12:45",
        endTime: "16:00",
        durationHours: 3.25,
        amenities: ["Acoustic Phone Booth", "Dual 4K Monitor", "350 Mbps WiFi"],
        allocatedRevenue: 12.8,
        status: "PENDING",
      },
      {
        legIndex: 3,
        venueId: "v-cowork-canopy",
        venueName: "Canopy Collaborative Lounge",
        venueCategory: "coworking",
        venueAddress: "2196 Fillmore St, Pacific Heights",
        seatNumber: "Lounge-Desk-11",
        startTime: "16:30",
        endTime: "19:00",
        durationHours: 2.5,
        amenities: ["Networking Lounge", "Craft Kombucha on Tap", "Ergonomic Chairs"],
        allocatedRevenue: 7.15,
        status: "PENDING",
      },
    ],
  };

  const [bundle, setBundle] = useState<WorkHopBundle>(initialBundle || defaultBundle);
  const [activeLegIndex, setActiveLegIndex] = useState<number>(1);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // Generate SVG QR Code on mount or token change
  useEffect(() => {
    try {
      const qrPayload = JSON.stringify({
        type: "WORKHOP_DAY_PASS",
        bundleId: bundle.bundleId,
        date: bundle.date,
        token: bundle.qrToken,
      });
      const svg = generateQRCodeSVG(qrPayload, {
        size: 200,
        padding: 2,
        fgColor: "#1e293b",
        bgColor: "#ffffff",
        title: `WorkHop Pass ${bundle.bundleId}`,
      });
      setQrSvg(svg);
    } catch (e) {
      console.error("QR Generation error:", e);
    }
  }, [bundle]);

  const handleDownloadQR = () => {
    if (qrSvg) {
      downloadSVG(qrSvg, `WorkHop-Pass-${bundle.bundleId}.svg`);
    }
  };

  // Simulate scanning at venue door
  const handleSimulateCheckIn = async (legIndex: number) => {
    setVerifying(true);
    setVerifyMessage(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setBundle((prev) => ({
        ...prev,
        legs: prev.legs.map((leg) =>
          leg.legIndex === legIndex
            ? {
                ...leg,
                status: "CHECKED_IN",
                checkedInAt: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }
            : leg
        ),
      }));
      setVerifyMessage(`Checked into Leg #${legIndex} successfully! Door unlocked.`);
      setTimeout(() => setVerifyMessage(null), 4000);
    } finally {
      setVerifying(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "cafe":
        return <Coffee className="w-4 h-4 text-amber-400" />;
      case "library":
        return <BookOpen className="w-4 h-4 text-emerald-400" />;
      case "coworking":
      default:
        return <Building2 className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5" /> {bundle.tier} Day Pass
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
                {bundle.discountPercentage}% Bundle Savings
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {bundle.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Valid: <strong>{bundle.date}</strong>
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Pass ID: <code className="font-mono text-indigo-300">{bundle.bundleId}</code>
              </span>
              <span className="flex items-center gap-1">
                Total: <strong className="text-white">${bundle.totalPrice} {bundle.currency}</strong>
              </span>
            </div>
          </div>

          {/* QR Pass Box */}
          <div className="flex flex-col items-center gap-2 p-3 bg-white/95 rounded-2xl shadow-xl shrink-0">
            {qrSvg ? (
              <div
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                className="w-[150px] h-[150px] flex items-center justify-center"
              />
            ) : (
              <div className="w-[150px] h-[150px] bg-slate-100 flex items-center justify-center rounded-lg">
                <QrCode className="w-12 h-12 text-slate-400 animate-pulse" />
              </div>
            )}
            <button
              onClick={handleDownloadQR}
              className="w-full text-center text-[11px] font-semibold text-slate-800 hover:text-indigo-600 flex items-center justify-center gap-1 transition"
            >
              <Download className="w-3 h-3" /> Save Pass SVG
            </button>
          </div>
        </div>

        {verifyMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{verifyMessage}</span>
          </div>
        )}
      </div>

      {/* Multi-Leg Itinerary Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" /> Today's Multi-Hop Itinerary ({bundle.legs.length} Stops)
          </h2>
          <span className="text-xs text-slate-400">Scan QR at each partner entrance</span>
        </div>

        <div className="space-y-4">
          {bundle.legs.map((leg, index) => {
            const isCheckedIn = leg.status === "CHECKED_IN";
            const isSelected = activeLegIndex === leg.legIndex;

            return (
              <div key={leg.legIndex} className="space-y-3">
                <div
                  onClick={() => setActiveLegIndex(leg.legIndex)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isCheckedIn
                      ? "bg-slate-900/80 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
                      : isSelected
                      ? "bg-slate-900/90 border-indigo-500 shadow-lg shadow-indigo-950/30"
                      : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl font-bold text-sm shrink-0 border ${
                          isCheckedIn
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                            : "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                        }`}
                      >
                        Hop {leg.legIndex}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{leg.venueName}</h3>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 flex items-center gap-1">
                            {getCategoryIcon(leg.venueCategory)}
                            <span className="capitalize">{leg.venueCategory}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{leg.venueAddress}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <span className="text-slate-400 block font-mono">
                          {leg.startTime} - {leg.endTime}
                        </span>
                        <span className="text-indigo-400 font-semibold">
                          Seat: {leg.seatNumber || "Hot Desk"}
                        </span>
                      </div>

                      {isCheckedIn ? (
                        <div className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Checked In ({leg.checkedInAt})
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSimulateCheckIn(leg.legIndex);
                          }}
                          disabled={verifying}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
                        >
                          Simulate Door Tap
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Amenities & Revenue attribution row */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                      {leg.amenities.map((am, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-800/70 border border-slate-700/60 text-slate-300 text-[11px]"
                        >
                          {am}
                        </span>
                      ))}
                    </div>

                    <div className="text-slate-400 text-[11px]">
                      Partner Payout: <strong className="text-slate-200">${leg.allocatedRevenue} USD</strong>
                    </div>
                  </div>
                </div>

                {/* Transition Line to next hop */}
                {index < bundle.legs.length - 1 && (
                  <div className="flex items-center gap-2 px-6 text-xs text-slate-500 font-medium">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                    <span>~15-20 min transit / coffee break before Hop #{index + 2}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
