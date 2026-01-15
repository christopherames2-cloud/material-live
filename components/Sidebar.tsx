'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('materialive_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem('materialive_token');
    
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    localStorage.removeItem('materialive_token');
    localStorage.removeItem('materialive_user');
    router.push('/');
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/board', label: 'Shelf Board', icon: '📋' },
    { href: '/receiving', label: 'Receiving', icon: '📦' },
    { href: '/delivery', label: 'Delivery', icon: '🚚' },
  ];

  // Admin-only items
  if (user?.role === 'admin') {
    navItems.push({ href: '/admin', label: 'Settings', icon: '⚙️' });
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <>
      {/* Mobile menu toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'none',
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 101,
          background: 'var(--bg-card)',
          border: 'none',
          color: 'white',
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          fontSize: '1.5rem',
        }}
      >
        ☰
      </button>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">MateriaLive</div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {user && (
          <div className="sidebar-user">
            <div className="user-info">
              <div className="user-avatar">{getInitials(user.fullName)}</div>
              <div>
                <div className="user-name">{user.fullName}</div>
                <div className="user-role">{user.role}</div>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="btn btn-secondary btn-block"
              style={{ fontSize: '0.875rem' }}
            >
              Sign Out
            </button>
          </div>
        )}
      </aside>

      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-menu-toggle {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
