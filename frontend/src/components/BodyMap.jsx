import { MapPin } from 'lucide-react';

const frontPoints = [
  { id: 'shoulders', label: 'Shoulders', x: 50, y: 22 },
  { id: 'chest', label: 'Chest', x: 50, y: 34 },
  { id: 'biceps', label: 'Biceps', x: 24, y: 41 },
  { id: 'forearms', label: 'Forearms', x: 16, y: 55 },
  { id: 'waist', label: 'Waist', x: 50, y: 50 },
  { id: 'thigh', label: 'Thigh', x: 39, y: 76 },
];

const backPoints = [
  { id: 'hips', label: 'Hips', x: 50, y: 60 },
  { id: 'calf', label: 'Calf', x: 50, y: 91 },
];

export default function BodyMap({ selected, onSelect, measurements = [], side = 'front' }) {
  const points = side === 'front' ? frontPoints : backPoints;
  
  return (
    <div className="body-map-container" style={{ position: 'relative', width: '100%', height: '400px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
      <svg viewBox="0 0 140 220" className="body-svg" style={{ height: '100%', width: 'auto', opacity: 0.4, color: 'var(--text)' }}>
        <circle cx="70" cy="22" r="17" fill="currentColor" opacity="0.1" />
        <path d="M50 48 C58 42 82 42 90 48 L98 78 C103 94 102 118 93 136 L88 154 L84 208 H62 L58 154 L47 136 C38 118 37 94 42 78 Z" fill="currentColor" opacity="0.1" />
        <path d="M43 62 C28 75 21 95 16 123" stroke="currentColor" fill="none" strokeWidth="2" opacity="0.2" />
        <path d="M97 62 C112 75 119 95 124 123" stroke="currentColor" fill="none" strokeWidth="2" opacity="0.2" />
      </svg>

      {points.map((point) => {
        const latest = measurements
          .filter(m => m.body_part === point.id)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        const isActive = selected === point.id;

        return (
          <button
            key={point.id}
            type="button"
            className={`body-point ${isActive ? 'active' : ''}`}
            style={{ 
              position: 'absolute',
              left: `${point.x}%`, 
              top: `${point.y}%`,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transform: 'translate(-50%, -50%)',
              zIndex: isActive ? 10 : 1
            }}
            onClick={() => onSelect(point.id)}
          >
            <div style={{ 
              width: '14px', 
              height: '14px', 
              borderRadius: '50%', 
              background: isActive ? 'var(--brand)' : 'var(--line)', 
              border: '3px solid var(--bg)',
              boxShadow: isActive ? '0 0 15px var(--brand)' : 'none',
              transition: 'all 0.3s'
            }} />
            
            {isActive && (
              <div className="glass-card animate-pop" style={{ 
                position: 'absolute', 
                bottom: '25px', 
                left: '50%', 
                transform: 'translateX(-50%)', 
                padding: '0.8rem 1rem', 
                minWidth: '120px',
                textAlign: 'center',
                zIndex: 20,
                border: '1px solid var(--brand)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'capitalize' }}>{point.label}</h4>
                {latest ? (
                  <p style={{ margin: '4px 0 0', fontSize: '1rem', fontWeight: '900' }}>{latest.value_cm}cm</p>
                ) : (
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.7rem' }}>No data</p>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
