import {
  calculateNomadTaxPresence,
  toCalendarDateString,
  TaxPresenceEntry,
} from "@/lib/tax/nomadTaxEngine";

describe("NomadTaxEngine - Physical Presence & Multi-Jurisdiction Collision Resolution", () => {
  it("normalizes ISO timestamps to UTC calendar date strings", () => {
    expect(toCalendarDateString("2026-03-15T08:30:00.000Z")).toBe("2026-03-15");
    expect(toCalendarDateString("2026-03-15T23:59:59.999Z")).toBe("2026-03-15");
  });

  it("calculates physical presence for single-country stays without collisions", () => {
    const entries: TaxPresenceEntry[] = [
      {
        id: "1",
        userId: "user-1",
        countryCode: "ES",
        jurisdiction: "Spain",
        timestamp: "2026-03-01T10:00:00Z",
      },
      {
        id: "2",
        userId: "user-1",
        countryCode: "ES",
        jurisdiction: "Spain",
        timestamp: "2026-03-02T10:00:00Z",
      },
    ];

    const report = calculateNomadTaxPresence(entries, { taxYear: 2026 });

    expect(report.totalUniqueCalendarDays).toBe(2);
    expect(report.collisionsResolvedCount).toBe(0);
    expect(report.jurisdictions).toHaveLength(1);
    expect(report.jurisdictions[0].countryCode).toBe("ES");
    expect(report.jurisdictions[0].daysCount).toBe(2);
  });

  it("resolves multi-jurisdiction physical presence collisions on transitional travel days without double-counting", () => {
    const entries: TaxPresenceEntry[] = [
      // Day 1: Stay in Spain
      {
        id: "e1",
        userId: "nomad-42",
        countryCode: "ES",
        jurisdiction: "Spain",
        timestamp: "2026-04-10T09:00:00Z",
      },
      // Day 2: Travel Day - Check-in in Spain in morning, arrival check-in in Portugal in evening
      {
        id: "e2",
        userId: "nomad-42",
        countryCode: "ES",
        jurisdiction: "Spain",
        timestamp: "2026-04-11T08:00:00Z",
        isDeparture: true,
      },
      {
        id: "e3",
        userId: "nomad-42",
        countryCode: "PT",
        jurisdiction: "Portugal",
        timestamp: "2026-04-11T21:30:00Z",
        isArrival: true,
      },
      // Day 3: Stay in Portugal
      {
        id: "e4",
        userId: "nomad-42",
        countryCode: "PT",
        jurisdiction: "Portugal",
        timestamp: "2026-04-12T14:00:00Z",
      },
    ];

    const report = calculateNomadTaxPresence(entries, { taxYear: 2026 });

    // Total unique calendar days must equal 3 (April 10, April 11, April 12)
    expect(report.totalUniqueCalendarDays).toBe(3);
    // Collision on April 11 should be resolved
    expect(report.collisionsResolvedCount).toBe(1);

    const esSummary = report.jurisdictions.find((j) => j.countryCode === "ES");
    const ptSummary = report.jurisdictions.find((j) => j.countryCode === "PT");

    // April 10 -> Spain (1 day)
    // April 11 -> Portugal (Arrival priority allocated 1 day)
    // April 12 -> Portugal (1 day)
    expect(esSummary?.daysCount).toBe(1);
    expect(ptSummary?.daysCount).toBe(2);

    // Total sum of days across jurisdictions must equal unique calendar days (3)
    const sumDays = report.jurisdictions.reduce((acc, j) => acc + j.daysCount, 0);
    expect(sumDays).toBe(3);
  });

  it("generates 183-day tax residency risk warnings when thresholds are reached", () => {
    // Generate 185 entries for Spain in 2026
    const entries: TaxPresenceEntry[] = [];
    const startDate = new Date("2026-01-01T12:00:00Z");

    for (let i = 0; i < 185; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      entries.push({
        id: `day-${i}`,
        userId: "nomad-183",
        countryCode: "ES",
        jurisdiction: "Spain",
        timestamp: d.toISOString(),
      });
    }

    const report = calculateNomadTaxPresence(entries, { taxYear: 2026 });

    expect(report.jurisdictions[0].isTaxResidentRisk).toBe(true);
    expect(report.jurisdictions[0].riskLevel).toBe("CRITICAL");
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings[0]).toContain("CRITICAL TAX RESIDENCY RISK");
  });
});
