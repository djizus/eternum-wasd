'use client';

import MembersPage from '@/components/MembersPage';
import { useSession } from 'next-auth/react';
import React from 'react';

export default function Members() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="loading-fullpage">Checking authentication...</div>;
  }

  if (status === 'authenticated') {
    return <MembersPage />;
  }

  // Redirect or show message if not authenticated
  return (
    <div className="unauthenticated-message">
      Please log in using Discord to access the Members page.
    </div>
  );
} 