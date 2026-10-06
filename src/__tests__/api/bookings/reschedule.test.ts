import { NextRequest } from "next/server";

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    venueSeat: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

jest.mock("@/lib/webhooks/deliver", () => ({
  emitWebhookEvent: jest.fn(),
}));

jest.mock("@/lib/reservations/event-bus", () => ({
  publishVenueAvailability: jest.fn(),
}));

jest.mock("@/lib/waitlist", () => ({
  notifyNextInWaitlist: jest.fn().mockResolvedValue(undefined),
}));

import { PATCH } from "@/app/api/bookings/[bookingId]/route";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

describe("PATCH /api/bookings/[bookingId] - Reschedule & Extend Flow", () => {
  const mockUserId = "user_123";
  const mockBookingId = "booking_abc";

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: mockUserId });
  });

  it("returns 401 if user is unauthenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

    const req = new NextRequest("http://localhost/api/bookings/booking_abc", {
      method: "PATCH",
      body: JSON.stringify({ date: "2026-10-10", time: "10:00" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ bookingId: mockBookingId }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 if booking is not found", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/bookings/booking_abc", {
      method: "PATCH",
      body: JSON.stringify({ date: "2026-10-10", time: "10:00" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ bookingId: mockBookingId }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Booking not found.");
  });

  it("returns 400 if booking is cancelled", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
      id: mockBookingId,
      userId: mockUserId,
      status: "CANCELLED",
      date: "2026-10-10",
      time: "10:00",
    });

    const req = new NextRequest("http://localhost/api/bookings/booking_abc", {
      method: "PATCH",
      body: JSON.stringify({ date: "2026-10-12", time: "14:00" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ bookingId: mockBookingId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Cannot reschedule a cancelled booking.");
  });

  it("returns 400 if target duration is out of range", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
      id: mockBookingId,
      userId: mockUserId,
      status: "CONFIRMED",
      date: "2026-10-10",
      time: "10:00",
      venueId: "venue_1",
    });

    const req = new NextRequest("http://localhost/api/bookings/booking_abc", {
      method: "PATCH",
      body: JSON.stringify({ duration: 600 }), // > 480 min
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ bookingId: mockBookingId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Duration must be an integer between 30 and 480 minutes");
  });

  it("returns 409 if requested desk slot conflicts with another reservation", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
      id: mockBookingId,
      userId: mockUserId,
      status: "CONFIRMED",
      date: "2026-10-10",
      time: "10:00",
      duration: 60,
      venueId: "venue_1",
      seatId: "seat_99",
      seatNumber: "A1",
    });

    (prisma.venueSeat.findFirst as jest.Mock).mockResolvedValue({
      id: "seat_99",
      seatNumber: "A1",
      isEnabled: true,
    });

    // Existing conflicting booking on seat_99 from 14:00 to 16:00
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([
      {
        date: "2026-10-15",
        time: "14:00",
        duration: 120,
        timeZone: "UTC",
      },
    ]);

    const req = new NextRequest("http://localhost/api/bookings/booking_abc", {
      method: "PATCH",
      body: JSON.stringify({
        date: "2026-10-15",
        time: "14:30",
        duration: 60,
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ bookingId: mockBookingId }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("The requested time slot or desk is not available");
  });

  it("successfully reschedules and extends an active booking when slot is available", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
      id: mockBookingId,
      confirmationId: "WS-CONF-123",
      userId: mockUserId,
      status: "CONFIRMED",
      date: "2026-10-10",
      time: "10:00",
      duration: 60,
      venueId: "venue_1",
      seatId: "seat_99",
      seatNumber: "A1",
      venue: { id: "venue_1", name: "Desk Hub", address: "123 St", category: "coworking" },
    });

    (prisma.venueSeat.findFirst as jest.Mock).mockResolvedValue({
      id: "seat_99",
      seatNumber: "A1",
      isEnabled: true,
    });

    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    const mockUpdated = {
      id: mockBookingId,
      confirmationId: "WS-CONF-123",
      userId: mockUserId,
      status: "CONFIRMED",
      date: "2026-10-15",
      time: "11:00",
      duration: 120,
      seatId: "seat_99",
      seatNumber: "A1",
    };
    (prisma.booking.update as jest.Mock).mockResolvedValue(mockUpdated);

    const req = new NextRequest("http://localhost/api/bookings/booking_abc", {
      method: "PATCH",
      body: JSON.stringify({
        date: "2026-10-15",
        time: "11:00",
        duration: 120,
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ bookingId: mockBookingId }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Booking rescheduled successfully.");
    expect(data.booking).toEqual(mockUpdated);
  });
});
