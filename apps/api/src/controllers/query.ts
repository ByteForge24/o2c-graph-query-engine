import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { executeGraphQuery } from 'graph';
import { buildGraphFromDb } from '../graph/buildGraphFromDb';

const prisma = new PrismaClient();

/**
 * Executes a deterministic graph query against the database.
 * Builds the graph from the database and runs the query execution service.
 * Note: This endpoint executes deterministic graph traversal, not LLM reasoning.
 *
 * @param req - Express request with query intent/parameters in body
 * @param res - Express response
 */
export const postQuery = async (req: Request, res: Response) => {
  try {
    console.log('\n[API] POST /query - Building graph from database...');

    // Build graph from DB
    const graph = await buildGraphFromDb(prisma);

    console.log('[API] Graph built, executing query service...');

    // Execute query against the graph
    const result = executeGraphQuery(graph, req.body);

    console.log('[API] Query executed, returning structured result\n');

    // Return deterministic result (success or structured failure)
    res.json({
      success: result.ok,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Unexpected runtime error
    console.error('[API] Query execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute query',
    });
  }
};
