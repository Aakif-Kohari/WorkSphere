/**
 * GraphMemory.ts
 * Implements the directed property graph structure to store entities (Venues, Users, Features) 
 * and relationships, enabling persistent mapping of user preferences and venue rejections.
 */

export type EntityType = 'USER' | 'VENUE' | 'FEATURE' | 'CONVERSATION';

export interface GraphNode {
  id: string;
  type: EntityType;
  properties: Record<string, string | number | boolean>;
  createdAt: number;
  lastReinforcedAt?: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relationship: string; // e.g., 'PREFERS', 'REJECTED', 'HAS_FEATURE', 'VISITED'
  weight: number;
  properties: Record<string, string | number | boolean>;
  createdAt: number;
}

export interface GraphMemoryOptions {
  decayTimeConstantMs?: number;
  pruneIntervalMs?: number;
  pruneThreshold?: number;
  maxReferencesForPruning?: number;
}

const DEFAULT_DECAY_TIME_CONSTANT_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PRUNE_THRESHOLD = 0.05;
const DEFAULT_MAX_REFERENCES_FOR_PRUNING = 1;

export class GraphMemory {
  private nodes: Map<string, GraphNode>;
  private edges: Map<string, GraphEdge[]>; // Adjacency list: sourceId -> edges
  private readonly decayTimeConstantMs: number;
  private readonly pruneThreshold: number;
  private readonly maxReferencesForPruning: number;
  private readonly pruningTimer?: ReturnType<typeof setInterval>;

  constructor(options: GraphMemoryOptions = {}) {
    const decayTimeConstantMs = options.decayTimeConstantMs ?? DEFAULT_DECAY_TIME_CONSTANT_MS;
    const pruneIntervalMs = options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
    const pruneThreshold = options.pruneThreshold ?? DEFAULT_PRUNE_THRESHOLD;
    const maxReferencesForPruning = options.maxReferencesForPruning ?? DEFAULT_MAX_REFERENCES_FOR_PRUNING;

    if (decayTimeConstantMs <= 0 || !Number.isFinite(decayTimeConstantMs)) {
      throw new RangeError('decayTimeConstantMs must be a finite positive number.');
    }
    if (pruneIntervalMs < 0 || !Number.isFinite(pruneIntervalMs)) {
      throw new RangeError('pruneIntervalMs must be a finite non-negative number.');
    }
    if (pruneThreshold < 0 || pruneThreshold > 1 || !Number.isFinite(pruneThreshold)) {
      throw new RangeError('pruneThreshold must be between 0 and 1.');
    }
    if (!Number.isInteger(maxReferencesForPruning) || maxReferencesForPruning < 0) {
      throw new RangeError('maxReferencesForPruning must be a non-negative integer.');
    }

    this.nodes = new Map();
    this.edges = new Map();
    this.decayTimeConstantMs = decayTimeConstantMs;
    this.pruneThreshold = pruneThreshold;
    this.maxReferencesForPruning = maxReferencesForPruning;

    if (pruneIntervalMs > 0) {
      this.pruningTimer = setInterval(() => this.pruneStaleEntities(), pruneIntervalMs);
      this.pruningTimer.unref?.();
    }
  }

  public addNode(node: GraphNode): void {
    const now = Date.now();
    const existingNode = this.nodes.get(node.id);
    this.nodes.set(node.id, {
      ...node,
      createdAt: existingNode?.createdAt ?? node.createdAt ?? now,
      lastReinforcedAt: now
    });
    if (!this.edges.has(node.id)) {
      this.edges.set(node.id, []);
    }
  }

  public addEdge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.sourceId) || !this.nodes.has(edge.targetId)) {
      throw new Error('Both source and target nodes must exist before adding an edge.');
    }
    
    const now = Date.now();
    for (const nodeId of [edge.sourceId, edge.targetId]) {
      const node = this.nodes.get(nodeId)!;
      this.nodes.set(nodeId, { ...node, lastReinforcedAt: now });
    }

    this.upsertEdge({ ...edge, createdAt: now });
  }

  private upsertEdge(edge: GraphEdge): void {
    const newEdge = { ...edge };
    const sourceEdges = this.edges.get(edge.sourceId) || [];
    
    // Update existing edge if relationship and target match, otherwise push new
    const existingIndex = sourceEdges.findIndex(
      e => e.targetId === edge.targetId && e.relationship === edge.relationship
    );
    
    if (existingIndex !== -1) {
      sourceEdges[existingIndex] = newEdge;
    } else {
      sourceEdges.push(newEdge);
    }
    
    this.edges.set(edge.sourceId, sourceEdges);
  }

  private decayMultiplier(timestamp: number, now: number): number {
    return Math.exp(-Math.max(0, now - timestamp) / this.decayTimeConstantMs);
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getNodeRelevance(id: string, now = Date.now()): number {
    const node = this.nodes.get(id);
    return node
      ? this.decayMultiplier(node.lastReinforcedAt ?? node.createdAt, now)
      : 0;
  }

  public getConnectedNodes(sourceId: string, relationship?: string): GraphNode[] {
    const sourceEdges = this.edges.get(sourceId) || [];
    const filteredEdges = relationship 
      ? sourceEdges.filter(e => e.relationship === relationship)
      : sourceEdges;

    return filteredEdges
      .map(e => this.nodes.get(e.targetId))
      .filter((node): node is GraphNode => node !== undefined);
  }

  public getUserPreferences(userId: string): { featureId: string; weight: number }[] {
    const preferredFeatures = this.getConnectedNodes(userId, 'PREFERS');
    const sourceEdges = this.edges.get(userId) ?? [];
    const now = Date.now();
    return preferredFeatures.map(node => {
      const preference = sourceEdges.find(edge => edge.targetId === node.id && edge.relationship === 'PREFERS');
      return {
        featureId: node.id,
        weight: (preference?.weight ?? 1)
          * this.decayMultiplier(preference?.createdAt ?? now, now)
      };
    });
  }

  public getRejectedVenues(userId: string): string[] {
    return this.getConnectedNodes(userId, 'REJECTED').map(node => node.id);
  }

  public exportGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const allEdges: GraphEdge[] = [];
    this.edges.forEach(edgeList => allEdges.push(...edgeList));
    
    return {
      nodes: Array.from(this.nodes.values()),
      edges: allEdges
    };
  }

  public pruneStaleEntities(now = Date.now()): number {
    const referenceCounts = new Map<string, number>();
    for (const [sourceId, sourceEdges] of this.edges) {
      for (const edge of sourceEdges) {
        referenceCounts.set(sourceId, (referenceCounts.get(sourceId) ?? 0) + 1);
        referenceCounts.set(edge.targetId, (referenceCounts.get(edge.targetId) ?? 0) + 1);
      }
    }

    const staleNodeIds = new Set<string>();
    for (const node of this.nodes.values()) {
      if (
        node.type !== 'USER' &&
        (referenceCounts.get(node.id) ?? 0) <= this.maxReferencesForPruning &&
        this.getNodeRelevance(node.id, now) < this.pruneThreshold
      ) {
        staleNodeIds.add(node.id);
      }
    }

    for (const nodeId of staleNodeIds) {
      this.nodes.delete(nodeId);
      this.edges.delete(nodeId);
    }
    if (staleNodeIds.size > 0) {
      for (const [sourceId, sourceEdges] of this.edges) {
        this.edges.set(sourceId, sourceEdges.filter(edge => !staleNodeIds.has(edge.targetId)));
      }
    }

    return staleNodeIds.size;
  }

  public dispose(): void {
    if (this.pruningTimer) {
      clearInterval(this.pruningTimer);
    }
  }

  public importGraph(data: { nodes: GraphNode[]; edges: GraphEdge[] }): void {
    this.nodes.clear();
    this.edges.clear();
    
    data.nodes.forEach(node => {
      this.nodes.set(node.id, {
        ...node,
        lastReinforcedAt: node.lastReinforcedAt ?? node.createdAt
      });
      this.edges.set(node.id, []);
    });
    data.edges.forEach(edge => {
      if (!this.nodes.has(edge.sourceId) || !this.nodes.has(edge.targetId)) {
        throw new Error('Both source and target nodes must exist before adding an edge.');
      }
      this.upsertEdge({ ...edge });
    });
  }
}
