"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getQRCodeSvg, downloadQRCodeImage } from '../../lib/qrHelper';
import { QrCode, Printer, Download, Copy, Check, X, RefreshCw, Users, CheckSquare, Square } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Single QR Modal State
  const [singleTable, setSingleTable] = useState(null);
  const [singleQr, setSingleQr] = useState(null); // { token, qrData, svg }
  const [singleLoading, setSingleLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Batch Print Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchItems, setBatchItems] = useState([]); // [{ table, token, qrData, svg }]
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Print Mode indicator
  const [isPrintingSingle, setIsPrintingSingle] = useState(false);

  async function fetchTables() {
    const { data } = await supabase
      .from('restaurant_tables')
      .select('*')
      .order('table_number', { ascending: true });
    setTables(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchTables();
    const channel = supabase.channel('admin_tables').on('postgres_changes', 
      { event: '*', schema: 'public', table: 'restaurant_tables' }, 
      () => { fetchTables(); }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function updateStatus(id, newStatus) {
    await supabase.from('restaurant_tables').update({ status: newStatus }).eq('id', id);
    fetchTables();
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

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading tables...</p>;

  // Filter items for batch print view
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

      {/* Main Screen UI */}
      <div className="full-data-card" style={{ marginBottom: 24 }}>
        <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20 }}>Tables & Floor Plan</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Manage live table status, generate HMAC-signed QR cards, and print physical table tents.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              className="btn btn-primary" 
              onClick={handleOpenBatchModal}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}
            >
              <Printer size={16} />
              <span>Print Table QR Cards</span>
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

        {/* Tables Grid */}
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {tables.map(t => (
            <div key={t.id} style={{ 
              border: '1px solid var(--border)', 
              borderRadius: '14px', 
              padding: '18px',
              background: t.status === 'occupied' ? 'rgba(184, 127, 92, 0.05)' : 'var(--bg-secondary)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Table {t.table_number}</h4>
                  {badge(t.status === 'available' ? 'success' : t.status === 'occupied' ? 'warning' : 'info', t.status)}
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} /> Capacity: {t.capacity} guests
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
          ))}
        </div>
      </div>

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
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cryptographically signed HMAC token for physical card</span>
              </div>
              <button onClick={() => setSingleTable(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {singleLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                <p>Generating verified QR token...</p>
              </div>
            ) : singleQr ? (
              <div>
                {/* High-res QR Display Card */}
                <div style={{
                  background: '#ffffff',
                  border: '2px dashed var(--border)',
                  borderRadius: 16,
                  padding: 24,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    TableFlow Dine
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
                    TABLE {singleTable.table_number}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                    Capacity: {singleTable.capacity} Guests
                  </div>

                  {/* SVG QR Code Container */}
                  <div 
                    style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    dangerouslySetInnerHTML={{ __html: singleQr.svg }} 
                  />

                  <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                    Scan to Order & Call Service
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Point phone camera or TableFlow mobile app
                  </div>
                </div>

                {/* Deep Link Payload */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    QR Payload URI
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    background: 'var(--bg-surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 8, 
                    padding: '8px 12px' 
                  }}>
                    <input 
                      readOnly 
                      value={singleQr.qrData} 
                      style={{ 
                        flex: 1, 
                        background: 'transparent', 
                        border: 'none', 
                        fontSize: 12, 
                        color: 'var(--text-secondary)', 
                        fontFamily: 'monospace',
                        outline: 'none' 
                      }} 
                    />
                    <button 
                      onClick={handleCopyPayload}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        cursor: 'pointer', 
                        color: copied ? 'var(--success)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12
                      }}
                      title="Copy QR Payload"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button 
                    className="btn btn-ghost" 
                    onClick={() => handleDownloadPng(singleQr.svg, singleTable.table_number)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Download size={15} />
                    <span>Download PNG</span>
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => triggerPrint(true)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Printer size={15} />
                    <span>Print Card</span>
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--danger)', textAlign: 'center' }}>Failed to load QR token for this table.</p>
            )}
          </div>
        </div>
      )}

      {/* BATCH PRINT & PREVIEW MODAL */}
      {batchModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="full-data-card" style={{ width: 920, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19 }}>Batch Table QR Print Sheet</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  Printable table tent cards formatted with TableFlow branding, capacity, and cryptographic HMAC tokens.
                </p>
              </div>
              <button onClick={() => setBatchModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Selection Bar */}
            <div style={{ padding: '12px 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button 
                  onClick={handleSelectAll}
                  style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}
                >
                  {selectedIds.size === batchItems.length ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} />}
                  <span>Select All ({batchItems.length} Tables)</span>
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedIds.size} of {batchItems.length} selected for printing
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button 
                  className="btn btn-primary" 
                  disabled={selectedIds.size === 0}
                  onClick={() => triggerPrint(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px' }}
                >
                  <Printer size={16} />
                  <span>Print Selected Cards ({selectedIds.size})</span>
                </button>
              </div>
            </div>

            {/* Scrollable Preview Grid */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 20 }}>
              {batchLoading ? (
                <div style={{ gridColumn: '1 / -1', padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
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
              {/* Header Branding */}
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

              {/* High Contrast QR Code */}
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

              {/* Instructions & Callout */}
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
