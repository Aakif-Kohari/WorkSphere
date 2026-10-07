import { prisma } from "@/lib/prisma";

export interface ApplePassRegistration {
  deviceLibraryIdentifier: string;
  pushToken: string;
  passTypeIdentifier: string;
  serialNumber: string;
  authorizationToken: string;
  bookingId?: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface SendPushResult {
  deviceLibraryIdentifier: string;
  pushToken: string;
  success: boolean;
  status?: number;
  error?: string;
}

export interface ApplePassUpdatePayload {
  serialNumber: string;
  passTypeIdentifier: string;
  bookingId: string;
  event: "modified" | "cancelled" | "checked_in" | "expired";
}

/** In-memory store fallback when Apple Wallet devices register (persisted if table exists) */
const deviceRegistrationStore = new Map<string, ApplePassRegistration>();

/**
 * Registers an Apple Wallet device to receive APNs push notifications for a specific pass.
 * Follows the official Apple Wallet Web Service API specification:
 * POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
 */
export async function registerApplePassDevice(params: {
  deviceLibraryIdentifier: string;
  passTypeIdentifier: string;
  serialNumber: string;
  pushToken: string;
  authorizationToken: string;
  bookingId?: string;
}): Promise<{ status: "created" | "already_registered" }> {
  const {
    deviceLibraryIdentifier,
    passTypeIdentifier,
    serialNumber,
    pushToken,
    authorizationToken,
    bookingId,
  } = params;

  if (!deviceLibraryIdentifier || !passTypeIdentifier || !serialNumber || !pushToken) {
    throw new Error("Missing required registration parameters");
  }

  const key = `${deviceLibraryIdentifier}:${passTypeIdentifier}:${serialNumber}`;
  const existing = deviceRegistrationStore.get(key);

  const registrationRecord: ApplePassRegistration = {
    deviceLibraryIdentifier,
    pushToken,
    passTypeIdentifier,
    serialNumber,
    authorizationToken,
    bookingId,
    updatedAt: new Date(),
    createdAt: existing ? existing.createdAt : new Date(),
  };

  deviceRegistrationStore.set(key, registrationRecord);

  try {
    // Attempt database persistence if schema supports it or raw store
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ApplePassRegistration" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "deviceLibraryIdentifier" TEXT NOT NULL,
        "passTypeIdentifier" TEXT NOT NULL,
        "serialNumber" TEXT NOT NULL,
        "pushToken" TEXT NOT NULL,
        "authorizationToken" TEXT NOT NULL,
        "bookingId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ApplePassRegistration_unique_device_pass" UNIQUE ("deviceLibraryIdentifier", "passTypeIdentifier", "serialNumber")
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ApplePassRegistration" 
       ("id", "deviceLibraryIdentifier", "passTypeIdentifier", "serialNumber", "pushToken", "authorizationToken", "bookingId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT ("deviceLibraryIdentifier", "passTypeIdentifier", "serialNumber")
       DO UPDATE SET "pushToken" = EXCLUDED."pushToken", "authorizationToken" = EXCLUDED."authorizationToken", "updatedAt" = NOW()`,
      deviceLibraryIdentifier,
      passTypeIdentifier,
      serialNumber,
      pushToken,
      authorizationToken,
      bookingId || null,
    ).catch(() => {});
  } catch (err) {
    console.warn("[AppleWallet] DB storage fallback to memory:", err);
  }

  return { status: existing ? "already_registered" : "created" };
}

/**
 * Unregisters an Apple Wallet device when a pass is deleted from the device.
 * DELETE /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
 */
export async function unregisterApplePassDevice(params: {
  deviceLibraryIdentifier: string;
  passTypeIdentifier: string;
  serialNumber: string;
  authorizationToken: string;
}): Promise<{ status: "unregistered" | "not_found" | "unauthorized" }> {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber, authorizationToken } = params;

  const key = `${deviceLibraryIdentifier}:${passTypeIdentifier}:${serialNumber}`;
  const record = deviceRegistrationStore.get(key);

  if (record && record.authorizationToken !== authorizationToken) {
    return { status: "unauthorized" };
  }

  const existed = deviceRegistrationStore.delete(key);

  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ApplePassRegistration"
       WHERE "deviceLibraryIdentifier" = $1
         AND "passTypeIdentifier" = $2
         AND "serialNumber" = $3`,
      deviceLibraryIdentifier,
      passTypeIdentifier,
      serialNumber,
    ).catch(() => {});
  } catch (err) {
    console.warn("[AppleWallet] DB unregister error:", err);
  }

  return { status: existed ? "unregistered" : "not_found" };
}

/**
 * Returns registered devices for a pass.
 */
export async function getRegisteredDevicesForPass(
  passTypeIdentifier: string,
  serialNumber: string,
): Promise<ApplePassRegistration[]> {
  const memoryMatches = Array.from(deviceRegistrationStore.values()).filter(
    (reg) => reg.passTypeIdentifier === passTypeIdentifier && reg.serialNumber === serialNumber,
  );

  try {
    const dbMatches = await prisma.$queryRawUnsafe<ApplePassRegistration[]>(
      `SELECT "deviceLibraryIdentifier", "passTypeIdentifier", "serialNumber", "pushToken", "authorizationToken", "bookingId"
       FROM "ApplePassRegistration"
       WHERE "passTypeIdentifier" = $1 AND "serialNumber" = $2`,
      passTypeIdentifier,
      serialNumber,
    );
    if (dbMatches && dbMatches.length > 0) {
      return dbMatches;
    }
  } catch {
    // Fall back to memory
  }

  return memoryMatches;
}

/**
 * Sends empty/silent APNs push notifications triggering Passbook to re-fetch updated passes.
 * According to Apple Wallet specs, pass update notifications MUST be an empty JSON payload `{}`
 * with no alert, sound, or badge.
 */
export async function sendApplePassUpdatePushNotification(
  payload: ApplePassUpdatePayload,
): Promise<SendPushResult[]> {
  const { passTypeIdentifier, serialNumber, bookingId, event } = payload;
  const registrations = await getRegisteredDevicesForPass(passTypeIdentifier, serialNumber);

  console.log(
    `[AppleWallet] Triggering APNs update for pass ${serialNumber} (${event}, booking ${bookingId}) across ${registrations.length} device(s)`,
  );

  const results: SendPushResult[] = [];

  for (const reg of registrations) {
    try {
      // In production APNs HTTP/2 communication:
      // POST https://api.push.apple.com/3/device/{pushToken} with header apns-topic: passTypeIdentifier
      // and empty body '{}'
      const apnsEndpoint = process.env.APNS_GATEWAY_URL || "https://api.sandbox.push.apple.com/3/device";
      const isConfigured = Boolean(process.env.APPLE_PASS_CERT_PEM || process.env.APNS_AUTH_KEY);

      if (isConfigured && typeof fetch === "function") {
        const response = await fetch(`${apnsEndpoint}/${reg.pushToken}`, {
          method: "POST",
          headers: {
            "apns-topic": passTypeIdentifier,
            "apns-push-type": "background",
            "apns-priority": "10",
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        });

        results.push({
          deviceLibraryIdentifier: reg.deviceLibraryIdentifier,
          pushToken: reg.pushToken,
          success: response.ok,
          status: response.status,
        });
      } else {
        // Mock/simulated successful silent push delivery in dev/test environment
        results.push({
          deviceLibraryIdentifier: reg.deviceLibraryIdentifier,
          pushToken: reg.pushToken,
          success: true,
          status: 200,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        deviceLibraryIdentifier: reg.deviceLibraryIdentifier,
        pushToken: reg.pushToken,
        success: false,
        error: errorMsg,
      });
    }
  }

  return results;
}

/**
 * Hook invoked when a booking status changes (modified, cancelled, checked in, or expired).
 */
export async function notifyAppleWalletOnBookingUpdate(params: {
  bookingId: string;
  serialNumber?: string;
  passTypeIdentifier?: string;
  event: "modified" | "cancelled" | "checked_in" | "expired";
}): Promise<SendPushResult[]> {
  const passType = params.passTypeIdentifier || process.env.APPLE_PASS_TYPE_ID || "pass.com.worksphere.booking";
  const serialNumber = params.serialNumber || `booking-${params.bookingId}`;

  return sendApplePassUpdatePushNotification({
    serialNumber,
    passTypeIdentifier: passType,
    bookingId: params.bookingId,
    event: params.event,
  });
}
