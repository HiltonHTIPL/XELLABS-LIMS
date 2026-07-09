"use client";

import React, { useEffect, useRef, useState } from "react";
import { embedDashboard } from "@superset-ui/embedded-sdk";

interface SupersetDashboardProps {
  dashboardId: string;
}

export default function SupersetDashboard({ dashboardId }: SupersetDashboardProps) {
  const mountPointRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const setupDashboard = async () => {
      if (!mountPointRef.current) return;

      try {
        setLoading(true);
        // Fetch guest token from local API
        const response = await fetch("/api/superset/guest-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dashboardId }),
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch guest token");
        }
        
        const data = await response.json();
        
        // Fallback to various common properties that might hold the token
        const guestToken = data.token || data.guestToken;

        if (!guestToken) {
           throw new Error("No guest token returned from API");
        }

        // Embed the dashboard
        if (mountPointRef.current) {
          const supersetDomain = process.env.NEXT_PUBLIC_SUPERSET_DOMAIN || "http://localhost:8088";
          
          embedDashboard({
            id: dashboardId,
            supersetDomain,
            mountPoint: mountPointRef.current,
            fetchGuestToken: () => Promise.resolve(guestToken),
            dashboardUiConfig: {
              hideTitle: true,
              hideTab: true,
              hideChartControls: true,
            },
          });
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "An error occurred while loading the dashboard");
          console.error("Error embedding Superset dashboard:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setupDashboard();

    return () => {
      isMounted = false;
      if (mountPointRef.current) {
        mountPointRef.current.innerHTML = "";
      }
    };
  }, [dashboardId]);

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-md m-4">
          <p className="font-semibold">Error loading dashboard</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
      <div ref={mountPointRef} className="w-full h-full flex-grow [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-none" />
    </div>
  );
}
