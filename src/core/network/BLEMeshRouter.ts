/**
 * BLEMeshRouter.ts
 * Manages the Web Bluetooth GATT connections, discovering peers and routing bundles opportunistically.
 * Acts as both a GATT server and client to facilitate ad-hoc mesh networking.
 */

import { DTNBundleProtocol, Bundle, BundlePriority } from './DTNBundleProtocol';

// Standardized UUIDs for WorkSphere DTN Service and Characteristics
const DTN_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const DTN_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

export class BLEMeshRouter {
  private protocol: DTNBundleProtocol;
  private outgoingQueue: Bundle[];
  private onBundleReceived: ((bundle: Bundle) => void) | null;

  constructor() {
    this.protocol = new DTNBundleProtocol();
    this.outgoingQueue = [];
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
    }
    this.outgoingQueue.push(...bundles);
    this.purgeExpiredQueue();
    DTNBundleProtocol.sortQueueByPriority(this.outgoingQueue);
  }

  public purgeExpiredQueue(now: number = Date.now()): Bundle[] {
    const initialLen = this.outgoingQueue.length;
    const valid: Bundle[] = [];
    const expired: Bundle[] = [];
    for (const b of this.outgoingQueue) {
      if (now >= b.header.creationTimestamp + b.header.lifetime) {
        expired.push(b);
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
    this.protocol.clearStoredBundles();
  }

  public setOnBundleReceived(callback: (bundle: Bundle) => void): void {
    this.onBundleReceived = callback;
  }

  /**
   * Attempts to connect to a discovered BLE device and transfer queued bundles.
   */
  public async connectAndTransfer(device: BluetoothDevice): Promise<void> {
    try {
      const server = await device.gatt?.connect();
      if (!server) throw new Error('GATT server connection failed');

      const service = await server.getPrimaryService(DTN_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(DTN_CHAR_UUID);

      // Transfer queued bundles
      while (this.outgoingQueue.length > 0) {
        const bundle = this.outgoingQueue.shift()!;
        const serialized = this.protocol.serializeBundle(bundle);
        
        // Write in chunks if necessary (simplified for scaffold)
        await characteristic.writeValue(serialized);
      }

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
