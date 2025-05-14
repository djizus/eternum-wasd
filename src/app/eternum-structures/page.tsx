'use client';
import EternumStructuresPage from '@/components/EternumStructuresPage';
import { useSession } from 'next-auth/react';
import React from 'react';

export default function EternumStructures() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="loading-fullpage">Checking authentication...</div>;
  }

  if (status === 'authenticated') {
    return <EternumStructuresPage />;
  }

  // Redirect or show message if not authenticated
  return (
    <div className="unauthenticated-message">
      Please log in using Discord to access the Members page.
    </div>
  );
} 
