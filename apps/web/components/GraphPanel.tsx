'use client';

import { useEffect, useState, useMemo } from 'react';
import { getGraph, type GraphApiResponse } from '@/lib/api';

type ViewMode = 'summary' | 'nodes' | 'edges';

export default function GraphPanel() {
  const [graphData, setGraphData] = useState<GraphApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [sampleSize, setSampleSize] = useState(5);

  // Node filtering
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string | null>(null);

  // Edge filtering
  const [edgeSearch, setEdgeSearch] = useState('');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<string | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGraph();
      setGraphData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  // Get unique node and edge types
  const nodeTypes = useMemo(() => {
    if (!graphData?.data.nodes) return [];
    return [...new Set(graphData.data.nodes.map((n) => n.type))].sort();
  }, [graphData]);

  const edgeTypes = useMemo(() => {
    if (!graphData?.data.edges) return [];
    return [...new Set(graphData.data.edges.map((e) => e.type))].sort();
  }, [graphData]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    if (!graphData?.data.nodes) return [];
    const query = nodeSearch.toLowerCase();
    return graphData.data.nodes.filter((node) => {
      const matchesSearch = !query || 
        node.id.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query);
      const matchesType = !nodeTypeFilter || node.type === nodeTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [graphData?.data.nodes, nodeSearch, nodeTypeFilter]);

  // Filter edges
  const filteredEdges = useMemo(() => {
    if (!graphData?.data.edges) return [];
    const query = edgeSearch.toLowerCase();
    return graphData.data.edges.filter((edge) => {
      const matchesSearch = !query ||
        edge.source.toLowerCase().includes(query) ||
        edge.target.toLowerCase().includes(query) ||
        edge.type.toLowerCase().includes(query);
      const matchesType = !edgeTypeFilter || edge.type === edgeTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [graphData?.data.edges, edgeSearch, edgeTypeFilter]);

  return (
    <div className="w-1/2 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-gray-900">Graph</h1>
          <p className="text-xs text-gray-600">DB-backed graph snapshot</p>
        </div>
        <button
          onClick={fetchGraph}
          disabled={loading}
          className="px-3 py-1 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Loading State */}
      {loading && !graphData && (
        <div className="mt-4 rounded border border-gray-300 bg-white p-6 text-center text-gray-600">
          Loading graph data...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-4">
          <div className="text-sm font-medium text-red-900">Error</div>
          <div className="text-sm text-red-700 mt-1">{error}</div>
        </div>
      )}

      {/* Graph Data Display */}
      {graphData && !loading && (
        <div className="mt-4 flex-1 flex flex-col gap-3 overflow-y-auto">
          {/* View Mode Tabs */}
          <div className="flex gap-2">
            {(['summary', 'nodes', 'edges'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Summary Tab */}
          {viewMode === 'summary' && graphData.data.stats && (
            <div className="space-y-3">
              {/* Overall Stats */}
              <div className="rounded border border-gray-300 bg-white p-4">
                <div className="text-sm font-medium text-gray-900 mb-3">Overall Statistics</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Total Nodes:</span>
                    <div className="font-mono text-lg text-blue-600">
                      {graphData.data.stats.totalNodes}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Total Edges:</span>
                    <div className="font-mono text-lg text-blue-600">
                      {graphData.data.stats.totalEdges}
                    </div>
                  </div>
                </div>
              </div>

              {/* Node Breakdown */}
              {Object.keys(graphData.data.stats.nodeBreakdown).length > 0 && (
                <div className="rounded border border-gray-300 bg-white p-4">
                  <div className="text-sm font-medium text-gray-900 mb-2">Nodes by Type</div>
                  <div className="space-y-1">
                    {Object.entries(graphData.data.stats.nodeBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <div key={type} className="flex justify-between text-xs">
                          <span className="font-mono text-gray-700">{type}</span>
                          <span className="text-gray-600">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Edge Breakdown */}
              {Object.keys(graphData.data.stats.edgeBreakdown).length > 0 && (
                <div className="rounded border border-gray-300 bg-white p-4">
                  <div className="text-sm font-medium text-gray-900 mb-2">Edges by Type</div>
                  <div className="space-y-1">
                    {Object.entries(graphData.data.stats.edgeBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <div key={type} className="flex justify-between text-xs">
                          <span className="font-mono text-gray-700">{type}</span>
                          <span className="text-gray-600">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nodes Tab */}
          {viewMode === 'nodes' && (
            <div className="space-y-3">
              {/* Node Filters */}
              <div className="rounded border border-gray-300 bg-white p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search nodes (id, type)..."
                    value={nodeSearch}
                    onChange={(e) => setNodeSearch(e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {nodeSearch && (
                    <button
                      onClick={() => setNodeSearch('')}
                      className="px-2 py-1 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 text-xs font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {nodeTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setNodeTypeFilter(null)}
                      className={`text-xs px-2 py-0.5 rounded transition ${
                        !nodeTypeFilter
                          ? 'bg-blue-600 text-white font-medium'
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      }`}
                    >
                      All
                    </button>
                    {nodeTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => setNodeTypeFilter(type)}
                        className={`text-xs px-2 py-0.5 rounded transition ${
                          nodeTypeFilter === type
                            ? 'bg-blue-600 text-white font-medium'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}

                <div className="text-xs text-gray-600">
                  Showing {Math.min(sampleSize, filteredNodes.length)} of {filteredNodes.length} filtered{' '}
                  {nodeTypeFilter ? `${nodeTypeFilter} ` : ''}nodes
                  {nodeSearch && ` (search: "${nodeSearch}")`}
                </div>
              </div>

              {/* Node Controls */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600" />
                <select
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Number(e.target.value))}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  {[5, 10, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      Show {size}
                    </option>
                  ))}
                </select>
              </div>

              {/* Node List */}
              <div className="space-y-2">
                {filteredNodes.length === 0 ? (
                  <div className="rounded border border-gray-300 bg-white p-4 text-center text-sm text-gray-600">
                    No nodes match the filter
                  </div>
                ) : (
                  filteredNodes.slice(0, sampleSize).map((node) => (
                    <div key={node.id} className="rounded border border-gray-300 bg-white p-3">
                      <div className="font-mono text-xs text-blue-600 mb-1">{node.id}</div>
                      <div className="flex gap-2 text-xs mb-2">
                        <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {node.type}
                        </span>
                        {node.label && (
                          <span className="text-gray-600">{node.label}</span>
                        )}
                      </div>
                      {Object.keys(node.data).length > 0 && (
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {Object.entries(node.data)
                            .slice(0, 3)
                            .map(([key, val]) => (
                              <div key={key} className="truncate">
                                <span className="font-medium">{key}:</span>{' '}
                                {String(val).slice(0, 40)}
                              </div>
                            ))}
                          {Object.keys(node.data).length > 3 && (
                            <div className="text-gray-500 italic">
                              +{Object.keys(node.data).length - 3} more fields
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Edges Tab */}
          {viewMode === 'edges' && (
            <div className="space-y-3">
              {/* Edge Filters */}
              <div className="rounded border border-gray-300 bg-white p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search edges (source, target, type)..."
                    value={edgeSearch}
                    onChange={(e) => setEdgeSearch(e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {edgeSearch && (
                    <button
                      onClick={() => setEdgeSearch('')}
                      className="px-2 py-1 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 text-xs font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {edgeTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setEdgeTypeFilter(null)}
                      className={`text-xs px-2 py-0.5 rounded transition ${
                        !edgeTypeFilter
                          ? 'bg-blue-600 text-white font-medium'
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      }`}
                    >
                      All
                    </button>
                    {edgeTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => setEdgeTypeFilter(type)}
                        className={`text-xs px-2 py-0.5 rounded transition ${
                          edgeTypeFilter === type
                            ? 'bg-blue-600 text-white font-medium'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}

                <div className="text-xs text-gray-600">
                  Showing {Math.min(sampleSize, filteredEdges.length)} of {filteredEdges.length} filtered{' '}
                  {edgeTypeFilter ? `${edgeTypeFilter} ` : ''}edges
                  {edgeSearch && ` (search: "${edgeSearch}")`}
                </div>
              </div>

              {/* Edge Controls */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600" />
                <select
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Number(e.target.value))}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  {[5, 10, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      Show {size}
                    </option>
                  ))}
                </select>
              </div>

              {/* Edge List */}
              <div className="space-y-2">
                {filteredEdges.length === 0 ? (
                  <div className="rounded border border-gray-300 bg-white p-4 text-center text-sm text-gray-600">
                    No edges match the filter
                  </div>
                ) : (
                  filteredEdges.slice(0, sampleSize).map((edge, idx) => (
                    <div key={idx} className="rounded border border-gray-300 bg-white p-3">
                      <div className="font-mono text-xs space-y-1 mb-2">
                        <div className="text-blue-600">{edge.source}</div>
                        <div className="text-gray-600 flex items-center gap-1">
                          <span>→</span>
                          <span className="font-medium text-purple-600">{edge.type}</span>
                          <span>→</span>
                        </div>
                        <div className="text-blue-600">{edge.target}</div>
                      </div>
                      {edge.label && (
                        <div className="text-xs text-gray-600">
                          Label: <span className="font-medium">{edge.label}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
