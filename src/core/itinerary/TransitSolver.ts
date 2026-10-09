/**
 * TransitSolver.ts
 * Solves the Time-Window Constrained Traveling Salesperson Problem (TSPTW)
 * for multi-venue itinerary optimization using Branch-and-Bound traversal.
 */

import { ItineraryGraph, VenueNode, TransitEdge } from './ItineraryGraph';
import { TimeWindowConstraint } from './TimeWindowConstraint';

export interface ItinerarySolution {
  sequence: string[]; // Ordered list of venue IDs
  totalDurationMinutes: number; // Transit + Dwell + Wait times
  totalTransitTimeMinutes: number;
  totalDwellTimeMinutes: number;
  totalWaitTimeMinutes: number;
  startTime: Date;
  endTime: Date;
  schedule: Array<{
    venueId: string;
    venueName: string;
    arrivalTime: Date;
    departureTime: Date;
    waitTimeMinutes: number;
  }>;
}

export interface TransitSolverOptions {
  maxDepth?: number;
  maxExecutionTimeMs?: number;
  pruneTimeWindowViolations?: boolean;
}

export class TransitSolver {
  private graph: ItineraryGraph;
  private timeConstraint: TimeWindowConstraint;

  constructor(graph: ItineraryGraph, timeConstraint: TimeWindowConstraint) {
    this.graph = graph;
    this.timeConstraint = timeConstraint;
  }

  /**
   * Solves the TSPTW to find the optimal visitation order minimizing total trip duration.
   */
  public solve(
    startVenueId: string,
    targetVenueIds: string[],
    startTime: Date,
    options: TransitSolverOptions = {}
  ): ItinerarySolution | null {
    const maxExecutionTimeMs = options.maxExecutionTimeMs ?? 5000;
    const startTimestamp = Date.now();

    const startNode = this.graph.getNode(startVenueId);
    if (!startNode) {
      throw new Error(`Start venue node '${startVenueId}' not found in graph.`);
    }

    const unvisited = new Set(targetVenueIds.filter((id) => id !== startVenueId));
    let bestSolution: ItinerarySolution | null = null;
    let bestCost = Infinity;

    // Search state for Branch-and-Bound recursion
    const initialScheduleItem = {
      venueId: startVenueId,
      venueName: startNode.name,
      arrivalTime: startTime,
      departureTime: new Date(
        startTime.getTime() + startNode.averageDwellTimeMinutes * 60000
      ),
      waitTimeMinutes: 0,
    };

    const search = (
      currentVenueId: string,
      currentTime: Date,
      visited: string[],
      currentSchedule: typeof initialScheduleItem[],
      accumulatedTransitTime: number,
      accumulatedDwellTime: number,
      accumulatedWaitTime: number,
      remainingTargets: Set<string>
    ) => {
      // Check execution time safety limit
      if (Date.now() - startTimestamp > maxExecutionTimeMs) {
        return;
      }

      // Base case: All target venues visited
      if (remainingTargets.size === 0) {
        const totalDuration =
          accumulatedTransitTime + accumulatedDwellTime + accumulatedWaitTime;

        if (totalDuration < bestCost) {
          bestCost = totalDuration;
          bestSolution = {
            sequence: [...visited],
            totalDurationMinutes: totalDuration,
            totalTransitTimeMinutes: accumulatedTransitTime,
            totalDwellTimeMinutes: accumulatedDwellTime,
            totalWaitTimeMinutes: accumulatedWaitTime,
            startTime,
            endTime: currentTime,
            schedule: [...currentSchedule],
          };
        }
        return;
      }

      // Bounding & Pruning: Compute lower bound for remaining unvisited nodes
      const lowerBound =
        accumulatedTransitTime +
        accumulatedDwellTime +
        accumulatedWaitTime +
        this.computeLowerBound(currentVenueId, remainingTargets);

      if (lowerBound >= bestCost) {
        return; // PRUNE: Lower bound exceeds best solution cost found so far
      }

      // Branching: Sort unvisited candidates by heuristic (shortest transit time / time window urgency)
      const candidates = Array.from(remainingTargets).sort((a, b) => {
        const edgeA = this.graph.getEdge(currentVenueId, a);
        const edgeB = this.graph.getEdge(currentVenueId, b);
        const tA = edgeA ? edgeA.transitTimeMinutes : Infinity;
        const tB = edgeB ? edgeB.transitTimeMinutes : Infinity;
        return tA - tB;
      });

      for (const nextVenueId of candidates) {
        const edge = this.graph.getEdge(currentVenueId, nextVenueId);
        if (!edge) continue; // No direct edge exists

        const nextNode = this.graph.getNode(nextVenueId);
        if (!nextNode) continue;

        const transitTime = edge.transitTimeMinutes;
        const arrivalTimestamp = new Date(
          currentTime.getTime() + transitTime * 60000
        );

        // Time Window Validation & Wait Time Computation
        let effectiveArrival = arrivalTimestamp;
        let waitTime = 0;

        if (!this.timeConstraint.isVenueOpenAt(nextVenueId, arrivalTimestamp)) {
          // Attempt to find next opening window
          const nextOpen = this.timeConstraint.getNextOpeningTime(
            nextVenueId,
            arrivalTimestamp
          );

          if (!nextOpen) {
            continue; // PRUNE: Venue is closed and no future open window exists in horizon
          }

          waitTime = Math.round(
            (nextOpen.getTime() - arrivalTimestamp.getTime()) / 60000
          );
          effectiveArrival = nextOpen;
        }

        const departureTime = new Date(
          effectiveArrival.getTime() + nextNode.averageDwellTimeMinutes * 60000
        );

        const newRemaining = new Set(remainingTargets);
        newRemaining.delete(nextVenueId);

        search(
          nextVenueId,
          departureTime,
          [...visited, nextVenueId],
          [
            ...currentSchedule,
            {
              venueId: nextVenueId,
              venueName: nextNode.name,
              arrivalTime: effectiveArrival,
              departureTime,
              waitTimeMinutes: waitTime,
            },
          ],
          accumulatedTransitTime + transitTime,
          accumulatedDwellTime + nextNode.averageDwellTimeMinutes,
          accumulatedWaitTime + waitTime,
          newRemaining
        );
      }
    };

    search(
      startVenueId,
      initialScheduleItem.departureTime,
      [startVenueId],
      [initialScheduleItem],
      0,
      startNode.averageDwellTimeMinutes,
      0,
      unvisited
    );

    return bestSolution;
  }

  /**
   * Computes lower bound for remaining unvisited nodes using minimum outgoing edge weights.
   */
  private computeLowerBound(
    currentVenueId: string,
    unvisitedNodes: Set<string>
  ): number {
    let bound = 0;
    const nodes = [currentVenueId, ...Array.from(unvisitedNodes)];

    for (const fromId of nodes) {
      const fromNode = this.graph.getNode(fromId);
      if (fromNode) {
        bound += fromNode.averageDwellTimeMinutes;
      }

      let minTransit = Infinity;
      for (const toId of unvisitedNodes) {
        if (fromId === toId) continue;
        const edge = this.graph.getEdge(fromId, toId);
        if (edge && edge.transitTimeMinutes < minTransit) {
          minTransit = edge.transitTimeMinutes;
        }
      }
      if (minTransit !== Infinity) {
        bound += minTransit;
      }
    }

    return bound;
  }
}
 * TimeWindowConstraint.ts
 * Implements the time-window validation to prevent routing to closed venues.
 * Parses opening hours and validates if a proposed arrival time falls within operational bounds.
 */

import { VenueNode } from './ItineraryGraph';

export interface TimeWindow {
    startMinutes: number; // Minutes from midnight
    endMinutes: number;   // Minutes from midnight
    daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export class TimeWindowConstraint {
    private parsedWindows: Map<string, TimeWindow[]>;

    constructor() {
        this.parsedWindows = new Map();
    }

    public parseOpeningHours(venueId: string, hoursString: string): void {
        if (hoursString.trim().toUpperCase() === '24/7') {
            this.parsedWindows.set(venueId, [{
                startMinutes: 0,
                endMinutes: 1439,
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
            }]);
            return;
        }

        // Simplified parser for "Mo-Fr 08:00-18:00" format
        const windows: TimeWindow[] = [];
        const dayMap: Record<string, number[]> = {
            'Mo': [1], 'Tu': [2], 'We': [3], 'Th': [4], 'Fr': [5], 'Sa': [6], 'Su': [0],
            'Mo-Fr': [1, 2, 3, 4, 5], 'Sa-Su': [6, 0]
        };

        const segments = hoursString.split(',').map(s => s.trim());
        for (const segment of segments) {
            const match = segment.match(/^([A-Za-z\-]+)\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
            if (match) {
                const daysStr = match[1];
                const startH = parseInt(match[2], 10);
                const startM = parseInt(match[3], 10);
                const endH = parseInt(match[4], 10);
                const endM = parseInt(match[5], 10);

                const days = dayMap[daysStr] || [1, 2, 3, 4, 5, 6, 0];
                windows.push({
                    startMinutes: startH * 60 + startM,
                    endMinutes: endH * 60 + endM,
                    daysOfWeek: days
                });
            }
        }
        this.parsedWindows.set(venueId, windows);
    }

    public isVenueOpenAt(venueId: string, date: Date): boolean {
        const windows = this.parsedWindows.get(venueId);
        if (!windows || windows.length === 0) {
            return true; // Default to open if no constraints are defined
        }

        const dayOfWeek = date.getDay();
        const minutesFromMidnight = date.getHours() * 60 + date.getMinutes();

        for (const window of windows) {
            if (window.daysOfWeek.includes(dayOfWeek)) {
                if (minutesFromMidnight >= window.startMinutes && minutesFromMidnight <= window.endMinutes) {
                    return true;
                }
            }
        }
        return false;
    }

    public getNextOpeningTime(venueId: string, fromDate: Date): Date | null {
        const windows = this.parsedWindows.get(venueId);
        if (!windows || windows.length === 0) return null;

        let checkDate = new Date(fromDate);
        for (let i = 0; i < 14; i++) { // Check up to 2 weeks ahead
            const dayOfWeek = checkDate.getDay();
            const relevantWindow = windows.find(w => w.daysOfWeek.includes(dayOfWeek));

            if (relevantWindow) {
                const openTime = new Date(checkDate);
                openTime.setHours(Math.floor(relevantWindow.startMinutes / 60), relevantWindow.startMinutes % 60, 0, 0);
                if (openTime > fromDate) {
                    return openTime;
                }
            }
            checkDate.setDate(checkDate.getDate() + 1);
            checkDate.setHours(0, 0, 0, 0);
        }
        return null;
    }
}
