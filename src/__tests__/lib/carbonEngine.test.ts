import {
  safeParseDistance,
  calculateCommuteEmissions,
  generateMonthlyCarbonSummary,
  exportCorporateESGReportCSV,
} from "@/lib/sustainability/carbonEngine";

describe("carbonEngine - Null & Undefined Commute Distance Safeguards", () => {
  it("safeParseDistance returns 0 for null, undefined, NaN, or non-number inputs", () => {
    expect(safeParseDistance(null)).toBe(0);
    expect(safeParseDistance(undefined)).toBe(0);
    expect(safeParseDistance(NaN)).toBe(0);
    expect(safeParseDistance(-15)).toBe(0);
    expect(safeParseDistance(12.5)).toBe(12.5);
  });

  it("calculateCommuteEmissions handles null or undefined distanceKm gracefully", () => {
    const resNull = calculateCommuteEmissions(null, "WALKING");
    expect(resNull.emissionsGrams).toBe(0);
    expect(resNull.avoidedGrams).toBe(0);

    const resUndefined = calculateCommuteEmissions(undefined, "GASOLINE_CAR");
    expect(resUndefined.emissionsGrams).toBe(0);
    expect(resUndefined.avoidedGrams).toBe(0);

    const resValid = calculateCommuteEmissions(10, "WALKING");
    expect(resValid.emissionsGrams).toBe(0);
    expect(resValid.avoidedGrams).toBe(1720); // 10km * 172g baseline
  });

  it("generateMonthlyCarbonSummary handles records with missing or null distanceKm", () => {
    const records = [
      {
        bookingId: "b-1",
        venueName: "Venue A",
        date: "2026-10-01",
        distanceKm: null,
        commuteMode: "WALKING" as const,
      },
      {
        bookingId: "b-2",
        venueName: "Venue B",
        date: "2026-10-02",
        distanceKm: undefined,
        commuteMode: "PUBLIC_TRANSIT" as const,
      },
      {
        bookingId: "b-3",
        venueName: "Venue C",
        date: "2026-10-03",
        distanceKm: 5.0,
        commuteMode: "BICYCLING" as const,
      },
    ];

    const summary = generateMonthlyCarbonSummary(records, "October 2026");

    expect(summary.totalDistanceKm).toBe(5.0);
    expect(summary.records[0].distanceKm).toBe(0);
    expect(summary.records[1].distanceKm).toBe(0);
    expect(summary.records[2].distanceKm).toBe(5.0);

    const csv = exportCorporateESGReportCSV(summary);
    expect(csv).toContain("0.0");
    expect(csv).toContain("5.0");
  });
});
