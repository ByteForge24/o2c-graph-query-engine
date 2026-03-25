import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildGraphFromDb } from '../graph/buildGraphFromDb';

const prisma = new PrismaClient();

export const getGraph = async (_req: Request, res: Response) => {
  try {
    console.log('\n[API] GET /graph - Building graph from database...');

    const graph = await buildGraphFromDb(prisma);

    console.log('[API] Graph built successfully, returning to client\n');

    res.json({
      success: true,
      data: graph,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Graph build error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to build graph',
    });
  }
};
