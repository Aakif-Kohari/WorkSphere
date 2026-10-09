/**
 * peripheralEngine.ts
 * Core domain types and business logic for Peer-to-Peer & Venue Hardware Lending Lockers.
 * Manages item availability, micro-deposits, locker bay allocation, and secure PIN generation.
 */

import crypto from "crypto";

export type PeripheralCategory =
  | "CHARGER"
  | "MONITOR"
  | "KEYBOARD"
  | "MOUSE"
  | "HEADSET"
  | "ADAPTER";

export interface PeripheralItem {
  id: string;
  venueId: string;
  name: string;
  category: PeripheralCategory;
  description: string;
  brand: string;
  lockerBayNumber: number;
  condition: "EXCELLENT" | "GOOD" | "FAIR";
  hourlyRateUsd: number;
  depositUsd: number;
  isAvailable: boolean;
  currentRentalId?: string | null;
  specifications: string[];
  imageUrl?: string;
}

export interface PeripheralRental {
  rentalId: string;
  itemId: string;
  userId: string;
  venueId: string;
  lockerBayNumber: number;
  unlockPin: string;
  depositAmount: number;
  hourlyRate: number;
  startTime: string;
  endTime?: string | null;
  totalCostUsd?: number | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
}

/**
 * Generates a secure, deterministic 4-digit unlock PIN for a locker bay.
 */
export function generateLockerPin(itemId: string, userId: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${itemId}:${userId}:${Date.now().toString().slice(0, 8)}`)
    .digest("hex");
  const num = parseInt(hash.slice(0, 4), 16) % 10000;
  return num.toString().padStart(4, "0");
}

/**
 * Calculates rental fees and final balance upon item return.
 */
export function calculateRentalCompletion(
  rental: PeripheralRental,
  returnTime = new Date()
): { durationHours: number; rentalCost: number; refundedDeposit: number } {
  const start = new Date(rental.startTime);
  const elapsedMs = Math.max(0, returnTime.getTime() - start.getTime());
  const durationHours = Math.max(1, Math.ceil(elapsedMs / (1000 * 60 * 60))); // billed per hour minimum 1hr

  const rentalCost = Number((durationHours * rental.hourlyRate).toFixed(2));
  const refundedDeposit = Math.max(0, Number((rental.depositAmount - rentalCost).toFixed(2)));

  return {
    durationHours,
    rentalCost,
    refundedDeposit,
  };
}
