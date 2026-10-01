"use client";
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getQRCodeSvg, downloadQRCodeImage } from '../../lib/qrHelper';
import { QrCode, Printer, Download, Copy, Check, X, RefreshCw, Users, CheckSquare, Square, Plus, Edit3, Trash2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // ── Single QR Modal State ──
  const [singleTable, setSingleTable] = useState(null);
  const [singleQr, setSingleQr] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Batch Print Modal State ──
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isPrintingSingle, setIsPrintingSingle] = useState(false);

  // ── Add Table Modal State (CREATE) ──
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTableNum, setNewTableNum] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [newCapacity, setNewCapacity] = useState(4);
  const [newCategoryId, setNewCategoryId] = useState('1');
  const [newStatus, setNewStatus] = useState('available');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // ── Edit Table Modal State (UPDATE) ──
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [editTableNum, setEditTableNum] = useState('');
  const [editTableName, setEditTableName] = useState('');
  const [editCapacity, setEditCapacity] = useState(4);
  const [editCategoryId, setEditCategoryId] = useState('1');
  const [editStatus, setEditStatus] = useState('available');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // ── Delete Confirmation Modal (DELETE) ──
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingTable, setDeletingTable] = useState(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function fetchTables() {
    try {
      // 1. Try Backend API first
      let tableList = null;
      try {
        const res = await fetch(`${API_BASE}/api/tables`);
        if (res.ok) {
          tableList = await res.json();
        }
      } catch (err) {
        console.warn('Backend /api/tables fetch error, falling back to Supabase:', err);
      }

      // 2. Fallback to direct Supabase
      if (!tableList) {
        const { data, error } = await supabase
          .from('restaurant_tables')
          .select('*, table_categories(id, name, description)')
          .order('table_number', { ascending: true });

        if (!error && data) tableList = data;
      }

      if (tableList) setTables(tableList);

      // Fetch Categories
      const { data: catData } = await supabase
        .from('table_categories')
        .select('*')
        .order('id', { ascending: true });
      if (catData) setCategories(catData);

    } catch (e) {
      console.error('Error fetching tables or categories:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTables();

    // 4-second auto-poll backup for live synchronization
    const pollInterval = setInterval(() => {
      fetchTables();
    }, 4000);

    const channel = supabase.channel('admin_tables_realtime_full').on('postgres_changes', 
      { event: '*', schema: 'public', table: 'restaurant_tables' }, 
      () => { fetchTables(); }
    ).subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateStatus(id, newStatus) {
    try {
      await fetch(`${API_BASE}/api/tables/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTables();
    } catch {
      await supabase.from('restaurant_tables').update({ status: newStatus }).eq('id', id);
      fetchTables();
    }
  }

  // ── Open Add Modal ──
  function handleOpenAddModal() {
    const highestNum = tables.reduce((max, t) => Math.max(max, parseInt(t.table_number) || 0), 0);
    setNewTableNum(String(highestNum + 1));
    setNewTableName('');
    setNewCapacity(4);
    setNewCategoryId(categories[0]?.id ? String(categories[0].id) : '1');
    setNewStatus('available');
    setAddModalOpen(true);
  }

  // ── Submit Add Table (CREATE) ──
  async function handleConfirmAddTable(e) {
    e.preventDefault();
    setIsSubmittingAdd(true);
    try {
      const parsedNum = parseInt(newTableNum, 10);
      const parsedCap = parseInt(newCapacity, 10) || 4;
      const parsedCat = newCategoryId ? parseInt(newCategoryId, 10) : 1;

      const res = await fetch(`${API_BASE}/api/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: parsedNum,
          table_name: newTableName.trim() || null,
          capacity: parsedCap,
          category_id: parsedCat,
          status: newStatus
        })
      });

      if (res.ok) {
        showToast(`✅ Table #${parsedNum} created successfully!`);
      } else {
        // Direct Supabase fallback
        const record = {
          table_number: parsedNum,
          capacity: parsedCap,
          category_id: parsedCat,
          status: newStatus
        };
        await supabase.from('restaurant_tables').insert(record);
        showToast(`✅ Table #${parsedNum} created!`);
      }

      setAddModalOpen(false);
      fetchTables();
    } catch (err) {
      showToast(`❌ Error creating table: ${err.message}`);
    } finally {
      setIsSubmittingAdd(false);
    }
  }

  // ── Open Edit Modal ──
  function handleOpenEditModal(t) {
    setEditingTable(t);
    setEditTableNum(String(t.table_number || ''));
    setEditTableName(t.table_name || '');
    setEditCapacity(t.capacity || 4);
    setEditCategoryId(t.category_id ? String(t.category_id) : '1');
    setEditStatus(t.status || 'available');
    setEditModalOpen(true);
  }

  // ── Submit Edit Table (UPDATE) ──
  async function handleConfirmEditTable(e) {
    e.preventDefault();
    if (!editingTable) return;
    setIsSubmittingEdit(true);
    try {
      const parsedNum = parseInt(editTableNum, 10);
      const parsedCap = parseInt(editCapacity, 10) || 4;
      const parsedCat = editCategoryId ? parseInt(editCategoryId, 10) : null;

      const res = await fetch(`${API_BASE}/api/tables/${editingTable.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: parsedNum,
          table_name: editTableName.trim() || null,
          capacity: parsedCap,
          category_id: parsedCat,
          status: editStatus
        })
      });

      if (res.ok) {
        showToast(`✅ Table #${parsedNum} updated successfully!`);
      } else {
        // Direct Supabase fallback
        const updates = {
          table_number: parsedNum,
          capacity: parsedCap,
          category_id: parsedCat,
          status: editStatus
        };
        await supabase.from('restaurant_tables').update(updates).eq('id', editingTable.id);
        showToast(`✅ Table #${parsedNum} updated!`);
      }

      setEditModalOpen(false);
      setEditingTable(null);
      fetchTables();
    } catch (err) {
      showToast(`❌ Error updating table: ${err.message}`);
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  // ── Open Delete Modal ──
  function handleOpenDeleteModal(t) {
    setDeletingTable(t);
    setDeleteModalOpen(true);
  }

  // ── Submit Delete Table (DELETE) ──
  async function handleConfirmDeleteTable() {
    if (!deletingTable) return;
    setIsSubmittingDelete(true);
    try {
      const res = await fetch(`${API_BASE}/api/tables/${deletingTable.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        showToast(`🗑️ Table #${deletingTable.table_number} removed from floor plan.`);
      } else {
        await supabase.from('restaurant_tables').delete().eq('id', deletingTable.id);
        showToast(`🗑️ Table #${deletingTable.table_number} removed.`);
      }

      setDeleteModalOpen(false);
      setDeletingTable(null);
      fetchTables();
    } catch (err) {
      showToast(`❌ Error deleting table: ${err.message}`);
    } finally {
      setIsSubmittingDelete(false);
    }
  }

  // Open Single Table QR Modal
  async function handleOpenSingleQr(table) {
    setSingleTable(table);
    setSingleLoading(true);
    setCopied(false);
    setSingleQr(null);

    try {
      const res = await fetch(`${API_BASE}/api/tables/${table.id}/qr-token`);
      const data = await res.json();
      if (data.qrData) {
        const svg = getQRCodeSvg(data.qrData, { cellSize: 6, margin: 10 });
        setSingleQr({
          token: data.token,
          qrData: data.qrData,
          svg
        });
      }
    } catch (err) {
      console.error('Error fetching table QR token:', err);
    } finally {
      setSingleLoading(false);
    }
  }

  // Open Batch Print Modal
  async function handleOpenBatchModal() {
    setBatchModalOpen(true);
    setBatchLoading(true);
    setBatchItems([]);

    try {
      const res = await fetch(`${API_BASE}/api/tables/qr-tokens/all`);
      const data = await res.json();
      const list = (data.tables || []).map(item => ({
        ...item,
        svg: getQRCodeSvg(item.qrData, { cellSize: 6, margin: 10 })
      }));
      setBatchItems(list);
      setSelectedIds(new Set(list.map(i => i.table.id)));
    } catch (err) {
      console.error('Error fetching batch QR tokens:', err);
    } finally {
      setBatchLoading(false);
    }
  }

  function handleCopyPayload() {
    if (!singleQr?.qrData) return;
    navigator.clipboard.writeText(singleQr.qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadPng(svgString, tableNum) {
    downloadQRCodeImage(svgString, `TableFlow-Table-${tableNum}-QR.png`);
  }

  function toggleSelectTable(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function handleSelectAll() {
    if (selectedIds.size === batchItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(batchItems.map(i => i.table.id)));
    }
  }

  function triggerPrint(single = false) {
    setIsPrintingSingle(single);
    setTimeout(() => {
      window.print();
    }, 150);
  }

  const totalCount = tables.length;
  const availableCount = tables.filter(t => t.status === 'available').length;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const cleaningCount = tables.filter(t => t.status === 'cleaning').length;

  if (loading) return <p style={{ color: 'var(--text-muted)', padding: '24px' }}>Loading tables & floor plan...</p>;

  const activePrintItems = isPrintingSingle
    ? singleTable && singleQr ? [{ table: singleTable, qrData: singleQr.qrData, svg: singleQr.svg }] : []
    : batchItems.filter(item => selectedIds.has(item.table.id));

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-cards-mount, #print-cards-mount * {
            visibility: visible !important;
          }
          #print-cards-mount {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
          }
          .table-tent-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          fontSize: '13px',
          fontWeight: '600',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Main Screen UI */}
      <div className="full-data-card" style={{ marginBottom: 24 }}>
        <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Tables & Floor Plan</h3>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '20px',
                background: '#ecfdf5',
                color: '#059669',
                fontSize: '11px',
                fontWeight: '700',
                border: '1px solid rgba(5,150,105,0.2)'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
                Mobile Live Sync
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Add, edit, and organize restaurant dining tables. All changes instantly sync with mobile booking and floor screens.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Add Table Button (CREATE) */}
            <button
              onClick={handleOpenAddModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--primary)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(184, 127, 92, 0.3)'
              }}
            >
              <Plus size={16} />
              <span>Add Table</span>
            </button>

            {/* Print Batch QR Button */}
            <button 
              className="btn btn-ghost" 
              onClick={handleOpenBatchModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                borderColor: 'var(--border)'
              }}
            >
              <Printer size={16} />
              <span>Print QR Cards</span>
            </button>
          </div>
        </div>

        {/* Floor Summary Stats */}
        <div style={{ 
          padding: '16px 24px', 
          borderBottom: '1px solid var(--border)', 
          background: 'var(--bg-surface)', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: 16 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Tables</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{totalCount}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Available</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{availableCount}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Occupied</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{occupiedCount}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--info)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Needs Cleaning</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--info)' }}>{cleaningCount}</div>
            </div>
          </div>
        </div>

        {/* Tables Grid with CRUD Cards */}
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {tables.map(t => {
            const catName = t.table_categories?.name || 'Main Dining';
            const hasCustomName = Boolean(t.table_name && t.table_name.trim());

            return (
              <div key={t.id} style={{ 
                border: '1px solid var(--border)', 
                borderRadius: '14px', 
                padding: '18px',
                background: t.status === 'occupied' ? 'rgba(184, 127, 92, 0.05)' : '#ffffff',
                boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}>
                <div>
                  {/* Top Bar: Title & Edit/Delete Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                        Table {t.table_number}
                      </h4>
                      {hasCustomName && (
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', marginTop: '2px' }}>
                          🏷️ {t.table_name}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        title="Edit Table Details"
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '5px 7px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Edit3 size={13} />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleOpenDeleteModal(t)}
                        title="Remove Table"
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fee2e2',
                          borderRadius: '6px',
                          padding: '5px 7px',
                          color: '#e11d48',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Status & Zone Badges */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {badge(t.status === 'available' ? 'success' : t.status === 'occupied' ? 'warning' : 'info', t.status.toUpperCase())}
                    <span style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      color: '#475569',
                      fontWeight: '600'
                    }}>
                      📍 {catName}
                    </span>
                  </div>

                  {/* Capacity */}
                  <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} /> Capacity: <strong>{t.capacity} guests</strong>
                  </p>
                </div>

                <div>
                  {/* QR Code Action Button */}
                  <button 
                    className="btn btn-ghost" 
                    onClick={() => handleOpenSingleQr(t)}
                    style={{ 
                      width: '100%', 
                      marginBottom: 10, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: 6,
                      padding: '7px 10px',
                      fontSize: 12,
                      borderColor: 'var(--border)'
                    }}
                  >
                    <QrCode size={14} color="var(--primary)" />
                    <span>View QR Code</span>
                  </button>

                  {/* Status Toggle Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {t.status === 'available' && (
                      <button className="btn btn-ghost" style={{ flex: 1, padding: '6px', fontSize: '12px' }} onClick={() => updateStatus(t.id, 'occupied')}>
                        Occupy
                      </button>
                    )}
                    {t.status === 'occupied' && (
                      <button className="btn btn-ghost" style={{ flex: 1, padding: '6px', fontSize: '12px' }} onClick={() => updateStatus(t.id, 'cleaning')}>
                        Clean
                      </button>
                    )}
                    {t.status === 'cleaning' && (
                      <button className="btn btn-primary" style={{ flex: 1, padding: '6px', fontSize: '12px' }} onClick={() => updateStatus(t.id, 'available')}>
                        Ready
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────── */}
      {/* ── MODAL 1: ADD NEW TABLE (CREATE) ── */}
      {/* ─────────────────────────────────────────────── */}
      {addModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '460px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(184, 127, 92, 0.12)',
                  padding: '9px',
                  borderRadius: '10px',
                  color: 'var(--primary)',
                  fontSize: '20px'
                }}>
                  🪑
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Add New Dining Table
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Configure table number, custom name, and seating
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAddTable}>
              {/* Table Number */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Table Number:
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(e.target.value)}
                  required
                  placeholder="e.g. 21"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Custom Table Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Custom Table Name / Label (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Corner Booth, Patio Terrace 1, VIP 1"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Seating Capacity */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Seating Capacity (Guests):
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  {[2, 4, 6, 8, 10].map(cap => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setNewCapacity(cap)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: '6px',
                        border: parseInt(newCapacity) === cap ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: parseInt(newCapacity) === cap ? 'rgba(184, 127, 92, 0.1)' : '#ffffff',
                        color: parseInt(newCapacity) === cap ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {cap}p
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Category / Dining Area */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Dining Zone / Category:
                </label>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  {categories.length > 0 ? (
                    categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.extra_charge ? `(+$${c.extra_charge})` : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="1">Main Dining</option>
                      <option value="2">Window Seating</option>
                      <option value="3">VIP Lounge</option>
                    </>
                  )}
                </select>
              </div>

              {/* Initial Status */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Initial Status:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="cleaning">Needs Cleaning</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  disabled={isSubmittingAdd}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingAdd ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 6px rgba(184, 127, 92, 0.25)'
                  }}
                >
                  {isSubmittingAdd ? 'Adding...' : '➕ Add Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* ── MODAL 2: EDIT TABLE DETAILS (UPDATE) ── */}
      {/* ─────────────────────────────────────────────── */}
      {editModalOpen && editingTable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '460px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '9px',
                  borderRadius: '10px',
                  color: '#2563eb',
                  fontSize: '20px'
                }}>
                  ✏️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Edit Table #{editingTable.table_number}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Modify capacity, custom name, zone, or status
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmEditTable}>
              {/* Table Number */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Table Number:
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={editTableNum}
                  onChange={(e) => setEditTableNum(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Table Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Custom Table Name / Label:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Corner Booth, VIP 1"
                  value={editTableName}
                  onChange={(e) => setEditTableName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Capacity */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Capacity (Guests):
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Zone / Category */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Dining Zone / Category:
                </label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  {categories.length > 0 ? (
                    categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="1">Main Dining</option>
                      <option value="2">Window Seating</option>
                      <option value="3">VIP Lounge</option>
                    </>
                  )}
                </select>
              </div>

              {/* Status */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Table Status:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="cleaning">Needs Cleaning</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={isSubmittingEdit}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingEdit ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingEdit ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────── */}
      {/* ── MODAL 3: DELETE TABLE CONFIRMATION (DELETE) ── */}
      {/* ─────────────────────────────────────────────── */}
      {deleteModalOpen && deletingTable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '430px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                background: '#fee2e2',
                color: '#dc2626',
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Remove Table #{deletingTable.table_number}?
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Capacity: {deletingTable.capacity} guests • {deletingTable.table_name || 'Standard Table'}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '14px 0 20px' }}>
              Are you sure you want to remove this table from the floor plan? Any associated active reservations or orders will be safely unlinked.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isSubmittingDelete}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTable}
                disabled={isSubmittingDelete}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isSubmittingDelete ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmittingDelete ? 'Removing...' : '🗑️ Remove Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE TABLE QR MODAL */}
      {singleTable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="full-data-card" style={{ width: 480, maxWidth: '92vw', padding: 28, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19 }}>Table {singleTable.table_number} QR Code</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Customer scan code for digital ordering & instant payment
                </p>
              </div>
              <button 
                className="btn btn-ghost" 
                onClick={() => setSingleTable(null)}
                style={{ padding: '6px', border: 'none' }}
              >
                <X size={18} />
              </button>
            </div>

            {singleLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />
                <p>Generating cryptographically signed table token...</p>
              </div>
            ) : singleQr ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  background: '#ffffff', 
                  padding: 24, 
                  borderRadius: 16, 
                  display: 'inline-block', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  marginBottom: 16,
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 6 }}>
                    TableFlow Dine
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>
                    TABLE {singleTable.table_number}
                  </div>
                  <div 
                    style={{ width: 200, height: 200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    dangerouslySetInnerHTML={{ __html: singleQr.svg }} 
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 10 }}>
                    Capacity: {singleTable.capacity} Guests
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => triggerPrint(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '9px 18px' }}
                  >
                    <Printer size={15} />
                    <span>Print Table Tent</span>
                  </button>
                  <button 
                    className="btn btn-ghost" 
                    onClick={() => handleDownloadPng(singleQr.svg, singleTable.table_number)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '9px 18px' }}
                  >
                    <Download size={15} />
                    <span>Save PNG</span>
                  </button>
                  <button 
                    className="btn btn-ghost" 
                    onClick={handleCopyPayload}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '9px 18px' }}
                  >
                    {copied ? <Check size={15} color="var(--success)" /> : <Copy size={15} />}
                    <span>{copied ? 'Copied URL!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* BATCH PRINT & PREVIEW MODAL */}
      {batchModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="full-data-card" style={{ 
            width: 860, 
            maxWidth: '94vw', 
            maxHeight: '90vh', 
            display: 'flex', 
            flexDirection: 'column', 
            padding: 24, 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border)', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19 }}>Batch Table QR Print Preview</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Select tables to print standard high-contrast 4x6 table tents.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button 
                  className="btn btn-primary" 
                  disabled={selectedIds.size === 0 || batchLoading}
                  onClick={() => triggerPrint(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px' }}
                >
                  <Printer size={15} />
                  <span>Print Selected ({selectedIds.size})</span>
                </button>
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setBatchModalOpen(false)}
                  style={{ padding: '6px', border: 'none' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }} onClick={handleSelectAll}>
                {selectedIds.size === batchItems.length ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} />}
                <span>Select All Tables</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {selectedIds.size} of {batchItems.length} tables selected
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
              {batchLoading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />
                  <p>Generating high-resolution table QR codes...</p>
                </div>
              ) : batchItems.map(item => {
                const isSelected = selectedIds.has(item.table.id);
                return (
                  <div 
                    key={item.table.id}
                    onClick={() => toggleSelectTable(item.table.id)}
                    style={{
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 18,
                      background: '#ffffff',
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      boxShadow: isSelected ? '0 4px 12px rgba(184, 127, 92, 0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ position: 'absolute', top: 12, left: 12 }}>
                      {isSelected ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} color="var(--text-muted)" />}
                    </div>

                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPng(item.svg, item.table.table_number);
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '4px 6px', fontSize: 11 }}
                        title="Download PNG"
                      >
                        <Download size={13} />
                      </button>
                    </div>

                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'var(--primary)', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 }}>
                      TableFlow Dine
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
                      TABLE {item.table.table_number}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                      Capacity: {item.table.capacity} Guests
                    </div>

                    <div 
                      style={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      dangerouslySetInnerHTML={{ __html: item.svg }} 
                    />

                    <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: '#0f172a' }}>
                      Scan to Order & Pay
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
                      Point phone camera to view live menu
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PRINT SHEET (MOUNTED DIRECTLY FOR WINDOW.PRINT) */}
      <div id="print-cards-mount" style={{ display: 'none' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '24px', 
          padding: '16px',
          background: '#ffffff'
        }}>
          {activePrintItems.map(item => (
            <div 
              key={item.table.id} 
              className="table-tent-card"
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 16,
                padding: '28px 24px',
                textAlign: 'center',
                background: '#ffffff',
                color: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '380px',
                boxSizing: 'border-box'
              }}
            >
              <div>
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 800, 
                  letterSpacing: '3px', 
                  color: '#B87F5C', 
                  textTransform: 'uppercase',
                  marginBottom: 6
                }}>
                  ✦ TableFlow Dine ✦
                </div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 900, 
                  letterSpacing: '-0.5px',
                  color: '#0f172a',
                  lineHeight: 1.1
                }}>
                  TABLE {item.table.table_number}
                </div>
                <div style={{ 
                  fontSize: 12, 
                  color: '#64748b', 
                  fontWeight: 500,
                  marginTop: 4
                }}>
                  Indoor Dining • Capacity {item.table.capacity} Guests
                </div>
              </div>

              <div style={{ 
                margin: '18px 0', 
                padding: '10px', 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                borderRadius: 12,
                display: 'inline-block' 
              }}>
                <div 
                  style={{ width: 190, height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: item.svg }} 
                />
              </div>

              <div style={{ width: '100%', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', letterSpacing: '0.5px' }}>
                  SCAN TO BROWSE MENU & ORDER
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                  Open your camera or TableFlow app to order directly from your table and request instant waiter service.
                </div>
                <div style={{ 
                  marginTop: 12, 
                  fontSize: 9, 
                  fontWeight: 600, 
                  letterSpacing: '1px', 
                  color: '#94a3b8', 
                  textTransform: 'uppercase' 
                }}>
                  ✂ Cut & Fold for Table Tent Display
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
