'use client';

import Dashboard from '@/components/Dashboard';
import { useSession } from 'next-auth/react';
import React from 'react';

// This component renders the original dashboard content
export default function SeasonPassesDashboardPage() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="loading-fullpage">Checking authentication...</div>;
  }

  if (status === 'authenticated') {
    return <Dashboard />; // Render the actual Dashboard component
  }

  // Redirect or show message if not authenticated
  return (
    <div className="unauthenticated-message">
      Please log in using Discord to access the Season Passes Dashboard.
    </div>
  );
} 