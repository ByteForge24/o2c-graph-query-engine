'use client';

import { useEffect, useState } from 'react';
import { healthCheck } from '@/lib/api';

export default function HealthStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'failed'>(
    'checking'
  );

  useEffect(() => {
    const checkHealth = async () => {
      const isHealthy = await healthCheck();
      setStatus(isHealthy ? 'connected' : 'failed');
    };

    checkHealth();
  }, []);

  return (
    <div className="rounded border border-gray-300 bg-gray-100 p-3">
      <span className="text-sm font-medium text-gray-700">
        {status === 'checking' && 'Checking API...'}
        {status === 'connected' && '✓ API Connected'}
        {status === 'failed' && '✗ API Failed'}
      </span>
    </div>
  );
}
