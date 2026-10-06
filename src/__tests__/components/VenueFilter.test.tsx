import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  VenueFilter,
  classifyNoiseLevel,
  filterVenuesByNoise,
} from "@/components/venue/VenueFilter";

// Mock next/navigation
const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/venues",
}));

describe("VenueFilter & Noise Level Classification (#4409)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  describe("classifyNoiseLevel", () => {
    it("classifies scores under 50dB as quiet", () => {
      expect(classifyNoiseLevel(35)).toBe("quiet");
      expect(classifyNoiseLevel(49.9)).toBe("quiet");
    });

    it("classifies scores between 50dB and 70dB as moderate", () => {
      expect(classifyNoiseLevel(50)).toBe("moderate");
      expect(classifyNoiseLevel(62)).toBe("moderate");
      expect(classifyNoiseLevel(70)).toBe("moderate");
    });

    it("classifies scores over 70dB as energetic", () => {
      expect(classifyNoiseLevel(70.1)).toBe("energetic");
      expect(classifyNoiseLevel(85)).toBe("energetic");
    });
  });

  describe("filterVenuesByNoise", () => {
    const venues = [
      { id: "v1", name: "Quiet Library", telemetry: { averageNoise: 42 } },
      { id: "v2", name: "Moderate Cafe", telemetry: { averageNoise: 65 } },
      { id: "v3", name: "Lively Pub", telemetry: { averageNoise: 78 } },
      { id: "v4", name: "Tagged Quiet", noiseLevel: "quiet" },
    ];

    it("returns all venues if no tags are selected", () => {
      expect(filterVenuesByNoise(venues, [])).toEqual(venues);
    });

    it("filters venues matching single noise tag", () => {
      const quietVenues = filterVenuesByNoise(venues, ["quiet"]);
      expect(quietVenues.map((v) => v.id)).toEqual(["v1", "v4"]);
    });

    it("filters venues matching multiple noise tags", () => {
      const result = filterVenuesByNoise(venues, ["quiet", "energetic"]);
      expect(result.map((v) => v.id)).toEqual(["v1", "v3", "v4"]);
    });
  });

  describe("VenueFilter component UI & search param sync", () => {
    it("renders noise level toggle buttons (Quiet, Moderate, Energetic)", () => {
      render(<VenueFilter />);

      expect(screen.getByTestId("noise-filter-quiet")).toBeInTheDocument();
      expect(screen.getByTestId("noise-filter-moderate")).toBeInTheDocument();
      expect(screen.getByTestId("noise-filter-energetic")).toBeInTheDocument();
    });

    it("updates search parameters to noise=quiet,moderate on multi-select toggle", () => {
      const onChange = jest.fn();
      render(<VenueFilter onChange={onChange} />);

      const quietBtn = screen.getByTestId("noise-filter-quiet");
      fireEvent.click(quietBtn);

      expect(onChange).toHaveBeenCalledWith(["quiet"]);
      expect(mockPush).toHaveBeenCalledWith("/venues?noise=quiet", { scroll: false });
    });
  });
});
