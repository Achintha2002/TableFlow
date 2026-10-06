"use client";

import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown, Check, Sparkles } from 'lucide-react';

function parse24Hour(val) {
  if (!val) return { hour12: 8, minute: '00', period: 'AM' };
  const parts = val.split(':');
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) h = 8;
  const minute = (parts[1] || '00').slice(0, 2).padStart(2, '0');
  const period = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, period };
}

function to24Hour(hour12, minute, period) {
  let h = parseInt(hour12, 10);
  if (period === 'AM') {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return `${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export default function LuxuryTimePicker({
  value = '08:00',
  onChange,
  label = 'Select Time',
  presets = []
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const { hour12, minute, period } = parse24Hour(value);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  function handleSelectHour(h) {
    const new24 = to24Hour(h, minute, period);
    onChange(new24);
  }

  function handleSelectMinute(m) {
    const new24 = to24Hour(hour12, m, period);
    onChange(new24);
  }

  function handleSelectPeriod(p) {
    const new24 = to24Hour(hour12, minute, p);
    onChange(new24);
  }

  const hoursList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minutesList = ['00', '15', '30', '45'];

  const displayFormatted = `${hour12.toString().padStart(2, '0')}:${minute} ${period}`;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 16px',
          background: isOpen ? '#ffffff' : 'var(--bg-surface)',
          border: `1.5px solid ${isOpen ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: '10px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(184, 127, 92, 0.15)' : 'none',
          outline: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(184, 127, 92, 0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={17} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <span style={{
              display: 'block',
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.3px',
              fontFamily: 'monospace'
            }}>
              {displayFormatted}
            </span>
          </div>
        </div>

        <ChevronDown
          size={18}
          color="var(--text-muted)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>

      {/* Luxury Dropdown Popover */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          zIndex: 9999,
          width: '340px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          padding: '20px',
          animation: 'fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header Preview Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(184, 127, 92, 0.08) 0%, rgba(212, 175, 55, 0.08) 100%)',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '18px',
            border: '1px solid rgba(184, 127, 92, 0.2)'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: 'var(--primary)' }}>
                {label}
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                {displayFormatted}
              </div>
            </div>

            {/* AM / PM Pills */}
            <div style={{
              display: 'flex',
              background: '#ffffff',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border)'
            }}>
              {['AM', 'PM'].map(p => {
                const isActive = period === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPeriod(p)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: isActive ? 'var(--primary)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      boxShadow: isActive ? '0 2px 6px rgba(184, 127, 92, 0.35)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hour & Minute Pickers */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '16px', marginBottom: '18px' }}>
            {/* Hours Grid */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                Hour
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {hoursList.map(h => {
                  const isSelected = hour12 === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelectHour(h)}
                      style={{
                        padding: '8px 0',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                        background: isSelected ? 'linear-gradient(135deg, #B87F5C, #9C6848)' : '#F8FAFC',
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        fontSize: '0.88rem',
                        fontWeight: isSelected ? 800 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 4px 10px rgba(184, 127, 92, 0.3)' : 'none'
                      }}
                      onMouseOver={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#F1F5F9';
                          e.currentTarget.style.borderColor = '#CBD5E1';
                        }
                      }}
                      onMouseOut={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#F8FAFC';
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }
                      }}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes Grid */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                Minute
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                {minutesList.map(m => {
                  const isSelected = minute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      style={{
                        padding: '8px 0',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                        background: isSelected ? 'linear-gradient(135deg, #B87F5C, #9C6848)' : '#F8FAFC',
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        fontSize: '0.88rem',
                        fontWeight: isSelected ? 800 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 4px 10px rgba(184, 127, 92, 0.3)' : 'none'
                      }}
                      onMouseOver={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#F1F5F9';
                          e.currentTarget.style.borderColor = '#CBD5E1';
                        }
                      }}
                      onMouseOut={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#F8FAFC';
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }
                      }}
                    >
                      :{m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Presets if provided */}
          {presets.length > 0 && (
            <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                Quick Presets
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {presets.map(timeStr => {
                  const pParsed = parse24Hour(timeStr);
                  const pLabel = `${pParsed.hour12}:${pParsed.minute} ${pParsed.period}`;
                  const isCur = value === timeStr;
                  return (
                    <button
                      key={timeStr}
                      type="button"
                      onClick={() => onChange(timeStr)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isCur ? 'var(--primary)' : 'var(--border)',
                        background: isCur ? 'rgba(184, 127, 92, 0.15)' : '#F8FAFC',
                        color: isCur ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: isCur ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {pLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirm / Close Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#1e293b'}
            onMouseOut={e => e.currentTarget.style.background = '#0f172a'}
          >
            <Check size={16} />
            <span>Apply Time</span>
          </button>
        </div>
      )}
    </div>
  );
}
