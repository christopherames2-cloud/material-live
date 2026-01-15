'use client';

import { useEffect, useState, useRef } from 'react';
import AuthWrapper from '@/components/AuthWrapper';

interface StagingRecord {
  id: number;
  request_id: string;
  job_num: string;
  job_name: string;
  job_address: string;
  spot_code: string;
  spot_name: string;
  custom_location: string;
  pack_number: string;
  item_descriptions: string;
  status: string;
  staged_at: string;
}

export default function DeliveryPage() {
  const [records, setRecords] = useState<StagingRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<StagingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signerName, setSignerName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/staging', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRecords(data.records);
      }
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  };

  useEffect(() => {
    if (showSignatureModal) {
      setTimeout(initCanvas, 100);
    }
  }, [showSignatureModal]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    initCanvas();
  };

  const handleDeliveryConfirm = async () => {
    if (!selectedRecord || !signerName.trim()) {
      setMessage({ type: 'error', text: 'Please enter the signer\'s name' });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL('image/png');

    // Parse signer name for file naming
    const nameParts = signerName.trim().split(' ');
    const firstInitial = nameParts[0]?.[0]?.toUpperCase() || '';
    const lastName = nameParts[nameParts.length - 1]?.toUpperCase() || '';

    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/delivery', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stagingRecordId: selectedRecord.id,
          signerName: signerName.trim(),
          signerFirstInitial: firstInitial,
          signerLastName: lastName,
          signatureData,
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Delivery confirmed successfully!' });
        setShowSignatureModal(false);
        setSelectedRecord(null);
        setSignerName('');
        fetchRecords();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to confirm delivery' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to confirm delivery' });
    }
  };

  const readyRecords = records.filter(r => r.status === 'ready' || r.status === 'staged');

  return (
    <AuthWrapper>
      <div className="page-header">
        <h1 className="page-title">Delivery & Pickup</h1>
        <button className="btn btn-secondary" onClick={fetchRecords}>
          🔄 Refresh
        </button>
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

      <div className="card">
        <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>
          Ready for Pickup ({readyRecords.length})
        </h2>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        ) : readyRecords.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Request ID</th>
                <th>Job</th>
                <th>Pack #</th>
                <th>Items</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {readyRecords.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.spot_code || record.custom_location || '-'}</strong>
                  </td>
                  <td>{record.request_id || '-'}</td>
                  <td>
                    <div>{record.job_num}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {record.job_name}
                    </div>
                  </td>
                  <td>{record.pack_number || '-'}</td>
                  <td style={{ maxWidth: '200px' }}>
                    <div style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {record.item_descriptions || '-'}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: record.status === 'ready' ? 'var(--success)' : 'var(--warning)',
                      color: 'white',
                    }}>
                      {record.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                      onClick={() => {
                        setSelectedRecord(record);
                        setShowSignatureModal(true);
                      }}
                    >
                      ✏️ Sign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚚</div>
            <p style={{ color: 'var(--text-secondary)' }}>
              No items ready for pickup. Stage items first in the Receiving section.
            </p>
          </div>
        )}
      </div>

      {/* Signature Modal */}
      {showSignatureModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => setShowSignatureModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Pickup/Delivery</h3>
              <button className="modal-close" onClick={() => setShowSignatureModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ 
                background: 'var(--bg-dark)', 
                padding: '1rem', 
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <div><strong>Location:</strong> {selectedRecord.spot_code || selectedRecord.custom_location}</div>
                <div><strong>Job:</strong> {selectedRecord.job_num} - {selectedRecord.job_name}</div>
                <div><strong>Request ID:</strong> {selectedRecord.request_id || 'N/A'}</div>
                <div><strong>Items:</strong> {selectedRecord.item_descriptions}</div>
              </div>

              <div className="form-group">
                <label>Receiver's Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter full name"
                />
              </div>

              <div className="form-group">
                <label>Signature</label>
                <div className="signature-container">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="signature-pad"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ cursor: 'crosshair' }}
                  />
                </div>
                <button 
                  className="btn btn-secondary" 
                  onClick={clearSignature}
                  style={{ fontSize: '0.875rem' }}
                >
                  Clear Signature
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSignatureModal(false)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleDeliveryConfirm}>
                ✅ Confirm Pickup
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthWrapper>
  );
}
