import { Play, Pause, RotateCcw, X, Timer } from 'lucide-react';
import { useStopwatch } from '../state/StopwatchContext.jsx';

export default function FloatingStopwatch() {
  const { 
    time, 
    isRunning, 
    setIsRunning, 
    isMinimized, 
    setIsMinimized, 
    formatTimeFull,
    reset 
  } = useStopwatch();
  
  if (isMinimized) {
    return (
      <button 
        className="floating-bubble" 
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 'calc(11.5rem + env(safe-area-inset-bottom, 0px))',
          right: '1.5rem',
          width: '56px',
          height: '56px',
          borderRadius: '28px',
          background: 'linear-gradient(135deg, var(--brand), var(--brand-2))',
          color: '#052e16',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          cursor: 'pointer',
          boxShadow: 'var(--shadow)',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <Timer size={28} />
        {isRunning && <div style={{ position: 'absolute', top: '0', right: '0', width: '12px', height: '12px', background: 'white', borderRadius: '50%', border: '2px solid var(--brand)' }} />}
      </button>
    );
  }

  return (
    <div 
      className="glass-card" 
      style={{
        position: 'fixed',
        bottom: 'calc(11.5rem + env(safe-area-inset-bottom, 0px))',
        right: '1.5rem',
        width: '240px',
        padding: '1.2rem',
        borderRadius: '24px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
        boxShadow: 'var(--shadow)',
        border: '1px solid var(--brand)',
        background: 'color-mix(in srgb, var(--bg-soft) 95%, transparent)',
        backdropFilter: 'blur(20px)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow" style={{ color: 'var(--brand)', margin: 0 }}>Stopwatch</span>
        <button onClick={() => setIsMinimized(true)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>
      
      <div style={{ fontSize: '2rem', fontFamily: 'monospace', textAlign: 'center', margin: '0.2rem 0', fontWeight: '900', color: 'var(--text)' }}>
        {formatTimeFull(time)}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.8rem' }}>
        <button 
          onClick={() => setIsRunning(!isRunning)} 
          className="primary-btn"
          style={{ 
            height: '44px',
            background: isRunning ? 'var(--danger)' : 'linear-gradient(135deg, var(--brand), var(--brand-2))',
            color: isRunning ? 'white' : '#052e16'
          }}
        >
          {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
        </button>
        <button 
          onClick={reset} 
          className="small-btn"
          style={{ width: '44px', height: '44px', borderRadius: '12px' }}
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}
