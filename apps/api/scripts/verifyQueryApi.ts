#!/usr/bin/env ts-node

/**
 * Smoke Verification Script for Query API
 * Verifies that POST /query endpoint returns deterministic, well-formed responses.
 * 
 * Run with: pnpm run query:verify
 * Assumes: API server is already running on localhost:4000
 */

const API_BASE = 'http://localhost:4000';
const QUERY_ENDPOINT = `${API_BASE}/query`;

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp?: string;
}

// ============================================================================
// TEST PAYLOADS
// ============================================================================

const INVALID_PAYLOAD = {
  // Missing required fields
  intent: 'trace_forward',
  // startNode is missing - should trigger validation failure
};

const VALID_PAYLOAD = {
  intent: 'trace_forward',
  startNode: {
    type: 'SalesOrder',
    id: '740506',
  },
  direction: 'outbound',
  maxDepth: 3,
};

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testEndpoint(
  name: string,
  payload: unknown,
  expectSuccess: boolean
): Promise<boolean> {
  try {
    const response = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseBody: ApiResponse = await response.json();
    const httpStatus = response.status;

    console.log(`\n[${name}]`);
    console.log(`  HTTP Status: ${httpStatus}`);
    console.log(`  success: ${responseBody.success}`);
    console.log(`  has timestamp: ${!!responseBody.timestamp}`);

    // All responses from /query should be HTTP 200 (service handles errors)
    const statusOk = httpStatus === 200;
    const hasSuccess = typeof responseBody.success === 'boolean';
    const hasTimestamp = typeof responseBody.timestamp === 'string';
    const hasData = responseBody.data !== undefined;

    if (!statusOk) {
      console.log(`  ✗ FAIL: Expected HTTP 200, got ${httpStatus}`);
      return false;
    }

    if (!hasSuccess) {
      console.log(`  ✗ FAIL: Missing 'success' property`);
      return false;
    }

    if (!hasTimestamp) {
      console.log(`  ✗ FAIL: Missing 'timestamp' property`);
      return false;
    }

    if (!hasData) {
      console.log(`  ✗ FAIL: Missing 'data' property`);
      return false;
    }

    // For deterministic invalid input, service should return data.ok === false
    if (!expectSuccess) {
      const data = responseBody.data as Record<string, unknown> | undefined;
      if (data?.ok !== false) {
        console.log(`  ✗ FAIL: Invalid payload should have data.ok === false`);
        return false;
      }
      console.log(`  ✓ PASS: Invalid payload correctly rejected`);
      return true;
    }

    // For valid input, we just check structure (might not have matches)
    console.log(`  ✓ PASS: Valid payload accepted`);
    return true;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🔍 Smoke Test: Query API Endpoint\n');
  console.log(`Target: ${QUERY_ENDPOINT}`);

  // Check connectivity
  try {
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (healthResponse.status !== 200) {
      console.error('\n✗ API server not healthy');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ API server unreachable on localhost:4000');
    console.error('  Ensure the API is running: pnpm --filter api dev');
    process.exit(1);
  }

  // Test invalid payload
  const invalidResult = await testEndpoint(
    'Test 1: Invalid Payload (missing startNode)',
    INVALID_PAYLOAD,
    false
  );

  // Test valid payload
  const validResult = await testEndpoint(
    'Test 2: Valid Payload',
    VALID_PAYLOAD,
    true
  );

  // Summary
  console.log('\n' + '='.repeat(50));
  if (invalidResult && validResult) {
    console.log('✓ All smoke tests passed');
    console.log('='.repeat(50) + '\n');
    process.exit(0);
  } else {
    console.log('✗ Some smoke tests failed');
    console.log('='.repeat(50) + '\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
