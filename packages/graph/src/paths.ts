/**
 * Path Reconstruction and Result Utilities
 * Converts predecessor chains into deterministic GraphQueryPath results.
 * Phase 3.3.4: Infrastructure for BFS traversal result building.
 */

import { GraphEdgeType, GraphQueryPath } from './index.js';

// ============================================================================
// TRAVERSAL TRACKING TYPES
// ============================================================================

/**
 * Represents a single step in a traversal predecessor chain.
 * Used to reconstruct paths from BFS or other graph traversal algorithms.
 */
export type GraphTraversalPredecessor = {
  /** Fully-qualified ID of the previous node in the path */
  previousNodeId: string;
  /** Type of the edge traversed to reach the current node */
  viaEdgeType: GraphEdgeType;
};

// ============================================================================
// PATH RECONSTRUCTION
// ============================================================================

/**
 * Reconstructs a deterministic path from a predecessor chain.
 * Walks backward from the end node using the predecessor map until reaching the start node.
 * Returns a GraphQueryPath suitable for query results.
 *
 * Special cases:
 * - If start === end: returns zero-hop path (single node, no edges)
 * - If end node has no predecessor entry and end !== start: returns undefined
 * - If the chain cannot reach start: returns undefined
 * - If a cycle is detected: returns undefined
 *
 * @param predecessors - Map from node ID to its predecessor in the traversal
 * @param startNodeId - Fully-qualified ID of the starting node
 * @param endNodeId - Fully-qualified ID of the ending node
 * @returns GraphQueryPath if successful, undefined if broken chain or cycle
 */
export function reconstructPath(
  predecessors: Map<string, GraphTraversalPredecessor>,
  startNodeId: string,
  endNodeId: string
): GraphQueryPath | undefined {
  // Special case: zero-hop path (start === end)
  if (startNodeId === endNodeId) {
    return {
      nodeIds: [startNodeId],
      edgeTypes: [],
      length: 0,
    };
  }

  // Reconstruct by walking backward from endNodeId
  const nodeIds: string[] = [];
  const edgeTypes: GraphEdgeType[] = [];
  const visited = new Set<string>();

  let currentNodeId = endNodeId;

  // Walk backward until we reach startNodeId
  while (currentNodeId !== startNodeId) {
    // Cycle detection
    if (visited.has(currentNodeId)) {
      return undefined;
    }
    visited.add(currentNodeId);

    // Get predecessor
    const pred = predecessors.get(currentNodeId);
    if (!pred) {
      // Broken chain: no predecessor found
      return undefined;
    }

    nodeIds.unshift(currentNodeId);
    edgeTypes.unshift(pred.viaEdgeType);

    currentNodeId = pred.previousNodeId;
  }

  // Add the start node at the beginning
  nodeIds.unshift(startNodeId);

  return {
    nodeIds,
    edgeTypes,
    length: edgeTypes.length,
  };
}
