"use client";

import SupersetDashboard from '../_components/SupersetDashboard';
import { useState } from 'react';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);

  const handleEdit = async () => {
    try {
      setLoading(true);
      // Fetch a short-lived autologin token (using same-site POST so cookies are sent)
      const res = await fetch('/api/superset/autologin-token', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to fetch autologin token');
      
      const { token } = await res.json();
      
      // Open autologin route in a new tab with the token in query params
      const nextParam = encodeURIComponent('http://localhost:8089/superset/dashboard/4/');
      window.open(`/api/superset/autologin?token=${token}&next=${nextParam}`, '_blank');
    } catch (err) {
      console.error(err);
      alert('Could not authenticate with Superset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full p-6">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900">XEL Analytics</h1>
        <button
          onClick={handleEdit}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
        >
          {loading ? 'Authenticating...' : 'Launch XEL Analytics'}
          <span className="text-xs font-normal">↗</span>
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full flex-grow overflow-hidden">
        {/* Embed UUID for Sales Dashboard (Superset embedded API) */}
        <SupersetDashboard dashboardId="70da153a-283b-455e-918c-3ba3f251ba91" />
      </div>
    </div>
  );
}
