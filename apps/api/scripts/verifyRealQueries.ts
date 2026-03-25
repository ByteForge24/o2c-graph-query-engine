#!/usr/bin/env ts-node

/**
 * Real Queries Manual Verification Runner
 * Tests actual query scenarios against the running API with DB-backed graph data.
 * Operator-friendly manual verification tool, not a strict unit test.
 *
 * Prerequisites:
 * - API server running on http://localhost:4000
 * - Database populated with real O2C flow data
 * - Graph has been built from the database
 *
 * Run with: pnpm --filter api run query:real
 */

import { GRAPH_NODE_TYPES } from 'graph';

import type { GraphQueryRequest } from 'graph';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'http://localhost:4000';
const QUERY_ENDPOINT = `${API_BASE_URL}/query`;
const REQUEST_TIMEOUT_MS = 5000;

// ============================================================================
// HELPER: API CALL
// ============================================================================

async function callQueryApi(request: GraphQueryRequest): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const body = await response.json();
    return {
      httpStatus: response.status,
      body,
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `API unreachable at ${QUERY_ENDPOINT}. Please start the API server: pnpm --filter api run dev`
      );
    }
    throw error;
  }
}

// ============================================================================
// HELPER: PRINT SUMMARY
// ============================================================================

function printScenarioSummary(
  name: string,
  httpStatus: number,
  result: any
): void {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📋 ${name}`);
  console.log(`${'─'.repeat(70)}`);

  console.log(`  HTTP Status:      ${httpStatus}`);
  console.log(`  API Success:      ${result.success ?? 'N/A'}`);
  console.log(`  Query OK:         ${result.data?.ok ?? false}`);

  const data = result.data;
  if (data) {
    console.log(`  Start Node:       ${data.resolvedStartNode?.nodeId ?? 'N/A'}`);
    console.log(`  Matches Found:    ${data.matches?.length ?? 0}`);
    console.log(`  Paths:            ${data.paths?.length ?? 0}`);
    console.log(
      `  Visited Nodes:    ${data.evidence?.visitedNodeIds?.length ?? 0}`
    );
    console.log(
      `  Traversed Edges:  ${data.evidence?.traversedEdges?.length ?? 0}`
    );
    console.log(
      `  Missing Flows:    ${data.missingFlows?.length ?? 0}`
    );

    // Print top 1-2 matches if present
    if (data.matches && data.matches.length > 0) {
      console.log(`\n  Top Matches:`);
      data.matches.slice(0, 2).forEach((match: any, idx: number) => {
        console.log(`    ${idx + 1}. ${match.nodeId ?? match.type ?? 'unknown'}`);
      });
    }

    // Print error if present
    if (data.error) {
      console.log(`\n  ⚠️  Error: ${data.error}`);
    }

    // Print missing flows if present
    if (data.missingFlows && data.missingFlows.length > 0) {
      console.log(`\n  Missing Flow Details:`);
      data.missingFlows.slice(0, 2).forEach((flow: any, idx: number) => {
        console.log(
          `    ${idx + 1}. Expected node type: ${flow.expectedNodeType ?? 'unknown'}`
        );
      });
    }
  }
}

// ============================================================================
// SCENARIOS
// ============================================================================

async function runScenarios() {
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 Real Query Manual Verification Runner');
  console.log(`📍 API: ${QUERY_ENDPOINT}`);
  console.log('═'.repeat(70));

  const scenarios: Array<{
    name: string;
    request: GraphQueryRequest;
  }> = [
    {
      name: 'Scenario A: Order → Delivery (Trace Forward)',
      request: {
        intent: 'trace_forward',
        startNode: {
          type: GRAPH_NODE_TYPES.SALES_ORDER,
          id: '740506',
        },
        targetNodeType: GRAPH_NODE_TYPES.DELIVERY_ITEM,
        direction: 'outbound',
        maxDepth: 3,
      },
    },
    {
      name: 'Scenario B: Order → Payment (Trace Forward)',
      request: {
        intent: 'trace_forward',
        startNode: {
          type: GRAPH_NODE_TYPES.SALES_ORDER,
          id: '740506',
        },
        targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
        direction: 'outbound',
        maxDepth: 10,
      },
    },
    {
      name: 'Scenario C: Billing → Order (Trace Backward)',
      request: {
        intent: 'trace_backward',
        startNode: {
          type: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
          id: '90504274',
        },
        targetNodeType: GRAPH_NODE_TYPES.SALES_ORDER,
        direction: 'inbound',
        maxDepth: 5,
      },
    },
    {
      name: 'Scenario D: Detect Missing Payment',
      request: {
        intent: 'detect_missing_flow',
        startNode: {
          type: GRAPH_NODE_TYPES.BILLING_DOCUMENT,
          id: '90504274',
        },
        targetNodeType: GRAPH_NODE_TYPES.PAYMENT,
        direction: 'outbound',
        maxDepth: 10,
      },
    },
  ];

  let successCount = 0;
  let totalCount = 0;

  for (const scenario of scenarios) {
    totalCount++;
    try {
      const { httpStatus, body } = await callQueryApi(scenario.request);
      printScenarioSummary(scenario.name, httpStatus, body);

      // Consider it a "responded successfully" when API returned structured response
      if (httpStatus === 200 && typeof body.success === 'boolean' && body.data) {
        successCount++;
      }
    } catch (error) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`❌ ${scenario.name}`);
      console.log(`${'─'.repeat(70)}`);
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`✅ Verification Complete: ${successCount}/${totalCount} scenarios responded`);
  console.log('═'.repeat(70) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================

runScenarios().catch((error) => {
  console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
