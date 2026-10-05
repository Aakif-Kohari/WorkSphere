import { initOfflineDB } from "../db";
import type { OfflineSearch, OfflineVenue, IRepository } from "../types";

export class SearchesRepository implements IRepository<OfflineSearch, string> {
  async get(query: string): Promise<OfflineSearch | undefined> {
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["searches"], "readonly");
      const store = tx.objectStore("searches");
      const req = store.get(query);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(): Promise<OfflineSearch[]> {
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["searches"], "readonly");
      const store = tx.objectStore("searches");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async save(search: OfflineSearch): Promise<void> {
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["searches"], "readwrite");
      const store = tx.objectStore("searches");
      const req = store.put(search);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async saveMany(searches: OfflineSearch[]): Promise<void> {
    if (searches.length === 0) return;
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["searches"], "readwrite");
      const store = tx.objectStore("searches");
      for (const search of searches) {
        store.put(search);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(query: string): Promise<void> {
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["searches"], "readwrite");
      const store = tx.objectStore("searches");
      const req = store.delete(query);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(): Promise<void> {
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["searches"], "readwrite");
      const store = tx.objectStore("searches");
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const searchesRepository = new SearchesRepository();
