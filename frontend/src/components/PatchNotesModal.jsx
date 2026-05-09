import { useState } from 'react';
import { X, Zap, Wrench, Flame, TrendingUp } from 'lucide-react';
import { PATCH_NOTES } from '../config/patchNotes.js';

const TYPE_CONFIG = {
  feature: { icon: <Zap size={13} />,      color: 'var(--brand, #22c55e)',    label: 'NEW' },
  fix:     { icon: <Wrench size={13} />,   color: '#60a5fa',                  label: 'FIX' },
  hotfix:  { icon: <Flame size={13} />,    color: '#ef4444',                  label: 'HOTFIX' },
  improve: { icon: <TrendingUp size={13} />, color: '#a78bfa',                label: 'IMPROVED' },
};

export default function PatchNotesModal({ onClose }) {
  const [page, setPage] = useState(0);
  const notes = PATCH_NOTES;
  const current = notes[page];
  const isLast = page === notes.length - 1;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 8000 }}
      onClick={onClose}
    >
      <div
        className="glass-card modal-content animate-pop"
        style={{ padding: 0, maxWidth: '420px', overflow: 'hidden', border: '1px solid var(--brand)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.2rem 1.5rem 1rem',
          borderBottom: '1px solid var(--line)',
          background: 'rgba(var(--brand-rgb, 34,197,94), 0.06)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: '900',
                background: 'var(--brand)',
                color: '#052e16',
                padding: '2px 8px',
                borderRadius: '999px',
                letterSpacing: '0.06em',
              }}>
                {current.version}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: '700' }}>
                {current.date}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900' }}>
              {page === 0 ? "✦ What's New" : current.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Changelog list */}
        <div style={{ padding: '1.2rem 1.5rem', maxHeight: '340px', overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.7rem' }}>
            {current.changes.map((c, i) => {
              const cfg = TYPE_CONFIG[c.type] || TYPE_CONFIG.improve;
              return (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: `${cfg.color}18`,
                    color: cfg.color,
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: '0.6rem',
                    fontWeight: '900',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <span style={{ fontSize: '0.85rem', lineHeight: '1.5', opacity: 0.88 }}>
                    {c.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}>
          {/* Pagination dots */}
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {notes.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                style={{
                  width: i === page ? '18px' : '6px',
                  height: '6px',
                  borderRadius: '999px',
                  background: i === page ? 'var(--brand)' : 'var(--line)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isLast && (
              <button
                className="small-btn"
                onClick={() => setPage(p => p + 1)}
                style={{ fontSize: '0.78rem' }}
              >
                Older →
              </button>
            )}
            {page > 0 && (
              <button
                className="small-btn"
                onClick={() => setPage(p => p - 1)}
                style={{ fontSize: '0.78rem' }}
              >
                ← Newer
              </button>
            )}
            <button
              className="primary-btn"
              onClick={onClose}
              style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
