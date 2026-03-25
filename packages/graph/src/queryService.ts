/**
 * Query Execution Service - Deterministic Graph Query Orchestration
 * Ties together validation, indexing, resolution, traversal, matching, and missing-flow detection.
 * Phase 3.5.1: End-to-end query execution service.
 */

import {
  GraphData,
  Graph,
  GraphQueryRequest,
  GraphQueryResult,
  GraphQueryValidationResult,
  GraphQueryResolvedNode,
  GraphQueryMatch,
  GraphQueryPath,
  GraphQueryMissingFlow,
  GraphQueryEvidence,
  QueryIntent,
  QueryDirection,
  GRAPH_NODE_TYPES,
} from './index.js';
import { validateGraphQueryRequest } from './query.js';
import { buildGraphIndex, GraphIndex } from './indexing.js';
import { resolveStartNode, runBoundedBfs, extractMatchesAndPaths, detectMissingFlows } from './execution.js';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Builds an empty evidence record (no visited nodes or edges).
 */
function buildEmptyEvidence(): GraphQueryEvidence {
  return {
    visitedNodeIds: [],
    traversedEdges: [],
  };
}

/**
 * Builds a deterministic error message from validation errors.
 * Joins all field messages into a single summary.
 */
function buildValidationErrorMessage(validationResult: GraphQueryValidationResult): string {
  const errorMessages = validationResult.errors.map(
    (err) => `${err.field}: ${err.message}`
  );
  return `Validation failed: ${errorMessages.join('; ')}`;
}

/**
 * Builds a deterministic error message for start-node-not-found.
 */
function buildStartNodeNotFoundMessage(
  nodeType: string,
  businessId: string
): string {
  return `Start node not found: ${nodeType} ${businessId}`;
}

/**
 * Builds metadata for a successful query execution, or as fallback structure.
 */
function buildMetaFromRequest(
  request: GraphQueryRequest,
  visitedNodeCount: number = 0,
  traversedEdgeCount: number = 0
) {
  return {
    intent: request.intent,
    direction: request.direction ?? 'outbound' as QueryDirection,
    maxDepth: request.maxDepth,
    visitedNodeCount,
    traversedEdgeCount,
  };
}

/**
 * Creates a minimal placeholder query for use in invalid-input failure results.
 * This satisfies the GraphQueryResult.query requirement when validation fails.
 */
function buildPlaceholderQuery(): GraphQueryRequest {
  return {
    intent: 'find_related' as QueryIntent,
    startNode: {
      type: GRAPH_NODE_TYPES.SALES_ORDER,
      id: '',
    },
  };
}

// ============================================================================
// QUERY EXECUTION SERVICE
// ============================================================================

/**
 * Executes a deterministic graph query end-to-end.
 * Validates input, builds index, resolves start node, traverses graph,
 * extracts matches and paths, detects missing flows, and returns results.
 *
 * Execution Flow:
 * A. Validate input with validateGraphQueryRequest
 * B. If validation fails: return error result with placeholders
 * C. Build graph index with buildGraphIndex
 * D. Resolve start node with resolveStartNode
 * E. If start node not found: return error result
 * F. Run BFS with direction and maxDepth from request
 * G. Extract matches and paths
 * H. Detect missing flows
 * I. Return complete result with ok: true
 *
 * @param graph - The graph structure (GraphData or Graph)
 * @param input - Unknown query input to validate and execute
 * @returns A deterministic GraphQueryResult
 */
export function executeGraphQuery(
  graph: GraphData | Graph,
  input: unknown
): GraphQueryResult {
  // ========== A. VALIDATE INPUT ==========
  const validationResult = validateGraphQueryRequest(input);

  if (!validationResult.ok) {
    // B. VALIDATION FAILURE PATH
    return {
      ok: false,
      query: buildPlaceholderQuery(),
      matches: [],
      paths: [],
      evidence: buildEmptyEvidence(),
      meta: buildMetaFromRequest(buildPlaceholderQuery()),
      error: buildValidationErrorMessage(validationResult),
    };
  }

  const request = validationResult.value!;

  // ========== C. BUILD GRAPH INDEX ==========
  const index = buildGraphIndex(graph);

  // ========== D. RESOLVE START NODE ==========
  const resolvedStartNode = resolveStartNode(index, request);

  if (!resolvedStartNode) {
    // E. START NODE NOT FOUND PATH
    const { type, id: businessId } = request.startNode;
    return {
      ok: false,
      query: request,
      resolvedStartNode: undefined,
      matches: [],
      paths: [],
      evidence: buildEmptyEvidence(),
      meta: buildMetaFromRequest(request),
      error: buildStartNodeNotFoundMessage(type, businessId),
    };
  }

  // ========== F. RUN BFS TRAVERSAL ==========
  const direction = request.direction ?? 'outbound';
  const maxDepth = request.maxDepth;

  const traversal = runBoundedBfs(
    index,
    resolvedStartNode.nodeId,
    direction,
    maxDepth
  );

  // ========== G. EXTRACT MATCHES AND PATHS ==========
  const extraction = extractMatchesAndPaths(
    index,
    request,
    resolvedStartNode,
    traversal
  );

  const matches = extraction.matches;
  const paths = extraction.paths;

  // ========== H. DETECT MISSING FLOWS ==========
  const missingFlows = detectMissingFlows(
    request,
    resolvedStartNode,
    matches
  );

  // ========== I. BUILD SUCCESSFUL RESULT ==========
  const result: GraphQueryResult = {
    ok: true,
    query: request,
    resolvedStartNode,
    matches,
    paths,
    evidence: {
      visitedNodeIds: traversal.visitedNodeIds,
      traversedEdges: traversal.traversedEdges,
    },
    meta: buildMetaFromRequest(
      request,
      traversal.visitedNodeIds.length,
      traversal.traversedEdges.length
    ),
  };

  // Add missingFlows only if non-empty
  if (missingFlows.length > 0) {
    result.missingFlows = missingFlows;
  }

  return result;
}
