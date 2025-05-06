'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Header.css';

const Header: React.FC = () => {
  const pathname = usePathname();

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
        </nav>
      </div>
    </header>
  );
};

export default Header; 