import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import {
  generateDefaultWebVitalsData,
} from "@/lib/webVitalsCollector";
import { generateWebVitalsCSV } from "@/lib/export/domain/systemVitalsExporter";

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
    const range = searchParams.get("range") || "7d";

    const webVitals = generateDefaultWebVitalsData(range);
    const csvContent = generateWebVitalsCSV(webVitals);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `worksphere-web-vitals-${range}-${today}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[Admin Web Vitals CSV Export API]", error);
    return NextResponse.json(
      { error: "Failed to export web vitals CSV" },
      { status: 500 },
    );
  }
}
