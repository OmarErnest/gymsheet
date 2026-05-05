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
          
          <h2 style={{ marginBottom: '0.5rem', color: 'var(--brand)' }}>{title}</h2>
          <p className="muted" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{message}</p>
          
          <button 
            className="primary-btn" 
            onClick={onClose} 
            style={{ marginTop: '1.5rem', width: '100%' }}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
