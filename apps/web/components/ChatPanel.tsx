'use client';

import { useState } from 'react';
import { runQuery, runNlQuery } from '@/lib/api';
import type { QueryApiResponse } from '@/lib/api';

// Query presets for core O2C deterministic scenarios
const QUERY_PRESETS = [
  {
    id: 'order-to-delivery',
    name: 'Order → Delivery',
    description: 'Trace order to delivery item',
    payload: {
      intent: 'trace_forward',
      startNode: {
        type: 'SalesOrder',
        id: '740506',
      },
      targetNodeType: 'DeliveryItem',
      direction: 'outbound',
      maxDepth: 3,
    },
  },
  {
    id: 'order-to-payment',
    name: 'Order → Payment',
    description: 'Trace order through full O2C to payment',
    payload: {
      intent: 'trace_forward',
      startNode: {
        type: 'SalesOrder',
        id: '740506',
      },
      targetNodeType: 'Payment',
      direction: 'outbound',
      maxDepth: 6,
    },
  },
  {
    id: 'billing-to-order',
    name: 'Billing → Order',
    description: 'Trace billing document back to original order',
    payload: {
      intent: 'trace_backward',
      startNode: {
        type: 'BillingDocument',
        id: '90504274',
      },
      targetNodeType: 'SalesOrder',
      direction: 'inbound',
      maxDepth: 5,
    },
  },
  {
    id: 'detect-missing-payment',
    name: 'Detect Missing Payment',
    description: 'Detect if payment flow is missing from billing',
    payload: {
      intent: 'detect_missing_flow',
      startNode: {
        type: 'BillingDocument',
        id: '90504274',
      },
      targetNodeType: 'Payment',
      direction: 'outbound',
      maxDepth: 10,
    },
  },
];

// Natural language query examples (aligned with translator whitelist)
const NL_EXAMPLES = [
  {
    id: 'show-payment',
    title: 'Show Payment',
    text: 'show payment for order 740506',
  },
  {
    id: 'find-delivery',
    title: 'Find Delivery',
    text: 'find delivery for order 740506',
  },
  {
    id: 'trace-billing',
    title: 'Trace Billing',
    text: 'trace billing 90504274 back to order',
  },
  {
    id: 'missing-payment',
    title: 'Missing Payment',
    text: 'is payment missing for billing 90504274',
  },
];

const DEFAULT_PRESET = QUERY_PRESETS[1]; // Order -> Payment
type QueryMode = 'Structured' | 'Natural Language';

interface ChatPanelProps {
  onFocusNode?: (nodeId: string) => void;
}

export default function ChatPanel({ onFocusNode }: ChatPanelProps) {
  const [queryMode, setQueryMode] = useState<QueryMode>('Structured');
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET.id);
  const [queryText, setQueryText] = useState(
    JSON.stringify(DEFAULT_PRESET.payload, null, 2)
  );
  const [nlInput, setNlInput] = useState(NL_EXAMPLES[0].text);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryApiResponse | null>(null);

  const selectedPreset = QUERY_PRESETS.find((p) => p.id === selectedPresetId);

  const handleModeChange = (mode: QueryMode) => {
    setQueryMode(mode);
    // Clear stale mode-specific validation messages when switching modes
    setError(null);
    setParseError(null);
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = QUERY_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setSelectedPresetId(presetId);
      setQueryText(JSON.stringify(preset.payload, null, 2));
      // Clear stale response when selecting a new preset
      setResponse(null);
      setError(null);
      setParseError(null);
    }
  };

  const handleExampleSelect = (exampleText: string) => {
    setNlInput(exampleText);
    // Clear stale response when selecting a new example
    setResponse(null);
    setError(null);
  };

  const handleResetToPreset = () => {
    if (selectedPreset) {
      setQueryText(JSON.stringify(selectedPreset.payload, null, 2));
      setParseError(null);
    }
  };

  const validateAndParse = (): any => {
    setParseError(null);
    try {
      return JSON.parse(queryText);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Invalid JSON';
      setParseError(`JSON Parse Error: ${errorMsg}`);
      return null;
    }
  };

  const isStructuredInputValid = (): boolean => {
    try {
      JSON.parse(queryText);
      return true;
    } catch {
      return false;
    }
  };

  const isNlInputValid = (): boolean => {
    return nlInput.trim().length > 0;
  };

  const handleClearResponse = () => {
    setResponse(null);
    setError(null);
  };

  const handleRunQuery = async () => {
    if (queryMode === 'Structured') {
      const parsed = validateAndParse();
      if (!parsed) return;

      setLoading(true);
      setError(null);
      setResponse(null);

      try {
        const result = await runQuery(parsed);
        setResponse(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    } else {
      // Natural Language mode
      const trimmedInput = nlInput.trim();
      if (!trimmedInput) {
        setError('Please enter a natural language query');
        return;
      }

      setLoading(true);
      setError(null);
      setResponse(null);

      try {
        const result = await runNlQuery(trimmedInput);
        setResponse(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="w-1/2 bg-white p-6 overflow-y-auto flex flex-col">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-gray-900">Query</h1>
        <p className="text-xs text-gray-600">Deterministic query runner</p>
      </div>

      {/* Mode Switch */}
      <div className="mt-4 flex gap-2">
        {(['Structured', 'Natural Language'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={`px-3 py-1 rounded text-sm font-medium transition ${
              queryMode === mode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Structured Mode */}
      {queryMode === 'Structured' && (
        <>
          {/* Mode Helper */}
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            Structured mode gives you full control over the query. Select a preset or manually edit the JSON.
          </div>

          {/* Presets */}
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Presets</label>
            <div className="flex flex-wrap gap-2">
              {QUERY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`text-xs px-3 py-1 rounded transition ${
                    selectedPresetId === preset.id
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            {selectedPreset && (
              <div className="text-xs text-gray-600 italic">
                {selectedPreset.description}
              </div>
            )}
          </div>

          {/* Query Input */}
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Structured Query (JSON)
            </label>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="rounded border border-gray-300 p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={8}
              placeholder="Enter a structured query..."
            />
            {parseError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {parseError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleRunQuery}
                disabled={loading || !isStructuredInputValid()}
                className="rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
              >
                {loading ? 'Running...' : 'Run Query'}
              </button>
              <button
                onClick={handleResetToPreset}
                className="rounded bg-gray-300 px-3 py-2 text-gray-800 font-medium hover:bg-gray-400 text-sm"
                title="Reset to selected preset"
              >
                Reset
              </button>
            </div>
          </div>
        </>
      )}

      {/* Natural Language Mode */}
      {queryMode === 'Natural Language' && (
        <>
          {/* Supported Scope Guidance */}
          <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
            <div className="font-medium text-blue-900 mb-2">Supported Patterns</div>
            <div className="text-blue-800 text-xs mb-2">
              Natural Language mode translates entered text to structured queries using a whitelist of patterns.
            </div>
            <ul className="text-blue-800 space-y-1 text-xs">
              <li>• Payment for a specific order</li>
              <li>• Delivery for a specific order</li>
              <li>• Billing document back to order</li>
              <li>• Missing payment detection for billing</li>
            </ul>
            <div className="text-xs text-blue-700 mt-2 italic">
              Try including an order or billing document ID (e.g., 740506, 90504274)
            </div>
          </div>

          {/* NL Examples */}
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Examples</label>
            <div className="flex flex-wrap gap-2">
              {NL_EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  onClick={() => handleExampleSelect(example.text)}
                  className={`text-xs px-3 py-1 rounded transition ${
                    nlInput === example.text
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {example.title}
                </button>
              ))}
            </div>
          </div>

          {/* NL Input */}
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Natural Language Query
            </label>
            <textarea
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              className="rounded border border-gray-300 p-3 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Ask in plain English..."
            />
            <button
              onClick={handleRunQuery}
              disabled={loading || !isNlInputValid()}
              className="rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Running...' : 'Run Query'}
            </button>
          </div>
        </>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3">
          <div className="text-sm font-medium text-red-900">Error</div>
          <div className="text-sm text-red-700 mt-1">{error}</div>
        </div>
      )}

      {/* Response Summary */}
      {response && (
        <div className="mt-4 flex-1 flex flex-col gap-2 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Response</div>
            <button
              onClick={handleClearResponse}
              className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
              title="Clear response"
            >
              Clear
            </button>
          </div>

          {/* Translation Metadata (for NL mode) */}
          {'translation' in response && response.translation && (
            <>
              {response.translation.status === 'translated' && (
                <div className="rounded border border-green-200 bg-green-50 p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                    <span className="font-medium text-green-900">Translation Successful</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-800">Intent:</span>{' '}
                    <span className="text-green-700 font-mono text-xs">
                      {response.translation.query?.intent}
                    </span>
                  </div>
                  {response.translation.query?.targetNodeType && (
                    <div>
                      <span className="font-medium text-green-800">Target:</span>{' '}
                      <span className="text-green-700 font-mono text-xs">
                        {response.translation.query.targetNodeType}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {response.translation.status === 'ambiguous' && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-amber-600 rounded-full"></span>
                    <span className="font-medium text-amber-900">Translation Ambiguous</span>
                  </div>
                  <div className="text-amber-800">
                    <span className="font-medium">Why:</span> {response.translation.reason}
                  </div>
                  {queryMode === 'Natural Language' && (
                    <div className="text-amber-700 text-xs mt-2 pt-2 border-t border-amber-200">
                      <span className="font-medium">💡 Tip:</span> Try one of the example prompts above or include the specific ID.
                    </div>
                  )}
                </div>
              )}

              {response.translation.status === 'unsupported' && (
                <div className="rounded border border-red-300 bg-red-50 p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-red-600 rounded-full"></span>
                    <span className="font-medium text-red-900">Not Supported Yet</span>
                  </div>
                  <div className="text-red-800">
                    <span className="font-medium">Why:</span> {response.translation.reason}
                  </div>
                  {queryMode === 'Natural Language' && (
                    <div className="text-red-700 text-xs mt-2 pt-2 border-t border-red-200">
                      <span className="font-medium">💡 Tip:</span> Try one of the example prompts above to see supported patterns.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Summary */}
          <div className="rounded border border-gray-300 bg-gray-50 p-3 text-sm space-y-1">
            <div>
              <span className="font-medium">Success:</span>{' '}
              <span className={response.success ? 'text-green-600' : 'text-red-600'}>
                {String(response.success)}
              </span>
            </div>
            {response.data && (
              <>
                <div>
                  <span className="font-medium">Query OK:</span>{' '}
                  <span className={response.data.ok ? 'text-green-600' : 'text-orange-600'}>
                    {String(response.data.ok)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Start Node:</span>{' '}
                  <span className="text-gray-700">
                    {response.data.resolvedStartNode ? (
                      <span className="font-mono text-xs">
                        {response.data.resolvedStartNode.type}
                        {':'}
                        {response.data.resolvedStartNode.businessId && `${response.data.resolvedStartNode.businessId}:`}
                        {response.data.resolvedStartNode.nodeId}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Matches:</span>{' '}
                  <span className="text-gray-700">
                    {response.data.matches?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Paths:</span>{' '}
                  <span className="text-gray-700">
                    {response.data.paths?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Visited Nodes:</span>{' '}
                  <span className="text-gray-700">
                    {response.data.evidence?.visitedNodeIds?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Traversed Edges:</span>{' '}
                  <span className="text-gray-700">
                    {response.data.evidence?.traversedEdges?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Missing Flows:</span>{' '}
                  <span className="text-gray-700">
                    {response.data.missingFlows?.length || 0}
                  </span>
                </div>
                {response.data.error && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-red-700">
                    <span className="font-medium">Error:</span> {response.data.error}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Top Matches */}
          {response.data?.matches && response.data.matches.length > 0 && (
            <div className="rounded border border-blue-200 bg-blue-50 p-3">
              <div className="text-sm font-medium text-blue-900 mb-2">
                Top Matches ({response.data.matches.length})
              </div>
              <div className="text-xs text-blue-700 mb-2">💡 Click a match to inspect in graph panel</div>
              <div className="space-y-2">
                {response.data.matches.slice(0, 3).map((match: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => onFocusNode?.(match.nodeId)}
                    className="rounded bg-white p-2 border border-blue-100 text-xs space-y-1 cursor-pointer hover:border-blue-300 hover:shadow-md transition"
                  >
                    <div>
                      <span className="font-medium text-blue-900">Type:</span>{' '}
                      <span className="font-mono text-blue-700">{match.type || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Business ID:</span>{' '}
                      <span className="font-mono text-blue-700">{match.businessId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Node ID:</span>{' '}
                      <span className="font-mono text-blue-700">{match.nodeId || 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
              {response.data.matches.length > 3 && (
                <div className="text-xs text-blue-600 mt-2 italic">
                  + {response.data.matches.length - 3} more
                </div>
              )}
            </div>
          )}

          {/* Paths - Flow View */}
          {response.data?.paths && response.data.paths.length > 0 && (
            <div className="rounded border border-purple-200 bg-purple-50 p-3">
              <div className="text-sm font-medium text-purple-900 mb-2">
                Flow View ({response.data.paths.length})
              </div>
              <div className="text-xs text-purple-700 mb-2">💡 Click a path node to inspect in graph panel</div>
              <div className="space-y-3">
                {response.data.paths.slice(0, 2).map((path: any, idx: number) => {
                  const nodeIds = path.nodeIds || [];
                  const edgeTypes = path.edgeTypes || [];

                  return (
                    <div key={idx} className="rounded bg-white p-3 border border-purple-100">
                      {/* Path Length Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-purple-200 text-purple-800 font-medium text-xs">
                          {nodeIds.length} nodes
                        </span>
                        <span className="text-xs text-gray-600">
                          {edgeTypes.length} hop{edgeTypes.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Visual Flow */}
                      <div className="overflow-x-auto">
                        <div className="flex items-center gap-1 pb-2 min-w-min">
                          {nodeIds.map((nodeId: string, nodeIdx: number) => {
                            const isStart = nodeIdx === 0;
                            const isEnd = nodeIdx === nodeIds.length - 1;

                            return (
                              <div key={nodeIdx} className="flex items-center gap-1">
                                {/* Node Pill */}
                                <div
                                  onClick={() => onFocusNode?.(nodeId)}
                                  className={`px-2 py-1 rounded-full font-mono text-xs whitespace-nowrap border-2 cursor-pointer transition ${
                                    isStart
                                      ? 'bg-green-100 border-green-400 text-green-900 font-medium hover:shadow-md hover:border-green-500'
                                      : isEnd
                                      ? 'bg-red-100 border-red-400 text-red-900 font-medium hover:shadow-md hover:border-red-500'
                                      : 'bg-gray-100 border-gray-300 text-gray-800 hover:shadow-md hover:border-gray-400'
                                  }`}
                                  title={nodeId}
                                >
                                  {nodeId.length > 12 ? nodeId.slice(0, 10) + '…' : nodeId}
                                </div>

                                {/* Arrow + Edge Type (if not last node) */}
                                {nodeIdx < nodeIds.length - 1 && (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-purple-500 font-bold text-xs">→</span>
                                    {edgeTypes[nodeIdx] && (
                                      <span className="text-xs font-medium text-purple-700 whitespace-nowrap">
                                        {edgeTypes[nodeIdx]}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Full Node Sequence (compact reference) */}
                      {nodeIds.length > 3 && (
                        <div className="mt-2 pt-2 border-t border-purple-100 text-xs text-gray-600">
                          <span className="font-medium">Full path:</span>{' '}
                          <span className="font-mono text-gray-700">{nodeIds.join(' → ')}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {response.data.paths.length > 2 && (
                <div className="text-xs text-purple-600 mt-2 italic">
                  + {response.data.paths.length - 2} more path{response.data.paths.length - 2 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Missing Flows */}
          {response.data?.missingFlows && response.data.missingFlows.length > 0 && (
            <div className="rounded border border-yellow-300 bg-yellow-50 p-3">
              <div className="text-sm font-medium text-yellow-900 mb-2 flex items-center gap-1">
                <span>⚠️</span>
                Missing Flows ({response.data.missingFlows.length})
              </div>
              <div className="space-y-2">
                {response.data.missingFlows.map((flow: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded bg-white p-2 border border-yellow-200 text-xs space-y-1"
                  >
                    <div>
                      <span className="font-medium text-yellow-900">Expected Node Type:</span>
                      <div className="font-mono text-yellow-700 mt-1">
                        {flow.expectedNodeType || 'N/A'}
                      </div>
                    </div>
                    {flow.reason && (
                      <div>
                        <span className="font-medium text-yellow-900">Reason:</span>
                        <div className="text-yellow-800 mt-1">{flow.reason}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full JSON (collapsible/debug) */}
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900">
              Full Response (JSON)
            </summary>
            <pre className="mt-2 rounded bg-gray-100 p-2 overflow-x-auto text-gray-800">
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
