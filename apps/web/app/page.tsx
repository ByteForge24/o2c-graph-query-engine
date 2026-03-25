'use client';

import { useState } from 'react';
import GraphPanel from '@/components/GraphPanel';
import ChatPanel from '@/components/ChatPanel';
import HealthStatus from '@/components/HealthStatus';

export default function Home() {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-screen">
      <GraphPanel focusedNodeId={focusedNodeId} />
      <ChatPanel onFocusNode={setFocusedNodeId} />
      <div className="absolute right-6 top-6">
        <HealthStatus />
      </div>
    </div>
  );
}
