'use client';

import { useEffect, useState } from 'react';
import AuthWrapper from '@/components/AuthWrapper';

interface StagingSpot {
  id: number;
  code: string;
  name: string;
  spot_type: string;
  grid_row: number;
  grid_col: number;
  // Staging record data if occupied
  staging_id?: number;
  request_id?: string;
  job_num?: string;
  job_name?: string;
  job_address?: string;
  pack_number?: string;
  item_descriptions?: string;
  status?: string;
  staged_at?: string;
  po_num?: string;
}

interface BoardSection {
  type: string;
  title: string;
  className: string;
  spots: StagingSpot[];
}

export default function BoardPage() {
  const [sections, setSections] = useState<BoardSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<StagingSpot | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchBoard();
  }, []);

  const fetchBoard = async () => {
    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/board', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSections(data.sections);
      }
    } catch (error) {
      console.error('Failed to fetch board:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpotClick = (spot: StagingSpot) => {
    setSelectedSpot(spot);
    setShowModal(true);
  };

  const getSectionTitle = (type: string): string => {
    const titles: Record<string, string> = {
      'will_call_construction': 'WILL CALL - CONSTRUCTION',
      'will_call_service': 'WILL CALL - SERVICE',
      'staging': 'STAGING IN WAREHOUSE',
      'delivery': 'CUSTOMER DELIVERY',
      'long_term': 'LONG TERM STORAGE',
      'pending_returns': 'PENDING RETURNS',
    };
    return titles[type] || type;
  };

  const getSectionClass = (type: string): string => {
    const classes: Record<string, string> = {
      'will_call_construction': 'will-call-construction',
      'will_call_service': 'will-call-service',
      'staging': 'staging',
      'delivery': 'delivery',
      'long_term': 'long-term',
      'pending_returns': 'pending-returns',
    };
    return classes[type] || '';
  };

  const getSpotColorClass = (spot: StagingSpot): string => {
    if (!spot.staging_id) return '';
    // Based on job type - could be expanded
    if (spot.job_num?.startsWith('SG')) return 'gcon';
    if (spot.job_num?.startsWith('SL')) return 'gsvc';
    return 'occupied';
  };

  if (loading) {
    return (
      <AuthWrapper>
        <div className="page-header">
          <h1 className="page-title">Shelf Board</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading board...</p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <div className="page-header">
        <h1 className="page-title">Shelf Board</h1>
        <button className="btn btn-primary" onClick={fetchBoard}>
          🔄 Refresh
        </button>
      </div>

      <div className="board-container">
        {sections.map((section) => (
          <div 
            key={section.type} 
            className={`board-section ${getSectionClass(section.type)}`}
          >
            <h2 className="board-section-title">
              {getSectionTitle(section.type)}
            </h2>
            <div className="board-grid">
              {section.spots.map((spot) => (
                <div
                  key={spot.id}
                  className={`spot-card ${spot.staging_id ? getSpotColorClass(spot) : ''}`}
                  onClick={() => handleSpotClick(spot)}
                >
                  <div className="spot-header">
                    <span className="spot-code">{spot.code}</span>
                    {spot.staging_id && (
                      <span className="spot-status">{spot.status}</span>
                    )}
                  </div>
                  {spot.staging_id ? (
                    <div className="spot-content">
                      <div className="spot-job">
                        {spot.job_num} - {spot.job_name}
                      </div>
                      {spot.job_address && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          {spot.job_address}
                        </div>
                      )}
                      <div className="spot-request">
                        FS: {spot.request_id || 'N/A'} | Pack: {spot.pack_number || '-'}
                      </div>
                      {spot.po_num && (
                        <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          PO: {spot.po_num}
                        </div>
                      )}
                      <div className="spot-items">
                        {spot.item_descriptions?.substring(0, 100)}
                        {(spot.item_descriptions?.length || 0) > 100 && '...'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      height: '100px',
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem'
                    }}>
                      Empty
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Spot Detail Modal */}
      {showModal && selectedSpot && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {selectedSpot.code} - {selectedSpot.staging_id ? 'Occupied' : 'Empty'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {selectedSpot.staging_id ? (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Job:</strong> {selectedSpot.job_num} - {selectedSpot.job_name}
                  </div>
                  {selectedSpot.job_address && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Address:</strong> {selectedSpot.job_address}
                    </div>
                  )}
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>FormSite ID:</strong> {selectedSpot.request_id || 'N/A'}
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Pack #:</strong> {selectedSpot.pack_number || '-'}
                  </div>
                  {selectedSpot.po_num && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>PO #:</strong> {selectedSpot.po_num}
                    </div>
                  )}
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Status:</strong> {selectedSpot.status}
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Staged:</strong> {selectedSpot.staged_at ? new Date(selectedSpot.staged_at).toLocaleString() : '-'}
                  </div>
                  <div>
                    <strong>Items:</strong>
                    <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                      {selectedSpot.item_descriptions || 'No description'}
                    </p>
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>
                  This spot is empty. Go to Receiving to stage items here.
                </p>
              )}
            </div>
            <div className="modal-footer">
              {selectedSpot.staging_id && (
                <>
                  <button className="btn btn-success">
                    ✅ Mark Ready
                  </button>
                  <button className="btn btn-primary">
                    🚚 Process Pickup
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthWrapper>
  );
}
