import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import {
  getAdminSystemMetrics,
  parseSystemRange,
} from "@/lib/adminSystemMetrics";
import { generateSystemVitalsCSV } from "@/lib/export/domain/systemVitalsExporter";
import { generateDefaultWebVitalsData } from "@/lib/webVitalsCollector";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const range = parseSystemRange(searchParams.get("range"));

    const [metrics, webVitals] = await Promise.all([
      getAdminSystemMetrics(range),
      Promise.resolve(generateDefaultWebVitalsData(range)),
    ]);

    const exportData = {
      ...metrics,
      webVitals,
    };

    const csvContent = generateSystemVitalsCSV(exportData);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `worksphere-system-vitals-${range}-${today}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[Admin System CSV Export API]", error);
    return NextResponse.json(
      { error: "Failed to export system vital metrics" },
      { status: 500 },
    );
  }
}
