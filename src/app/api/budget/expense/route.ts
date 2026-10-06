import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { workspaceBudgetService } from "@/lib/billing/budgetService";

/**
 * POST /api/budget/expense
 * Records a new workspace booking expense allocated to a department or cost center.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const effectiveUserId = userId || "guest-user";

    const body = await request.json().catch(() => ({}));
    const { bookingId, venueName, category, department, costCenter, amount } = body;

    if (!venueName || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Valid venue name and positive expense amount are required." },
        { status: 400 },
      );
    }

    const expense = workspaceBudgetService.addExpense(effectiveUserId, {
      bookingId,
      venueName,
      category: category || "Workspace Booking",
      department: department || "General",
      costCenter,
      amount,
    });

    const summary = workspaceBudgetService.getBudgetSummary(effectiveUserId);

    return NextResponse.json({
      success: true,
      message: "Workspace expense allocated successfully.",
      expense,
      summary,
    });
  } catch (error) {
    console.error("[POST /api/budget/expense] Error:", error);
    return NextResponse.json(
      { error: "Failed to record workspace expense." },
      { status: 500 },
    );
  }
}
