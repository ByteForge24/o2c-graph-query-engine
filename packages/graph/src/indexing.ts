/**
 * Graph Adjacency Indexing
 * Builds in-memory index structures for fast neighbor lookups during traversal.
 * Phase 3.3.1: Infrastructure for deterministic graph traversal.
 */

import { GraphNode, GraphNodeType, GraphEdgeType, GraphEdge, GraphData, Graph } from './index.js';

// ============================================================================
// ADJACENCY INDEX TYPES
// ============================================================================

/**
 * Represents a single adjacency entry in the graph.
 * Used in outbound and inbound adjacency lists.
 */
export type GraphAdjacencyEntry = {
  /** Type of the edge connecting the nodes */
  edgeType: GraphEdgeType;
  /** Fully-qualified node ID of the neighbor */
  nodeId: string;
};

/**
 * In-memory index structure for fast graph traversal.
 * Maps node IDs to their neighbors via typed edges.
 *
 * Structure:
 * - `nodeById`: all nodes indexed by their ID
 * - `outbound`: outgoing edges from each node (source → target)
 * - `inbound`: incoming edges to each node (target ← source)
 * - `byTypeAndBusinessId`: lookup table for resolving start nodes by type and business ID
 *
 * Adjacency lists preserve edge insertion order for determinism.
 */
export type GraphIndex = {
  /** All nodes indexed by their fully-qualified ID */
  nodeById: Map<string, GraphNode>;
  /** Outgoing adjacency lists: node → neighbors via outgoing edges */
  outbound: Map<string, GraphAdjacencyEntry[]>;
  /** Incoming adjacency lists: node ← neighbors via incoming edges */
  inbound: Map<string, GraphAdjacencyEntry[]>;
  /** Lookup index: node type → business ID → node (for start node resolution) */
  byTypeAndBusinessId: Map<GraphNodeType, Map<string, GraphNode>>;
};

/**
 * Represents a resolved neighbor node from the index.
 * Includes the full node, the edge type, and the direction it was reached from.
 * Used by neighbor expansion helpers during traversal.
 */
export type GraphNeighbor = {
  /** The resolved neighbor node */
  node: GraphNode;
  /** Type of the edge connecting to this neighbor */
  viaEdgeType: GraphEdgeType;
  /** Direction the neighbor was reached from: outbound or inbound */
  direction: 'outbound' | 'inbound';
};

// ============================================================================
// INDEXING HELPERS
// ============================================================================

/**
 * Appends an adjacency entry to a map, creating the list if needed.
 * Preserves insertion order for determinism.
 */
function appendAdjacency(
  map: Map<string, GraphAdjacencyEntry[]>,
  key: string,
  entry: GraphAdjacencyEntry
): void {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key)!.push(entry);
}

/**
 * Extracts the business/domain ID from a full graph node ID.
 * Graph node IDs follow the format: `Type:businessId`
 * Example: `SalesOrder:740506` -> `740506`
 *
 * @param nodeId - Fully-qualified graph node ID
 * @returns The business ID portion after the first `:`
 */
export function extractBusinessIdFromNodeId(nodeId: string): string {
  const colonIndex = nodeId.indexOf(':');
  if (colonIndex === -1 || colonIndex === nodeId.length - 1) {
    // If no colon or colon at end, return the whole ID
    return nodeId;
  }
  return nodeId.substring(colonIndex + 1);
}

// ============================================================================
// INDEX BUILDER
// ============================================================================

/**
 * Builds a graph index from a graph structure.
 * Creates deterministic adjacency maps for both outbound and inbound traversal.
 *
 * Input can be:
 * - GraphData (nodes and edges only)
 * - Graph (with optional statistics)
 *
 * The index does not mutate the input graph.
 * Adjacency lists preserve edge insertion order.
 *
 * @param graph - Source graph structure
 * @returns Indexed graph with fast neighbor lookups
 */
export function buildGraphIndex(graph: GraphData | Graph): GraphIndex {
  const index: GraphIndex = {
    nodeById: new Map(),
    outbound: new Map(),
    inbound: new Map(),
    byTypeAndBusinessId: new Map(),
  };

  // Index all nodes by their ID
  for (const node of graph.nodes) {
    index.nodeById.set(node.id, node);

    // Index by type and business ID for start node resolution.
    // Business ID is extracted from the graph node ID.
    // Duplicate (type, businessId) pairs: keep the first one, ignore later duplicates.
    const businessId = extractBusinessIdFromNodeId(node.id);
    if (!index.byTypeAndBusinessId.has(node.type)) {
      index.byTypeAndBusinessId.set(node.type, new Map());
    }
    const typeMap = index.byTypeAndBusinessId.get(node.type)!;
    if (!typeMap.has(businessId)) {
      typeMap.set(businessId, node);
      // Note: duplicates are silently ignored in this phase,
      // allowing first occurrence to act as the canonical node.
    }
  }

  // Build adjacency lists from edges, preserving insertion order
  for (const edge of graph.edges) {
    const { source, target, type } = edge;

    // Outbound: source → target
    appendAdjacency(index.outbound, source, {
      edgeType: type,
      nodeId: target,
    });

    // Inbound: target ← source (entry points back to source)
    appendAdjacency(index.inbound, target, {
      edgeType: type,
      nodeId: source,
    });
  }

  return index;
}

/**
 * Looks up a node by its type and business/domain ID.
 * Resolves start nodes for graph queries based on request parameters.
 *
 * Returns undefined if no node with the given (type, businessId) pair exists.
 *
 * @param index - The built graph index
 * @param type - Canonical node type from GRAPH_NODE_TYPES
 * @param businessId - Domain-specific ID without type prefix
 * @returns The matched GraphNode, or undefined if not found
 */
export function getNodeByTypeAndBusinessId(
  index: GraphIndex,
  type: GraphNodeType,
  businessId: string
): GraphNode | undefined {
  const typeMap = index.byTypeAndBusinessId.get(type);
  if (!typeMap) {
    return undefined;
  }
  return typeMap.get(businessId);
}

// ============================================================================
// NEIGHBOR EXPANSION HELPERS
// ============================================================================

/**
 * Gets all outbound neighbors of a node.
 * Resolves each neighbor node from the index and preserves adjacency order.
 * Silently skips neighbors whose nodes are not in the index.
 *
 * @param index - The built graph index
 * @param nodeId - Fully-qualified ID of the source node
 * @returns Array of resolved outbound neighbors in adjacency order
 */
export function getOutboundNeighbors(
  index: GraphIndex,
  nodeId: string
): GraphNeighbor[] {
  const adjacencyEntries = index.outbound.get(nodeId) || [];
  const neighbors: GraphNeighbor[] = [];

  for (const entry of adjacencyEntries) {
    const node = index.nodeById.get(entry.nodeId);
    if (node) {
      neighbors.push({
        node,
        viaEdgeType: entry.edgeType,
        direction: 'outbound',
      });
    }
    // Silently skip if neighbor node is missing from index
  }

  return neighbors;
}

/**
 * Gets all inbound neighbors of a node.
 * Resolves each neighbor node from the index and preserves adjacency order.
 * Silently skips neighbors whose nodes are not in the index.
 *
 * @param index - The built graph index
 * @param nodeId - Fully-qualified ID of the target node
 * @returns Array of resolved inbound neighbors in adjacency order
 */
export function getInboundNeighbors(
  index: GraphIndex,
  nodeId: string
): GraphNeighbor[] {
  const adjacencyEntries = index.inbound.get(nodeId) || [];
  const neighbors: GraphNeighbor[] = [];

  for (const entry of adjacencyEntries) {
    const node = index.nodeById.get(entry.nodeId);
    if (node) {
      neighbors.push({
        node,
        viaEdgeType: entry.edgeType,
        direction: 'inbound',
      });
    }
    // Silently skip if neighbor node is missing from index
  }

  return neighbors;
}

/**
 * Gets neighbors in a specified direction.
 * Returns outbound and/or inbound neighbors based on the direction parameter.
 * For 'both', returns outbound neighbors first, then inbound neighbors.
 * Preserves adjacency order within each direction.
 *
 * @param index - The built graph index
 * @param nodeId - Fully-qualified ID of the node
 * @param direction - 'outbound' for forward edges, 'inbound' for backward, 'both' for both
 * @returns Array of resolved neighbors in order: outbound (if applicable), then inbound (if applicable)
 */
export function getNeighbors(
  index: GraphIndex,
  nodeId: string,
  direction: 'outbound' | 'inbound' | 'both'
): GraphNeighbor[] {
  if (direction === 'outbound') {
    return getOutboundNeighbors(index, nodeId);
  } else if (direction === 'inbound') {
    return getInboundNeighbors(index, nodeId);
  } else {
    // direction === 'both'
    return [
      ...getOutboundNeighbors(index, nodeId),
      ...getInboundNeighbors(index, nodeId),
    ];
  }
}
