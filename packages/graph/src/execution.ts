/**
 * Query Execution Engine - Start Node Resolution & BFS Traversal & Target Matching & Missing-Flow Detection
 * Resolves query start nodes, performs bounded graph traversal, extracts matched paths, and detects missing flows.
 * Phase 3.4.1-3.4.4: Core execution engine primitives.
 */

import {
  GraphIndex,
  GraphNode,
  GraphQueryRequest,
  GraphQueryResolvedNode,
  GraphEdgeType,
  GraphQueryMatch,
  GraphQueryPath,
  GraphQueryMissingFlow,
} from './index.js';
import { getNodeByTypeAndBusinessId, getNeighbors, extractBusinessIdFromNodeId } from './indexing.js';
import { GraphTraversalPredecessor, reconstructPath } from './paths.js';

// ============================================================================
// START NODE RESOLUTION
// ============================================================================

/**
 * Converts a GraphNode to a GraphQueryResolvedNode, deriving the business ID.
 * Helper for constructing resolved nodes during query execution.
 *
 * @param node - The matched graph node
 * @param businessId - The business/domain ID from the query request
 * @returns Resolved node suitable for query results
 */
function toResolvedNode(
  node: GraphNode,
  businessId: string
): GraphQueryResolvedNode {
  return {
    nodeId: node.id,
    type: node.type,
    businessId,
  };
}

/**
 * Resolves the start node for a query from the graph index.
 * Performs exact lookup using the validated request parameters.
 *
 * Assumes the request has already been validated by validateGraphQueryRequest().
 * No fallback matching or fuzzy search is attempted.
 *
 * @param index - The built graph index
 * @param request - A validated GraphQueryRequest
 * @returns Resolved start node if found in the index, undefined otherwise
 */
export function resolveStartNode(
  index: GraphIndex,
  request: GraphQueryRequest
): GraphQueryResolvedNode | undefined {
  // Extract parameters from the validated request
  const { type, id: businessId } = request.startNode;

  // Look up the node by type and business ID
  const node = getNodeByTypeAndBusinessId(index, type, businessId);

  if (!node) {
    return undefined;
  }

  // Convert to resolved node for query results
  return toResolvedNode(node, businessId);
}

// ============================================================================
// BFS TRAVERSAL
// ============================================================================

/**
 * Represents a queued node for BFS expansion.
 * Tracks the node ID and its depth for bounded traversal.
 */
interface BfsQueueEntry {
  nodeId: string;
  depth: number;
}

/**
 * Result of a bounded BFS traversal over the graph.
 * Captures visited nodes, edges, predecessors, and depth information.
 * Used to build query results in later phases.
 */
export type GraphBfsTraversalResult = {
  /** All node IDs visited during traversal, in discovery order */
  visitedNodeIds: string[];
  /** All edges traversed, in discovery order */
  traversedEdges: Array<{
    /** Source node of the traversal edge */
    source: string;
    /** Target node of the traversal edge */
    target: string;
    /** Type of the edge */
    type: GraphEdgeType;
  }>;
  /** Predecessor map for path reconstruction (does not include start node) */
  predecessors: Map<string, GraphTraversalPredecessor>;
  /** Depth of each visited node (start node has depth 0) */
  depthByNodeId: Map<string, number>;
};

/**
 * Performs a bounded breadth-first search traversal from a start node.
 * Explores the graph in deterministic BFS order, respecting direction and depth constraints.
 *
 * The traversal captures:
 * - Visited nodes in discovery order
 * - Traversed edges in discovery order
 * - Predecessor information for path reconstruction
 * - Depth information for each discovered node
 *
 * Traversal Rules:
 * - Start node is at depth 0
 * - Neighbors are expanded in helper-provided order
 * - If maxDepth is defined, no neighbors are expanded at or beyond maxDepth
 * - If maxDepth is undefined, traversal is unbounded
 * - First discovery of a node wins (no revisits)
 * - The start node is not included in predecessors
 *
 * @param index - The built graph index
 * @param startNodeId - Fully-qualified ID of the starting node
 * @param direction - Traversal direction: 'outbound', 'inbound', or 'both'
 * @param maxDepth - Maximum hop count (undefined = unbounded)
 * @returns Traversal result with visited nodes, edges, predecessors, and depths
 */
export function runBoundedBfs(
  index: GraphIndex,
  startNodeId: string,
  direction: 'outbound' | 'inbound' | 'both',
  maxDepth?: number
): GraphBfsTraversalResult {
  // Check if start node exists in the index
  const startNode = index.nodeById.get(startNodeId);
  if (!startNode) {
    // Return empty traversal result
    return {
      visitedNodeIds: [],
      traversedEdges: [],
      predecessors: new Map(),
      depthByNodeId: new Map(),
    };
  }

  // Initialize result tracking
  const result: GraphBfsTraversalResult = {
    visitedNodeIds: [],
    traversedEdges: [],
    predecessors: new Map(),
    depthByNodeId: new Map(),
  };

  // Initialize BFS
  const queue: BfsQueueEntry[] = [];
  const discovered = new Set<string>();

  // Enqueue start node
  queue.push({ nodeId: startNodeId, depth: 0 });
  discovered.add(startNodeId);
  result.visitedNodeIds.push(startNodeId);
  result.depthByNodeId.set(startNodeId, 0);

  // BFS loop
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = current.depth;

    // Check if we should expand further
    const shouldExpand = maxDepth === undefined || currentDepth < maxDepth;

    if (!shouldExpand) {
      // Don't expand neighbors beyond maxDepth
      continue;
    }

    // Get neighbors in the specified direction
    const neighbors = getNeighbors(index, current.nodeId, direction);

    // Process each neighbor
    for (const neighbor of neighbors) {
      const neighborNodeId = neighbor.node.id;

      // Skip if already discovered (first discovery wins)
      if (discovered.has(neighborNodeId)) {
        continue;
      }

      // Mark as discovered
      discovered.add(neighborNodeId);
      const nextDepth = currentDepth + 1;

      // Add to result
      result.visitedNodeIds.push(neighborNodeId);
      result.depthByNodeId.set(neighborNodeId, nextDepth);

      // Record predecessor (for path reconstruction)
      result.predecessors.set(neighborNodeId, {
        previousNodeId: current.nodeId,
        viaEdgeType: neighbor.viaEdgeType,
      });

      // Record traversed edge
      result.traversedEdges.push({
        source: current.nodeId,
        target: neighborNodeId,
        type: neighbor.viaEdgeType,
      });

      // Enqueue for further expansion
      queue.push({ nodeId: neighborNodeId, depth: nextDepth });
    }
  }

  return result;
}

// ============================================================================
// TARGET MATCHING AND PATH EXTRACTION
// ============================================================================

/**
 * Result of target matching and path extraction.
 * Contains matched nodes and reconstructed paths from start to each match.
 */
export type GraphQueryMatchExtractionResult = {
  /** Matched nodes, in discovery order from BFS traversal */
  matches: GraphQueryMatch[];
  /** Reconstructed paths, in same order as matches */
  paths: GraphQueryPath[];
};

/**
 * Converts a GraphNode to a GraphQueryMatch, deriving the business ID.
 * Helper for constructing matched nodes during query execution.
 *
 * @param node - The graph node to convert
 * @returns Match record with full nodeId, type, and extracted businessId
 */
function toQueryMatch(node: GraphNode): GraphQueryMatch {
  return {
    nodeId: node.id,
    type: node.type,
    businessId: extractBusinessIdFromNodeId(node.id),
  };
}

/**
 * Extracts matched nodes and reconstructs paths from BFS traversal results.
 * Filters visited nodes by targetNodeType (if provided) and reconstructs paths
 * from the start node to each match using the predecessor chain.
 *
 * Matching Behavior:
 * - If request.targetNodeType is provided: select visited nodes matching the target type
 * - If request.targetNodeType is not provided: treat all visited nodes except start as matches
 * - Start node is excluded unless it matches the target type
 * - Match order follows traversal.visitedNodeIds discovery order
 * - Path reconstruction uses predecessors from the traversal
 * - If path reconstruction fails (broken chain or cycle), the path is omitted
 *
 * @param index - The built graph index
 * @param request - A validated GraphQueryRequest (determines targetNodeType filter)
 * @param resolvedStartNode - The resolved start node from query execution
 * @param traversal - The BFS traversal result with visited nodes, edges, and predecessors
 * @returns Extraction result with matches and paths in discovery order
 */
export function extractMatchesAndPaths(
  index: GraphIndex,
  request: GraphQueryRequest,
  resolvedStartNode: GraphQueryResolvedNode,
  traversal: GraphBfsTraversalResult
): GraphQueryMatchExtractionResult {
  const matches: GraphQueryMatch[] = [];
  const paths: GraphQueryPath[] = [];

  // Iterate over visited nodes in discovery order
  for (const nodeId of traversal.visitedNodeIds) {
    // Skip the start node
    if (nodeId === resolvedStartNode.nodeId) {
      continue;
    }

    // Look up the node in the index
    const node = index.nodeById.get(nodeId);
    if (!node) {
      // Silent skip: node not in index (should not happen with valid traversal)
      continue;
    }

    // Apply targetNodeType filter if provided
    if (request.targetNodeType !== undefined) {
      if (node.type !== request.targetNodeType) {
        continue;
      }
    }

    // Convert node to match
    const match = toQueryMatch(node);
    matches.push(match);

    // Reconstruct path from start to this matched node
    const path = reconstructPath(
      traversal.predecessors,
      resolvedStartNode.nodeId,
      nodeId
    );

    // Include path if reconstruction succeeded, otherwise omit
    if (path !== undefined) {
      paths.push(path);
    }
  }

  return {
    matches,
    paths,
  };
}

// ============================================================================
// MISSING-FLOW DETECTION
// ============================================================================

/**
 * Builds a deterministic reason string for a missing-flow detection.
 * Describes the expected but unreachable target node type from the start node.
 *
 * @param startNodeType - Type of the starting node
 * @param startNodeBusinessId - Business ID of the starting node
 * @param targetNodeType - Expected target node type
 * @returns Reason string
 */
function buildMissingFlowReason(
  startNodeType: string,
  startNodeBusinessId: string,
  targetNodeType: string
): string {
  return `No reachable ${targetNodeType} found from ${startNodeType} ${startNodeBusinessId} within the query constraints`;
}

/**
 * Detects missing-flow outcomes for detect_missing_flow queries.
 * Reports when expected target nodes are unreachable under current query constraints.
 *
 * Detection Behavior:
 * - If request.intent !== 'detect_missing_flow', return []
 * - If request.targetNodeType is undefined, return []
 * - If matches.length > 0, return [] (target was reached, no flow is missing)
 * - If matches.length === 0, return a single missing-flow record (target was not reached)
 *
 * @param request - A validated GraphQueryRequest
 * @param resolvedStartNode - The resolved start node from query execution
 * @param matches - Matched nodes from the traversal (typically from extractMatchesAndPaths)
 * @returns Array of missing-flow records (empty or single-element)
 */
export function detectMissingFlows(
  request: GraphQueryRequest,
  resolvedStartNode: GraphQueryResolvedNode,
  matches: GraphQueryMatch[]
): GraphQueryMissingFlow[] {
  // Not a missing-flow detection query
  if (request.intent !== 'detect_missing_flow') {
    return [];
  }

  // Missing-flow queries require a target node type
  if (request.targetNodeType === undefined) {
    return [];
  }

  // If matches were found, no flow is missing
  if (matches.length > 0) {
    return [];
  }

  // Target was not reached: report missing flow
  const reason = buildMissingFlowReason(
    resolvedStartNode.type,
    resolvedStartNode.businessId,
    request.targetNodeType
  );

  return [
    {
      expectedNodeType: request.targetNodeType,
      reason,
    },
  ];
}
