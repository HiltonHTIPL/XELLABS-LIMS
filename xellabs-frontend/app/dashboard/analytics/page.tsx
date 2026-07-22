"use client";

import SupersetDashboard from '../_components/SupersetDashboard';
import { useState } from 'react';
import Link from 'next/link';

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
      const nextParam = encodeURIComponent('http://localhost:8088/superset/dashboard/6/');
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
        <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
          <span className="material-icons" style={{ fontSize: 16, color: '#374151' }}>arrow_back</span>
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Data Analytics</h1>
        <button
          onClick={handleEdit}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
        >
          {loading ? 'Authenticating...' : 'Launch Data Analytics'}
          <span className="text-xs font-normal">↗</span>
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full flex-grow overflow-hidden">
        <SupersetDashboard dashboardId="9d7824fb-69f1-4238-94a8-c3faa2a4603c" />
      </div>
    </div>
  );
}
