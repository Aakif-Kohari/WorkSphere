import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RescheduleModal } from "@/components/bookings/RescheduleModal";

describe("RescheduleModal Component", () => {
  const mockBooking = {
    id: "booking-1",
    confirmationId: "WS-CONF-888",
    date: "2026-10-20",
    time: "10:00",
    duration: 60,
    seatNumber: "A4",
    seatId: "seat-4",
    venue: {
      name: "Indie Hub",
      address: "123 Tech Lane",
    },
  };

  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <RescheduleModal
        booking={mockBooking}
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders booking details when open", () => {
    render(
      <RescheduleModal
        booking={mockBooking}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    expect(screen.getByText(/Reschedule \/ Extend Booking/i)).toBeInTheDocument();
    expect(screen.getByText(/Indie Hub/i)).toBeInTheDocument();
    expect(screen.getByText(/WS-CONF-888/i)).toBeInTheDocument();
    expect(screen.getByTestId("reschedule-date-input")).toHaveValue("2026-10-20");
    expect(screen.getByTestId("reschedule-time-input")).toHaveValue("10:00");
  });

  it("updates duration when quick extend buttons are clicked", () => {
    render(
      <RescheduleModal
        booking={mockBooking}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    const extend30Btn = screen.getByTestId("quick-extend-30m");
    fireEvent.click(extend30Btn);
    expect(screen.getByText(/90 min/i)).toBeInTheDocument();

    const extend1hBtn = screen.getByTestId("quick-extend-1h");
    fireEvent.click(extend1hBtn);
    expect(screen.getByText(/150 min/i)).toBeInTheDocument();
  });

  it("submits PATCH request and triggers onSuccess callback", async () => {
    const originalFetch = global.fetch;
    const mockUpdatedBooking = { ...mockBooking, date: "2026-10-22", time: "11:00", duration: 120 };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        booking: mockUpdatedBooking,
      }),
    });

    render(
      <RescheduleModal
        booking={mockBooking}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    const dateInput = screen.getByTestId("reschedule-date-input");
    const timeInput = screen.getByTestId("reschedule-time-input");
    const submitBtn = screen.getByTestId("reschedule-submit-button");

    fireEvent.change(dateInput, { target: { value: "2026-10-22" } });
    fireEvent.change(timeInput, { target: { value: "11:00" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/bookings/booking-1",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"date":"2026-10-22"'),
        }),
      );
      expect(mockOnSuccess).toHaveBeenCalledWith(mockUpdatedBooking);
    });

    global.fetch = originalFetch;
  });

  it("displays error message when API returns failure", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "The requested time slot or desk is not available.",
      }),
    });

    render(
      <RescheduleModal
        booking={mockBooking}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    const submitBtn = screen.getByTestId("reschedule-submit-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/The requested time slot or desk is not available/i),
      ).toBeInTheDocument();
    });

    global.fetch = originalFetch;
  });
});
