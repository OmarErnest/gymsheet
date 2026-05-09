import { useState, useRef, useEffect } from 'react';
import { X, Zap, Wrench, Flame, TrendingUp, ChevronRight, ChevronLeft } from 'lucide-react';
import { PATCH_NOTES } from '../config/patchNotes.js';

const TYPE_CONFIG = {
  feature: { icon: <Zap size={13} />, color: 'var(--brand, #22c55e)', label: 'NEW' },
  fix: { icon: <Wrench size={13} />, color: '#60a5fa', label: 'FIX' },
  hotfix: { icon: <Flame size={13} />, color: '#ef4444', label: 'HOTFIX' },
  improve: { icon: <TrendingUp size={13} />, color: '#a78bfa', label: 'ENH' },
};

export default function PatchNotesModal({ onClose }) {
  const scrollRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const notes = PATCH_NOTES;

  const handleScroll = (e) => {
    const scrollLeft = e.target.scrollLeft;
    const width = e.target.offsetWidth;
    const newIdx = Math.round(scrollLeft / width);
    if (newIdx !== activeIdx) {
      setActiveIdx(newIdx);
    }
  };

  const scrollTo = (idx) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: idx * scrollRef.current.offsetWidth,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 8000 }}
      onClick={onClose}
    >
      <div
        className="glass-card modal-content animate-pop"
        style={{ 
          padding: 0, 
          maxWidth: '420px', 
          width: '92%',
          overflow: 'hidden', 
          border: '1px solid var(--brand)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Main Scrollable Area */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
          className="no-scrollbar"
        >
          {notes.map((note, idx) => (
            <div 
              key={note.version} 
              style={{ 
                width: '100%', 
                flexShrink: 0, 
                scrollSnapAlign: 'start',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '1.2rem 1.5rem 1rem',
                borderBottom: '1px solid var(--line)',
                background: idx === 0 ? 'rgba(var(--brand-rgb, 34,197,94), 0.12)' : 'rgba(255,255,255,0.03)',
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
                      background: idx === 0 ? 'var(--brand)' : 'var(--card-strong)',
                      color: idx === 0 ? '#052e16' : 'var(--text)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      letterSpacing: '0.06em',
                    }}>
                      {note.version}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: '700' }}>
                      {note.date}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '1000', color: idx === 0 ? 'var(--brand)' : 'var(--text)' }}>
                    {idx === 0 ? "✦ WHAT'S NEW" : note.title}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '6px', borderRadius: '8px', flexShrink: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Area */}
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, minHeight: '260px' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.9rem' }}>
                  {note.changes.map((c, i) => {
                    const cfg = TYPE_CONFIG[c.type] || TYPE_CONFIG.improve;
                    return (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: `${cfg.color}18`,
                          color: cfg.color,
                          borderRadius: '6px',
                          padding: '3px 7px',
                          fontSize: '0.6rem',
                          fontWeight: '1000',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          border: `1px solid ${cfg.color}30`
                        }}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <span style={{ fontSize: '0.88rem', lineHeight: '1.6', opacity: 0.9, fontWeight: '500' }}>
                          {c.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Swipe Indicator Overlay (Floating arrows) */}
        {activeIdx < notes.length - 1 && (
          <div 
            onClick={() => scrollTo(activeIdx + 1)}
            style={{ 
              position: 'absolute', 
              right: '8px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              background: 'rgba(var(--brand-rgb), 0.2)', 
              color: 'var(--brand)', 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              zIndex: 10,
              backdropFilter: 'blur(5px)',
              border: '1px solid rgba(var(--brand-rgb), 0.3)',
              animation: 'bounce-right 1.5s infinite'
            }}
          >
            <ChevronRight size={24} />
          </div>
        )}
        {activeIdx > 0 && (
          <div 
            onClick={() => scrollTo(activeIdx - 1)}
            style={{ 
              position: 'absolute', 
              left: '8px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              background: 'rgba(255,255,255,0.1)', 
              color: 'var(--text)', 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              zIndex: 10,
              backdropFilter: 'blur(5px)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <ChevronLeft size={24} />
          </div>
        )}

        {/* Footer with Page Dots */}
        <div style={{
          padding: '1.2rem 1.5rem',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {notes.map((_, i) => (
              <div
                key={i}
                onClick={() => scrollTo(i)}
                style={{
                  width: i === activeIdx ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '999px',
                  background: i === activeIdx ? 'var(--brand)' : 'var(--line)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: i === activeIdx ? 1 : 0.5
                }}
              />
            ))}
          </div>

          <button
            className="primary-btn"
            onClick={onClose}
            style={{ 
              fontSize: '0.8rem', 
              padding: '0.6rem 1.4rem', 
              minHeight: 'auto', 
              width: 'auto',
              borderRadius: '10px'
            }}
          >
            {activeIdx === 0 ? 'Got it!' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
