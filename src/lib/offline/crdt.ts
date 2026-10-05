import * as Y from "yjs";
import { initOfflineDB } from "./db";
import type { OfflineVenue } from "./types";

export const userDoc = new Y.Doc();
export const yFavorites = userDoc.getMap<OfflineVenue>("favorites");
export const yRatings = userDoc.getMap<Record<string, unknown>>("ratings");

userDoc.on("update", async (update: Uint8Array) => {
  try {
    await queueCrdtUpdate(update);
  } catch (err) {
    console.error("Failed to queue CRDT update:", err);
  }
});

export async function queueCrdtUpdate(update: Uint8Array): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pendingActions"], "readwrite");
    const store = tx.objectStore("pendingActions");
    const req = store.add({
      type: "CRDT_UPDATE",
      payload: Array.from(update),
      timestamp: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingCrdtUpdates(): Promise<Uint8Array[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pendingActions"], "readonly");
    const store = tx.objectStore("pendingActions");
    const req = store.getAll();
    req.onsuccess = () => {
      const actions = (req.result || []) as Array<{ type: string; payload: number[] }>;
      const updates = actions
        .filter((a) => a.type === "CRDT_UPDATE")
        .map((a) => new Uint8Array(a.payload));
      resolve(updates);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearPendingCrdtUpdates(): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pendingActions"], "readwrite");
    const store = tx.objectStore("pendingActions");
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
