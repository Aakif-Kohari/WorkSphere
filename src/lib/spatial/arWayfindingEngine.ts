/**
 * arWayfindingEngine.ts
 * Spatial vector math and turn-by-turn waypoint routing for WebXR indoor AR wayfinding.
 * Computes heading bearings, distance vectors, and glowing bounding-box coordinates for reserved desks.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ARWaypoint {
  stepIndex: number;
  position: Vector3D;
  instruction: string;
  distanceToNextMeters: number;
  turnAction: "STRAIGHT" | "TURN_LEFT" | "TURN_RIGHT" | "ARRIVED" | "STAIRS_ELEVATOR";
}

export interface ARNavigationPath {
  targetSeatId: string;
  targetSeatNumber: string;
  targetPosition: Vector3D;
  totalDistanceMeters: number;
  estimatedWalkingSeconds: number;
  waypoints: ARWaypoint[];
}

/**
 * Calculates Euclidean distance between two 3D spatial points.
 */
export function calculate3DDistance(p1: Vector3D, p2: Vector3D): number {
  return Math.sqrt(
    Math.pow(p2.x - p1.x, 2) +
    Math.pow(p2.y - p1.y, 2) +
    Math.pow(p2.z - p1.z, 2)
  );
}

/**
 * Calculates horizontal bearing angle (in degrees 0-360) from camera position to target.
 */
export function calculateHorizontalBearingDeg(from: Vector3D, to: Vector3D): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let angle = Math.atan2(dx, -dz) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return Number(angle.toFixed(1));
}

/**
 * Generates an indoor navigation path with intermediate waypoints to avoid interior walls.
 */
export function computeARIndoorRoute(
  start: Vector3D,
  destination: Vector3D,
  targetSeatId: string,
  targetSeatNumber: string
): ARNavigationPath {
  const totalDist = calculate3DDistance(start, destination);
  const waypoints: ARWaypoint[] = [];

  // If distance is short (< 4m), direct line of sight
  if (totalDist <= 4.0) {
    waypoints.push({
      stepIndex: 1,
      position: destination,
      instruction: `Walk straight towards ${targetSeatNumber}`,
      distanceToNextMeters: Number(totalDist.toFixed(1)),
      turnAction: "STRAIGHT",
    });
    waypoints.push({
      stepIndex: 2,
      position: destination,
      instruction: `Arrived at ${targetSeatNumber}`,
      distanceToNextMeters: 0,
      turnAction: "ARRIVED",
    });
  } else {
    // Generate an intermediate hallway intersection waypoint
    const midX = start.x + (destination.x - start.x) * 0.5;
    const midZ = start.z; // Move along primary hallway axis first

    const intermediatePoint: Vector3D = {
      x: Number(midX.toFixed(2)),
      y: Number(start.y.toFixed(2)),
      z: Number(midZ.toFixed(2)),
    };

    const dist1 = calculate3DDistance(start, intermediatePoint);
    const dist2 = calculate3DDistance(intermediatePoint, destination);

    const isLeftTurn = destination.z < start.z;

    waypoints.push({
      stepIndex: 1,
      position: intermediatePoint,
      instruction: "Follow main corridor walkway",
      distanceToNextMeters: Number(dist1.toFixed(1)),
      turnAction: "STRAIGHT",
    });

    waypoints.push({
      stepIndex: 2,
      position: destination,
      instruction: isLeftTurn ? "Turn left into Workspace Bay" : "Turn right into Workspace Bay",
      distanceToNextMeters: Number(dist2.toFixed(1)),
      turnAction: isLeftTurn ? "TURN_LEFT" : "TURN_RIGHT",
    });

    waypoints.push({
      stepIndex: 3,
      position: destination,
      instruction: `Arrived at your reserved desk (${targetSeatNumber})`,
      distanceToNextMeters: 0,
      turnAction: "ARRIVED",
    });
  }

  const estimatedWalkingSeconds = Math.max(5, Math.round(totalDist / 1.1)); // 1.1 m/s indoor walking pace

  return {
    targetSeatId,
    targetSeatNumber,
    targetPosition: destination,
    totalDistanceMeters: Number(totalDist.toFixed(1)),
    estimatedWalkingSeconds,
    waypoints,
  };
}

export type ARCameraFallbackMode = "3d_spatial" | "horizon_locked" | "2d_top_down";

export interface ClampedCameraOrientation {
  offset: Vector3D;
  fallbackMode: ARCameraFallbackMode;
  isCompassReliable: boolean;
  pitchDeg: number;
  rollDeg: number;
}

/**
 * Clamps camera tilt / altitude when compass/gyro sensor reports null or NaN tilt.
 * Falls back to a 2D top-down perspective or forward-facing horizon lock (pitch = 0).
 * Clamps pitch to [-45°, 45°] and roll to [-30°, 30°] to prevent erratic spinning toward the sky.
 */
export function clampCameraOrientation(
  beta: number | null | undefined, // Pitch [-180, 180]
  gamma: number | null | undefined, // Roll [-90, 90]
  options: {
    minPitchDeg?: number;
    maxPitchDeg?: number;
    minRollDeg?: number;
    maxRollDeg?: number;
    forceTopDownOnNull?: boolean;
  } = {}
): ClampedCameraOrientation {
  const minPitch = options.minPitchDeg ?? -45;
  const maxPitch = options.maxPitchDeg ?? 45;
  const minRoll = options.minRollDeg ?? -30;
  const maxRoll = options.maxRollDeg ?? 30;

  const isBetaNullOrInvalid =
    beta === null || beta === undefined || typeof beta !== "number" || isNaN(beta);
  const isGammaNullOrInvalid =
    gamma === null || gamma === undefined || typeof gamma !== "number" || isNaN(gamma);

  if (isBetaNullOrInvalid || isGammaNullOrInvalid) {
    // If device orientation values are null or unreliable, fall back to a 2D top-down perspective or forward-facing horizon lock
    const fallbackMode: ARCameraFallbackMode = options.forceTopDownOnNull
      ? "2d_top_down"
      : "horizon_locked";

    return {
      offset: { x: 0, y: 0, z: 0 },
      fallbackMode,
      isCompassReliable: false,
      pitchDeg: 0,
      rollDeg: 0,
    };
  }

  // Clamp angles within safe forward-facing bounds
  const clampedBeta = Math.max(minPitch, Math.min(maxPitch, beta));
  const clampedGamma = Math.max(minRoll, Math.min(maxRoll, gamma));

  return {
    offset: {
      x: Number(((clampedGamma / 90) * 0.5).toFixed(3)),
      y: Number(((clampedBeta / 180) * 0.3).toFixed(3)),
      z: 0,
    },
    fallbackMode: "3d_spatial",
    isCompassReliable: true,
    pitchDeg: clampedBeta,
    rollDeg: clampedGamma,
  };
}
