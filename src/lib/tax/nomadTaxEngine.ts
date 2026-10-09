/**
 * nomadTaxEngine.ts
 * Implements rolling-window visa stay calculations (Schengen 90/180, UK 180, Tax 183-Day rules)
 * and aggregates deductible coworking/workspace expenses across jurisdictions.
 */

export interface NomadCheckInRecord {
  id: string;
  venueId: string;
  venueName: string;
  city: string;
  country: string;
  countryCode: string; // ISO 2-letter e.g. "ES", "PT", "DE", "JP", "GB", "US"
  isSchengen: boolean;
  date: string; // "YYYY-MM-DD"
  amountSpent: number;
  currency: string;
  vatRatePct: number;
}

export interface VisaZoneLimit {
  zoneName: string;
  maxDays: number;
  windowDays: number;
  daysUsed: number;
  daysRemaining: number;
  status: "SAFE" | "WARNING" | "CRITICAL_LIMIT";
  taxResidencyRisk: boolean;
}

export interface NomadComplianceReport {
  taxYear: number;
  schengenStay: VisaZoneLimit;
  countryBreakdown: Array<{
    country: string;
    countryCode: string;
    daysSpent: number;
    daysRemaining183Rule: number;
    taxResidencyRisk: boolean;
    totalSpent: number;
    vatReclaimable: number;
    currency: string;
  }>;
  totalWorkspaceExpense: number;
  totalVatReclaimable: number;
  currency: string;
  generatedAt: string;
}

const SCHENGEN_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "CH"
]);

/**
 * Calculates rolling Schengen days used in the last 180 days from referenceDate.
 */
export function calculateSchengenStay(
  records: NomadCheckInRecord[],
  referenceDate = new Date()
): VisaZoneLimit {
  const windowDays = 180;
  const maxDays = 90;

  const windowStart = new Date(referenceDate);
  windowStart.setDate(windowStart.getDate() - windowDays);

  const uniqueSchengenDates = new Set<string>();

  records.forEach((r) => {
    if (r.isSchengen || SCHENGEN_COUNTRIES.has(r.countryCode.toUpperCase())) {
      const recordDate = new Date(r.date);
      if (recordDate >= windowStart && recordDate <= referenceDate) {
        uniqueSchengenDates.add(r.date);
      }
    }
  });

  const daysUsed = uniqueSchengenDates.size;
  const daysRemaining = Math.max(0, maxDays - daysUsed);

  let status: VisaZoneLimit["status"] = "SAFE";
  if (daysRemaining <= 14) status = "CRITICAL_LIMIT";
  else if (daysRemaining <= 30) status = "WARNING";

  return {
    zoneName: "Schengen Area (90/180 Rule)",
    maxDays,
    windowDays,
    daysUsed,
    daysRemaining,
    status,
    taxResidencyRisk: daysUsed >= 85,
  };
}

/**
 * Computes full country breakdown and tax residency risks.
 */
export function generateNomadComplianceReport(
  records: NomadCheckInRecord[],
  taxYear = new Date().getFullYear()
): NomadComplianceReport {
  const schengenStay = calculateSchengenStay(records);

  const countryMap = new Map<
    string,
    {
      country: string;
      countryCode: string;
      dates: Set<string>;
      totalSpent: number;
      vatReclaimable: number;
      currency: string;
    }
  >();

  let totalWorkspaceExpense = 0;
  let totalVatReclaimable = 0;

  records.forEach((r) => {
    const recordYear = new Date(r.date).getFullYear();
    if (recordYear === taxYear) {
      if (!countryMap.has(r.countryCode)) {
        countryMap.set(r.countryCode, {
          country: r.country,
          countryCode: r.countryCode,
          dates: new Set(),
          totalSpent: 0,
          vatReclaimable: 0,
          currency: r.currency || "USD",
        });
      }

      const c = countryMap.get(r.countryCode)!;
      c.dates.add(r.date);
      c.totalSpent += r.amountSpent;
      const vat = r.amountSpent * (r.vatRatePct / 100);
      c.vatReclaimable += vat;

      totalWorkspaceExpense += r.amountSpent;
      totalVatReclaimable += vat;
    }
  });

  const countryBreakdown = Array.from(countryMap.values()).map((c) => {
    const daysSpent = c.dates.size;
    const daysRemaining183Rule = Math.max(0, 183 - daysSpent);
    return {
      country: c.country,
      countryCode: c.countryCode,
      daysSpent,
      daysRemaining183Rule,
      taxResidencyRisk: daysSpent >= 150,
      totalSpent: Number(c.totalSpent.toFixed(2)),
      vatReclaimable: Number(c.vatReclaimable.toFixed(2)),
      currency: c.currency,
    };
  });

  countryBreakdown.sort((a, b) => b.daysSpent - a.daysSpent);

  return {
    taxYear,
    schengenStay,
    countryBreakdown,
    totalWorkspaceExpense: Number(totalWorkspaceExpense.toFixed(2)),
    totalVatReclaimable: Number(totalVatReclaimable.toFixed(2)),
    currency: "USD",
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Formats compliance report as tax-deductible CSV.
 */
export function exportComplianceReportCSV(report: NomadComplianceReport): string {
  const headers = [
    "Jurisdiction",
    "Country Code",
    "Days In-Country",
    "Days to 183-Tax Trigger",
    "Tax Risk Flag",
    "Total Workspace Expense (USD)",
    "Estimated VAT/GST Reclaim (USD)",
  ];

  const rows = report.countryBreakdown.map((c) => [
    `"${c.country}"`,
    c.countryCode,
    c.daysSpent,
    c.daysRemaining183Rule,
    c.taxResidencyRisk ? "HIGH_RISK" : "SAFE",
    c.totalSpent.toFixed(2),
    c.vatReclaimable.toFixed(2),
  ]);

  const summary = [
    "",
    `"Schengen 90/180 Status","${report.schengenStay.daysUsed} / 90 Days Used (${report.schengenStay.daysRemaining} Remaining)","Status: ${report.schengenStay.status}"`,
    `"Total Tax Deductible Workspace Expenses","USD ${report.totalWorkspaceExpense.toFixed(2)}"`,
    `"Total Reclaimable VAT/GST","USD ${report.totalVatReclaimable.toFixed(2)}"`,
  ];

  return [headers.join(","), ...rows.map((r) => r.join(",")), ...summary].join("\n");
}
