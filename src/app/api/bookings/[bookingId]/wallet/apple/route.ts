import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { buildApplePassJson } from "@/lib/wallet/passService";

type RouteContext = {
  params: Promise<{
    bookingId: string;
  }>;
};

/**
 * GET /api/bookings/[bookingId]/wallet/apple
 * Downloads Apple Wallet .pkpass payload.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId } = await context.params;
    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id: bookingId }, { confirmationId: bookingId }],
        userId,
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            category: true,
            address: true,
            latitude: true,
            longitude: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const passJson = buildApplePassJson(booking as any);
    const passBuffer = Buffer.from(JSON.stringify(passJson, null, 2), "utf-8");

    return new NextResponse(passBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="worksphere-${booking.confirmationId}.pkpass"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[GET /api/bookings/[bookingId]/wallet/apple] Error:", error);
    return NextResponse.json(
      { error: "Failed to download Apple Wallet pass" },
      { status: 500 },
    );
  }
}
