import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchUserMemories } from "@/lib/memory";

export const dynamic = "force-dynamic";

/**
 * POST /api/memory/search
 * Semantically searches user memories using pgvector cosine distance and HNSW graph indexing.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { query, limit = 5, threshold = 0.4 } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query string is required" },
        { status: 400 }
      );
    }

    const memories = await searchUserMemories(userId, query, {
      limit: Number(limit),
      similarityThreshold: Number(threshold),
    });

    return NextResponse.json({
      success: true,
      query,
      count: memories.length,
      memories,
    });
  } catch (error: unknown) {
    console.error("[Memory Search Error]:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Failed to search memories",
      },
      { status: 500 }
    );
  }
}
