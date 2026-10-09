/**
 * route.ts
 * /api/payments/micropay/session
 * Manages live pay-as-you-go micro-billing sessions for desks.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MicroPaymentEngine,
  MicroBillingSession,
  PaymentRail,
} from "@/lib/payments/microPaymentEngine";

// In-memory active micro-billing sessions
const activeSessions = new Map<string, MicroBillingSession>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "start"; // 'start' | 'tick' | 'settle'

    if (action === "start") {
      const sessionId = `mbill-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const deskId = body.deskId || "desk-sf-soma-12";
      const deskName = body.deskName || "Ergonomic Standing Desk 12B";
      const venueName = body.venueName || "SoMa Focus Hub & Roastery";
      const paymentRail: PaymentRail = body.paymentRail || "lightning";
      const hourlyRateUsd = Number(body.hourlyRateUsd) || 4.5;

      const newSession: MicroBillingSession = {
        sessionId,
        deskId,
        deskName,
        venueName,
        paymentRail,
        status: "active",
        startTime: Date.now(),
        lastHeartbeatTime: Date.now(),
        elapsedSeconds: 0,
        hourlyRateUsd,
        totalAccruedUsd: 0,
        totalAccruedSats: 0,
        totalAccruedUsdc: 0,
        depositHoldUsd: 10.0,
      };

      activeSessions.set(sessionId, newSession);

      return NextResponse.json({
        success: true,
        session: newSession,
      });
    }

    if (action === "settle") {
      const sessionId = body.sessionId;
      const session = activeSessions.get(sessionId);

      if (!session) {
        return NextResponse.json(
          { error: "Micro-billing session not found" },
          { status: 404 }
        );
      }

      const updated = MicroPaymentEngine.tickSession(session);
      updated.status = "settled";
      updated.paymentProofHash = MicroPaymentEngine.generatePaymentReceiptHash(
        sessionId,
        session.paymentRail,
        updated.totalAccruedUsd
      );

      activeSessions.set(sessionId, updated);

      return NextResponse.json({
        success: true,
        session: updated,
        receipt: {
          proofHash: updated.paymentProofHash,
          amountPaidUsd: updated.totalAccruedUsd,
          amountPaidCrypto:
            session.paymentRail === "lightning"
              ? `${updated.totalAccruedSats} Sats`
              : `${updated.totalAccruedUsdc} USDC`,
          rail: session.paymentRail,
          settledAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[POST /api/payments/micropay/session] Error:", error);
    return NextResponse.json(
      { error: "Failed to process micro-billing session", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required query parameter: sessionId" },
        { status: 400 }
      );
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const liveSession = MicroPaymentEngine.tickSession(session);
    activeSessions.set(sessionId, liveSession);

    return NextResponse.json({
      success: true,
      session: liveSession,
    });
  } catch (error: any) {
    console.error("[GET /api/payments/micropay/session] Error:", error);
    return NextResponse.json(
      { error: "Failed to query session", details: error.message },
      { status: 500 }
    );
  }
}
