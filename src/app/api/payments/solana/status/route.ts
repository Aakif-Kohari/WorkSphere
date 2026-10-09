import { NextRequest, NextResponse } from "next/server";
import { SolanaPayStatusResponse } from "@/lib/payments/solanaPay";

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

    if (simulateConfirm || !referenceStore.has(reference)) {
      const isConfirmed = simulateConfirm;
      const statusData: SolanaPayStatusResponse = {
        reference,
        status: isConfirmed ? "CONFIRMED" : "PENDING",
        signature: isConfirmed
          ? `5K2x${Math.random().toString(36).substring(2, 15)}SolanaTxSig${Date.now()}`
          : undefined,
        slot: isConfirmed ? 248901234 : undefined,
        timestamp: new Date().toISOString(),
      };
      referenceStore.set(reference, statusData);
    }

    const currentStatus = referenceStore.get(reference)!;

    return NextResponse.json(currentStatus);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to check Solana payment status" },
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
