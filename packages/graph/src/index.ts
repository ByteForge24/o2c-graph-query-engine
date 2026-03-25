// ============================================================================
// CANONICAL GRAPH VOCABULARY (FROZEN)
// ============================================================================

import {
  GRAPH_NODE_TYPES,
  GraphNodeType,
  GRAPH_EDGE_TYPES,
  GraphEdgeType,
} from './vocabulary.js';

export { GRAPH_NODE_TYPES, GraphNodeType, GRAPH_EDGE_TYPES, GraphEdgeType } from './vocabulary.js';

// ============================================================================
// TYPE DEFINITIONS - STRUCTURAL GRAPH CONTRACT
// ============================================================================

/**
 * Represents a node in the O2C flow graph.
 * All nodes are typed according to the frozen vocabulary and include payload data.
 */
export type GraphNode = {
  id: string;
  type: GraphNodeType;
  data: Record<string, unknown>;
  label?: string;
};

/**
 * Represents an edge (relationship) in the O2C flow graph.
 * All edges are typed according to the frozen vocabulary.
 */
export type GraphEdge = {
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
};

/**
 * Statistics about a built graph.
 * Summarizes node and edge composition by type.
 */
export type GraphStats = {
  totalNodes: number;
  totalEdges: number;
  nodeBreakdown: Partial<Record<GraphNodeType, number>>;
  edgeBreakdown: Partial<Record<GraphEdgeType, number>>;
};

/**
 * Basic graph structure: nodes and edges only.
 * Used by in-memory builder and intermediate results.
 */
export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/**
 * Complete graph structure with optional statistics.
 * Used by DB-backed builder and final results.
 */
export type Graph = GraphData & {
  stats?: GraphStats;
};

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

/**
 * Alias for GraphNode.
 * Maintained for compatibility with existing code.
 */
export type Node = GraphNode;

/**
 * Alias for GraphEdge.
 * Maintained for compatibility with existing code.
 */
export type Edge = GraphEdge;

// ============================================================================
// RELATIONSHIP CONFIGURATION - O2C TRAVERSAL CONTRACT
// ============================================================================

/**
 * Describes a directed relationship between two node types in the O2C graph.
 * Defines vocabulary (edge type) and optional matching metadata for builders.
 */
export type GraphRelationshipRule = {
  sourceType: GraphNodeType;
  targetType: GraphNodeType;
  edgeType: GraphEdgeType;
  edgeLabel: string;
  // DB-builder specific: fields to match for edge creation
  sourceKeyField: string;
  targetKeyField: string;
};

/**
 * Canonical relationship rules for forward O2C traversal (Order → Payment).
 * Source of truth for all graph builders.
 * Order matters: relationships are listed in traversal sequence.
 */
export const GRAPH_RELATIONSHIPS: readonly GraphRelationshipRule[] = [
  // Order → OrderItem
  {
    sourceType: GRAPH_NODE_TYPES.SALES_ORDER,
    targetType: GRAPH_NODE_TYPES.SALES_ORDER_ITEM,
    edgeType: GRAPH_EDGE_TYPES.ORDER_TO_ITEM,
    edgeLabel: 'contains',
    sourceKeyField: 'id',
    targetKeyField: 'orderId',
  },
  // OrderItem → DeliveryItem
  {
    sourceType: GRAPH_NODE_TYPES.SALES_ORDER_ITEM,
    targetType: GRAPH_NODE_TYPES.DELIVERY_ITEM,
    edgeType: GRAPH_EDGE_TYPES.ITEM_TO_DELIVERY,
    edgeLabel: 'delivered via',
    sourceKeyField: 'orderId',
    targetKeyField: 'orderId',
  },
  // DeliveryItem → BillingDocumentItem
  {
    sourceType: GRAPH_NODE_TYPES.DELIVERY_ITEM,
    targetType: GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM,
    edgeType: GRAPH_EDGE_TYPES.DELIVERY_TO_BILLING_ITEM,
    edgeLabel: 'billed from',
    sourceKeyField: 'deliveryId',
    targetKeyField: 'deliveryId',
  },
  // BillingDocumentItem → BillingDocument
  {
    sourceType: GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM,
    targetType: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
    edgeType: GRAPH_EDGE_TYPES.BILLING_ITEM_TO_DOCUMENT,
    edgeLabel: 'part of',
    sourceKeyField: 'billingId',
    targetKeyField: 'id',
  },
  // BillingDocument → JournalEntry
  {
    sourceType: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
    targetType: GRAPH_NODE_TYPES.JOURNAL_ENTRY,
    edgeType: GRAPH_EDGE_TYPES.BILLING_TO_JOURNAL,
    edgeLabel: 'recorded in',
    sourceKeyField: 'accountingDocument',
    targetKeyField: 'accountingDocument',
  },
  // BillingDocument → Payment
  {
    sourceType: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
    targetType: GRAPH_NODE_TYPES.PAYMENT,
    edgeType: GRAPH_EDGE_TYPES.BILLING_TO_PAYMENT,
    edgeLabel: 'paid by',
    sourceKeyField: 'accountingDocument',
    targetKeyField: 'accountingDocument',
  },
] as const;

// ============================================================================
// QUERY REQUEST TYPES (Phase 3.2+)
// ============================================================================

export {
  QueryIntent,
  QueryDirection,
  QueryStartNode,
  GraphQueryRequest,
  isValidQueryIntent,
  isValidQueryDirection,
  // Result types (Phase 3.2.2)
  GraphQueryResolvedNode,
  GraphQueryPath,
  GraphQueryMatch,
  GraphQueryEvidence,
  GraphQueryMissingFlow,
  GraphQueryMeta,
  GraphQueryResult,
  // Validation types and utilities (Phase 3.2.3)
  GraphQueryValidationError,
  GraphQueryValidationResult,
  isValidGraphNodeType,
  isPlainObject,
  validateGraphQueryRequest,
} from './query.js';

// ============================================================================
// CANONICAL EXAMPLE QUERIES (Phase 3.2.4)
// ============================================================================

export {
  EXAMPLE_TRACE_ORDER_TO_DELIVERY,
  EXAMPLE_TRACE_ORDER_TO_BILLING,
  EXAMPLE_TRACE_ORDER_TO_PAYMENT,
  EXAMPLE_TRACE_BILLING_TO_ORDER,
  EXAMPLE_DETECT_MISSING_PAYMENT,
  GRAPH_QUERY_EXAMPLES,
} from './queryExamples.js';

// ============================================================================
// GRAPH INDEXING (Phase 3.3.1-3.3.3)
// ============================================================================

export {
  GraphAdjacencyEntry,
  GraphIndex,
  buildGraphIndex,
  extractBusinessIdFromNodeId,
  getNodeByTypeAndBusinessId,
  GraphNeighbor,
  getOutboundNeighbors,
  getInboundNeighbors,
  getNeighbors,
} from './indexing.js';

// ============================================================================
// PATH RECONSTRUCTION (Phase 3.3.4)
// ============================================================================

export {
  GraphTraversalPredecessor,
  reconstructPath,
} from './paths.js';

// ============================================================================
// QUERY EXECUTION ENGINE (Phase 3.4.1-3.4.4)
// ============================================================================

export {
  resolveStartNode,
  GraphBfsTraversalResult,
  runBoundedBfs,
  GraphQueryMatchExtractionResult,
  extractMatchesAndPaths,
  detectMissingFlows,
} from './execution.js';

// ============================================================================
// QUERY EXECUTION SERVICE (Phase 3.5.1)
// ============================================================================

export {
  executeGraphQuery,
} from './queryService.js';
