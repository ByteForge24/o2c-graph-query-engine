#!/usr/bin/env ts-node

/**
 * Standalone verification script
 * Run with: pnpm exec ts-node scripts/verify.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateResponse } from 'llm';

const prisma = new PrismaClient();

async function verify() {
  console.log('\n📋 Verifying services...\n');

  // API
  console.log('✓ API OK (this script is running)');

  // Database
  try {
    await prisma.salesOrder.findFirst();
    console.log('✓ DB OK');
  } catch (error) {
    console.error(
      '✗ DB Error:',
      error instanceof Error ? error.message : String(error)
    );
  }

  // LLM
  try {
    await generateResponse('test');
    console.log('✓ LLM OK');
  } catch (error) {
    console.error(
      '✗ LLM Error:',
      error instanceof Error ? error.message : String(error)
    );
  }

  console.log('\n');
  await prisma.$disconnect();
  process.exit(0);
}

verify().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
