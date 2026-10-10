import {
  contourToSvgPathData,
  generateFloorplanSvg,
  downloadFloorplanSvg,
  type ContourPolygon,
} from "@/lib/floorplan/contourSvgExporter";

describe("Contour SVG Exporter (#5392)", () => {
  const samplePolygon1: ContourPolygon = [
    { x: 10, y: 10 },
    { x: 100, y: 10 },
    { x: 100, y: 100 },
    { x: 10, y: 10 },
  ];

  const samplePolygon2: ContourPolygon = [
    { x: 150, y: 150 },
    { x: 250, y: 150 },
    { x: 250, y: 250 },
    { x: 150, y: 250 },
  ];

  describe("contourToSvgPathData", () => {
    it("converts pixel coordinate points to an SVG path string", () => {
      const d = contourToSvgPathData(samplePolygon1, 800, 600);
      expect(d).toBe("M 10 10 L 100 10 L 100 100 L 10 10 Z");
    });

    it("normalizes coordinates when normalize option is true", () => {
      const d = contourToSvgPathData(samplePolygon1, 1000, 500, {
        normalize: true,
        precision: 3,
      });
      // 10 / 1000 = 0.01, 10 / 500 = 0.02
      expect(d).toContain("M 0.01 0.02");
      expect(d.endsWith("Z")).toBe(true);
    });

    it("returns empty string for empty polygon", () => {
      expect(contourToSvgPathData([], 800, 600)).toBe("");
    });
  });

  describe("generateFloorplanSvg", () => {
    it("generates a valid SVG document with metadata and path elements", () => {
      const svg = generateFloorplanSvg(
        [samplePolygon1, samplePolygon2],
        800,
        600,
        "venue-101"
      );

      expect(svg).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
      expect(svg).toContain(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">`);
      expect(svg).toContain(`<!-- Venue: venue-101 | Contours: 2 | ViewBox: 0 0 800 600 -->`);
      expect(svg).toContain(`<path id="contour-1" d="M 10 10 L 100 10 L 100 100 L 10 10 Z"`);
      expect(svg).toContain(`<path id="contour-2" d="M 150 150 L 250 150 L 250 250 L 150 250 Z"`);
      expect(svg).toContain(`</svg>`);
    });

    it("applies custom styling options", () => {
      const svg = generateFloorplanSvg([samplePolygon1], 800, 600, "venue-test", {
        strokeColor: "#ff0000",
        strokeWidth: 4,
        fillColor: "rgba(255, 0, 0, 0.2)",
      });

      expect(svg).toContain(`stroke="#ff0000"`);
      expect(svg).toContain(`stroke-width="4"`);
      expect(svg).toContain(`fill="rgba(255, 0, 0, 0.2)"`);
    });
  });

  describe("downloadFloorplanSvg", () => {
    it("generates correctly formatted filename [venueId]-floorplan-vector.svg", () => {
      // Mock window and document for unit test environment
      const originalCreateElement = document.createElement;
      const originalBlob = global.Blob;
      const originalURL = global.URL;

      const mockClick = jest.fn();
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();

      document.createElement = jest.fn((tag) => {
        if (tag === "a") {
          return {
            href: "",
            download: "",
            click: mockClick,
          } as unknown as HTMLElement;
        }
        return originalCreateElement.call(document, tag);
      });

      document.body.appendChild = mockAppendChild;
      document.body.removeChild = mockRemoveChild;

      global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
      global.URL.revokeObjectURL = jest.fn();

      const filename = downloadFloorplanSvg(
        [samplePolygon1],
        800,
        600,
        "venue-austin-05"
      );

      expect(filename).toBe("venue-austin-05-floorplan-vector.svg");
      expect(mockClick).toHaveBeenCalled();

      // Restore
      document.createElement = originalCreateElement;
      global.Blob = originalBlob;
      global.URL = originalURL;
    });
  });
});
