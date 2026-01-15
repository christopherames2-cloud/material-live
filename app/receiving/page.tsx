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

interface SelectedItem {
  id: number;
  quantity: number;
  maxQuantity: number;
}

export default function ReceivingPage() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [spots, setSpots] = useState<StagingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [stagingInProgress, setStagingInProgress] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  
  // Track selected items with quantities
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  
  const [stageForm, setStageForm] = useState({
    spotId: '',
    customLocation: '',
    packNumber: '',
    notes: '',
    requestId: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchPOs();
    fetchSpots();
  }, []);

  const fetchPOs = async () => {
    setLoading(true);
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
      setMessage({ type: 'error', text: 'Failed to load purchase orders' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPOItems = async (poId: number) => {
    setLoadingItems(true);
    setPOItems([]);
    setSelectedItems([]);
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
      setMessage({ type: 'error', text: 'Failed to load PO items' });
    } finally {
      setLoadingItems(false);
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

  const handleItemToggle = (item: POItem) => {
    const existing = selectedItems.find(s => s.id === item.id);
    if (existing) {
      // Remove item
      setSelectedItems(selectedItems.filter(s => s.id !== item.id));
    } else {
      // Add item with full quantity (received from CE, ready to stage)
      setSelectedItems([...selectedItems, {
        id: item.id,
        quantity: item.received, // Default to received quantity
        maxQuantity: item.received
      }]);
    }
  };

  const handleQuantityChange = (itemId: number, quantity: number) => {
    setSelectedItems(selectedItems.map(s => 
      s.id === itemId 
        ? { ...s, quantity: Math.min(Math.max(0, quantity), s.maxQuantity) }
        : s
    ));
  };

  const handleSelectAll = () => {
    if (selectedItems.length === poItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(poItems.map(item => ({
        id: item.id,
        quantity: item.received,
        maxQuantity: item.received
      })));
    }
  };

  const getTotalSelectedQuantity = () => {
    return selectedItems.reduce((sum, s) => sum + s.quantity, 0);
  };

  const handleStage = async () => {
    if (selectedItems.length === 0 || getTotalSelectedQuantity() === 0) {
      setMessage({ type: 'error', text: 'Please select at least one item with quantity > 0' });
      return;
    }

    if (!stageForm.spotId && !stageForm.customLocation) {
      setMessage({ type: 'error', text: 'Please select a spot or enter a custom location' });
      return;
    }

    setStagingInProgress(true);
    try {
      const token = localStorage.getItem('materialive_token');
      
      // Build item descriptions with quantities
      const itemDescriptions = selectedItems
        .filter(s => s.quantity > 0)
        .map(s => {
          const item = poItems.find(i => i.id === s.id);
          return `${item?.item_num}: ${item?.description} (Qty: ${s.quantity})`;
        })
        .join('; ');

      // Get job info from first item
      const firstItem = poItems.find(i => i.id === selectedItems[0]?.id);
      
      const res = await fetch('/api/staging', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poId: selectedPO?.id,
          items: selectedItems.filter(s => s.quantity > 0).map(s => ({
            itemId: s.id,
            quantity: s.quantity
          })),
          spotId: stageForm.spotId && stageForm.spotId !== 'other' ? parseInt(stageForm.spotId) : null,
          customLocation: stageForm.customLocation || null,
          packNumber: stageForm.packNumber,
          notes: stageForm.notes,
          jobNum: firstItem?.job_num || '',
          jobName: firstItem?.job_name || '',
          requestId: stageForm.requestId,
          itemDescriptions,
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Items staged successfully!' });
        setShowStageModal(false);
        setSelectedItems([]);
        setStageForm({
          spotId: '',
          customLocation: '',
          packNumber: '',
          notes: '',
          requestId: selectedPO?.request_id || '',
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
    } finally {
      setStagingInProgress(false);
    }
  };

  const handleAddDemoPO = async () => {
    setLoadingDemo(true);
    try {
      const token = localStorage.getItem('materialive_token');
      const res = await fetch('/api/pos/demo', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Demo PO created!' });
        fetchPOs();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create demo PO' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error: ' + (err.message || 'Unknown error') });
    } finally {
      setLoadingDemo(false);
    }
  };

  const filteredPOs = pos.filter(po => 
    po.ce_ponum.toString().includes(searchTerm) ||
    po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.request_id?.includes(searchTerm)
  );

  const isItemSelected = (itemId: number) => selectedItems.some(s => s.id === itemId);
  const getSelectedQuantity = (itemId: number) => selectedItems.find(s => s.id === itemId)?.quantity || 0;

  return (
    <AuthWrapper>
      <div className="page-header">
        <h1 className="page-title">Receiving</h1>
        <button 
          className="btn btn-secondary" 
          onClick={fetchPOs}
          disabled={loading}
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'}`}>
          {message.text}
          <button 
            onClick={() => setMessage(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
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
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              <p style={{ color: 'var(--text-secondary)' }}>Loading POs...</p>
            </div>
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
            onClick={handleAddDemoPO}
            disabled={loadingDemo}
          >
            {loadingDemo ? '⏳ Creating...' : '+ Add Demo PO'}
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
                  disabled={selectedItems.length === 0 || getTotalSelectedQuantity() === 0}
                >
                  📦 Stage Selected ({getTotalSelectedQuantity()} units)
                </button>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                💡 Select items received in ComputerEase to stage for pickup. You can split quantities for partial releases.
              </p>

              {loadingItems ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                  <p style={{ color: 'var(--text-secondary)' }}>Loading items...</p>
                </div>
              ) : poItems.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input 
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={selectedItems.length === poItems.length && poItems.length > 0}
                        />
                      </th>
                      <th>Item</th>
                      <th>Description</th>
                      <th>Job</th>
                      <th style={{ textAlign: 'center' }}>CE Received</th>
                      <th style={{ textAlign: 'center', width: '120px' }}>Qty to Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((item) => (
                      <tr key={item.id} style={{ 
                        background: isItemSelected(item.id) ? 'rgba(37, 99, 235, 0.1)' : 'transparent'
                      }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isItemSelected(item.id)}
                            onChange={() => handleItemToggle(item)}
                          />
                        </td>
                        <td style={{ fontWeight: '500' }}>{item.item_num}</td>
                        <td>{item.description}</td>
                        <td>
                          <div style={{ fontSize: '0.875rem' }}>{item.job_num}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.job_name}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            background: item.received > 0 ? 'var(--success)' : 'var(--bg-dark)',
                            color: item.received > 0 ? 'white' : 'var(--text-secondary)',
                            fontSize: '0.875rem'
                          }}>
                            {item.received}
                          </span>
                        </td>
                        <td>
                          {isItemSelected(item.id) ? (
                            <input
                              type="number"
                              className="form-input"
                              style={{ 
                                width: '80px', 
                                textAlign: 'center',
                                padding: '0.375rem',
                                margin: '0 auto',
                                display: 'block'
                              }}
                              value={getSelectedQuantity(item.id)}
                              onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                              min={0}
                              max={item.received}
                              step="any"
                            />
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', display: 'block', textAlign: 'center' }}>-</span>
                          )}
                        </td>
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
              <h3 className="modal-title">Stage Items for Pickup</h3>
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
                <strong>Staging {getTotalSelectedQuantity()} unit(s):</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                  {selectedItems
                    .filter(s => s.quantity > 0)
                    .map(s => {
                      const item = poItems.find(i => i.id === s.id);
                      return (
                        <li key={s.id}>
                          {item?.item_num}: {item?.description} — <strong>{s.quantity}</strong> of {s.maxQuantity}
                        </li>
                      );
                    })
                  }
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowStageModal(false)}
                disabled={stagingInProgress}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleStage}
                disabled={stagingInProgress}
              >
                {stagingInProgress ? '⏳ Staging...' : '📦 Stage Items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthWrapper>
  );
}
