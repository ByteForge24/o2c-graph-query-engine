/**
 * Canonical Example Queries for O2C Graph Traversal
 * Demonstrates intended usage patterns for core deterministic use cases.
 * These examples serve as contracts for future API and LLM translation layers.
 */

import { GraphQueryRequest } from './query.js';

/**
 * Trace forward from a SalesOrder to its delivery items.
 * Use case: Find what was delivered for a given order.
 * Depth: 3 hops covers Order → OrderItems → DeliveryItems
 */
export const EXAMPLE_TRACE_ORDER_TO_DELIVERY: GraphQueryRequest = {
  intent: 'trace_forward',
  startNode: {
    type: 'SalesOrder',
    id: '740506',
  },
  targetNodeType: 'DeliveryItem',
  maxDepth: 3,
  direction: 'outbound',
};

/**
 * Trace forward from a SalesOrder to its billing document.
 * Use case: Find the billing document(s) generated from an order.
 * Depth: 5 hops covers Order → OrderItems → DeliveryItems → BillingItems → BillingDocument
 */
export const EXAMPLE_TRACE_ORDER_TO_BILLING: GraphQueryRequest = {
  intent: 'trace_forward',
  startNode: {
    type: 'SalesOrder',
    id: '740506',
  },
  targetNodeType: 'BillingDocument',
  maxDepth: 5,
  direction: 'outbound',
};

/**
 * Trace forward from a SalesOrder all the way to payment.
 * Use case: Find the payment(s) that settled an order (full O2C flow).
 * Depth: 6 hops covers entire O2C chain including journal entries and payments.
 */
export const EXAMPLE_TRACE_ORDER_TO_PAYMENT: GraphQueryRequest = {
  intent: 'trace_forward',
  startNode: {
    type: 'SalesOrder',
    id: '740506',
  },
  targetNodeType: 'Payment',
  maxDepth: 6,
  direction: 'outbound',
};

/**
 * Trace backward from a BillingDocument to its originating SalesOrder.
 * Use case: Reverse lookup from a billing doc back to the original order.
 * Depth: 5 hops covers entire reverse chain.
 */
export const EXAMPLE_TRACE_BILLING_TO_ORDER: GraphQueryRequest = {
  intent: 'trace_backward',
  startNode: {
    type: 'BillingDocument',
    id: '90504274',
  },
  targetNodeType: 'SalesOrder',
  maxDepth: 5,
  direction: 'inbound',
};

/**
 * Detect missing payment flow for a billing document.
 * Use case: Check if a billing document has a corresponding payment in the graph.
 * If detect_missing_flow returns matches, no flow gaps exist.
 * If it returns no matches, the payment is missing from the graph.
 * Depth: 2 hops covers BillingDocument → JournalEntry → Payment
 */
export const EXAMPLE_DETECT_MISSING_PAYMENT: GraphQueryRequest = {
  intent: 'detect_missing_flow',
  startNode: {
    type: 'BillingDocument',
    id: '90504274',
  },
  targetNodeType: 'Payment',
  maxDepth: 2,
  direction: 'outbound',
};

/**
 * Grouped collection of all canonical example queries.
 * Useful for iteration, documentation, or test data generation.
 */
export const GRAPH_QUERY_EXAMPLES = {
  TRACE_ORDER_TO_DELIVERY: EXAMPLE_TRACE_ORDER_TO_DELIVERY,
  TRACE_ORDER_TO_BILLING: EXAMPLE_TRACE_ORDER_TO_BILLING,
  TRACE_ORDER_TO_PAYMENT: EXAMPLE_TRACE_ORDER_TO_PAYMENT,
  TRACE_BILLING_TO_ORDER: EXAMPLE_TRACE_BILLING_TO_ORDER,
  DETECT_MISSING_PAYMENT: EXAMPLE_DETECT_MISSING_PAYMENT,
} as const;
