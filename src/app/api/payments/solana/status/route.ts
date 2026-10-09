import { NextRequest, NextResponse } from "next/server";
import {
  SolanaPayStatusResponse,
  SOLANA_PAY_DEFAULT_TIMEOUT_MS,
  isSolanaPaymentExpired,
} from "@/lib/payments/solanaPay";

export const dynamic = "force-dynamic";

// In-memory reference status store for dev / test simulation
const referenceStore = new Map<string, SolanaPayStatusResponse>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { error: "Missing required 'reference' query parameter" },
        { status: 400 }
      );
    }

    const simulateConfirm = searchParams.get("simulate") === "true";
    const simulateExpired = searchParams.get("expired") === "true";

    const now = Date.now();

    if (simulateExpired) {
      const expiredData: SolanaPayStatusResponse = {
        reference,
        status: "EXPIRED",
        message: "Transaction expired. Please generate a new QR code.",
        timestamp: new Date().toISOString(),
        createdAt: now - SOLANA_PAY_DEFAULT_TIMEOUT_MS - 1000,
      };
      referenceStore.set(reference, expiredData);
      return NextResponse.json(expiredData);
    }

    if (simulateConfirm || !referenceStore.has(reference)) {
      const isConfirmed = simulateConfirm;
      const statusData: SolanaPayStatusResponse = {
        reference,
        status: isConfirmed ? "CONFIRMED" : "PENDING",
        signature: isConfirmed
          ? `5K2x${Math.random().toString(36).substring(2, 15)}SolanaTxSig${now}`
          : undefined,
        slot: isConfirmed ? 248901234 : undefined,
        timestamp: new Date().toISOString(),
        createdAt: now,
      };
      referenceStore.set(reference, statusData);
    }

    const currentStatus = referenceStore.get(reference)!;

    // Check if the transaction reference has expired past the blockhash TTL (5 mins)
    if (
      currentStatus.status === "PENDING" &&
      currentStatus.createdAt &&
      isSolanaPaymentExpired(currentStatus.createdAt, SOLANA_PAY_DEFAULT_TIMEOUT_MS, now)
    ) {
      currentStatus.status = "EXPIRED";
      currentStatus.message = "Transaction expired. Please generate a new QR code.";
      currentStatus.timestamp = new Date().toISOString();
      referenceStore.set(reference, currentStatus);
    }

    return NextResponse.json(currentStatus);
  } catch (err: any) {
    const errorMessage = err?.message || "Failed to check Solana payment status";
    if (errorMessage.toLowerCase().includes("simulation failed") || errorMessage.toLowerCase().includes("timeout")) {
      return NextResponse.json({
        status: "EXPIRED",
        message: "Transaction expired. Please generate a new QR code.",
      });
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { reference, action } = body;

    if (!reference) {
      return NextResponse.json(
        { error: "Missing 'reference' field" },
        { status: 400 }
      );
    }

    if (action === "confirm") {
      const updated: SolanaPayStatusResponse = {
        reference,
        status: "CONFIRMED",
        signature: `5K2x${Math.random().toString(36).substring(2, 15)}SolanaTxSig${Date.now()}`,
        slot: 248901234,
        timestamp: new Date().toISOString(),
        createdAt: referenceStore.get(reference)?.createdAt ?? Date.now(),
      };
      referenceStore.set(reference, updated);
      return NextResponse.json(updated);
    }

    if (action === "expire") {
      const updated: SolanaPayStatusResponse = {
        reference,
        status: "EXPIRED",
        message: "Transaction expired. Please generate a new QR code.",
        timestamp: new Date().toISOString(),
        createdAt: referenceStore.get(reference)?.createdAt ?? Date.now() - SOLANA_PAY_DEFAULT_TIMEOUT_MS - 1000,
      };
      referenceStore.set(reference, updated);
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
