import type { GraphQueryResult } from 'graph';
import type { NlQueryTranslationResult } from 'llm';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Response envelope for structured graph queries.
 * Returned by POST /query endpoint.
 */
export type StructuredQueryApiResponse = {
  success: boolean;
  data?: GraphQueryResult;
  timestamp: string;
  error?: string;
};

/**
 * Response envelope for natural language queries.
 * Returned by POST /query/nl endpoint.
 */
export type NlQueryApiResponse = {
  success: boolean;
  translation?: NlQueryTranslationResult;
  data?: GraphQueryResult;
  timestamp: string;
  error?: string;
};

/**
 * Union type for any query response from the API.
 */
export type QueryApiResponse =
  | StructuredQueryApiResponse
  | NlQueryApiResponse;

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await apiCall('/health');
    return true;
  } catch {
    return false;
  }
}

export async function runQuery(payload: unknown): Promise<StructuredQueryApiResponse> {
  return apiCall<StructuredQueryApiResponse>('/query', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function runNlQuery(input: string): Promise<NlQueryApiResponse> {
  return apiCall<NlQueryApiResponse>('/query/nl', {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

/**
 * Fetch the full graph from the backend.
 * Returns DB-backed graph with all nodes, edges, and statistics.
 */
export type GraphApiResponse = {
  success: boolean;
  data: {
    nodes: Array<{
      id: string;
      type: string;
      data: Record<string, unknown>;
      label?: string;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
      label?: string;
    }>;
    stats?: {
      totalNodes: number;
      totalEdges: number;
      nodeBreakdown: Record<string, number>;
      edgeBreakdown: Record<string, number>;
    };
  };
  timestamp: string;
  error?: string;
};

export async function getGraph(): Promise<GraphApiResponse> {
  return apiCall<GraphApiResponse>('/graph', {
    method: 'GET',
  });
}
