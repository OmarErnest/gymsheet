import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function EventModal({ isOpen, onClose, image, title, message, subMessage, type }) {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    if (!isOpen) {
      setDisplayText('');
      return;
    }

    let i = 0;
    const speed = 15; // Fast but visible typewriter effect
    const interval = setInterval(() => {
      setDisplayText(message.slice(0, i + 1));
      i++;
      if (i >= message.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [isOpen, message]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal-content event-modal glass-card animate-pop" style={{ padding: 0, overflow: 'hidden', maxWidth: '340px', position: 'relative' }}>
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
          <X size={20} color="var(--brand)" />
        </button>
        
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div className="event-img-container" style={{ marginBottom: '1.5rem', position: 'relative', borderRadius: '50%', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '80%', background: 'var(--brand)', filter: 'blur(40px)', opacity: 0.2, zIndex: -1 }}></div>
            <img 
              src={image} 
              alt={title} 
              style={{ width: '100%', height: 'auto', borderRadius: '50%', position: 'relative', zIndex: 1 }} 
            />
          </div>
          
          <h2 className="pixel-text" style={{ marginBottom: '0.8rem', color: 'var(--brand)', fontSize: '0.9rem', lineHeight: '1.4' }}>{title}</h2>
          <div className="pixel-text muted" style={{ fontSize: '0.6rem', lineHeight: '1.8', textAlign: 'left', wordBreak: 'break-word', minHeight: '3.6rem', whiteSpace: 'pre-wrap' }}>
            {displayText}
          </div>
          
          {subMessage && (
            <p className="pixel-text" style={{ fontSize: '0.55rem', marginTop: '1rem', color: 'var(--muted)', opacity: 0.8 }}>
              {subMessage}
            </p>
          )}
          
          <button 
            className="primary-btn pixel-text" 
            onClick={onClose} 
            style={{ marginTop: '1.5rem', width: '100%', fontSize: '0.7rem' }}
          >
            CONTINUE
          </button>
        </div>
      </div>
    </div>
  );
}
