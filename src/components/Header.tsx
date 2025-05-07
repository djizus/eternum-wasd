'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import './Header.css';

const Header: React.FC = () => {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-logo">
          <Link href="/" className="logo-link">
            <span className="logo-text">WASD</span>
            <span className="logo-subtitle">Guild</span>
          </Link>
        </div>
        <nav className="header-nav">
          {status === 'authenticated' && (
            <>
              <Link 
                href="/" 
                className={`nav-link ${pathname === '/' ? 'active' : ''}`}
              >
                Dashboard
              </Link>
              <Link 
                href="/members" 
                className={`nav-link ${pathname === '/members' ? 'active' : ''}`}
              >
                Members
              </Link>
              <Link 
                href="/settling-map" 
                className={`nav-link ${pathname === '/settling-map' ? 'active' : ''}`}
              >
                Settling Map
              </Link>
            </>
          )}
        </nav>
        <div className="header-auth-status">
          {status === 'loading' && (
            <span className="auth-loading">Loading...</span>
          )}
          {status === 'unauthenticated' && (
            <button onClick={() => signIn('discord')} className="auth-button login">
              Login with Discord
            </button>
          )}
          {status === 'authenticated' && session?.user && (
            <div className="auth-user-info">
              {session.user.image ? (
                <Image 
                  src={session.user.image} 
                  alt={session.user.name || 'User'} 
                  className="user-avatar"
                  width={40}
                  height={40}
                />
              ) : (
                <span className="user-name">
                  {session.user.name || session.user.email}
                </span>
              )}
              <button onClick={() => signOut()} className="auth-button logout">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header; 