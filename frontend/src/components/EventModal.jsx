import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function EventModal({ isOpen, onClose, image, title, message, type }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content event-modal glass-card animate-pop" style={{ padding: 0, overflow: 'hidden', maxWidth: '340px' }}>
        <button className="close-modal" onClick={onClose} style={{ top: '10px', right: '10px' }}>
          <X size={20} />
        </button>
        
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div className="event-img-container" style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '80%', background: 'var(--brand)', filter: 'blur(40px)', opacity: 0.2, zIndex: -1 }}></div>
            <img 
              src={image} 
              alt={title} 
              style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-lg)', position: 'relative', zIndex: 1 }} 
            />
          </div>
          
          <h2 className="pixel-text" style={{ marginBottom: '0.8rem', color: 'var(--brand)', fontSize: '1rem', lineHeight: '1.4' }}>{title}</h2>
          <p className="pixel-text muted" style={{ fontSize: '0.65rem', lineHeight: '1.8', textAlign: 'left', wordBreak: 'break-word' }}>{message}</p>
          
          {subMessage && (
            <p className="pixel-text" style={{ fontSize: '0.55rem', marginTop: '0.8rem', color: 'var(--muted)', opacity: 0.8 }}>
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
