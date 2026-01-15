'use client';

import { useEffect, useState } from 'react';
import AuthWrapper from '@/components/AuthWrapper';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  active: number;
  last_login: string;
}

interface Location {
  id: number;
  ce_locationnum: number;
  name: string;
  type: number;
  active: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeTab, setActiveTab] = useState('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    pin: '',
    role: 'warehouse',
  });
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/admin/locations', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.fullName || !newUser.pin) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    if (newUser.pin.length !== 4 || !/^\d+$/.test(newUser.pin)) {
      setMessage({ type: 'error', text: 'PIN must be exactly 4 digits' });
      return;
    }

    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'User created successfully' });
        setShowUserModal(false);
        setNewUser({ username: '', fullName: '', pin: '', role: 'warehouse' });
        fetchUsers();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to create user' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create user' });
    }
  };

  const toggleUserActive = async (userId: number, currentActive: number) => {
    try {
      const token = localStorage.getItem('materialive_token');
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: currentActive ? 0 : 1 }),
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to toggle user:', error);
    }
  };

  return (
    <AuthWrapper requiredRole="admin">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'}`}>
          {message.text}
          <button 
            onClick={() => setMessage(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['users', 'locations', 'sync'].map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem' }}>User Management</h2>
            <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>
              + Add User
            </button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.full_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
                  <td>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: user.active ? 'var(--success)' : 'var(--danger)',
                      color: 'white',
                    }}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn ${user.active ? 'btn-danger' : 'btn-success'}`}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => toggleUserActive(user.id, user.active)}
                    >
                      {user.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Locations Tab */}
      {activeTab === 'locations' && (
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Inventory Locations</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Locations are synced from ComputerEase iclocation table where type = 1
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>CE Location #</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td>{loc.ce_locationnum || '-'}</td>
                  <td>{loc.name}</td>
                  <td>{loc.type}</td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: loc.active ? 'var(--success)' : 'var(--danger)',
                      color: 'white',
                    }}>
                      {loc.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sync Tab */}
      {activeTab === 'sync' && (
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>ComputerEase Sync</h2>
          
          <div style={{ 
            background: 'var(--bg-dark)', 
            padding: '1.5rem', 
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Local Agent Required</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              To sync data with ComputerEase, you need to install the MateriaLive Agent 
              on a computer with access to the ComputerEase ODBC connection.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: '1', minWidth: '250px', background: 'var(--bg-dark)' }}>
              <h4>Sync Status</h4>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Agent Status: <span style={{ color: 'var(--warning)' }}>Not Connected</span>
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                Last Sync: Never
              </p>
            </div>

            <div className="card" style={{ flex: '1', minWidth: '250px', background: 'var(--bg-dark)' }}>
              <h4>Tables to Sync</h4>
              <ul style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                <li>icpo (Purchase Orders)</li>
                <li>icpoitem (PO Items)</li>
                <li>icpodist (PO Distribution)</li>
                <li>icreceived (Received Items)</li>
                <li>iclocation (Locations)</li>
                <li>jcjob (Jobs)</li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Agent Connection String</h4>
            <div style={{ 
              background: 'var(--bg-dark)', 
              padding: '1rem', 
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              overflowX: 'auto'
            }}>
              CLOUD_URL=https://your-materialive-app.com<br/>
              CLOUD_API_KEY=your-api-key-here<br/>
              CE_DSN=Company 0 - System
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New User</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toUpperCase() })}
                  placeholder="e.g., JSMITH"
                />
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  placeholder="e.g., John Smith"
                />
              </div>

              <div className="form-group">
                <label>PIN (4 digits)</label>
                <input
                  type="password"
                  className="form-input"
                  value={newUser.pin}
                  onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="••••"
                  maxLength={4}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  className="form-input"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="warehouse">Warehouse (Full Access)</option>
                  <option value="field">Field (View Only)</option>
                  <option value="admin">Admin (Settings Access)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateUser}>
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthWrapper>
  );
}
