import { useEffect, useState } from 'react';
import { Crown, Trophy, ExternalLink, Users, X, Flame } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { api, iso } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import { t } from '../i18n.js';

export default function Global({ lang }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBeta, setShowBeta] = useState(false);
  const [popupUser, setPopupUser] = useState(null);

  useEffect(() => {
    api(`/leaderboard/?today=${iso(new Date())}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const getBorderClass = (rank, hasLink) => {
    if (rank === 1) return "border-gold";
    if (rank === 2) return "border-silver";
    if (rank === 3) return "border-bronze";
    if (hasLink && rank <= 10) return "border-green";
    return "";
  };

  const getIconUrl = (url) => {
    if (!url) return null;
    if (url.includes('http')) return url;
    if (url.endsWith('.png')) return `/icons/${url}`;
    return url;
  };

  if (loading || !data) return <Skeleton count={4} />;
  
  const rowsAll = data.leaderboard || [];

  const realUsers = rowsAll.filter(u => !u.is_test_user);
  const betaUsers = rowsAll.filter(u => u.is_test_user);

  let rows = realUsers.slice(0, 10);
  const self = realUsers.find(u => u.id === user?.id);
  if (self && !rows.find(u => u.id === user.id)) rows.push(self);

  if (showBeta) rows = [...rows, ...betaUsers];

  return (
    <section className="stack">
      <div className="hero-card global-hero sheet-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <Flame size={32} style={{ color: 'var(--brand)' }} />
        <div style={{ flex: 1 }}>
          <h2 className="pixel-text">{t(lang, 'leaderboard')}</h2>
          {data.champion_name && (
            <p className="muted pixel-text" style={{ fontSize: '0.62rem', marginTop: '0.6rem', lineHeight: '1.6', letterSpacing: '0px' }}>
              {lang === 'es' 
                ? <><strong style={{ color: 'var(--brand)' }}>{data.champion_name}</strong> demostró ser el peleador más fuerte de todos.</>
                : <><strong style={{ color: 'var(--brand)' }}>{data.champion_name}</strong> proved to be the strongest fighter of them all.</>
              }
            </p>
          )}
          {!navigator.onLine && <p className="notice" style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>Showing offline/cached data</p>}
        </div>

        {/* Supreme Seal - 3-Fold Bigger & Cropped */}
        <div style={{ 
          position: 'absolute',
          right: '-30px',
          bottom: '-40px',
          width: '160px', 
          height: '160px', 
          border: '5px solid rgba(16, 185, 129, 0.2)', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: '90px',
          fontWeight: '900',
          fontFamily: "'Ma Shan Zheng', cursive",
          color: 'rgba(16, 185, 129, 0.15)',
          opacity: 1,
          transform: 'rotate(-15deg)',
          pointerEvents: 'none',
          zIndex: 0
        }}>
          覇
        </div>
      </div>


      <div className="rank-list">
        {rows.map((row, index) => {
          const isFirstTestUser = row.is_test_user && (index === 0 || !rows[index - 1].is_test_user);
          const hasLink = !!row.recommended_link;

          return (
            <div key={row.id}>
              {isFirstTestUser && (
                <div style={{ margin: '2rem 0 1rem', textAlign: 'center' }}>
                  <p className="eyebrow muted">Public Beta Environment Users</p>
                  <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '0.5rem 0' }} />
                </div>
              )}
              <article className={`rank-card ${row.id === user?.id ? 'self-highlight' : ''}`} style={row.is_test_user ? { opacity: 0.7 } : {}}>
                <div className="rank-number" style={{ 
                  fontSize: row.rank <= 10 ? '1.5rem' : '0.8rem', 
                  fontWeight: '900',
                  fontFamily: row.rank <= 10 ? "'Ma Shan Zheng', cursive" : 'inherit'
                }}>
                  {row.rank <= 10 ? ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][row.rank - 1] : row.rank}
                </div>
                <div className={`avatar-container ${getBorderClass(row.rank, hasLink)}`} onClick={() => setPopupUser(row)}>
                  <div className="avatar big">
                    {row.profile_pic_url ? <img src={getIconUrl(row.profile_pic_url)} alt="" /> : row.name?.charAt(0)}
                  </div>
                  {hasLink && <div className="link-badge"><ExternalLink size={12} /></div>}
                </div>
                <div className="rank-main">
                  <h3>{row.name} {row.rank === 1 && !row.is_test_user && <Crown size={18} />}</h3>
                  <div className="rank-meta">
                    <span className="pill">{row.active_days} {t(lang, 'activeDays')}</span>
                    <span className="pill">{Math.round(row.average_lift_kg_this_week || 0)}kg {t(lang, 'avgLift')}</span>
                  </div>
                </div>
                <strong className="rank-score">{row.score}<br /><small>{t(lang, 'score')}</small></strong>
              </article>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
        <button className={`chip ${showBeta ? 'active' : ''}`} onClick={() => setShowBeta(!showBeta)} style={{ gap: '0.4rem', padding: '0.6rem 1rem' }}>
          <Users size={14} />
          {showBeta ? 'Hide Beta Users' : t(lang, 'showBeta')}
        </button>
      </div>

      {popupUser && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content event-modal glass-card animate-pop" style={{ padding: 0, overflow: 'hidden', maxWidth: '340px', position: 'relative' }}>
            <button 
              className="close-modal" 
              onClick={() => setPopupUser(null)} 
              style={{ 
                position: 'absolute',
                top: '15px', 
                right: '15px', 
                left: 'auto', 
                background: 'none', 
                border: 'none', 
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'none',
                zIndex: 10,
                cursor: 'pointer'
              }}
            >
              <X size={24} color="var(--brand)" />
            </button>
            
            <div className="event-img-container" style={{ position: 'relative', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', background: 'var(--brand)', filter: 'blur(60px)', opacity: 0.1, zIndex: -1 }}></div>
              {popupUser.profile_pic_url ? (
                <img 
                  src={getIconUrl(popupUser.profile_pic_url)} 
                  alt={popupUser.name} 
                  style={{ width: '100%', height: 'auto', display: 'block', position: 'relative', zIndex: 1 }} 
                />
              ) : (
                <div className="pixel-text" style={{ padding: '3rem', fontSize: '3rem', color: 'var(--brand)', position: 'relative', zIndex: 1 }}>
                  {popupUser.name?.charAt(0)}
                </div>
              )}
            </div>
            
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h2 className="pixel-text" style={{ marginBottom: '0.8rem', color: 'var(--brand)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                {popupUser.name}
              </h2>
              
              <div className="pixel-text muted" style={{ fontSize: '0.65rem', lineHeight: '1.8', textAlign: 'left', wordBreak: 'break-word', minHeight: '2.5rem', whiteSpace: 'pre-wrap' }}>
                {popupUser.recommended_link ? (
                  lang === 'es' 
                    ? `¡SIENTO UN GRAN PODER DE PELEA!\n\n${popupUser.name} COMPARTIÓ UNA RECOMENDACIÓN PARA SUPERAR TUS LÍMITES.`
                    : `I SENSE A HIGH POWER LEVEL!\n\n${popupUser.name} SHARED A RECOMMENDATION TO PUSH YOUR LIMITS.`
                ) : (
                  lang === 'es'
                    ? `${popupUser.name} ESTÁ ENTRENANDO EN SOLITARIO. SIN RECOMENDACIONES POR AHORA... ¡SIGUE TU CAMINO!`
                    : `${popupUser.name} IS TRAINING IN ISOLATION. NO RECOMMENDATIONS YET... CONTINUE YOUR PATH!`
                )}
              </div>
              
              {popupUser.recommended_link ? (
                <a 
                  href={popupUser.recommended_link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="primary-btn pixel-text" 
                  style={{ marginTop: '1.5rem', width: '100%', fontSize: '0.65rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                  onClick={(e) => {
                    const msg = lang === 'es' 
                      ? `¿Deseas continuar a este enlace externo?\n\n${popupUser.recommended_link}`
                      : `Would you like to continue to this external link?\n\n${popupUser.recommended_link}`;
                    if (!window.confirm(msg)) {
                      e.preventDefault();
                    } else {
                      setPopupUser(null);
                    }
                  }}
                >
                  {lang === 'es' ? '¡VAMOS!' : 'GO FOR IT!'}
                </a>
              ) : (
                <button 
                  className="primary-btn pixel-text" 
                  onClick={() => setPopupUser(null)} 
                  style={{ marginTop: '1.5rem', width: '100%', fontSize: '0.65rem' }}
                >
                  {lang === 'es' ? 'CONTINUAR' : 'CONTINUE'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
