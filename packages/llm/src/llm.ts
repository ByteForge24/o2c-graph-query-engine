import type { LLMResponse } from './types';

/**
 * Generate a response from an LLM provider
 *
 * @param prompt - The input prompt for the LLM
 * @returns Promise resolving to the LLM response text
 *
 * TODO: Integrate real API (Gemini, Groq, etc.)
 * Structure: Create src/providers/ with API-specific implementations
 */
export async function generateResponse(prompt: string): Promise<string> {
  // Mock implementation - placeholder for real API integration
  // Remove this and call actual API provider
  return 'LLM response placeholder';
}

/**
 * Generate a full LLM response object
 *
 * @param prompt - The input prompt for the LLM
 * @returns Promise resolving to the full LLM response with metadata
 */
export async function generateFullResponse(
  prompt: string
): Promise<LLMResponse> {
  const text = await generateResponse(prompt);
  return {
    text,
    model: 'mock',
  };
}
