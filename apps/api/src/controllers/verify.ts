import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateResponse } from 'llm';

const prisma = new PrismaClient();

export const verify = async (_req: Request, res: Response) => {
  const results = {
    api: false,
    db: false,
    llm: false,
    errors: [] as string[],
  };

  // Check API
  results.api = true;
  console.log('✓ API OK');

  // Check Database
  try {
    await prisma.salesOrder.findFirst();
    results.db = true;
    console.log('✓ DB OK');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.errors.push(`DB Error: ${errorMsg}`);
    console.error('✗ DB Error:', errorMsg);
  }

  // Check LLM
  try {
    const response = await generateResponse('test');
    if (response) {
      results.llm = true;
      console.log('✓ LLM OK');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.errors.push(`LLM Error: ${errorMsg}`);
    console.error('✗ LLM Error:', errorMsg);
  }

  const allOk = results.api && results.db && results.llm;
  res.status(allOk ? 200 : 503).json(results);
};
