/**
 * MeetHalfwayOptimizer.ts
 * Implements Weiszfeld's algorithm for geometric median computation across multiple team coordinates.
 * Evaluates candidate venues by minimizing aggregate travel time and commute variance (fairness).
 */

export interface TeamMemberLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  transitMode?: 'transit' | 'driving' | 'bicycling' | 'walking';
}

export interface CandidateVenue {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  address?: string | null;
  rating?: number | null;
  wifiSpeed?: number | null;
  wifiQuality?: number | null;
  hasOutlets?: boolean;
  maxCapacity: number;
  currentOccupancy: number;
  availableSeatsCount?: number;
  imageUrl?: string | null;
}

export interface MemberTravelEstimate {
  memberId: string;
  memberName: string;
  distanceMeters: number;
  durationMinutes: number;
  transitMode: string;
}

export interface RankedVenueRecommendation {
  venue: CandidateVenue;
  centroidDistanceMeters: number;
  aggregateDurationMinutes: number;
  averageDurationMinutes: number;
  maxDurationMinutes: number;
  fairnessScore: number; // 0 to 100 (100 = perfectly equal commute times)
  compositeRankScore: number;
  memberEstimates: MemberTravelEstimate[];
  availableCapacity: number;
}

export interface OptimizationResult {
  centroid: {
    latitude: number;
    longitude: number;
  };
  recommendedVenues: RankedVenueRecommendation[];
  searchRadiusMeters: number;
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Great Circle distance between two lat/lng coordinates (Haversine formula).
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes average speed in meters per minute according to transit mode.
 */
function getSpeedMetersPerMinute(mode?: string): number {
  switch (mode) {
    case 'driving':
      return (35 * 1000) / 60; // 35 km/h urban driving with traffic
    case 'bicycling':
      return (16 * 1000) / 60; // 16 km/h cycling
    case 'walking':
      return (4.8 * 1000) / 60; // 4.8 km/h walking
    case 'transit':
    default:
      return (25 * 1000) / 60; // 25 km/h average public transit (including wait/transfer buffer)
  }
}

export class MeetHalfwayOptimizer {
  /**
   * Computes the Geometric Median (L1 Fermat-Weber center) using Weiszfeld's algorithm.
   * This minimizes the sum of Euclidean distances to all team members instead of being skewed by outliers.
   */
  public static computeGeometricMedian(
    members: TeamMemberLocation[],
    maxIterations = 100,
    tolerance = 1e-6
  ): { latitude: number; longitude: number } {
    if (members.length === 0) {
      return { latitude: 0, longitude: 0 };
    }
    if (members.length === 1) {
      return { latitude: members[0].latitude, longitude: members[0].longitude };
    }

    // Initial estimate: Center of mass (arithmetic mean)
    let curLat = members.reduce((sum, m) => sum + m.latitude, 0) / members.length;
    let curLng = members.reduce((sum, m) => sum + m.longitude, 0) / members.length;

    for (let iter = 0; iter < maxIterations; iter++) {
      let numLat = 0;
      let numLng = 0;
      let denom = 0;

      for (const m of members) {
        const dist = Math.max(
          Math.hypot(m.latitude - curLat, m.longitude - curLng),
          1e-8
        );
        const weight = 1 / dist;
        numLat += m.latitude * weight;
        numLng += m.longitude * weight;
        denom += weight;
      }

      if (denom === 0) break;

      const nextLat = numLat / denom;
      const nextLng = numLng / denom;

      const shift = Math.hypot(nextLat - curLat, nextLng - curLng);
      curLat = nextLat;
      curLng = nextLng;

      if (shift < tolerance) break;
    }

    return { latitude: curLat, longitude: curLng };
  }

  /**
   * Ranks candidate venues based on commute time, fairness (standard deviation), seat capacity, and amenities.
   */
  public static rankVenuesForTeam(
    members: TeamMemberLocation[],
    venues: CandidateVenue[],
    minRequiredSeats: number = members.length
  ): OptimizationResult {
    const centroid = this.computeGeometricMedian(members);
    const rankedRecommendations: RankedVenueRecommendation[] = [];

    let maxObservedDistance = 0;

    for (const venue of venues) {
      const availableCapacity = Math.max(
        0,
        venue.availableSeatsCount ?? venue.maxCapacity - venue.currentOccupancy
      );

      // Filter out venues with insufficient capacity
      if (availableCapacity < minRequiredSeats) {
        continue;
      }

      const centroidDist = calculateHaversineDistanceMeters(
        centroid.latitude,
        centroid.longitude,
        venue.latitude,
        venue.longitude
      );

      if (centroidDist > maxObservedDistance) {
        maxObservedDistance = centroidDist;
      }

      const memberEstimates: MemberTravelEstimate[] = members.map((member) => {
        const distanceMeters = calculateHaversineDistanceMeters(
          member.latitude,
          member.longitude,
          venue.latitude,
          venue.longitude
        );
        const speed = getSpeedMetersPerMinute(member.transitMode);
        const durationMinutes = Math.round((distanceMeters / speed) * 1.2 + 2); // 20% routing overhead + 2 min buffer

        return {
          memberId: member.id,
          memberName: member.name,
          distanceMeters: Math.round(distanceMeters),
          durationMinutes: Math.max(1, durationMinutes),
          transitMode: member.transitMode || 'transit',
        };
      });

      const durations = memberEstimates.map((e) => e.durationMinutes);
      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const avgDuration = totalDuration / durations.length;
      const maxDuration = Math.max(...durations);

      // Calculate variance and standard deviation for fairness scoring
      const variance =
        durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) /
        durations.length;
      const stdDev = Math.sqrt(variance);

      // Fairness Score (100 = 0 std dev, drops as difference in member commutes increases)
      const fairnessScore = Math.max(0, Math.round(100 - stdDev * 3));

      // Quality bonuses
      const ratingBonus = (venue.rating ?? 3.5) * 5; // up to 25 pts
      const wifiBonus = Math.min(15, ((venue.wifiSpeed ?? 50) / 100) * 15); // up to 15 pts
      const outletBonus = venue.hasOutlets ? 5 : 0;

      // Lower aggregate travel time and higher fairness yield higher score
      const travelPenalty = avgDuration * 1.5;
      const compositeRankScore = Math.max(
        0,
        Math.round(100 - travelPenalty + (fairnessScore * 0.4) + ratingBonus + wifiBonus + outletBonus)
      );

      rankedRecommendations.push({
        venue,
        centroidDistanceMeters: Math.round(centroidDist),
        aggregateDurationMinutes: totalDuration,
        averageDurationMinutes: Math.round(avgDuration),
        maxDurationMinutes: maxDuration,
        fairnessScore,
        compositeRankScore,
        memberEstimates,
        availableCapacity,
      });
    }

    // Sort descending by composite ranking score
    rankedRecommendations.sort((a, b) => b.compositeRankScore - a.compositeRankScore);

    return {
      centroid,
      recommendedVenues: rankedRecommendations,
      searchRadiusMeters: Math.max(5000, maxObservedDistance),
    };
  }
}
