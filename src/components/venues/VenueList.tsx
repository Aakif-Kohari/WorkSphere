"use client";

import React, { useMemo } from "react";
import { VenueCard } from "@/components/VenueCard";
import {
  sortVenuesByProximity,
  filterVenuesByRadius,
  formatWalkingTimeBadge,
  haversineKm,
} from "@/lib/distance";

export interface VenueListProps {
  venues: any[];
  userLocation?: { lat: number; lng: number } | null;
  sortByProximity?: boolean;
  maxDistanceKm?: number;
  className?: string;
  onBookmarkToggle?: (venueId: string) => void;
}

/**
 * VenueList renders venue cards in a responsive grid, with computed walking time badges
 * and proximity sorting when user location permission is granted.
 */
export function VenueList({
  venues,
  userLocation = null,
  sortByProximity = false,
  maxDistanceKm,
  className = "",
  onBookmarkToggle,
}: VenueListProps) {
  const processedVenues = useMemo(() => {
    let result = [...venues];

    if (maxDistanceKm && maxDistanceKm > 0 && userLocation) {
      result = filterVenuesByRadius(result, userLocation, maxDistanceKm);
    }

    if (sortByProximity && userLocation) {
      result = sortVenuesByProximity(result, userLocation);
    }

    return result;
  }, [venues, userLocation, sortByProximity, maxDistanceKm]);

  if (processedVenues.length === 0) {
    return (
      <div
        data-testid="venue-list-empty"
        className="text-center py-12 text-zinc-500 dark:text-zinc-400"
      >
        No venues found matching your distance and location criteria.
      </div>
    );
  }

  return (
    <div
      data-testid="venue-list-grid"
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
    >
      {processedVenues.map((venue) => {
        const vLat = venue.latitude ?? venue.lat;
        const vLon = venue.longitude ?? venue.lng;
        const computedDistance =
          userLocation && vLat != null && vLon != null
            ? haversineKm(userLocation.lat, userLocation.lng, vLat, vLon)
            : null;

        return (
          <div key={venue.id || venue.placeId} className="relative group">
            <VenueCard venue={venue} onBookmarkToggle={onBookmarkToggle} />
            {computedDistance !== null && (
              <span
                data-testid={`walking-badge-${venue.id}`}
                className="sr-only"
              >
                {formatWalkingTimeBadge(computedDistance)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default VenueList;
