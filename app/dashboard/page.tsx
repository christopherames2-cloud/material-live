'use client';

import { useEffect, useState } from 'react';
import AuthWrapper from '@/components/AuthWrapper';
import Link from 'next/link';

interface DashboardStats {
  totalStaged: number;
  readyForPickup: number;
  pendingDelivery: number;
  openPOs: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStaged: 0,
    readyForPickup: 0,
    pendingDelivery: 0,
    openPOs: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('materialive_token');
      
      const res = await fetch('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentActivity(data.recentActivity || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthWrapper>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/receiving" className="btn btn-primary">
            📦 Receive Items
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="card-grid" style={{ marginBottom: '2rem' }}>
        <div className="card stat-card">
          <div className="stat-value">{stats.totalStaged}</div>
          <div className="stat-label">Items Staged</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.readyForPickup}</div>
          <div className="stat-label">Ready for Pickup</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pendingDelivery}</div>
          <div className="stat-label">Pending Delivery</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{stats.openPOs}</div>
          <div className="stat-label">Open POs</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link href="/board" className="btn btn-secondary">
            📋 View Shelf Board
          </Link>
          <Link href="/receiving" className="btn btn-secondary">
            📦 Receive PO Items
          </Link>
          <Link href="/delivery" className="btn btn-secondary">
            🚚 Process Delivery
          </Link>
          <Link href="/board?scan=true" className="btn btn-secondary">
            📱 Scan QR Code
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Recent Activity</h2>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        ) : recentActivity.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Request ID</th>
                <th>Location</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((activity, index) => (
                <tr key={index}>
                  <td>{activity.time}</td>
                  <td>{activity.action}</td>
                  <td>{activity.requestId}</td>
                  <td>{activity.location}</td>
                  <td>{activity.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>
            No recent activity. Start by receiving items or staging materials.
          </p>
        )}
      </div>

      {/* System Status */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>System Status</h2>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              background: 'var(--success)',
              display: 'inline-block'
            }}></span>
            <span>Cloud Database: Connected</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              background: 'var(--text-secondary)',
              display: 'inline-block'
            }}></span>
            <span>ComputerEase Sync: Awaiting Agent</span>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
