import { useState, useEffect } from 'react';
import { Search, X, Calendar, Activity, Dumbbell, ArrowRight } from 'lucide-react';
import { api } from '../api/client.js';
import { t } from '../i18n.js';

export default function SearchModal({ onClose, lang }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api(`/exercise-logs/?search=${encodeURIComponent(query)}`);
        setResults(res.results || res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="modal-overlay" style={{ zIndex: 4000 }} onClick={onClose}>
      <div 
        className="modal-content glass-card animate-pop" 
        style={{ 
          maxWidth: '500px', 
          width: '95%', 
          padding: 0, 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column', 
          maxHeight: '80vh',
          border: '1px solid var(--brand)'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <Search size={20} className="text-brand" />
          <input 
            autoFocus
            type="text" 
            placeholder={lang === 'es' ? 'Buscar ejercicios pasados...' : 'Search past workouts...'} 
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ 
              flex: 1, 
              background: 'none', 
              border: 'none', 
              color: 'var(--text)', 
              fontSize: '1.1rem', 
              fontWeight: '600',
              outline: 'none'
            }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="loading-logo-spin" style={{ width: '30px', height: '30px', margin: '0 auto 1rem' }} />
              <p className="muted">{t(lang, 'searching')}...</p>
            </div>
          )}
          
          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <p className="muted">{t(lang, 'noResults')}</p>
            </div>
          )}

          {!loading && results.map(log => (
            <div 
              key={log.id} 
              style={{ 
                padding: '1rem', 
                borderRadius: '12px', 
                marginBottom: '0.5rem', 
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                border: '1px solid transparent',
                transition: 'all 0.2s'
              }}
              className="search-result-item"
            >
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '10px', 
                background: 'rgba(var(--brand-rgb), 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--brand)'
              }}>
                {log.exercise_detail?.exercise_type === 'calisthenics' ? <Activity size={20} /> : <Dumbbell size={20} />}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{log.exercise_detail?.name}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.2rem', fontSize: '0.75rem' }} className="muted">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> {log.date}
                  </span>
                  <span>{log.sets}x{log.reps} @ {log.weight_kg}kg</span>
                </div>
              </div>
              <ArrowRight size={16} className="muted" />
            </div>
          ))}

          {query.length < 2 && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                {lang === 'es' ? 'Escribe al menos 2 letras para buscar' : 'Type at least 2 characters to search'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
