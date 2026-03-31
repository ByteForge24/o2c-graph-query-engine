'use client';

import { useState } from 'react';
import GraphPanel from '@/components/GraphPanel';
import ChatPanel from '@/components/ChatPanel';
import HealthStatus from '@/components/HealthStatus';

interface FocusedPath {
  nodeIds: string[];
  edgeTypes: string[];
}

export default function Home() {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<FocusedPath | null>(null);

  return (
    <div className="flex h-screen w-screen">
      <GraphPanel focusedNodeId={focusedNodeId} focusedPath={focusedPath} />
      <ChatPanel
        onFocusNode={setFocusedNodeId}
        onFocusPath={setFocusedPath}
      />
      <div className="absolute right-6 top-6">
        <HealthStatus />
      </div>
    </div>
  );
}
