/**
 * Natural Language to Query Translation Layer
 *
 * This module bridges natural language questions to structured GraphQueryRequest objects.
 * IMPORTANT: This is a placeholder implementation using deterministic pattern matching only.
 * No external LLM calls happen here. The LLM is a translator, not the source of truth.
 * Execution and validation still decide what is valid (separation of concerns).
 *
 * Phase 4.3: Initial NL translation contract and deterministic placeholder translator.
 * Future phases will integrate real LLM translation while maintaining this contract.
 */

import type { GraphQueryRequest, QueryStartNode } from 'graph';

// ============================================================================
// TRANSLATION CONTRACT TYPES
// ============================================================================

/**
 * Status of a natural language query translation.
 * Indicates whether the translation succeeded and why it might have failed.
 */
export type NlQueryTranslationStatus =
  | 'translated'  // Successfully translated to a GraphQueryRequest
  | 'unsupported' // The query falls outside supported patterns
  | 'ambiguous';  // The query is too vague or underspecified to translate safely

/**
 * Structured result of translating a natural language question to a graph query.
 * Contains the translation status, original input, and optional output query or reason.
 */
export type NlQueryTranslationResult = {
  /** Translation status: success or reason for failure */
  status: NlQueryTranslationStatus;

  /** Original natural language input */
  input: string;

  /** Translated structured query (present if status === 'translated') */
  query?: GraphQueryRequest;

  /** Explanation message for unsupported or ambiguous queries */
  reason?: string;
};

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

/**
 * Supported natural language patterns for deterministic translation.
 * Each pattern is matched via regex or string normalization.
 * No fuzzy matching; fail safely for ambiguous input.
 */
interface PatternMatch {
  regex: RegExp;
  extract: (input: string, match: RegExpMatchArray) => NlQueryTranslationResult;
}

/**
 * Translate "show payment for order 740506"
 * Intent: trace_forward to Payment from a SalesOrder
 */
const showPaymentPattern: PatternMatch = {
  regex: /^show\s+payment\s+for\s+order\s+(\d+)$/i,
  extract: (input, match) => {
    const orderId = match[1];
    return {
      status: 'translated',
      input,
      query: {
        intent: 'trace_forward',
        startNode: { type: 'SalesOrder', id: orderId },
        targetNodeType: 'Payment',
        direction: 'outbound',
        maxDepth: 6,
      },
    };
  },
};

/**
 * Translate "find delivery for order 740506"
 * Intent: trace_forward to DeliveryItem from a SalesOrder
 */
const findDeliveryPattern: PatternMatch = {
  regex: /^find\s+delivery\s+for\s+order\s+(\d+)$/i,
  extract: (input, match) => {
    const orderId = match[1];
    return {
      status: 'translated',
      input,
      query: {
        intent: 'trace_forward',
        startNode: { type: 'SalesOrder', id: orderId },
        targetNodeType: 'DeliveryItem',
        direction: 'outbound',
        maxDepth: 3,
      },
    };
  },
};

/**
 * Translate "trace billing 90504274 back to order"
 * Intent: trace_backward from BillingDocument to SalesOrder
 */
const traceBillingBackPattern: PatternMatch = {
  regex: /^trace\s+billing\s+(\d+)\s+back\s+to\s+order$/i,
  extract: (input, match) => {
    const billingId = match[1];
    return {
      status: 'translated',
      input,
      query: {
        intent: 'trace_backward',
        startNode: { type: 'BillingDocument', id: billingId },
        targetNodeType: 'SalesOrder',
        direction: 'inbound',
        maxDepth: 5,
      },
    };
  },
};

/**
 * Translate "is payment missing for billing 90504274"
 * Intent: detect_missing_flow to Payment from BillingDocument
 */
const missingPaymentPattern: PatternMatch = {
  regex: /^is\s+payment\s+missing\s+for\s+billing\s+(\d+)$/i,
  extract: (input, match) => {
    const billingId = match[1];
    return {
      status: 'translated',
      input,
      query: {
        intent: 'detect_missing_flow',
        startNode: { type: 'BillingDocument', id: billingId },
        targetNodeType: 'Payment',
        direction: 'outbound',
        maxDepth: 10,
      },
    };
  },
};

/**
 * Ambiguous patterns: resembles a supported intent but lacks required business ID.
 * Checked before supported patterns to identify underspecified queries.
 */
interface AmbiguousPatternMatch {
  regex: RegExp;
  reason: string;
}

const ambiguousPatterns: AmbiguousPatternMatch[] = [
  {
    regex: /^show\s+payment\s*$/i,
    reason: 'Input is ambiguous: missing order ID for payment lookup. Expected format: "show payment for order {id}"',
  },
  {
    regex: /^find\s+delivery\s*$/i,
    reason: 'Input is ambiguous: missing order ID for delivery lookup. Expected format: "find delivery for order {id}"',
  },
  {
    regex: /^trace\s+billing\s+back\s+to\s+order\s*$/i,
    reason: 'Input is ambiguous: missing billing document ID for backward trace. Expected format: "trace billing {id} back to order"',
  },
  {
    regex: /^is\s+payment\s+missing\s*$/i,
    reason: 'Input is ambiguous: missing billing document ID for payment flow check. Expected format: "is payment missing for billing {id}"',
  },
];

/**
 * Ordered list of supported patterns.
 * Matched in sequence until first match is found.
 */
const SUPPORTED_PATTERNS: PatternMatch[] = [
  showPaymentPattern,
  findDeliveryPattern,
  traceBillingBackPattern,
  missingPaymentPattern,
];

// ============================================================================
// PLACEHOLDER TRANSLATOR IMPLEMENTATION
// ============================================================================

/**
 * Translate a natural language question to a structured GraphQueryRequest.
 *
 * This is a deterministic placeholder translator that:
 * - Matches input against a whitelist of supported patterns
 * - Extracts parameters deterministically (no fuzzy interpretation)
 * - Returns safe structured results (translated, unsupported, or ambiguous)
 * - Does NOT call external LLMs (those are integrated in later phases)
 *
 * Future phases will replace this with real LLM translation while maintaining
 * this contract shape; execution/validation still decide what is ultimately valid.
 *
 * @param input - Natural language question to translate
 * @returns Translation result with status and optional query or reason
 */
export function translateNaturalLanguageToQuery(
  input: string
): NlQueryTranslationResult {
  // Normalize input
  const normalized = input.trim();

  if (!normalized) {
    return {
      status: 'unsupported',
      input,
      reason: 'Empty input',
    };
  }

  // Try to match against ambiguous patterns first
  // (recognizes intent but lacks required parameters)
  for (const pattern of ambiguousPatterns) {
    if (pattern.regex.test(normalized)) {
      return {
        status: 'ambiguous',
        input,
        reason: pattern.reason,
      };
    }
  }

  // Try to match against supported patterns
  for (const pattern of SUPPORTED_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (match) {
      return pattern.extract(normalized, match);
    }
  }

  // Input is clearly unsupported (doesn't match any known pattern)
  // This is safe failure mode: don't speculate, don't hallucinate
  return {
    status: 'unsupported',
    input,
    reason:
      'Input does not match any supported NL pattern. ' +
      'Supported patterns: "show payment for order {id}", ' +
      '"find delivery for order {id}", ' +
      '"trace billing {id} back to order", ' +
      '"is payment missing for billing {id}"',
  };
}
