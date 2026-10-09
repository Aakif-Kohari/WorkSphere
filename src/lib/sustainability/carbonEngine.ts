/**
 * carbonEngine.ts
 * Implements EPA / EEA multimodal commute carbon footprint emissions calculations,
 * workspace green energy audits, and corporate Scope 3 ESG sustainability reporting.
 */

export type CommuteMode =
  | "WALKING"
  | "BICYCLING"
  | "ELECTRIC_SCOOTER"
  | "PUBLIC_TRANSIT"
  | "ELECTRIC_VEHICLE"
  | "GASOLINE_CAR";

export const EMISSION_FACTORS_G_PER_KM: Record<CommuteMode, number> = {
  WALKING: 0,
  BICYCLING: 0,
  ELECTRIC_SCOOTER: 12,
  PUBLIC_TRANSIT: 35,
  ELECTRIC_VEHICLE: 48,
  GASOLINE_CAR: 172, // Baseline comparison
};

export interface EcoWorkspaceBadge {
  id: string;
  name: string;
  category: "ENERGY" | "WASTE" | "COMMUTE" | "WATER";
  description: string;
  verified: boolean;
}

export interface WorkspaceCommuteRecord {
  bookingId: string;
  venueName: string;
  date: string;
  distanceKm: number;
  commuteMode: CommuteMode;
  emissionsGramsCo2: number;
  avoidedGramsCo2: number; // emissions saved vs gasoline car baseline
  isGreenCertifiedVenue: boolean;
}

export interface CarbonFootprintSummary {
  periodMonth: string;
  totalDistanceKm: number;
  totalEmissionsKgCo2: number;
  totalAvoidedKgCo2: number;
  treesEquivalentOffset: number;
  greenVenuesVisitedCount: number;
  modeBreakdown: Array<{
    mode: CommuteMode;
    label: string;
    distanceKm: number;
    emissionsKgCo2: number;
    percentage: number;
  }>;
  ecoBadgesEarned: EcoWorkspaceBadge[];
  records: WorkspaceCommuteRecord[];
}

/**
 * Calculates emissions and avoided emissions for a commute trip.
 */
export function calculateCommuteEmissions(
  distanceKm: number,
  mode: CommuteMode
): { emissionsGrams: number; avoidedGrams: number } {
  const actualFactor = EMISSION_FACTORS_G_PER_KM[mode] ?? 35;
  const baselineFactor = EMISSION_FACTORS_G_PER_KM.GASOLINE_CAR;

  const emissionsGrams = Math.round(distanceKm * actualFactor);
  const baselineGrams = Math.round(distanceKm * baselineFactor);
  const avoidedGrams = Math.max(0, baselineGrams - emissionsGrams);

  return { emissionsGrams, avoidedGrams };
}

/**
 * Aggregates monthly carbon footprint and corporate ESG Scope 3 metrics.
 */
export function generateMonthlyCarbonSummary(
  records: Array<{
    bookingId: string;
    venueName: string;
    date: string;
    distanceKm: number;
    commuteMode: CommuteMode;
    isGreenCertifiedVenue?: boolean;
  }>,
  periodMonth = "October 2026"
): CarbonFootprintSummary {
  let totalDistanceKm = 0;
  let totalEmissionsGrams = 0;
  let totalAvoidedGrams = 0;
  let greenVenuesCount = 0;

  const modeDistanceMap: Record<CommuteMode, number> = {
    WALKING: 0,
    BICYCLING: 0,
    ELECTRIC_SCOOTER: 0,
    PUBLIC_TRANSIT: 0,
    ELECTRIC_VEHICLE: 0,
    GASOLINE_CAR: 0,
  };

  const processedRecords: WorkspaceCommuteRecord[] = records.map((r) => {
    const { emissionsGrams, avoidedGrams } = calculateCommuteEmissions(r.distanceKm, r.commuteMode);

    totalDistanceKm += r.distanceKm;
    totalEmissionsGrams += emissionsGrams;
    totalAvoidedGrams += avoidedGrams;
    modeDistanceMap[r.commuteMode] += r.distanceKm;

    if (r.isGreenCertifiedVenue) greenVenuesCount++;

    return {
      bookingId: r.bookingId,
      venueName: r.venueName,
      date: r.date,
      distanceKm: r.distanceKm,
      commuteMode: r.commuteMode,
      emissionsGramsCo2: emissionsGrams,
      avoidedGramsCo2: avoidedGrams,
      isGreenCertifiedVenue: r.isGreenCertifiedVenue ?? false,
    };
  });

  const totalDistance = totalDistanceKm || 1;
  const modeBreakdown = Object.entries(modeDistanceMap).map(([mode, dist]) => {
    const factor = EMISSION_FACTORS_G_PER_KM[mode as CommuteMode];
    return {
      mode: mode as CommuteMode,
      label: mode.replace("_", " "),
      distanceKm: Number(dist.toFixed(1)),
      emissionsKgCo2: Number(((dist * factor) / 1000).toFixed(2)),
      percentage: Math.round((dist / totalDistance) * 100),
    };
  });

  // 1 mature urban tree absorbs ~21.7 kg CO2 per year (~1.8 kg/month)
  const treesEquivalentOffset = Number(((totalAvoidedGrams / 1000) / 1.8).toFixed(1));

  const ecoBadges: EcoWorkspaceBadge[] = [
    {
      id: "b-zero-emissions",
      name: "Zero-Emission Commuter",
      category: "COMMUTE",
      description: "Over 70% of monthly workspace commutes completed via Walking or Cycling.",
      verified: modeDistanceMap.WALKING + modeDistanceMap.BICYCLING >= totalDistance * 0.7,
    },
    {
      id: "b-solar-patron",
      name: "Solar Workspace Patron",
      category: "ENERGY",
      description: "Checked into 100% solar and green-grid powered coworking spaces.",
      verified: greenVenuesCount >= 3,
    },
    {
      id: "b-climate-positive",
      name: "Climate Positive Nomad",
      category: "WASTE",
      description: "Avoided over 25 kg of CO2 emissions compared to driving.",
      verified: totalAvoidedGrams >= 25000,
    },
  ];

  return {
    periodMonth,
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    totalEmissionsKgCo2: Number((totalEmissionsGrams / 1000).toFixed(2)),
    totalAvoidedKgCo2: Number((totalAvoidedGrams / 1000).toFixed(2)),
    treesEquivalentOffset,
    greenVenuesVisitedCount: greenVenuesCount,
    modeBreakdown,
    ecoBadgesEarned: ecoBadges,
    records: processedRecords,
  };
}

/**
 * Exports corporate Scope 3 ESG Audit report as CSV.
 */
export function exportCorporateESGReportCSV(summary: CarbonFootprintSummary): string {
  const headers = [
    "Booking ID",
    "Workspace Venue",
    "Date",
    "Commute Distance (km)",
    "Transit Mode",
    "Trip Emissions (g CO2)",
    "Avoided Emissions vs Driving (g CO2)",
    "Green Certified Space",
  ];

  const rows = summary.records.map((r) => [
    r.bookingId,
    `"${r.venueName}"`,
    r.date,
    r.distanceKm.toFixed(1),
    r.commuteMode,
    r.emissionsGramsCo2,
    r.avoidedGramsCo2,
    r.isGreenCertifiedVenue ? "YES" : "NO",
  ]);

  const footer = [
    "",
    `"Total Distance Traveled (km)","${summary.totalDistanceKm}"`,
    `"Total Net Emissions (kg CO2)","${summary.totalEmissionsKgCo2}"`,
    `"Total CO2 Avoided vs Solo Driving (kg CO2)","${summary.totalAvoidedKgCo2}"`,
    `"Equivalent Trees Planted Offset","${summary.treesEquivalentOffset} Trees"`,
  ];

  return [headers.join(","), ...rows.map((r) => r.join(",")), ...footer].join("\n");
}
