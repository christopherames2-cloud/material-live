'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });

      const data = await res.json();

      if (data.success) {
        // Store token in localStorage
        localStorage.setItem('materialive_token', data.token);
        localStorage.setItem('materialive_user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(value);
  };

  return (
    <div className="login-container">
      <h1 className="login-logo">MateriaLive</h1>
      <p className="login-tagline">Warehouse Inventory & Delivery Tracking</p>

      <div className="login-box">
        <h2 className="login-title">Sign In</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value.toUpperCase())}
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="pin">PIN</label>
            <input
              type="password"
              id="pin"
              className="form-input pin-input"
              value={pin}
              onChange={handlePinChange}
              placeholder="••••"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={loading || !username || pin.length !== 4}
            style={{ marginTop: '1.5rem' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      <p style={{ marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        BEC Inc. - Glendora Warehouse
      </p>
    </div>
  );
}
