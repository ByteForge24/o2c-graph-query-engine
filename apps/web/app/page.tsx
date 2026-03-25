import GraphPanel from '@/components/GraphPanel';
import ChatPanel from '@/components/ChatPanel';
import HealthStatus from '@/components/HealthStatus';

export default function Home() {
  return (
    <div className="flex h-screen w-screen">
      <GraphPanel />
      <ChatPanel />
      <div className="absolute right-6 top-6">
        <HealthStatus />
      </div>
    </div>
  );
}
