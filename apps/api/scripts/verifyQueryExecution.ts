#!/usr/bin/env ts-node

/**
 * Query Execution Verification - End-to-End Happy-Path Tests
 * Validates executeGraphQuery() on an in-memory fixture graph.
 * Verifies complete deterministic query flows without framework dependencies.
 *
 * Run with: pnpm --filter api run query:execute
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
} from 'graph';

// ============================================================================
// FIXTURE GRAPH (COMPLETE O2C FLOW)
// ============================================================================

function buildFixtureGraph(): GraphData {
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
  console.log('\n🧪 Query Execution Verification - End-to-End Happy Path\n');

  let testCount = 0;
  let passCount = 0;
  const graph = buildFixtureGraph();

  // ========== Scenario A: Order -> Delivery ==========
  try {
    console.log('[A] Order -> Delivery (depth 3)');
    testCount++;

    const result = executeGraphQuery(graph, {
      intent: 'trace_forward',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '740506',
      },
      targetNodeType: GRAPH_NODE_TYPES.DELIVERY_ITEM,
      direction: 'outbound',
      maxDepth: 3,
    }) as GraphQueryResult;

    assert(result.ok === true, 'result.ok === true');
    pass('result.ok === true');

    assert(result.matches.length === 1, 'exactly 1 match');
    pass('exactly 1 match');

    assert(
      result.matches[0].type === GRAPH_NODE_TYPES.DELIVERY_ITEM,
      'match type is DeliveryItem'
    );
    pass('match type is DeliveryItem');

    assert(result.paths.length === 1, 'exactly 1 path');
    pass('exactly 1 path');

    assert(result.resolvedStartNode !== undefined, 'resolvedStartNode exists');
    pass('resolvedStartNode exists');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ========== Scenario B: Order -> Payment ==========
  try {
    console.log('\n[B] Order -> Payment (depth 6)');
    testCount++;

    const result = executeGraphQuery(graph, {
      intent: 'trace_forward',
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

    assert(result.matches.length === 1, 'exactly 1 match');
    pass('exactly 1 match');

    assert(
      result.matches[0].nodeId === 'Payment:9400000220_1',
      'match nodeId is Payment:9400000220_1'
    );
    pass('match nodeId is Payment:9400000220_1');

    assert(result.paths.length === 1, 'exactly 1 path');
    pass('exactly 1 path');

    assert(result.paths[0].length === 5, 'path length is 5 (hops)');
    pass('path length is 5');

    assert(
      result.evidence.visitedNodeIds.includes('BillingDocument:90504274'),
      'evidence includes BillingDocument'
    );
    pass('evidence visitedNodeIds includes BillingDocument:90504274');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ========== Scenario C: Billing -> Order backward ==========
  try {
    console.log('\n[C] Billing -> Order backward (depth 5)');
    testCount++;

    const result = executeGraphQuery(graph, {
      intent: 'trace_backward',
      startNode: {
        type: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
        id: '90504274',
      },
      targetNodeType: GRAPH_NODE_TYPES.SALES_ORDER,
      direction: 'inbound',
      maxDepth: 5,
    }) as GraphQueryResult;

    assert(result.ok === true, 'result.ok === true');
    pass('result.ok === true');

    assert(result.matches.length === 1, 'exactly 1 match');
    pass('exactly 1 match');

    assert(
      result.matches[0].type === GRAPH_NODE_TYPES.SALES_ORDER,
      'match type is SalesOrder'
    );
    pass('match type is SalesOrder');

    assert(result.resolvedStartNode !== undefined, 'resolvedStartNode exists');
    pass('resolvedStartNode exists');

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
