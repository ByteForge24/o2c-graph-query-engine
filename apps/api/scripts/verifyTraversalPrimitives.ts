#!/usr/bin/env ts-node

/**
 * Traversal Primitives Verification - Fixture-Style Tests
 * Validates core graph traversal primitives using deterministic in-memory fixture graphs.
 * No external dependencies, no test framework, just direct verification.
 *
 * Run with: pnpm --filter api run query-primitives
 */

import {
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  buildGraphIndex,
  getNodeByTypeAndBusinessId,
  getOutboundNeighbors,
  reconstructPath,
  resolveStartNode,
  runBoundedBfs,
  extractMatchesAndPaths,
  detectMissingFlows,
} from 'graph';

import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphQueryRequest,
} from 'graph';

// ============================================================================
// FIXTURE GRAPHS
// ============================================================================

/**
 * Builds a complete fixture graph following the O2C flow.
 * SalesOrder -> SalesOrderItems -> DeliveryItems -> BillingItems -> BillingDocument -> Payment
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
      label: 'ORDER_TO_ITEM',
    },
    {
      source: 'SalesOrderItem:740506_10',
      target: 'DeliveryItem:80738076_000010',
      type: GRAPH_EDGE_TYPES.ITEM_TO_DELIVERY,
      label: 'ITEM_TO_DELIVERY',
    },
    {
      source: 'DeliveryItem:80738076_000010',
      target: 'BillingDocumentItem:90504274_10',
      type: GRAPH_EDGE_TYPES.DELIVERY_TO_BILLING_ITEM,
      label: 'DELIVERY_TO_BILLING_ITEM',
    },
    {
      source: 'BillingDocumentItem:90504274_10',
      target: 'BillingDocument:90504274',
      type: GRAPH_EDGE_TYPES.BILLING_ITEM_TO_DOCUMENT,
      label: 'BILLING_ITEM_TO_DOCUMENT',
    },
    {
      source: 'BillingDocument:90504274',
      target: 'Payment:9400000220_1',
      type: GRAPH_EDGE_TYPES.BILLING_TO_PAYMENT,
      label: 'BILLING_TO_PAYMENT',
    },
    {
      source: 'BillingDocument:90504274',
      target: 'JournalEntry:9400000220_1',
      type: GRAPH_EDGE_TYPES.BILLING_TO_JOURNAL,
      label: 'BILLING_TO_JOURNAL',
    },
  ];

  return { nodes, edges };
}

/**
 * Builds a fixture graph with Payment node missing (for detect_missing_flow testing).
 */
function buildMissingPaymentFixtureGraph(): GraphData {
  const nodes: GraphNode[] = [
    {
      id: 'SalesOrder:740506',
      type: GRAPH_NODE_TYPES.SALES_ORDER,
      data: { businessId: '740506' },
    },
    {
      id: 'SalesOrderItem:740506_10',
      type: GRAPH_NODE_TYPES.SALES_ORDER_ITEM,
      data: { businessId: '740506_10' },
    },
    {
      id: 'DeliveryItem:80738076_000010',
      type: GRAPH_NODE_TYPES.DELIVERY_ITEM,
      data: { businessId: '80738076_000010' },
    },
    {
      id: 'BillingDocumentItem:90504274_10',
      type: GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM,
      data: { businessId: '90504274_10' },
    },
    {
      id: 'BillingDocument:90504274',
      type: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
      data: { businessId: '90504274' },
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
    // No edges to Payment - it's missing
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
  console.log('\n🧪 Traversal Primitives Verification\n');

  let testCount = 0;
  let passCount = 0;

  // Test A: buildGraphIndex
  try {
    console.log('[A] buildGraphIndex');
    testCount++;
    const graph = buildCompleteFixtureGraph();
    const index = buildGraphIndex(graph);

    assert(index.nodeById.size === 7, 'index contains 7 nodes');
    pass('nodeById contains 7 nodes');

    assert(
      index.nodeById.has('SalesOrder:740506'),
      'nodeById contains SalesOrder:740506'
    );
    pass('nodeById contains SalesOrder:740506');

    assert(index.outbound.size > 0, 'outbound adjacency exists');
    pass('outbound adjacency exists');

    assert(index.inbound.size > 0, 'inbound adjacency exists');
    pass('inbound adjacency exists');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Test B: getNodeByTypeAndBusinessId
  try {
    console.log('\n[B] getNodeByTypeAndBusinessId');
    testCount++;
    const graph = buildCompleteFixtureGraph();
    const index = buildGraphIndex(graph);

    const salesOrder = getNodeByTypeAndBusinessId(
      index,
      GRAPH_NODE_TYPES.SALES_ORDER,
      '740506'
    );
    assert(salesOrder !== undefined, 'resolves SalesOrder');
    assert(
      salesOrder?.id === 'SalesOrder:740506',
      'resolved node ID matches'
    );
    pass('resolves SalesOrder 740506');

    const billing = getNodeByTypeAndBusinessId(
      index,
      GRAPH_NODE_TYPES.BILLING_DOCUMENT,
      '90504274'
    );
    assert(billing !== undefined, 'resolves BillingDocument');
    assert(billing?.id === 'BillingDocument:90504274', 'billing ID matches');
    pass('resolves BillingDocument 90504274');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Test C: getOutboundNeighbors
  try {
    console.log('\n[C] getOutboundNeighbors');
    testCount++;
    const graph = buildCompleteFixtureGraph();
    const index = buildGraphIndex(graph);

    const soNeighbors = getOutboundNeighbors(index, 'SalesOrder:740506');
    assert(soNeighbors.length === 1, 'SalesOrder has 1 outbound neighbor');
    assert(
      soNeighbors[0].node.id === 'SalesOrderItem:740506_10',
      'neighbor is SalesOrderItem'
    );
    pass('SalesOrder expands to SalesOrderItem');

    const billNeighbors = getOutboundNeighbors(index, 'BillingDocument:90504274');
    assert(billNeighbors.length === 2, 'BillingDocument has 2 outbound neighbors');
    assert(
      billNeighbors[0].node.type === GRAPH_NODE_TYPES.PAYMENT,
      'first neighbor is Payment'
    );
    assert(
      billNeighbors[1].node.type === GRAPH_NODE_TYPES.JOURNAL_ENTRY,
      'second neighbor is JournalEntry'
    );
    pass('BillingDocument expands to Payment and JournalEntry');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Test D: reconstructPath
  try {
    console.log('\n[D] reconstructPath');
    testCount++;
    const graph = buildCompleteFixtureGraph();
    const index = buildGraphIndex(graph);
    const traversal = runBoundedBfs(
      index,
      'SalesOrder:740506',
      'outbound',
      undefined
    );

    const path = reconstructPath(
      traversal.predecessors,
      'SalesOrder:740506',
      'Payment:9400000220_1'
    );
    assert(path !== undefined, 'path reconstructed successfully');
    assert(path!.nodeIds.length === 6, 'path has 6 nodes');
    assert(
      path!.nodeIds[0] === 'SalesOrder:740506',
      'path starts with SalesOrder'
    );
    assert(path!.nodeIds[5] === 'Payment:9400000220_1', 'path ends with Payment');
    assert(path!.edgeTypes.length === 5, 'path has 5 edges');
    pass(
      'reconstructs path from SalesOrder to Payment with correct nodes/edges'
    );

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Test E: resolveStartNode
  try {
    console.log('\n[E] resolveStartNode');
    testCount++;
    const graph = buildCompleteFixtureGraph();
    const index = buildGraphIndex(graph);

    const request: GraphQueryRequest = {
      intent: 'trace_forward',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '740506',
      },
    };

    const resolved = resolveStartNode(index, request);
    assert(resolved !== undefined, 'resolves start node');
    assert(resolved!.nodeId === 'SalesOrder:740506', 'resolved nodeId matches');
    assert(resolved!.type === GRAPH_NODE_TYPES.SALES_ORDER, 'type matches');
    assert(resolved!.businessId === '740506', 'businessId matches');
    pass('resolves GraphQueryRequest start node correctly');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Test F: runBoundedBfs
  try {
    console.log('\n[F] runBoundedBfs');
    testCount++;
    const graph = buildCompleteFixtureGraph();
    const index = buildGraphIndex(graph);

    const traversal = runBoundedBfs(
      index,
      'SalesOrder:740506',
      'outbound',
      undefined
    );

    assert(traversal.visitedNodeIds.length === 7, 'visited all 7 nodes');
    assert(
      traversal.visitedNodeIds[0] === 'SalesOrder:740506',
      'start node first'
    );
    assert(
      traversal.visitedNodeIds.includes('Payment:9400000220_1'),
      'visited Payment'
    );
    pass('outbound traversal from SalesOrder visits all nodes');

    const limitedTraversal = runBoundedBfs(
      index,
      'SalesOrder:740506',
      'outbound',
      2
    );
    assert(limitedTraversal.visitedNodeIds.length <= 4, 'maxDepth limits nodes');
    pass('maxDepth=2 limits expansion correctly');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Test G: extractMatchesAndPaths
  try {
    console.log('\n[G] extractMatchesAndPaths');
    testCount++;
    const graph = buildCompleteFixtureGraph();
    const index = buildGraphIndex(graph);

    const request: GraphQueryRequest = {
      intent: 'trace_forward',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '740506',
      },
      targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
      direction: 'outbound',
    };

    const resolved = resolveStartNode(index, request)!;
    const traversal = runBoundedBfs(
      index,
      resolved.nodeId,
      'outbound',
      undefined
    );
    const extraction = extractMatchesAndPaths(index, request, resolved, traversal);

    assert(extraction.matches.length === 1, 'found 1 match');
    assert(
      extraction.matches[0].nodeId === 'Payment:9400000220_1',
      'match is Payment'
    );
    assert(extraction.paths.length === 1, 'found 1 path');
    pass('extraction finds Payment match with path');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Test H: detectMissingFlows (complete graph)
  try {
    console.log('\n[H] detectMissingFlows (complete graph)');
    testCount++;
    const graph = buildCompleteFixtureGraph();
    const index = buildGraphIndex(graph);

    const request: GraphQueryRequest = {
      intent: 'detect_missing_flow',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '740506',
      },
      targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
    };

    const resolved = resolveStartNode(index, request)!;
    const traversal = runBoundedBfs(
      index,
      resolved.nodeId,
      'outbound',
      undefined
    );
    const extraction = extractMatchesAndPaths(index, request, resolved, traversal);

    const missingFlows = detectMissingFlows(request, resolved, extraction.matches);
    assert(missingFlows.length === 0, 'no missing flows when Payment is reached');
    pass('detectMissingFlows returns [] when target found');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Test I: detectMissingFlows (missing payment graph)
  try {
    console.log('\n[I] detectMissingFlows (missing payment)');
    testCount++;
    const graph = buildMissingPaymentFixtureGraph();
    const index = buildGraphIndex(graph);

    const request: GraphQueryRequest = {
      intent: 'detect_missing_flow',
      startNode: {
        type: GRAPH_NODE_TYPES.SALES_ORDER,
        id: '740506',
      },
      targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
    };

    const resolved = resolveStartNode(index, request)!;
    const traversal = runBoundedBfs(
      index,
      resolved.nodeId,
      'outbound',
      undefined
    );
    const extraction = extractMatchesAndPaths(index, request, resolved, traversal);

    const missingFlows = detectMissingFlows(request, resolved, extraction.matches);
    assert(missingFlows.length === 1, 'detected missing flow');
    assert(
      missingFlows[0].expectedNodeType === GRAPH_NODE_TYPES.PAYMENT,
      'missing flow is for Payment'
    );
    pass('detectMissingFlows detects missing Payment correctly');

    passCount++;
  } catch (error) {
    console.log(
      `  ✗ ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passCount}/${testCount} test groups passed`);
  console.log('='.repeat(60) + '\n');

  process.exit(passCount === testCount ? 0 : 1);
}

runTests().catch((error) => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
