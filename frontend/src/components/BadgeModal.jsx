import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function BadgeModal({ badge, onClose, isNew = false }) {
  const [displayText, setDisplayText] = useState('');

  // If badge is from UserBadge model, it has badge_detail
  const detail = badge ? (badge.badge_detail || badge) : null;

  useEffect(() => {
    if (!detail) {
      setDisplayText('');
      return;
    }

    let i = 0;
    const msg = `"${detail.dbz_message}"\n\n- ${detail.description}`;
    const speed = 20; // Typewriter effect speed
    
    setDisplayText('');
    
    const interval = setInterval(() => {
      setDisplayText(msg.slice(0, i + 1));
      i++;
      if (i >= msg.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [detail]);

  if (!badge || !detail) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={onClose}>
      <div 
        className="modal-content event-modal glass-card animate-pop" 
        style={{ padding: 0, overflow: 'hidden', maxWidth: '340px', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <button 
          className="close-modal" 
          onClick={onClose} 
          style={{ 
            position: 'absolute',
            top: '12px', 
            right: '12px', 
            left: 'auto', 
            background: 'none', 
            border: 'none', 
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'none',
            zIndex: 10
          }}
        >
          <X size={20} color="#f39c12" />
        </button>
        
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          {isNew && (
            <h3 className="pixel-text" style={{ 
              color: '#f39c12', 
              fontSize: '0.8rem',
              letterSpacing: '1px',
              animation: 'rainbow 2s linear infinite',
              margin: '0 0 1rem 0'
            }}>
              NEW BADGE EARNED!
            </h3>
          )}

          <div className="event-img-container" style={{ marginBottom: '1.5rem', position: 'relative', width: '100px', height: '100px', margin: '0 auto 1.5rem auto', borderRadius: '50%', overflow: 'hidden' }}>
            {/* The signature orange glow */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120%', height: '120%', background: '#f39c12', filter: 'blur(30px)', opacity: 0.25, zIndex: -1 }}></div>
            <img 
              src={`/icons/badges/${detail.icon_name}`} 
              alt={detail.name} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain', 
                position: 'relative', 
                zIndex: 1, 
                borderRadius: '50%',
                filter: 'drop-shadow(0 0 8px rgba(243, 156, 18, 0.4))' 
              }} 
              onError={(e) => { e.target.src = '/icons/badges/default.png'; }}
            />
          </div>
          
          <h2 className="pixel-text" style={{ 
            color: 'var(--brand)', 
            fontSize: '0.9rem', 
            lineHeight: '1.4',
            margin: '0 0 0.8rem 0'
          }}>
            {detail.name}
          </h2>

          <div className="pixel-text muted" style={{ 
            fontSize: '0.8rem', 
            lineHeight: '1.8', 
            textAlign: 'left', 
            wordBreak: 'break-word', 
            minHeight: '4.5rem', 
            whiteSpace: 'pre-wrap',
            color: 'var(--text)'
          }}>
            {displayText}
          </div>
          
          <button 
            className="primary-btn pixel-text"
            onClick={onClose} 
            style={{ 
              marginTop: '1.5rem', 
              width: '100%', 
              fontSize: '0.7rem'
            }}
          >
            {isNew ? "KEEP GETTING STRONGER!" : "CONTINUE"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes rainbow {
          0% { color: #f39c12; }
          25% { color: #e67e22; }
          50% { color: #f1c40f; }
          75% { color: #e67e22; }
          100% { color: #f39c12; }
        }
        @keyframes pop {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop {
          animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
}
