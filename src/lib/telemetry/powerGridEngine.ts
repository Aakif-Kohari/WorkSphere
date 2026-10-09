/**
 * powerGridEngine.ts
 * Core telemetry engine for workspace power grid health, socket voltage/wattage delivery,
 * and crowdsourced dead-plug reliability scoring.
 */

export type PowerSocketType =
  | "USB_C_140W_PD"
  | "USB_C_100W_PD"
  | "USB_C_65W"
  | "AC_UNIVERSAL_WALL"
  | "WIRELESS_MAGSAFE";

export type OutletHealthStatus =
  | "OPERATIONAL_OPTIMAL"
  | "THROTTLED_LOW_WATTAGE"
  | "DEAD_NO_POWER"
  | "LOOSE_PHYSICAL_FAULT";

export interface DeskPowerNode {
  seatId: string;
  seatNumber: string;
  socketType: PowerSocketType;
  maxWattageW: number;
  measuredVoltageV: number;
  status: OutletHealthStatus;
  reliabilityScorePct: number; // 0 to 100
  lastVerifiedAt: string;
  reportedIssueCount: number;
  outletLocation: "UNDER_DESK" | "DESK_GROMMET" | "WALL_MOUNTED" | "FLOOR_BOX";
}

export interface VenuePowerGridSummary {
  venueId: string;
  venueName: string;
  overallGridHealthScore: number; // 0 to 100
  totalSocketsCount: number;
  workingSocketsCount: number;
  fastChargingCoveragePct: number; // % of desks with >= 65W PD
  nominalVoltageV: number; // 120V (US) or 230V (EU/UK)
  nodes: DeskPowerNode[];
  lastGridSweepAt: string;
}

/**
 * Computes overall power grid health score and fast charging coverage percentage.
 */
export function computeVenuePowerGridSummary(
  venueId: string,
  venueName: string,
  nodes: DeskPowerNode[],
  nominalVoltage = 120
): VenuePowerGridSummary {
  const total = nodes.length || 1;
  const working = nodes.filter((n) => n.status === "OPERATIONAL_OPTIMAL").length;
  const fastChargingCount = nodes.filter(
    (n) => n.status === "OPERATIONAL_OPTIMAL" && n.maxWattageW >= 65
  ).length;

  const reliabilitySum = nodes.reduce((sum, n) => sum + n.reliabilityScorePct, 0);
  const overallGridHealthScore = Math.round(reliabilitySum / total);
  const fastChargingCoveragePct = Math.round((fastChargingCount / total) * 100);

  return {
    venueId,
    venueName,
    overallGridHealthScore,
    totalSocketsCount: nodes.length,
    workingSocketsCount: working,
    fastChargingCoveragePct,
    nominalVoltageV: nominalVoltage,
    nodes,
    lastGridSweepAt: new Date().toISOString(),
  };
}
