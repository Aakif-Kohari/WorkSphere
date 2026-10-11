/**
 * BLEMeshRouter.ts
 * Manages the Web Bluetooth GATT connections, discovering peers and routing bundles opportunistically.
 * Acts as both a GATT server and client to facilitate ad-hoc mesh networking.
 */

import { DTNBundleProtocol, Bundle, BundlePriority } from './DTNBundleProtocol';

// Standardized UUIDs for WorkSphere DTN Service and Characteristics
const DTN_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const DTN_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

export interface RouteEntry {
  destination: string;
  nextHop?: string;
  status: 'active' | 'dormant' | 'expired';
  failureCount: number;
  lastAttemptTimestamp: number;
  nextRetryTimestamp: number;
}

export interface QueuedBundleItem {
  bundle: Bundle;
  retryCount: number;
  nextAttemptTimestamp: number;
}

export class BLEMeshRouter {
  public static readonly MAX_RETRY_LIMIT = 3;
  public static readonly BASE_BACKOFF_MS = 1000;

  private protocol: DTNBundleProtocol;
  private outgoingQueue: Bundle[];
  private bundleRetryMap: Map<string, number>;
  private routingTable: Map<string, RouteEntry>;
  private onBundleReceived: ((bundle: Bundle) => void) | null;

  constructor() {
    this.protocol = new DTNBundleProtocol();
    this.outgoingQueue = [];
    this.bundleRetryMap = new Map();
    this.routingTable = new Map();
    this.onBundleReceived = null;
  }

  public enqueueMessage(
    source: string,
    destination: string,
    payload: Uint8Array,
    priority: BundlePriority = BundlePriority.NORMAL,
    lifetimeMs: number = 3600000
  ): void {
    const bundles = this.protocol.createBundle(source, destination, payload, lifetimeMs, priority);
    for (const bundle of bundles) {
      this.protocol.storeBundle(bundle);
      const bundleId = DTNBundleProtocol.getBundleId(bundle);
      this.bundleRetryMap.set(bundleId, 0);
    }
    this.outgoingQueue.push(...bundles);
    this.purgeExpiredQueue();
    DTNBundleProtocol.sortQueueByPriority(this.outgoingQueue);

    // Register active route if not present
    if (!this.routingTable.has(destination)) {
      this.setRoute(destination, 'active');
    }
  }

  public setRoute(destination: string, status: 'active' | 'dormant' | 'expired' = 'active', nextHop?: string): void {
    this.routingTable.set(destination, {
      destination,
      nextHop,
      status,
      failureCount: 0,
      lastAttemptTimestamp: Date.now(),
      nextRetryTimestamp: 0,
    });
  }

  public getRoute(destination: string): RouteEntry | undefined {
    return this.routingTable.get(destination);
  }

  public getRoutingTable(): Map<string, RouteEntry> {
    return new Map(this.routingTable);
  }

  public evictStaleRoute(destination: string): boolean {
    return this.routingTable.delete(destination);
  }

  public recordDeliveryFailure(destination: string, bundleId?: string): { retriesExhausted: boolean; routeEvicted: boolean } {
    let route = this.routingTable.get(destination);
    if (!route) {
      route = {
        destination,
        status: 'active',
        failureCount: 0,
        lastAttemptTimestamp: Date.now(),
        nextRetryTimestamp: 0,
      };
      this.routingTable.set(destination, route);
    }

    route.failureCount += 1;
    route.lastAttemptTimestamp = Date.now();

    // Exponential backoff: BASE_BACKOFF_MS * 2^(failureCount - 1)
    const backoffMs = BLEMeshRouter.BASE_BACKOFF_MS * Math.pow(2, route.failureCount - 1);
    route.nextRetryTimestamp = route.lastAttemptTimestamp + backoffMs;

    let retriesExhausted = false;
    let routeEvicted = false;

    if (bundleId) {
      const currentRetries = (this.bundleRetryMap.get(bundleId) || 0) + 1;
      this.bundleRetryMap.set(bundleId, currentRetries);
      if (currentRetries >= BLEMeshRouter.MAX_RETRY_LIMIT) {
        retriesExhausted = true;
      }
    }

    if (route.failureCount >= BLEMeshRouter.MAX_RETRY_LIMIT) {
      route.status = 'expired';
      this.evictStaleRoute(destination);
      routeEvicted = true;
    } else {
      route.status = 'dormant';
    }

    return { retriesExhausted, routeEvicted };
  }

  public recordDeliverySuccess(destination: string, bundleId?: string): void {
    const route = this.routingTable.get(destination);
    if (route) {
      route.failureCount = 0;
      route.status = 'active';
      route.nextRetryTimestamp = 0;
    }
    if (bundleId) {
      this.bundleRetryMap.delete(bundleId);
    }
  }

  public purgeExpiredQueue(now: number = Date.now()): Bundle[] {
    const valid: Bundle[] = [];
    const expired: Bundle[] = [];
    for (const b of this.outgoingQueue) {
      const bundleId = DTNBundleProtocol.getBundleId(b);
      const retries = this.bundleRetryMap.get(bundleId) || 0;
      if (now >= b.header.creationTimestamp + b.header.lifetime || retries >= BLEMeshRouter.MAX_RETRY_LIMIT) {
        expired.push(b);
        this.bundleRetryMap.delete(bundleId);
      } else {
        valid.push(b);
      }
    }
    this.outgoingQueue = valid;
    this.protocol.purgeExpiredBundles(now);
    return expired;
  }

  public getQueue(): Bundle[] {
    this.purgeExpiredQueue();
    return [...this.outgoingQueue];
  }

  public getQueueLength(): number {
    this.purgeExpiredQueue();
    return this.outgoingQueue.length;
  }

  public getProtocol(): DTNBundleProtocol {
    return this.protocol;
  }

  public clearQueue(): void {
    this.outgoingQueue = [];
    this.bundleRetryMap.clear();
    this.protocol.clearStoredBundles();
  }

  public setOnBundleReceived(callback: (bundle: Bundle) => void): void {
    this.onBundleReceived = callback;
  }

  /**
   * Attempts to connect to a discovered BLE device and transfer queued bundles.
   * Handles delivery failure fallback with exponential backoff and stale route eviction (#5734).
   */
  public async connectAndTransfer(device: BluetoothDevice): Promise<void> {
    try {
      const server = await device.gatt?.connect();
      if (!server) throw new Error('GATT server connection failed');

      const service = await server.getPrimaryService(DTN_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(DTN_CHAR_UUID);

      const remainingQueue: Bundle[] = [];

      // Transfer queued bundles with destination reachability checks
      while (this.outgoingQueue.length > 0) {
        const bundle = this.outgoingQueue.shift()!;
        const dest = bundle.header.destination;
        const bundleId = DTNBundleProtocol.getBundleId(bundle);
        const route = this.getRoute(dest);

        // Check if route is in backoff period
        if (route && route.nextRetryTimestamp > Date.now()) {
          remainingQueue.push(bundle);
          continue;
        }

        try {
          const serialized = this.protocol.serializeBundle(bundle);
          await characteristic.writeValue(serialized);
          this.recordDeliverySuccess(dest, bundleId);
        } catch (writeError) {
          const { retriesExhausted } = this.recordDeliveryFailure(dest, bundleId);
          if (!retriesExhausted) {
            remainingQueue.push(bundle);
          }
        }
      }

      this.outgoingQueue = remainingQueue;

      // Listen for incoming bundles
      characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          const bundle = this.protocol.deserializeBundle(new Uint8Array(target.value.buffer));
          if (bundle && this.onBundleReceived) {
            this.onBundleReceived(bundle);
          }
        }
      });

    } catch (error) {
      console.error('BLE transfer failed:', error);
      // If GATT connection failed, fail in-flight destinations
      for (const bundle of this.outgoingQueue) {
        const bundleId = DTNBundleProtocol.getBundleId(bundle);
        this.recordDeliveryFailure(bundle.header.destination, bundleId);
      }
    }
  }

  public async requestDevice(): Promise<BluetoothDevice | null> {
    if (!navigator.bluetooth) return null;
    
    try {
      return await navigator.bluetooth.requestDevice({
        filters: [{ services: [DTN_SERVICE_UUID] }],
        optionalServices: [DTN_SERVICE_UUID]
      });
    } catch (e) {
      console.error('Device selection failed:', e);
      return null;
    }
  }
}
