import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreakBadge } from "@/components/Header/StreakBadge";

describe("StreakBadge", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        currentStreak: 5,
        longestStreak: 12,
        unlockedMilestones: [3, 5],
      }),
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders with tabIndex 0, role status, and accessible tooltip role", async () => {
    render(<StreakBadge />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("tabindex", "0");
    expect(badge).toHaveAttribute("aria-label", "5-day work streak");

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveClass("group-focus-within:opacity-100");
  });
});
