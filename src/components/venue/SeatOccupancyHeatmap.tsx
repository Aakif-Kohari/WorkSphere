"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";

export interface HeatmapSelection {
  date: string;
  time: string;
}

interface HeatmapCell {
  date: string;
  hour: number;
  occupancy: number;
}

interface ForecastHeatmapResponse {
  success: boolean;
  data: HeatmapCell[];
  error?: string;
}

interface SeatOccupancyHeatmapProps {
  venueId: string;
  onSelectSlot?: (selection: HeatmapSelection) => void;
  selectedDate?: string;
  selectedTime?: string;
}

const HOURS = Array.from({ length: 24 }, (_, index) => index);

function getStartDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function getDateLabel(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
  }).format(date);
}

function getCellClass(occupancy: number) {
  if (occupancy > 75) {
    return "bg-red-500/80 hover:bg-red-500";
  }

  if (occupancy >= 40) {
    return "bg-yellow-400/80 hover:bg-yellow-400";
  }

  return "bg-green-500/80 hover:bg-green-500";
}

function getCellLabel(occupancy: number) {
  if (occupancy > 75) return "High occupancy";
  if (occupancy >= 40) return "Medium occupancy";
  return "Low occupancy";
}

export function SeatOccupancyHeatmap({
  venueId,
  onSelectSlot,
  selectedDate,
  selectedTime,
}: SeatOccupancyHeatmapProps) {
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDate = useMemo(() => getStartDate(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadHeatmap() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          venueId,
          startDate,
        });

        const response = await fetch(
          `/api/map/forecast-heatmap?${params.toString()}`,
          { cache: "no-store" },
        );

        const payload =
          (await response.json()) as ForecastHeatmapResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ?? "Unable to load occupancy heatmap",
          );
        }

        if (!cancelled) {
          setCells(payload.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load occupancy heatmap",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHeatmap();

    return () => {
      cancelled = true;
    };
  }, [venueId, startDate]);

  const dates = useMemo(
    () => Array.from(new Set(cells.map((cell) => cell.date))),
    [cells],
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const cell of cells) {
      map.set(`${cell.date}-${cell.hour}`, cell.occupancy);
    }

    return map;
  }, [cells]);

  if (loading) {
    return (
      <section
        data-testid="seat-occupancy-heatmap"
        className="rounded-2xl border border-white/10 bg-black/20 p-5"
      >
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        data-testid="seat-occupancy-heatmap"
        className="rounded-2xl border border-white/10 bg-black/20 p-5"
      >
        <p className="text-sm text-zinc-500">{error}</p>
      </section>
    );
  }

  return (
    <section
      data-testid="seat-occupancy-heatmap"
      className="rounded-2xl border border-white/10 bg-black/20 p-5"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-violet-300" />
            <h3 className="font-semibold text-white">
              Seat occupancy forecast
            </h3>
          </div>

          <p className="mt-1 text-xs text-zinc-500">
            Select a time slot to pre-fill your reservation.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-green-500" />
            &lt;40%
          </span>

          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-yellow-400" />
            40–75%
          </span>

          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
            &gt;75%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `72px repeat(${dates.length}, minmax(0, 1fr))`,
            }}
          >
            <div />

            {dates.map((date) => (
              <div
                key={date}
                className="pb-2 text-center text-[11px] font-medium text-zinc-400"
              >
                {getDateLabel(date)}
              </div>
            ))}

            {HOURS.map((hour) => (
              <div key={`row-${hour}`} className="contents">
                <div className="flex items-center justify-end pr-2 text-[10px] text-zinc-600">
                  {hour.toString().padStart(2, "0")}:00
                </div>

                {dates.map((date) => {
                  const occupancy =
                    cellMap.get(`${date}-${hour}`) ?? 0;

                  const slotTime = `${hour
                    .toString()
                    .padStart(2, "0")}:00`;

                  const isSelected =
                    selectedDate === date &&
                    selectedTime === slotTime;

                  return (
                    <button
                      key={`${date}-${hour}`}
                      type="button"
                      data-testid={`heatmap-cell-${date}-${hour}`}
                      aria-label={`${date} ${slotTime}, ${Math.round(
                        occupancy,
                      )}% occupancy, ${getCellLabel(occupancy)}`}
                      title={`${Math.round(occupancy)}% occupancy`}
                      onClick={() =>
                        onSelectSlot?.({
                          date,
                          time: slotTime,
                        })
                      }
                      className={`h-7 min-w-0 rounded-sm transition ${getCellClass(
                        occupancy,
                      )} ${
                        isSelected
                          ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-950"
                          : ""
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
