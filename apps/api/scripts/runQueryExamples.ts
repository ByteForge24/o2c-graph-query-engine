#!/usr/bin/env ts-node

/**
 * Query Examples Runner - Manual Verification Script
 * Executes canonical query examples against the running API endpoint.
 * Demonstrates real deterministic query execution with structured responses.
 *
 * Run with: pnpm --filter api run query:examples
 * Assumes: API server is already running on localhost:4000
 */

import { GRAPH_QUERY_EXAMPLES } from 'graph';

const API_BASE = 'http://localhost:4000';
const QUERY_ENDPOINT = `${API_BASE}/query`;

interface QueryResponse {
  success: boolean;
  data?: {
    ok: boolean;
    resolvedStartNode?: {
      nodeId: string;
      type: string;
      businessId: string;
    };
    matches?: Array<{ nodeId: string; type: string; businessId: string }>;
    paths?: Array<{ nodeIds: string[]; length: number }>;
    evidence?: {
      visitedNodeIds: string[];
      traversedEdges: Array<{ source: string; target: string; type: string }>;
    };
    missingFlows?: Array<{ expectedNodeType: string; reason: string }>;
    error?: string;
  };
  timestamp?: string;
}

// ============================================================================
// RUNNER
// ============================================================================

interface ScenarioResult {
  name: string;
  passed: boolean;
  httpStatus: number;
  success: boolean;
  ok: boolean;
  resolvedStartNode?: string;
  matchCount: number;
  pathCount: number;
  visitedNodeCount: number;
  traversedEdgeCount: number;
  missingFlowCount: number;
  topMatches: string[];
  error?: string;
}

async function runScenario(
  name: string,
  payload: unknown
): Promise<ScenarioResult> {
  try {
    const response = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseBody: QueryResponse = await response.json();
    const data = responseBody.data;

    const result: ScenarioResult = {
      name,
      passed: response.status === 200,
      httpStatus: response.status,
      success: responseBody.success,
      ok: data?.ok ?? false,
      matchCount: data?.matches?.length ?? 0,
      pathCount: data?.paths?.length ?? 0,
      visitedNodeCount: data?.evidence?.visitedNodeIds?.length ?? 0,
      traversedEdgeCount: data?.evidence?.traversedEdges?.length ?? 0,
      missingFlowCount: data?.missingFlows?.length ?? 0,
      topMatches: (data?.matches ?? []).slice(0, 3).map((m) => `${m.type}:${m.businessId}`),
      resolvedStartNode: data?.resolvedStartNode
        ? `${data.resolvedStartNode.type}:${data.resolvedStartNode.businessId}`
        : undefined,
    };

    if (data?.error) {
      result.error = data.error;
    }

    return result;
  } catch (error) {
    return {
      name,
      passed: false,
      httpStatus: 0,
      success: false,
      ok: false,
      matchCount: 0,
      pathCount: 0,
      visitedNodeCount: 0,
      traversedEdgeCount: 0,
      missingFlowCount: 0,
      topMatches: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatResult(result: ScenarioResult): string {
  const lines: string[] = [];

  lines.push(`\n[${result.name}]`);
  lines.push(`  HTTP ${result.httpStatus} | success=${result.success} | ok=${result.ok}`);

  if (result.resolvedStartNode) {
    lines.push(`  Start: ${result.resolvedStartNode}`);
  }

  if (result.error) {
    lines.push(`  ⚠ Error: ${result.error}`);
  } else if (result.ok) {
    lines.push(`  ✓ Matches: ${result.matchCount}`);
    if (result.topMatches.length > 0) {
      lines.push(`    Top nodes: ${result.topMatches.join(', ')}`);
    }
    lines.push(`  Paths: ${result.pathCount}`);
    lines.push(`  Traversal: ${result.visitedNodeCount} nodes, ${result.traversedEdgeCount} edges`);
  }

  if (result.missingFlowCount > 0) {
    lines.push(`  Missing flows: ${result.missingFlowCount}`);
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n📊 Query Examples Runner\n');
  console.log(`Target: ${QUERY_ENDPOINT}\n`);

  // Check connectivity
  try {
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (healthResponse.status !== 200) {
      console.error('✗ API server not healthy');
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ API server unreachable at localhost:4000');
    console.error('  Start the server with: pnpm --filter api dev');
    process.exit(1);
  }

  // Run scenarios
  const scenarios: ScenarioResult[] = [];

  console.log('Running canonical query examples...');

  // Collect all scenarios from examples
  const exampleEntries = Object.entries(GRAPH_QUERY_EXAMPLES);

  for (const [name, payload] of exampleEntries) {
    const result = await runScenario(name, payload);
    scenarios.push(result);
    console.log(formatResult(result));
  }

  // Summary
  const passedCount = scenarios.filter((s) => s.ok).length;
  const totalCount = scenarios.length;

  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${passedCount}/${totalCount} scenarios successfully executed`);
  console.log('='.repeat(60) + '\n');

  // Exit code based on all scenarios being ok
  const allOk = scenarios.every((s) => s.ok);
  process.exit(allOk ? 0 : 1);
}

main().catch((error) => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
