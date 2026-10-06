import { Redis } from "@upstash/redis";
import type { PerfSample, PerformanceSummary, FpsTelemetryData } from "../types";

const MAX_SAMPLES = 500;
const SLOW_THRESHOLD_MS = 800;

// ─── In-memory fallback ────────────────────────────────────────────────────────
const memSamples: PerfSample[] = [];
const memRegions = new Map<string, number>();

// ─── Redis setup ───────────────────────────────────────────────────────────────
let cachedRedis: Redis | null = null;

function getRedis(): Redis | null {
  if (cachedRedis) return cachedRedis;

  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }

  try {
    cachedRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
      retry: false,
    });
  } catch {
    // Redis unavailable — fall back to in-memory
  }

  return cachedRedis;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms`)),
      ms,
    );
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

// ─── Public: record a single request ──────────────────────────────────────────

export function recordApiLatency(
  route: string,
  durationMs: number,
  region = "unknown",
): void {
  const sample: PerfSample = {
    route,
    durationMs: isNaN(durationMs) || !isFinite(durationMs) || durationMs < 0 ? 0 : durationMs,
    region,
    timestamp: Date.now(),
  };

  // In-memory write (always, best-effort)
  memSamples.push(sample);
  if (memSamples.length > MAX_SAMPLES) memSamples.shift();
  memRegions.set(region, (memRegions.get(region) ?? 0) + 1);

  // Async Redis write (fire-and-forget)
  const redis = getRedis();
  if (!redis) return;

  const serialized = JSON.stringify(sample);
  const pipeline = redis.pipeline();
  pipeline.lpush("worksphere:perf:samples", serialized);
  pipeline.ltrim("worksphere:perf:samples", 0, MAX_SAMPLES - 1);
  pipeline.sadd("worksphere:perf:routes", route);
  pipeline.lpush(`worksphere:perf:route:${route}`, serialized);
  pipeline.ltrim(`worksphere:perf:route:${route}`, 0, 99);
  pipeline.hincrby("worksphere:perf:regions", region, 1);

  withTimeout(pipeline.exec(), 2000).catch((err) => {
    console.error("[performanceTelemetry] Redis write failed:", err);
  });
}

// ─── Frame Render Time & Metric Guards (#4382) ─────────────────────────────

export interface FrameRenderMetrics {
  totalFrames: number;
  totalDurationMs: number;
  avgFrameTimeMs: number;
  fps: number;
  minFrameTimeMs: number;
  maxFrameTimeMs: number;
  p95FrameTimeMs: number;
}

/**
 * Validates telemetry metrics payload before dispatching to endpoint (#4382).
 * Sanitizes any potential NaN, Infinity, or negative values to 0.
 */
export function validateTelemetryMetricsPayload<T extends Record<string, any>>(
  payload: T,
): T {
  if (!payload || typeof payload !== "object") return payload;

  const sanitized = { ...payload } as any;

  for (const key of Object.keys(sanitized)) {
    const val = sanitized[key];
    if (typeof val === "number") {
      if (isNaN(val) || !isFinite(val) || val < 0) {
        sanitized[key] = 0;
      }
    }
  }

  return sanitized;
}

/**
 * Computes average frame render time safely, guarding against zero frame counts,
 * empty sample buffers, and 0ms total duration (#4382).
 */
export function calculateAverageFrameTime(
  frameDurationsMs: number[] = [],
  totalDurationMs = 0,
): number {
  if (!frameDurationsMs || frameDurationsMs.length === 0) {
    return 0;
  }

  const valid = frameDurationsMs.filter(
    (d) => typeof d === "number" && !isNaN(d) && isFinite(d) && d >= 0,
  );

  if (valid.length === 0) {
    return 0;
  }

  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  const totalTime = sum > 0 ? sum : totalDurationMs;

  if (totalTime <= 0 || valid.length === 0) {
    return 0;
  }

  const avg = sum / valid.length;
  return isNaN(avg) || !isFinite(avg) ? 0 : Math.round(avg * 100) / 100;
}

/**
 * Calculates complete frame render metrics payload with zero-frame guards and metric payload validation.
 */
export function calculateFrameMetrics(
  frameDurationsMs: number[] = [],
  totalDurationMs = 0,
): FrameRenderMetrics {
  if (!frameDurationsMs || frameDurationsMs.length === 0) {
    return {
      totalFrames: 0,
      totalDurationMs: 0,
      avgFrameTimeMs: 0,
      fps: 0,
      minFrameTimeMs: 0,
      maxFrameTimeMs: 0,
      p95FrameTimeMs: 0,
    };
  }

  const valid = frameDurationsMs.filter(
    (d) => typeof d === "number" && !isNaN(d) && isFinite(d) && d >= 0,
  );

  if (valid.length === 0) {
    return {
      totalFrames: 0,
      totalDurationMs: 0,
      avgFrameTimeMs: 0,
      fps: 0,
      minFrameTimeMs: 0,
      maxFrameTimeMs: 0,
      p95FrameTimeMs: 0,
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const duration = totalDurationMs > 0 ? totalDurationMs : sum;

  const avgFrameTimeMs = calculateAverageFrameTime(valid, duration);
  const fps =
    duration > 0 && valid.length > 0
      ? Math.round((valid.length / (duration / 1000)) * 10) / 10
      : 0;

  return validateTelemetryMetricsPayload({
    totalFrames: valid.length,
    totalDurationMs: Math.max(0, duration),
    avgFrameTimeMs,
    fps: isNaN(fps) || !isFinite(fps) ? 0 : fps,
    minFrameTimeMs: sorted[0] || 0,
    maxFrameTimeMs: sorted[sorted.length - 1] || 0,
    p95FrameTimeMs: Math.round(percentile(sorted, 95)),
  });
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx];
}

function average(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const valid = values.filter(
    (v) => typeof v === "number" && !isNaN(v) && isFinite(v),
  );
  if (valid.length === 0) return 0;
  const sum = valid.reduce((a, b) => a + b, 0);
  const avg = sum / valid.length;
  return isNaN(avg) || !isFinite(avg) ? 0 : Math.round(avg);
}

function buildHourlyTrend(
  samples: PerfSample[],
  hours = 24,
): Array<{ hour: string; avgMs: number; p95Ms: number; requestCount: number }> {
  const now = Date.now();
  const buckets = new Map<string, number[]>();

  for (let h = hours - 1; h >= 0; h--) {
    const label = new Date(now - h * 3_600_000).toISOString().slice(0, 13);
    buckets.set(label, []);
  }

  for (const s of samples) {
    const label = new Date(s.timestamp).toISOString().slice(0, 13);
    if (buckets.has(label)) {
      buckets.get(label)!.push(s.durationMs);
    }
  }

  return [...buckets.entries()].map(([hour, durations]) => {
    const sorted = [...durations].sort((a, b) => a - b);
    return {
      hour,
      avgMs: average(sorted),
      p95Ms: Math.round(percentile(sorted, 95)),
      requestCount: sorted.length,
    };
  });
}

function buildSummaryFromSamples(samples: PerfSample[]): PerformanceSummary {
  const byTimeDesc = [...samples].sort((a, b) => b.timestamp - a.timestamp);
  const allDurations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const slowCount = allDurations.filter((d) => d >= SLOW_THRESHOLD_MS).length;

  // Region aggregation
  const regionMap = new Map<string, { total: number; count: number }>();
  for (const s of samples) {
    const r = regionMap.get(s.region) ?? { total: 0, count: 0 };
    r.total += s.durationMs;
    r.count += 1;
    regionMap.set(s.region, r);
  }
  const regionBreakdown = [...regionMap.entries()]
    .map(([region, { total, count }]) => ({
      region,
      count,
      avgMs: count > 0 ? Math.round(total / count) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Route aggregation
  const routeMap = new Map<string, number[]>();
  for (const s of samples) {
    const bucket = routeMap.get(s.route) ?? [];
    bucket.push(s.durationMs);
    routeMap.set(s.route, bucket);
  }
  const routeBreakdown = [...routeMap.entries()]
    .map(([route, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      return {
        route,
        avgMs: average(sorted),
        p95Ms: Math.round(percentile(sorted, 95)),
        requestCount: sorted.length,
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms);

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalRequests: samples.length,
      slowRequests: slowCount,
      avgMs: average(allDurations),
      p95Ms: Math.round(percentile(allDurations, 95)),
      slowThresholdMs: SLOW_THRESHOLD_MS,
    },
    latencyTrend: buildHourlyTrend(samples),
    recentSamples: byTimeDesc.slice(0, 50),
    regionBreakdown,
    routeBreakdown,
  };
}

export async function getPerformanceSummary(): Promise<PerformanceSummary> {
  const redis = getRedis();

  if (redis) {
    try {
      const raw = (await withTimeout(
        redis.lrange("worksphere:perf:samples", 0, MAX_SAMPLES - 1),
        2000,
      )) as string[];

      if (raw && raw.length > 0) {
        const samples: PerfSample[] = raw
          .map((s) => {
            try {
              return typeof s === "string" ? (JSON.parse(s) as PerfSample) : s;
            } catch {
              return null;
            }
          })
          .filter((s): s is PerfSample => s !== null);

        return buildSummaryFromSamples(samples);
      }
    } catch (err) {
      console.error(
        "[performanceTelemetry] Redis read failed, falling back to in-memory:",
        err,
      );
    }
  }

  // Fallback: use in-memory samples
  if (memSamples.length === 0) {
    const now = Date.now();
    const seedRoutes = [
      { route: "/api/venues", durationMs: 142, region: "local" },
      { route: "/api/chat", durationMs: 285, region: "local" },
      { route: "/api/admin/system", durationMs: 95, region: "local" },
      { route: "/admin/performance", durationMs: 48, region: "local" },
      { route: "prisma:Venue", durationMs: 18, region: "local" },
      { route: "prisma:Booking", durationMs: 32, region: "local" },
    ];
    for (const r of seedRoutes) {
      memSamples.push({
        ...r,
        timestamp: now - Math.floor(Math.random() * 3600000),
      });
    }
  }

  return buildSummaryFromSamples([...memSamples]);
}

export function logFpsTelemetry(data: FpsTelemetryData) {
  const validated = validateTelemetryMetricsPayload(data);

  if (process.env.NODE_ENV === "development") {
    console.debug(
      `[Telemetry] FPS: ${validated.fps.toFixed(1)} | Frame Time: ${validated.frameTimeMs.toFixed(2)}ms | Steps: ${validated.raymarchSteps}`,
    );
  }

  if (typeof window !== "undefined" && (window as any).WorkSphereTelemetry) {
    (window as any).WorkSphereTelemetry.track(
      "cloud_renderer_performance",
      validated,
    );
  }
}
