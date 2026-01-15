'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';

interface AuthWrapperProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'warehouse' | 'field' | null;
}

// Simple JWT decode (just to read payload, not verify - server does that)
function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  return payload.exp < Math.floor(Date.now() / 1000);
}

export default function AuthWrapper({ children, requiredRole = null }: AuthWrapperProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('materialive_token');
      const userData = localStorage.getItem('materialive_user');

      if (!token || !userData) {
        router.push('/');
        return;
      }

      // Check if token is expired (client-side check)
      if (isTokenExpired(token)) {
        localStorage.removeItem('materialive_token');
        localStorage.removeItem('materialive_user');
        router.push('/');
        return;
      }

      // Parse user data
      try {
        const user = JSON.parse(userData);
        
        // Check role if required
        if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
          router.push('/dashboard');
          return;
        }
        
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('materialive_token');
        localStorage.removeItem('materialive_user');
        router.push('/');
        return;
      }
      
      setIsLoading(false);
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
