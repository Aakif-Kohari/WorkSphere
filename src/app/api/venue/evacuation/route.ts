/**
 * route.ts
 * POST /api/venue/evacuation
 * Generates emergency egress route, nearest fire exits, AED locator, and assembly point guidance.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeEmergencyEvacuationPlan,
  type EmergencyType,
} from "@/lib/safety/evacuationRouter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      venueId,
      userSeatNumber = "Desk A-14",
      emergencyType = "FIRE_ALARM",
      currentCoordinates = { x: 25, y: 20 },
    } = body;

    let venueName = "Mission Focus Coworking & Cafe";

    if (venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        select: { name: true },
      });
      if (venue) venueName = venue.name;
    }

    const plan = computeEmergencyEvacuationPlan(
      currentCoordinates,
      venueName,
      userSeatNumber,
      emergencyType as EmergencyType
    );

    return NextResponse.json({
      success: true,
      alertTimestamp: new Date().toISOString(),
      evacuationPlan: plan,
    });
  } catch (error: any) {
    console.error("[POST /api/venue/evacuation] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate emergency evacuation plan", details: error.message },
      { status: 500 }
    );
  }
}
