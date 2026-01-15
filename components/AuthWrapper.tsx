'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';

interface AuthWrapperProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'warehouse' | 'field' | null;
}

export default function AuthWrapper({ children, requiredRole = null }: AuthWrapperProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('materialive_token');
      const userData = localStorage.getItem('materialive_user');

      if (!token || !userData) {
        router.push('/');
        return;
      }

      try {
        const res = await fetch('/api/auth/session', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (data.valid) {
          // Check role if required
          if (requiredRole && data.user.role !== requiredRole && data.user.role !== 'admin') {
            // Admin can access everything, otherwise redirect
            router.push('/dashboard');
            return;
          }
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('materialive_token');
          localStorage.removeItem('materialive_user');
          router.push('/');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, requiredRole]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-dark)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
