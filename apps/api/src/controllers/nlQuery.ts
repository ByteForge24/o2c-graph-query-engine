import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { executeGraphQuery } from 'graph';
import { translateNaturalLanguageToQuery } from 'llm';
import { buildGraphFromDb } from '../graph/buildGraphFromDb';

const prisma = new PrismaClient();

/**
 * Executes a natural language query through the translation layer.
 * Flow:
 * 1. Validate and translate natural language input
 * 2. If translation fails (unsupported/ambiguous), return structured failure
 * 3. If translation succeeds, execute the translated query via the graph service
 * 4. Return structured result with translation metadata and execution result
 *
 * This endpoint demonstrates that the LLM translator is not the source of truth:
 * execution/validation via the graph service still decides what is valid.
 *
 * @param req - Express request with { input: string } in body
 * @param res - Express response
 */
export const postNlQuery = async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString();

    // Step 1: Validate input format
    const input = req.body?.input;

    if (typeof input !== 'string' || input.trim() === '') {
      console.log('[API] POST /query/nl - Invalid input format');
      return res.json({
        success: false,
        translation: {
          status: 'unsupported',
          input: input || '',
          reason: 'Input must be a non-empty string',
        },
        timestamp,
      });
    }

    console.log(`[API] POST /query/nl - Translating: "${input}"`);

    // Step 2: Translate natural language to structured query
    const translation = translateNaturalLanguageToQuery(input);

    // Step 3: If translation is not successful, return early with translation result
    if (translation.status !== 'translated') {
      console.log(`[API] Translation failed with status: ${translation.status}`);
      return res.json({
        success: false,
        translation,
        timestamp,
      });
    }

    // Translation succeeded, proceed with execution
    console.log('[API] Translation successful, building graph from database...');

    // Step 4: Build graph from DB
    const graph = await buildGraphFromDb(prisma);

    console.log('[API] Graph built, executing translated query...');

    // Step 5: Execute the translated query
    const result = executeGraphQuery(graph, translation.query!);

    console.log('[API] Query executed, returning result with translation metadata\n');

    // Step 6: Return structured result with both translation and execution data
    res.json({
      success: result.ok,
      translation,
      data: result,
      timestamp,
    });
  } catch (error) {
    // Unexpected runtime error
    console.error('[API] NL query execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute NL query',
      timestamp: new Date().toISOString(),
    });
  }
};
