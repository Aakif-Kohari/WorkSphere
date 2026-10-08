import { prisma } from "@/lib/prisma";
import { eventBus } from "@/core/events";

export interface PromotionResult {
  promotedCount: number;
  promotedRsvps: Array<{
    id: string;
    userId: string;
    sessionId: string;
    status: string;
  }>;
}

/**
 * Automatically promotes waitlisted/MAYBE attendees to GOING for a social session
 * when available capacity allows (e.g., following an RSVP cancellation or decline).
 *
 * @param sessionId The ID of the CoworkingSession
 * @returns Details on any promoted RSVPs
 */
export async function autoPromoteSessionWaitlist(
  sessionId: string,
): Promise<PromotionResult> {
  const session = await prisma.coworkingSession.findUnique({
    where: { id: sessionId },
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
    return { promotedCount: 0, promotedRsvps: [] };
  }

  // If no guest cap is set, no promotion queue constraint is active
  if (!session.maxGuests) {
    return { promotedCount: 0, promotedRsvps: [] };
  }

  const currentGoing = session._count.rsvps;
  const availableSlots = session.maxGuests - currentGoing;

  if (availableSlots <= 0) {
    return { promotedCount: 0, promotedRsvps: [] };
  }

  // Find the earliest MAYBE attendees waiting in FIFO order
  const waitlistedAttendees = await prisma.sessionRsvp.findMany({
    where: {
      sessionId,
      status: "MAYBE",
    },
    orderBy: { createdAt: "asc" },
    take: availableSlots,
  });

  if (waitlistedAttendees.length === 0) {
    return { promotedCount: 0, promotedRsvps: [] };
  }

  const promotedRsvps: PromotionResult["promotedRsvps"] = [];

  for (const attendee of waitlistedAttendees) {
    try {
      const updated = await prisma.sessionRsvp.update({
        where: { id: attendee.id },
        data: { status: "GOING" },
      });

      promotedRsvps.push({
        id: updated.id,
        userId: updated.userId,
        sessionId: updated.sessionId,
        status: updated.status,
      });

      // Emit session RSVP update event
      await eventBus.emit("session:rsvp", {
        sessionId: session.id,
        rsvpId: updated.id,
        userId: updated.userId,
        status: "GOING",
      });

      // Emit session promoted event
      await eventBus.emit("session:promoted", {
        sessionId: session.id,
        rsvpId: updated.id,
        userId: updated.userId,
        previousStatus: "MAYBE",
      });
    } catch (error) {
      console.error(
        `[autoPromoteSessionWaitlist] Error promoting RSVP ${attendee.id}:`,
        error,
      );
    }
  }

  return {
    promotedCount: promotedRsvps.length,
    promotedRsvps,
  };
}
