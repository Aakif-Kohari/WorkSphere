import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventBus } from "@/core/events";
import { autoPromoteSessionWaitlist } from "@/lib/social/waitlistPromotion";
import "@/core/subscribers/discord";

const allowed = new Set(["GOING", "MAYBE", "DECLINED", "CANCELLED"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { slug } = await params;
  const body = await request.json();
  let status =
    typeof body.status === "string" ? body.status.toUpperCase() : "";

  if (!allowed.has(status)) {
    return NextResponse.json({ error: "Invalid RSVP status" }, { status: 400 });
  }

  if (status === "CANCELLED") {
    status = "DECLINED";
  }

  const session = await prisma.coworkingSession.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          rsvps: {
            where: { status: "GOING" },
          },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const existing = await prisma.sessionRsvp.findUnique({
    where: {
      sessionId_userId: {
        sessionId: session.id,
        userId,
      },
    },
  });

  if (
    status === "GOING" &&
    session.maxGuests &&
    session._count.rsvps >= session.maxGuests
  ) {
    if (!existing || existing.status !== "GOING") {
      return NextResponse.json({ error: "Session is full" }, { status: 409 });
    }
  }

  const wasPreviouslyGoing = existing?.status === "GOING";

  try {
    const rsvp = await prisma.sessionRsvp.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId,
        },
      },
      update: { status: status as "GOING" | "MAYBE" | "DECLINED" },
      create: {
        sessionId: session.id,
        userId,
        status: status as "GOING" | "MAYBE" | "DECLINED",
      },
    });

    await eventBus.emit("session:rsvp", {
      sessionId: session.id,
      rsvpId: rsvp.id,
      userId,
      status: rsvp.status,
    });

    // Auto-promote waitlisted attendee if a going slot was freed up
    let promotionResult = null;
    if (wasPreviouslyGoing && status !== "GOING") {
      promotionResult = await autoPromoteSessionWaitlist(session.id);
    }

    return NextResponse.json({
      ...rsvp,
      promotedWaitlist: promotionResult?.promotedRsvps ?? [],
    });
  } catch (error: any) {
    // Handle concurrent insert collisions by falling back to update
    if (error.code === "P2002") {
      const rsvp = await prisma.sessionRsvp.update({
        where: {
          sessionId_userId: {
            sessionId: session.id,
            userId,
          },
        },
        data: { status: status as "GOING" | "MAYBE" | "DECLINED" },
      });

      await eventBus.emit("session:rsvp", {
        sessionId: session.id,
        rsvpId: rsvp.id,
        userId,
        status: rsvp.status,
      });

      let promotionResult = null;
      if (wasPreviouslyGoing && status !== "GOING") {
        promotionResult = await autoPromoteSessionWaitlist(session.id);
      }

      return NextResponse.json({
        ...rsvp,
        promotedWaitlist: promotionResult?.promotedRsvps ?? [],
      });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { slug } = await params;

  const session = await prisma.coworkingSession.findUnique({
    where: { slug },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const existing = await prisma.sessionRsvp.findUnique({
    where: {
      sessionId_userId: {
        sessionId: session.id,
        userId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "RSVP not found" }, { status: 404 });
  }

  const wasGoing = existing.status === "GOING";

  await prisma.sessionRsvp.delete({
    where: {
      sessionId_userId: {
        sessionId: session.id,
        userId,
      },
    },
  });

  await eventBus.emit("session:rsvp", {
    sessionId: session.id,
    rsvpId: existing.id,
    userId,
    status: "DECLINED",
  });

  let promotionResult = null;
  if (wasGoing) {
    promotionResult = await autoPromoteSessionWaitlist(session.id);
  }

  return NextResponse.json({
    success: true,
    message: "RSVP cancelled successfully",
    promotedWaitlist: promotionResult?.promotedRsvps ?? [],
  });
}

