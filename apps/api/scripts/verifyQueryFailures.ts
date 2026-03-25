#!/usr/bin/env ts-node

/**
 * Query Failures & Anomalies Verification - End-to-End Failure Cases
 * Validates executeGraphQuery() failure modes and edge cases on in-memory fixture graphs.
 * Verifies deterministic error handling without framework dependencies.
 *
 * Run with: pnpm --filter api run query:failures
 */

import {
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  executeGraphQuery,
} from 'graph';

import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphQueryResult,
  GraphQueryRequest,
} from 'graph';

// ============================================================================
// FIXTURE GRAPHS
// ============================================================================

/**
 * Builds a complete fixture graph following the O2C flow.
 * SalesOrder -> SalesOrderItems -> DeliveryItems -> BillingItems -> BillingDocument -> Payment -> JournalEntry
 */
function buildCompleteFixtureGraph(): GraphData {
  const nodes: GraphNode[] = [
    {
      id: 'SalesOrder:740506',
      type: GRAPH_NODE_TYPES.SALES_ORDER,
      data: { businessId: '740506' },
      label: 'Sales Order 740506',
    },
    {
      id: 'SalesOrderItem:740506_10',
      type: GRAPH_NODE_TYPES.SALES_ORDER_ITEM,
      data: { businessId: '740506_10' },
      label: 'Sales Order Item 740506_10',
    },
    {
      id: 'DeliveryItem:80738076_000010',
      type: GRAPH_NODE_TYPES.DELIVERY_ITEM,
      data: { businessId: '80738076_000010' },
      label: 'Delivery Item 80738076_000010',
    },
    {
      id: 'BillingDocumentItem:90504274_10',
      type: GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM,
      data: { businessId: '90504274_10' },
      label: 'Billing Document Item 90504274_10',
    },
    {
      id: 'BillingDocument:90504274',
      type: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
      data: { businessId: '90504274' },
      label: 'Billing Document 90504274',
    },
    {
      id: 'Payment:9400000220_1',
      type: GRAPH_NODE_TYPES.PAYMENT,
      data: { businessId: '9400000220_1' },
      label: 'Payment 9400000220_1',
    },
    {
      id: 'JournalEntry:9400000220_1',
      type: GRAPH_NODE_TYPES.JOURNAL_ENTRY,
      data: { businessId: '9400000220_1' },
      label: 'Journal Entry 9400000220_1',
    },
  ];

  const edges: GraphEdge[] = [
    {
      source: 'SalesOrder:740506',
      target: 'SalesOrderItem:740506_10',
      type: GRAPH_EDGE_TYPES.ORDER_TO_ITEM,
    },
    {
      source: 'SalesOrderItem:740506_10',
      target: 'DeliveryItem:80738076_000010',
      type: GRAPH_EDGE_TYPES.ITEM_TO_DELIVERY,
    },
    {
      source: 'DeliveryItem:80738076_000010',
      target: 'BillingDocumentItem:90504274_10',
      type: GRAPH_EDGE_TYPES.DELIVERY_TO_BILLING_ITEM,
    },
    {
      source: 'BillingDocumentItem:90504274_10',
      target: 'BillingDocument:90504274',
      type: GRAPH_EDGE_TYPES.BILLING_ITEM_TO_DOCUMENT,
    },
    {
      source: 'BillingDocument:90504274',
      target: 'Payment:9400000220_1',
      type: GRAPH_EDGE_TYPES.BILLING_TO_PAYMENT,
    },
    {
      source: 'BillingDocument:90504274',
      target: 'JournalEntry:9400000220_1',
      type: GRAPH_EDGE_TYPES.BILLING_TO_JOURNAL,
    },
  ];

  return { nodes, edges };
}

/**
 * Builds a missing-payment fixture graph.
 * Structurally identical to complete graph but missing the final Payment node and edges.
 */
function buildMissingPaymentFixtureGraph(): GraphData {
  const nodes: GraphNode[] = [
    {
      id: 'SalesOrder:740506',
      type: GRAPH_NODE_TYPES.SALES_ORDER,
      data: { businessId: '740506' },
      label: 'Sales Order 740506',
    },
    {
      id: 'SalesOrderItem:740506_10',
      type: GRAPH_NODE_TYPES.SALES_ORDER_ITEM,
      data: { businessId: '740506_10' },
      label: 'Sales Order Item 740506_10',
    },
    {
      id: 'DeliveryItem:80738076_000010',
      type: GRAPH_NODE_TYPES.DELIVERY_ITEM,
      data: { businessId: '80738076_000010' },
      label: 'Delivery Item 80738076_000010',
    },
    {
      id: 'BillingDocumentItem:90504274_10',
      type: GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM,
      data: { businessId: '90504274_10' },
      label: 'Billing Document Item 90504274_10',
    },
    {
      id: 'BillingDocument:90504274',
      type: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
      data: { businessId: '90504274' },
      label: 'Billing Document 90504274',
    },
    // NOTE: Payment node intentionally omitted
  ];

  const edges: GraphEdge[] = [
    {
      source: 'SalesOrder:740506',
      target: 'SalesOrderItem:740506_10',
      type: GRAPH_EDGE_TYPES.ORDER_TO_ITEM,
    },
    {
      source: 'SalesOrderItem:740506_10',
      target: 'DeliveryItem:80738076_000010',
      type: GRAPH_EDGE_TYPES.ITEM_TO_DELIVERY,
    },
    {
      source: 'DeliveryItem:80738076_000010',
      target: 'BillingDocumentItem:90504274_10',
      type: GRAPH_EDGE_TYPES.DELIVERY_TO_BILLING_ITEM,
    },
    {
      source: 'BillingDocumentItem:90504274_10',
      target: 'BillingDocument:90504274',
      type: GRAPH_EDGE_TYPES.BILLING_ITEM_TO_DOCUMENT,
    },
    // NOTE: BILLING_TO_PAYMENT edge intentionally omitted
  ];

  return { nodes, edges };
}

// ============================================================================
// ASSERTIONS
// ============================================================================

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`✗ Assertion failed: ${message}`);
  }
}

function pass(message: string) {
  console.log(`  ✓ ${message}`);
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests() {
  console.log('\n🧪 Query Failures & Anomalies Verification - Failure Cases\n');

  let testCount = 0;
  let passCount = 0;

  const completeGraph = buildCompleteFixtureGraph();
  const missingPaymentGraph = buildMissingPaymentFixtureGraph();

  // ========== Scenario A: Invalid input shape ==========
  try {
    console.log('[A] Invalid input shape (missing startNode)');
    testCount++;

    // Intentionally pass incomplete request (without startNode)
    const result = executeGraphQuery(completeGraph, {
      intent: 'trace_forward',
      targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
      direction: 'outbound',
      maxDepth: 6,
      // startNode deliberately omitted
    } as GraphQueryRequest);

    const typedResult = result as GraphQueryResult;

    assert(typedResult.ok === false, 'result.ok === false');
    pass('result.ok === false');

    assert(typedResult.error !== undefined, 'result.error exists');
    pass('result.error exists');

    assert(typedResult.matches.length === 0, 'matches.length === 0');
    pass('matches.length === 0');

    assert(typedResult.paths.length === 0, 'paths.length === 0');
    pass('paths.length === 0');

    assert(
      typedResult.evidence.visitedNodeIds.length === 0,
      'visitedNodeIds.length === 0'
    );
    pass('visitedNodeIds.length === 0');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ========== Scenario B: Missing start node ==========
  try {
    console.log('\n[B] Missing start node (nonexistent business ID)');
    testCount++;

    const result = executeGraphQuery(completeGraph, {
      intent: 'trace_forward',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '999999', // nonexistent
      },
      targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
      direction: 'outbound',
      maxDepth: 6,
    }) as GraphQueryResult;

    assert(result.ok === false, 'result.ok === false');
    pass('result.ok === false');

    assert(result.resolvedStartNode === undefined, 'resolvedStartNode === undefined');
    pass('resolvedStartNode === undefined');

    assert(
      result.error !== undefined && result.error.toLowerCase().includes('start node'),
      'error includes "start node"'
    );
    pass('error includes "start node"');

    assert(result.matches.length === 0, 'matches.length === 0');
    pass('matches.length === 0');

    assert(result.paths.length === 0, 'paths.length === 0');
    pass('paths.length === 0');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ========== Scenario C: detect_missing_flow on complete graph ==========
  try {
    console.log('\n[C] detect_missing_flow on complete graph (no missing flows)');
    testCount++;

    const result = executeGraphQuery(completeGraph, {
      intent: 'detect_missing_flow',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '740506',
      },
      targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
      direction: 'outbound',
      maxDepth: 6,
    }) as GraphQueryResult;

    assert(result.ok === true, 'result.ok === true');
    pass('result.ok === true');

    assert(
      result.missingFlows === undefined || result.missingFlows.length === 0,
      'missingFlows is empty or undefined'
    );
    pass('missingFlows is empty or undefined');

    assert(result.matches.length > 0, 'matches.length > 0');
    pass('matches.length > 0');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ========== Scenario D: detect_missing_flow on missing-payment graph ==========
  try {
    console.log(
      '\n[D] detect_missing_flow on missing-payment graph (detects missing flow)'
    );
    testCount++;

    const result = executeGraphQuery(missingPaymentGraph, {
      intent: 'detect_missing_flow',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '740506',
      },
      targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
      direction: 'outbound',
      maxDepth: 6,
    }) as GraphQueryResult;

    assert(result.ok === true, 'result.ok === true');
    pass('result.ok === true');

    assert(result.matches.length === 0, 'matches.length === 0');
    pass('matches.length === 0');

    assert(
      result.missingFlows !== undefined && result.missingFlows.length > 0,
      'missingFlows.length > 0'
    );
    pass('missingFlows.length > 0');

    if (result.missingFlows && result.missingFlows.length > 0) {
      assert(
        result.missingFlows[0].expectedNodeType === GRAPH_NODE_TYPES.PAYMENT,
        'missingFlows[0].expectedNodeType === PAYMENT'
      );
      pass('missingFlows[0].expectedNodeType === PAYMENT');
    }

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ========== Scenario E: Depth-limited no-match case ==========
  try {
    console.log(
      '\n[E] Depth-limited no-match (target exists but maxDepth too small)'
    );
    testCount++;

    const result = executeGraphQuery(completeGraph, {
      intent: 'trace_forward',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '740506',
      },
      targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
      direction: 'outbound',
      maxDepth: 2, // too shallow; Payment is at depth 5
    }) as GraphQueryResult;

    assert(result.ok === true, 'result.ok === true');
    pass('result.ok === true');

    assert(result.matches.length === 0, 'matches.length === 0');
    pass('matches.length === 0');

    assert(
      result.missingFlows === undefined || result.missingFlows.length === 0,
      'missingFlows absent (non-detect_missing_flow intent)'
    );
    pass('missingFlows absent (non-detect_missing_flow intent)');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ========== SUMMARY ==========
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passCount}/${testCount} scenarios passed`);
  console.log('='.repeat(60) + '\n');

  process.exit(passCount === testCount ? 0 : 1);
}

runTests().catch((error) => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
