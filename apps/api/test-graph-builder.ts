#!/usr/bin/env ts-node

/**
 * Direct test of graph builder from TypeScript
 */

import { PrismaClient } from '@prisma/client';
import { buildGraphFromDb } from './src/graph/buildGraphFromDb';

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('\n========================================');
    console.log('[TEST] DB-Backed Graph Builder');
    console.log('========================================\n');

    const graph = await buildGraphFromDb(prisma);

    console.log('\n========================================');
    console.log('[RESULTS] Graph Build Summary');
    console.log('========================================\n');

    console.log(`Total Nodes: ${graph.stats!.totalNodes}`);
    console.log(`Total Edges: ${graph.stats!.totalEdges}`);

    console.log('\n[BREAKDOWN] Nodes by Type:');
    for (const [type, count] of Object.entries(graph.stats!.nodeBreakdown)) {
      console.log(`  ${type}: ${count}`);
    }

    console.log('\n[BREAKDOWN] Edges by Type:');
    for (const [type, count] of Object.entries(graph.stats!.edgeBreakdown)) {
      console.log(`  ${type}: ${count}`);
    }

    console.log('\n[SAMPLE] First 3 Nodes:');
    graph.nodes.slice(0, 3).forEach((node) => {
      console.log(`  ${node.id}: ${JSON.stringify(node.data)}`);
    });

    console.log('\n[SAMPLE] First 3 Edges:');
    graph.edges.slice(0, 3).forEach((edge) => {
      console.log(`  ${edge.source} --[${edge.type}]--> ${edge.target}`);
    });

    console.log('\n[OK] Graph builder test successful!\n');
  } catch (err) {
    console.error('[ERR] Test failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
