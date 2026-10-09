/**
 * AccessibleRouter.ts
 * Modifies standard OSRM graph weights to heavily penalize non-accessible routes based on elevation and OSM tags.
 */

import { ElevationMatrix, ElevationProfile } from './ElevationMatrix';
import { OSMAccessibilityParser, AccessibilityFeatures } from './OSMAccessibilityParser';

export interface RouteSegment {
    distance: number;
    duration: number;
    elevationGain: number;
    osmTags: Record<string, string>;
}

export interface AccessibilityWeightedRoute {
    totalDistance: number;
    totalDuration: number;
    accessibilityScore: number;
    penaltyMultiplier: number;
    isRecommended: boolean;
    segments: RouteSegment[];
}

export class AccessibleRouter {
    private static readonly MAX_SAFE_PENALTY_MULTIPLIER = 20.0;
    private static readonly WHEELCHAIR_MAX_GRADE_THRESHOLD = 8.33; // ADA standard max slope percentage (1:12)
    private elevationMatrix: ElevationMatrix;
    private osmParser: OSMAccessibilityParser;

    constructor() {
        this.elevationMatrix = new ElevationMatrix();
        this.osmParser = new OSMAccessibilityParser();
    }

    /**
     * Evaluates a route and applies accessibility penalties to its duration/weight.
     * Guards against steep wheelchair grade multiplier overflow.
     * @param segments Route segments from OSRM.
     * @param wheelchairMode If true, strictly penalizes non-compliant segments.
     */
    public evaluateRoute(segments: RouteSegment[], wheelchairMode: boolean = true): AccessibilityWeightedRoute {
        if (!Array.isArray(segments) || segments.length === 0) {
            return {
                totalDistance: 0,
                totalDuration: 0,
                accessibilityScore: 100,
                penaltyMultiplier: 1.0,
                isRecommended: true,
                segments: []
            };
        }

        let totalDistance = 0;
        let totalDuration = 0;
        let totalElevationGain = 0;
        let totalPenaltyMultiplier = 1.0;
        let minSegmentScore = 100;

        const evaluatedSegments: RouteSegment[] = [];

        for (const segment of segments) {
            const segDist = Number.isFinite(segment.distance) ? Math.max(0, segment.distance) : 0;
            const segDur = Number.isFinite(segment.duration) ? Math.max(0, segment.duration) : 0;
            const segElev = Number.isFinite(segment.elevationGain) ? segment.elevationGain : 0;

            totalDistance += segDist;
            totalDuration += segDur;
            totalElevationGain += Math.abs(segElev);

            const features = this.osmParser.parseFeatures(segment.osmTags || {});
            const segmentScore = this.osmParser.calculateScore(features);

            if (segmentScore < minSegmentScore) {
                minSegmentScore = segmentScore;
            }

            // Calculate penalty based on features and elevation
            let segmentMultiplier = 1.0;

            if (wheelchairMode) {
                if (!features.isWheelchairAccessible && !features.hasRamp) {
                    segmentMultiplier += 2.0; // Heavy penalty for missing ramps/accessibility
                }

                // Simulate elevation check (in real impl, this uses DEM data per segment)
                const simulatedGrade = this.elevationMatrix.calculateGrade(segElev, segDist);
                if (simulatedGrade > AccessibleRouter.WHEELCHAIR_MAX_GRADE_THRESHOLD) {
                    // Progressive penalty for steepness, capped to prevent numerical overflow
                    const excessGrade = simulatedGrade - AccessibleRouter.WHEELCHAIR_MAX_GRADE_THRESHOLD;
                    const gradePenalty = Math.min(15.0, excessGrade / 5.0);
                    segmentMultiplier += gradePenalty;
                }
            }

            // Safely clamp individual segment multiplier
            segmentMultiplier = Math.min(segmentMultiplier, AccessibleRouter.MAX_SAFE_PENALTY_MULTIPLIER);
            totalPenaltyMultiplier = Math.max(totalPenaltyMultiplier, segmentMultiplier);
            evaluatedSegments.push(segment);
        }

        // Clamp total penalty multiplier to prevent numerical overflow in downstream Dijkstra weights
        totalPenaltyMultiplier = Math.min(
            Number.isFinite(totalPenaltyMultiplier) ? totalPenaltyMultiplier : 1.0,
            AccessibleRouter.MAX_SAFE_PENALTY_MULTIPLIER
        );

        const adjustedDuration = Math.round(totalDuration * totalPenaltyMultiplier);
        const isRecommended = minSegmentScore >= 60 && totalPenaltyMultiplier < 1.5;

        return {
            totalDistance,
            totalDuration: Number.isFinite(adjustedDuration) ? adjustedDuration : totalDuration,
            accessibilityScore: minSegmentScore,
            penaltyMultiplier: totalPenaltyMultiplier,
            isRecommended,
            segments: evaluatedSegments
        };
    }
}

