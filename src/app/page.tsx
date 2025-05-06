'use client';

import Dashboard from '@/components/Dashboard';
import { useSession } from 'next-auth/react';
import React from 'react';

export default function Home() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="loading-fullpage">Checking authentication...</div>;
  }

  if (status === 'authenticated') {
    return <Dashboard />;
  }

  return (
    <div className="unauthenticated-message">
      Please log in using Discord to access the dashboard.
    </div>
  );
} 