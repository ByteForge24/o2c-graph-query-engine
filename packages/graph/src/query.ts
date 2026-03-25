/**
 * Structured Query Types for Graph Traversal
 * Defines the contract for deterministic, intent-driven queries over the O2C graph
 * Execution and validation are separate (Phase 3.2.3+)
 */

import { GraphNodeType, GraphEdgeType, GRAPH_NODE_TYPES } from './vocabulary.js';

// ============================================================================
// QUERY INTENT
// ============================================================================

/**
 * Enumeration of high-level query intents.
 * Each intent represents a different traversal pattern or analytical goal.
 */
export type QueryIntent =
  | 'trace_forward'       // Forward traversal following the O2C flow (Order → Payment)
  | 'trace_backward'      // Backward traversal from a node to its origins
  | 'find_related'        // Find all nodes related to the start node within a depth limit
  | 'detect_missing_flow'; // Detect if expected flow steps are missing in the graph

// ============================================================================
// QUERY DIRECTION
// ============================================================================

/**
 * Direction of traversal relative to the relationship direction.
 * Controls whether to follow edges from source to target or vice versa.
 */
export type QueryDirection =
  | 'outbound' // Follow edges in their canonical direction (source → target)
  | 'inbound'  // Follow edges in reverse (target ← source)
  | 'both';    // Follow both directions

// ============================================================================
// QUERY START NODE
// ============================================================================

/**
 * Specifies the starting point for a query.
 * Identifies a concrete node in the graph by type and ID.
 */
export type QueryStartNode = {
  /** Canonical node type from GRAPH_NODE_TYPES */
  type: GraphNodeType;
  /** Node ID (typically {type}:id format in the graph) */
  id: string;
};

// ============================================================================
// GRAPH QUERY REQUEST
// ============================================================================

/**
 * Structured request for deterministic graph traversal.
 * Represents a single, well-defined query over the O2C graph.
 *
 * Design principles:
 * - Deterministic: same request always produces same result
 * - Intent-driven: intent conveys traversal semantics, not just mechanics
 * - Type-safe: uses frozen vocabulary and canonical types
 * - Extensible: filters placeholder allows future filtering logic
 * - LLM-friendly: structured and unambiguous representation
 */
export type GraphQueryRequest = {
  /** High-level intent for this query */
  intent: QueryIntent;

  /** Starting node for the traversal */
  startNode: QueryStartNode;

  /** Optional: Restrict results to this node type */
  targetNodeType?: GraphNodeType;

  /** Optional: Maximum traversal depth (hops); undefined = unlimited */
  maxDepth?: number;

  /** Optional: Direction of traversal; default = 'outbound' */
  direction?: QueryDirection;

  /**
   * Optional: Filter criteria for results (reserved for future phases).
   * Currently ignored; planned for Phase 3.2.3 or later.
   * Format: arbitrary key-value pairs for filtering logic to interpret.
   */
  filters?: Record<string, unknown>;
};

// ============================================================================
// QUERY CONVENIENCE TYPES
// ============================================================================

/**
 * Type guard for checking if a value is a valid QueryIntent
 */
export function isValidQueryIntent(value: unknown): value is QueryIntent {
  return (
    typeof value === 'string' &&
    ['trace_forward', 'trace_backward', 'find_related', 'detect_missing_flow'].includes(
      value
    )
  );
}

/**
 * Type guard for checking if a value is a valid QueryDirection
 */
export function isValidQueryDirection(value: unknown): value is QueryDirection {
  return (
    typeof value === 'string' &&
    ['outbound', 'inbound', 'both'].includes(value)
  );
}

// ============================================================================
// QUERY VALIDATION (Phase 3.2.3)
// ============================================================================

/**
 * Represents a single validation error for a specific field.
 * Errors are deterministic and field-specific for diagnostic purposes.
 */
export type GraphQueryValidationError = {
  /** Path to the field that failed validation (e.g., "intent", "startNode.type") */
  field: string;
  /** Human-readable message describing the validation failure */
  message: string;
};

/**
 * Result of validating a GraphQueryRequest from unknown input.
 * Either contains a valid, typed request or a list of validation errors.
 */
export type GraphQueryValidationResult = {
  /** Whether validation succeeded */
  ok: boolean;
  /** The valid request, only present if ok is true */
  value?: GraphQueryRequest;
  /** All discovered validation errors */
  errors: GraphQueryValidationError[];
};

/**
 * Type guard to check if a value is a valid GraphNodeType.
 * Derives valid types from GRAPH_NODE_TYPES, the frozen canonical vocabulary.
 */
export function isValidGraphNodeType(value: unknown): value is GraphNodeType {
  const validTypes = Object.values(GRAPH_NODE_TYPES);
  return typeof value === 'string' && validTypes.includes(value as GraphNodeType);
}

/**
 * Checks if a value is a plain object (not array, null, or primitive).
 * Useful for distinguishing plain objects from other types.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Validates a GraphQueryRequest from unknown input.
 * Returns a deterministic validation result with typed value or field-specific errors.
 *
 * Validation rules:
 * - `intent` must be one of QueryIntent
 * - `startNode` must be a plain object
 * - `startNode.type` must be a valid GraphNodeType
 * - `startNode.id` must be a non-empty string
 * - `targetNodeType`, if present, must be a valid GraphNodeType
 * - `maxDepth`, if present, must be a positive integer > 0
 * - `direction`, if present, must be one of QueryDirection
 * - `filters`, if present, must be a plain object
 */
export function validateGraphQueryRequest(input: unknown): GraphQueryValidationResult {
  const errors: GraphQueryValidationError[] = [];

  // Input must be a plain object
  if (!isPlainObject(input)) {
    errors.push({
      field: 'query',
      message: 'Input must be a plain object',
    });
    return { ok: false, errors };
  }

  // Narrow type for input to plain object for subsequent checks
  const query = input as Record<string, unknown>;

  // Validate intent (required)
  if (!('intent' in query)) {
    errors.push({
      field: 'intent',
      message: 'Required field missing',
    });
  } else if (!isValidQueryIntent(query.intent)) {
    errors.push({
      field: 'intent',
      message: `Must be one of: 'trace_forward', 'trace_backward', 'find_related', 'detect_missing_flow'`,
    });
  }

  // Validate startNode (required)
  let validStartNode: QueryStartNode | undefined;
  if (!('startNode' in query)) {
    errors.push({
      field: 'startNode',
      message: 'Required field missing',
    });
  } else if (!isPlainObject(query.startNode)) {
    errors.push({
      field: 'startNode',
      message: 'Must be a plain object',
    });
  } else {
    const startNode = query.startNode as Record<string, unknown>;

    // Validate startNode.type
    if (!('type' in startNode)) {
      errors.push({
        field: 'startNode.type',
        message: 'Required field missing',
      });
    } else if (!isValidGraphNodeType(startNode.type)) {
      errors.push({
        field: 'startNode.type',
        message: 'Must be a valid GraphNodeType (SalesOrder, SalesOrderItem, DeliveryItem, BillingDocument, BillingDocumentItem, JournalEntry, or Payment)',
      });
    }

    // Validate startNode.id
    if (!('id' in startNode)) {
      errors.push({
        field: 'startNode.id',
        message: 'Required field missing',
      });
    } else if (typeof startNode.id !== 'string' || startNode.id.trim().length === 0) {
      errors.push({
        field: 'startNode.id',
        message: 'Must be a non-empty string',
      });
    }

    // If startNode is valid, capture it
    if (
      'type' in startNode &&
      'id' in startNode &&
      isValidGraphNodeType(startNode.type) &&
      typeof startNode.id === 'string' &&
      startNode.id.trim().length > 0
    ) {
      validStartNode = {
        type: startNode.type as GraphNodeType,
        id: startNode.id,
      };
    }
  }

  // Validate optional targetNodeType
  if ('targetNodeType' in query && query.targetNodeType !== undefined) {
    if (!isValidGraphNodeType(query.targetNodeType)) {
      errors.push({
        field: 'targetNodeType',
        message: 'Must be a valid GraphNodeType if provided',
      });
    }
  }

  // Validate optional maxDepth
  if ('maxDepth' in query && query.maxDepth !== undefined) {
    if (typeof query.maxDepth !== 'number' || !Number.isInteger(query.maxDepth) || query.maxDepth <= 0) {
      errors.push({
        field: 'maxDepth',
        message: 'Must be a positive integer greater than 0 if provided',
      });
    }
  }

  // Validate optional direction
  if ('direction' in query && query.direction !== undefined) {
    if (!isValidQueryDirection(query.direction)) {
      errors.push({
        field: 'direction',
        message: "Must be one of: 'outbound', 'inbound', 'both' if provided",
      });
    }
  }

  // Validate optional filters
  if ('filters' in query && query.filters !== undefined) {
    if (!isPlainObject(query.filters)) {
      errors.push({
        field: 'filters',
        message: 'Must be a plain object if provided',
      });
    }
  }

  // If any errors, return early
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // All validation passed; construct typed value
  // At this point, validStartNode is guaranteed to be defined due to error checks above
  const validRequest: GraphQueryRequest = {
    intent: query.intent as QueryIntent,
    startNode: validStartNode!,
    ...(query.targetNodeType !== undefined && { targetNodeType: query.targetNodeType as GraphNodeType }),
    ...(query.maxDepth !== undefined && { maxDepth: query.maxDepth as number }),
    ...(query.direction !== undefined && { direction: query.direction as QueryDirection }),
    ...(query.filters !== undefined && { filters: query.filters as Record<string, unknown> }),
  };

  return { ok: true, value: validRequest, errors: [] };
}

// ============================================================================
// GRAPH QUERY RESULT TYPES
// ============================================================================

/**
 * Represents a resolved node from the graph, matching canonical vocabulary.
 * Used as the concrete target of a query result.
 */
export type GraphQueryResolvedNode = {
  /** Graph node ID: fully-qualified with type prefix (e.g., "SalesOrder:12345") */
  nodeId: string;
  /** Canonical node type from GRAPH_NODE_TYPES */
  type: GraphNodeType;
  /** Business/domain ID: the plain identifier without type prefix (e.g., "12345") */
  businessId: string;
};

/**
 * Represents a deterministic traversal path through the graph.
 * Each path shows a sequence of node hops and the edge types that connect them.
 */
export type GraphQueryPath = {
  /** Ordered list of node IDs along the path from start to end */
  nodeIds: string[];
  /** Ordered list of edge types connecting consecutive nodes */
  edgeTypes: GraphEdgeType[];
  /** Path length (number of hops/edges); length = edgeTypes.length */
  length: number;
};

/**
 * Represents a final matched node from the query result.
 * Typically populated for `trace_forward`, `trace_backward`, or `find_related` intents.
 */
export type GraphQueryMatch = {
  /** Graph node ID: fully-qualified with type prefix (e.g., "SalesOrder:12345") */
  nodeId: string;
  /** Canonical node type from GRAPH_NODE_TYPES */
  type: GraphNodeType;
  /** Business/domain ID: the plain identifier without type prefix (e.g., "12345") */
  businessId: string;
};

/**
 * Provides grounding evidence for traversal decisions.
 * Shows which nodes and edges were actually visited during execution.
 */
export type GraphQueryEvidence = {
  /** Set of all node IDs visited during traversal */
  visitedNodeIds: string[];
  /** All directed edges traversed (source → target) */
  traversedEdges: Array<{
    /** Fully-qualified source node ID */
    source: string;
    /** Fully-qualified target node ID */
    target: string;
    /** Canonical edge type that was traversed */
    type: GraphEdgeType;
  }>;
};

/**
 * Describes a missing flow step in the O2C chain.
 * Primarily used for the `detect_missing_flow` intent.
 */
export type GraphQueryMissingFlow = {
  /** Expected canonical node type in the O2C chain */
  expectedNodeType: GraphNodeType;
  /** Human-readable reason why this step is missing (e.g., "No JournalEntry found for this billing document") */
  reason: string;
};

/**
 * Metadata about query execution and traversal.
 * Useful for debugging, understanding scope, and guardrails.
 */
export type GraphQueryMeta = {
  /** Intent that was executed */
  intent: QueryIntent;
  /** Direction that was used for traversal */
  direction: QueryDirection;
  /** Maximum depth applied (undefined = unlimited) */
  maxDepth?: number;
  /** Total nodes visited during traversal */
  visitedNodeCount: number;
  /** Total edges traversed during traversal */
  traversedEdgeCount: number;
};

/**
 * Comprehensive result of a deterministic graph query.
 * Contains resolved nodes, matched results, traversal paths, and grounding evidence.
 *
 * Design principles:
 * - `ok` indicates whether the query succeeded (true = no engine errors)
 * - `matches` are the final result nodes (empty if no matches)
 * - `paths` are deterministic traversal sequences (may be empty)
 * - `evidence` provides grounding in actual graph state
 * - `missingFlows` is optional, primarily for `detect_missing_flow` intent
 * - `error` is only set on deterministic engine/API failures, not hallucinated prose
 */
export type GraphQueryResult = {
  /** Whether the query executed successfully (true = no engine errors) */
  ok: boolean;
  /** The request that produced this result */
  query: GraphQueryRequest;
  /** The resolved starting node (undefined if query failed to resolve it) */
  resolvedStartNode?: GraphQueryResolvedNode;
  /** Zero or more matched result nodes */
  matches: GraphQueryMatch[];
  /** Zero or more traversal paths from start to matches */
  paths: GraphQueryPath[];
  /** Evidence showing all nodes and edges visited during execution */
  evidence: GraphQueryEvidence;
  /** Optional: Missing flow steps (relevant for `detect_missing_flow` intent) */
  missingFlows?: GraphQueryMissingFlow[];
  /** Metadata about the query execution */
  meta: GraphQueryMeta;
  /** Optional: Error message if ok is false */
  error?: string;
};
