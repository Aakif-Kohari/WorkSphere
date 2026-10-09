/**
 * route.ts
 * /api/payments/micropay/invoice
 * Generates BOLT11 Lightning Network invoices and USDC pay payloads.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MicroPaymentEngine,
  PaymentRail,
  LIVE_EXCHANGE_RATES,
} from "@/lib/payments/microPaymentEngine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body.sessionId || `session-${Date.now()}`;
    const amountUsd = Number(body.amountUsd) || 5.0;
    const paymentRail: PaymentRail = body.paymentRail || "lightning";

    const invoice = MicroPaymentEngine.createMicroInvoice(sessionId, amountUsd, paymentRail);

    return NextResponse.json({
      success: true,
      invoice,
      exchangeRates: LIVE_EXCHANGE_RATES,
    });
  } catch (error: any) {
    console.error("[POST /api/payments/micropay/invoice] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate micro-payment invoice", details: error.message },
      { status: 500 }
    );
  }
}
