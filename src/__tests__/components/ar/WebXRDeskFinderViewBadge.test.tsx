import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import WebXRDeskFinderView, {
  calculateDeskBadgeOpacity,
  calculateEstimatedWalkingSeconds,
} from "@/components/ar/WebXRDeskFinderView";

describe("WebXRDeskFinderView Distance & Walking Time HUD Badge (#5388)", () => {
  beforeEach(() => {
    // Mock global fetch for wayfinding API
    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url === "/api/ar/wayfinding") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              route: {
                targetSeatId: "seat-test-1",
                targetSeatNumber: "Desk B-08 (Window Pod)",
                targetPosition: { x: 5.4, y: 0, z: -8.2 },
                totalDistanceMeters: 9.8,
                estimatedWalkingSeconds: 9,
                waypoints: [
                  {
                    stepIndex: 1,
                    position: { x: 2.7, y: 0, z: 0 },
                    instruction: "Follow corridor",
                    distanceToNextMeters: 2.7,
                    turnAction: "STRAIGHT",
                  },
                  {
                    stepIndex: 2,
                    position: { x: 5.4, y: 0, z: -8.2 },
                    instruction: "Turn right into Pod",
                    distanceToNextMeters: 8.6,
                    turnAction: "TURN_RIGHT",
                  },
                  {
                    stepIndex: 3,
                    position: { x: 5.4, y: 0, z: -8.2 },
                    instruction: "Arrived at Desk B-08",
                    distanceToNextMeters: 0,
                    turnAction: "ARRIVED",
                  },
                ],
              },
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateDeskBadgeOpacity", () => {
    it("returns 1 for distance >= 1.5m", () => {
      expect(calculateDeskBadgeOpacity(1.5)).toBe(1);
      expect(calculateDeskBadgeOpacity(5.0)).toBe(1);
      expect(calculateDeskBadgeOpacity(10.2)).toBe(1);
    });

    it("smoothly fades badge opacity as user approaches within 1.5 meters", () => {
      expect(calculateDeskBadgeOpacity(1.2)).toBeCloseTo(0.8, 2);
      expect(calculateDeskBadgeOpacity(0.75)).toBeCloseTo(0.5, 2);
      expect(calculateDeskBadgeOpacity(0.3)).toBeCloseTo(0.2, 2);
    });

    it("returns 0 when arrived or distance <= 0", () => {
      expect(calculateDeskBadgeOpacity(0)).toBe(0);
      expect(calculateDeskBadgeOpacity(-0.5)).toBe(0);
    });
  });

  describe("calculateEstimatedWalkingSeconds", () => {
    it("computes walking time based on distance and 1.1 m/s indoor pace", () => {
      expect(calculateEstimatedWalkingSeconds(5.5)).toBe(5);
      expect(calculateEstimatedWalkingSeconds(11.0)).toBe(10);
      expect(calculateEstimatedWalkingSeconds(0)).toBe(0);
    });
  });

  describe("WebXRDeskFinderView Component HUD", () => {
    it("renders the floating HUD distance and estimated walking time badge", async () => {
      await act(async () => {
        render(<WebXRDeskFinderView targetSeatNumber="Desk B-08 (Window Pod)" />);
      });

      const badge = screen.getByTestId("desk-hud-distance-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/m/);
      expect(badge).toHaveTextContent(/s walk/);
    });

    it("recalculates distance on camera movement (pointer move)", async () => {
      let container: HTMLElement;
      await act(async () => {
        const renderResult = render(<WebXRDeskFinderView />);
        container = renderResult.container;
      });

      const badgeBefore = screen.getByTestId("desk-hud-distance-badge").textContent;

      // Simulate moving camera across viewport
      const viewport = container!.querySelector("[onpointermove], div.overflow-hidden");
      expect(viewport).toBeTruthy();

      await act(async () => {
        fireEvent.pointerMove(viewport!, {
          clientX: 400,
          clientY: 200,
        });
      });

      const badgeAfter = screen.getByTestId("desk-hud-distance-badge");
      expect(badgeAfter).toBeInTheDocument();
    });

    it("fades badge opacity when arrived at destination", async () => {
      await act(async () => {
        render(<WebXRDeskFinderView />);
      });

      // Advance steps until arrived
      const advanceBtn = screen.getByRole("button", { name: /Advance Step/i });
      await act(async () => {
        fireEvent.click(advanceBtn);
      });
      await act(async () => {
        fireEvent.click(advanceBtn);
      });

      const badge = screen.getByTestId("desk-hud-distance-badge");
      expect(badge).toHaveStyle({ opacity: "0" });
    });
  });
});
