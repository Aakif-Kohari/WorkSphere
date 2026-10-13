import React from "react";
import { render, screen } from "@testing-library/react";
import {
  CockpitAltimeterTape,
  calculateAltitudeFeet,
  interpolateAltitudeDrumPosition,
} from "../CockpitAltimeterTape";

describe("CockpitAltimeterTape", () => {
  describe("calculateAltitudeFeet", () => {
    it("maps Floor 1 to 1,000 ft", () => {
      expect(calculateAltitudeFeet(1, 5)).toBe(1000);
    });

    it("maps Floor 2 to 2,000 ft", () => {
      expect(calculateAltitudeFeet(2, 5)).toBe(2000);
    });

    it("maps Floor 3 to 3,000 ft", () => {
      expect(calculateAltitudeFeet(3, 10)).toBe(3000);
    });

    it("maps Rooftop (floorNumber >= totalFloors) to 10,000 ft", () => {
      expect(calculateAltitudeFeet(5, 5)).toBe(10000);
      expect(calculateAltitudeFeet(10, 10)).toBe(10000);
      expect(calculateAltitudeFeet(12, 10)).toBe(10000);
    });

    it("maps ground or non-positive floor to 0 ft", () => {
      expect(calculateAltitudeFeet(0, 5)).toBe(0);
      expect(calculateAltitudeFeet(-1, 5)).toBe(0);
    });
  });

  describe("interpolateAltitudeDrumPosition", () => {
    it("interpolates 0 ft to 0 px offset", () => {
      const offset = interpolateAltitudeDrumPosition(0, 10000, 320);
      expect(offset).toBe(0);
    });

    it("interpolates midpoint (5,000 ft) to half tape travel height", () => {
      const offset = interpolateAltitudeDrumPosition(5000, 10000, 320);
      expect(offset).toBe(160);
    });

    it("interpolates Rooftop ceiling (10,000 ft) to maximum tape travel height", () => {
      const offset = interpolateAltitudeDrumPosition(10000, 10000, 320);
      expect(offset).toBe(320);
    });

    it("interpolates Floor 1 (1,000 ft) to 10% of tape travel height", () => {
      const offset = interpolateAltitudeDrumPosition(1000, 10000, 320);
      expect(offset).toBeCloseTo(32, 1);
    });

    it("clamps values below 0 ft or above 10,000 ft", () => {
      expect(interpolateAltitudeDrumPosition(-500, 10000, 320)).toBe(0);
      expect(interpolateAltitudeDrumPosition(15000, 10000, 320)).toBe(320);
    });
  });

  describe("Component Rendering", () => {
    it("renders active floor and altitude for Floor 1", () => {
      render(<CockpitAltimeterTape floorNumber={1} totalFloors={5} venueName="Cyber Tower" />);

      expect(screen.getByText("Cyber Tower")).toBeInTheDocument();
      expect(screen.getByText("F1")).toBeInTheDocument();
      expect(screen.getByText("1,000 FT")).toBeInTheDocument();
      expect(screen.getByTestId("altimeter-drum-roller")).toBeInTheDocument();
      expect(screen.getByTestId("altimeter-tape-strip")).toBeInTheDocument();
    });

    it("renders active floor and altitude for Floor 2", () => {
      render(<CockpitAltimeterTape floorNumber={2} totalFloors={5} />);

      expect(screen.getByText("F2")).toBeInTheDocument();
      expect(screen.getByText("2,000 FT")).toBeInTheDocument();
    });

    it("renders Rooftop status when on top floor", () => {
      render(<CockpitAltimeterTape floorNumber={5} totalFloors={5} />);

      expect(screen.getByText("ROOF")).toBeInTheDocument();
      expect(screen.getByText("10,000 FT")).toBeInTheDocument();
      expect(screen.getByText(/Sky Deck \/ 10,000 FT/)).toBeInTheDocument();
    });

    it("renders emerald major and minor tick marks", () => {
      render(<CockpitAltimeterTape floorNumber={1} totalFloors={5} />);

      expect(screen.getByTestId("tape-mark-10000")).toBeInTheDocument();
      expect(screen.getByTestId("tape-mark-1000")).toBeInTheDocument();
      expect(screen.getByTestId("tape-mark-0")).toBeInTheDocument();
    });
  });
});
