'use client';

import LiveMapPage from '@/components/LiveMapPage';
// We might still need auth checks depending on whether the map is public or not
// Keeping session check for now, adjust if map should be public
import { useSession } from 'next-auth/react';
import React from 'react';

export default function Home() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="loading-fullpage">Checking authentication...</div>;
  }

  // Render SettlingMapPage if authenticated, otherwise show login message
  // Modify this logic if the map should be accessible without login
  if (status === 'authenticated') {
     return <LiveMapPage />;
  }
  
  return (
    <div className="unauthenticated-message">
      Please log in using Discord to access the map.
    </div>
  );
} 