'use client';

import { useEffect, useState } from 'react';
import AuthWrapper from '@/components/AuthWrapper';

interface PurchaseOrder {
  id: number;
  ce_ponum: number;
  vendor_name: string;
  po_date: string;
  request_id: string;
  status: string;
  items_count: number;
}

interface POItem {
  id: number;
  item_num: string;
  description: string;
  outstanding: number;
  received: number;
  job_num: string;
  job_name: string;
}

interface StagingSpot {
  id: number;
  code: string;
  name: string;
  spot_type: string;
}

export default function ReceivingPage() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [spots, setSpots] = useState<StagingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStageModal, setShowStageModal] = useState(false);
  const [stageForm, setStageForm] = useState({
    selectedItems: [] as number[],
    spotId: '',
    customLocation: '',
    packNumber: '',
    notes: '',
    jobNum: '',
    jobName: '',
    requestId: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchPOs();
    fetchSpots();
  }, []);

  const fetchPOs = async () => {
    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/pos', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPOs(data.purchaseOrders);
      }
    } catch (error) {
      console.error('Failed to fetch POs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPOItems = async (poId: number) => {
    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch(`/api/pos/${poId}/items`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPOItems(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch PO items:', error);
    }
  };

  const fetchSpots = async () => {
    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/staging/spots?available=true', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSpots(data.spots);
      }
    } catch (error) {
      console.error('Failed to fetch spots:', error);
    }
  };

  const handlePOSelect = (po: PurchaseOrder) => {
    setSelectedPO(po);
    fetchPOItems(po.id);
    setStageForm({
      ...stageForm,
      requestId: po.request_id || '',
    });
  };

  const handleItemToggle = (itemId: number) => {
    const newSelected = stageForm.selectedItems.includes(itemId)
      ? stageForm.selectedItems.filter(id => id !== itemId)
      : [...stageForm.selectedItems, itemId];
    
    setStageForm({ ...stageForm, selectedItems: newSelected });
  };

  const handleStage = async () => {
    if (stageForm.selectedItems.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one item to stage' });
      return;
    }

    if (!stageForm.spotId && !stageForm.customLocation) {
      setMessage({ type: 'error', text: 'Please select a spot or enter a custom location' });
      return;
    }

    try {
      const token = localStorage.getItem('materialive_token');
      const selectedItemsData = poItems.filter(item => stageForm.selectedItems.includes(item.id));
      
      const res = await fetch('/api/staging', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poId: selectedPO?.id,
          itemIds: stageForm.selectedItems,
          spotId: stageForm.spotId ? parseInt(stageForm.spotId) : null,
          customLocation: stageForm.customLocation || null,
          packNumber: stageForm.packNumber,
          notes: stageForm.notes,
          jobNum: selectedItemsData[0]?.job_num || '',
          jobName: selectedItemsData[0]?.job_name || '',
          requestId: stageForm.requestId,
          itemDescriptions: selectedItemsData.map(i => i.description).join(', '),
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Items staged successfully!' });
        setShowStageModal(false);
        setStageForm({
          selectedItems: [],
          spotId: '',
          customLocation: '',
          packNumber: '',
          notes: '',
          jobNum: '',
          jobName: '',
          requestId: '',
        });
        fetchPOs();
        fetchSpots();
        if (selectedPO) {
          fetchPOItems(selectedPO.id);
        }
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to stage items' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to stage items' });
    }
  };

  const filteredPOs = pos.filter(po => 
    po.ce_ponum.toString().includes(searchTerm) ||
    po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.request_id?.includes(searchTerm)
  );

  return (
    <AuthWrapper>
      <div className="page-header">
        <h1 className="page-title">Receiving</h1>
        <button className="btn btn-secondary" onClick={fetchPOs}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* PO List */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Purchase Orders</h2>
          
          <input
            type="text"
            className="form-input"
            placeholder="Search PO #, Vendor, Request ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ marginBottom: '1rem' }}
          />

          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
          ) : filteredPOs.length > 0 ? (
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {filteredPOs.map((po) => (
                <div
                  key={po.id}
                  onClick={() => handlePOSelect(po)}
                  style={{
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    background: selectedPO?.id === po.id ? 'var(--primary)' : 'var(--bg-dark)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{ fontWeight: '600' }}>PO #{po.ce_ponum}</div>
                  <div style={{ fontSize: '0.875rem', color: selectedPO?.id === po.id ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                    {po.vendor_name || 'Unknown Vendor'}
                  </div>
                  {po.request_id && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      FS: {po.request_id}
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '0.75rem', 
                    marginTop: '0.5rem',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>{new Date(po.po_date).toLocaleDateString()}</span>
                    <span style={{ 
                      padding: '0.125rem 0.5rem',
                      borderRadius: '4px',
                      background: po.status === 'open' ? 'var(--success)' : 'var(--warning)',
                      color: 'white',
                      fontSize: '0.625rem',
                      textTransform: 'uppercase',
                    }}>
                      {po.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>
              No purchase orders found. POs will appear here when synced from ComputerEase.
            </p>
          )}

          {/* Demo: Add sample PO button */}
          <button 
            className="btn btn-secondary btn-block"
            style={{ marginTop: '1rem' }}
            onClick={async () => {
              const token = localStorage.getItem('materialive_token');
              await fetch('/api/pos/demo', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              fetchPOs();
            }}
          >
            + Add Demo PO
          </button>
        </div>

        {/* PO Details */}
        <div className="card">
          {selectedPO ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem' }}>
                  PO #{selectedPO.ce_ponum} Items
                </h2>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowStageModal(true)}
                  disabled={stageForm.selectedItems.length === 0}
                >
                  📦 Stage Selected ({stageForm.selectedItems.length})
                </button>
              </div>

              {poItems.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input 
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStageForm({
                                ...stageForm,
                                selectedItems: poItems.map(i => i.id)
                              });
                            } else {
                              setStageForm({ ...stageForm, selectedItems: [] });
                            }
                          }}
                          checked={stageForm.selectedItems.length === poItems.length}
                        />
                      </th>
                      <th>Item</th>
                      <th>Description</th>
                      <th>Job</th>
                      <th>Outstanding</th>
                      <th>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={stageForm.selectedItems.includes(item.id)}
                            onChange={() => handleItemToggle(item.id)}
                          />
                        </td>
                        <td>{item.item_num}</td>
                        <td>{item.description}</td>
                        <td>
                          <div style={{ fontSize: '0.875rem' }}>{item.job_num}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.job_name}</div>
                        </td>
                        <td>{item.outstanding}</td>
                        <td>{item.received}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>
                  No items found for this PO.
                </p>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
              <p style={{ color: 'var(--text-secondary)' }}>
                Select a Purchase Order to view items
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stage Modal */}
      {showStageModal && (
        <div className="modal-overlay" onClick={() => setShowStageModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Stage Items</h3>
              <button className="modal-close" onClick={() => setShowStageModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Staging Location</label>
                <select
                  className="form-input"
                  value={stageForm.spotId}
                  onChange={(e) => setStageForm({ ...stageForm, spotId: e.target.value, customLocation: '' })}
                >
                  <option value="">Select a spot...</option>
                  {spots.map((spot) => (
                    <option key={spot.id} value={spot.id}>
                      {spot.code} - {spot.name} ({spot.spot_type.replace(/_/g, ' ')})
                    </option>
                  ))}
                  <option value="other">Other (Custom Location)</option>
                </select>
              </div>

              {stageForm.spotId === 'other' && (
                <div className="form-group">
                  <label>Custom Location</label>
                  <input
                    type="text"
                    className="form-input"
                    value={stageForm.customLocation}
                    onChange={(e) => setStageForm({ ...stageForm, customLocation: e.target.value })}
                    placeholder="Enter custom location..."
                  />
                </div>
              )}

              <div className="form-group">
                <label>Pack Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={stageForm.packNumber}
                  onChange={(e) => setStageForm({ ...stageForm, packNumber: e.target.value })}
                  placeholder="e.g., 1 of 3"
                />
              </div>

              <div className="form-group">
                <label>Request ID (FormSite)</label>
                <input
                  type="text"
                  className="form-input"
                  value={stageForm.requestId}
                  onChange={(e) => setStageForm({ ...stageForm, requestId: e.target.value })}
                  placeholder="FormSite Request ID"
                />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  className="form-input"
                  value={stageForm.notes}
                  onChange={(e) => setStageForm({ ...stageForm, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>

              <div style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: '8px' }}>
                <strong>Staging {stageForm.selectedItems.length} item(s)</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                  {poItems
                    .filter(i => stageForm.selectedItems.includes(i.id))
                    .map(i => (
                      <li key={i.id}>{i.item_num}: {i.description}</li>
                    ))
                  }
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStageModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleStage}>
                📦 Stage Items
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthWrapper>
  );
}
