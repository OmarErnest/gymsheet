import { useEffect, useState } from 'react';
import { Crown, Trophy, ExternalLink, Users } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';

import { api } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import { t } from '../i18n.js';

export default function Global({ lang }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBeta, setShowBeta] = useState(false);

  useEffect(() => {
    api('/leaderboard/')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);


  const handleLinkClick = (link, name) => {
    if (window.confirm(`Do you want to leave the app to visit ${name}'s recommendation?\n\nLink: ${link}`)) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const getBorderClass = (rank, hasLink) => {
    if (rank === 1) return "border-gold";
    if (rank === 2) return "border-silver";
    if (rank === 3) return "border-bronze";
    if (hasLink && rank <= 10) return "border-green";
    return "";
  };

  if (loading || !data) return <Skeleton count={4} />;
  
  const rowsAll = data.leaderboard || [];
  const championMessage = data.champion_message;

  // Split real and beta
  const realUsers = rowsAll.filter(u => !u.is_test_user);
  const betaUsers = rowsAll.filter(u => u.is_test_user);

  // Top 10 real users
  let rows = realUsers.slice(0, 10);

  // If self is not in top 10, add self
  const self = realUsers.find(u => u.id === user?.id);
  if (self && !rows.find(u => u.id === user.id)) {
    rows.push(self);
  }

  if (showBeta) {
    rows = [...rows, ...betaUsers];
  }


  return (
    <section className="stack">
      <div className="hero-card global-hero sheet-hero">
        <Trophy />
        <div>
          <h2>{t(lang, 'leaderboard')}</h2>
          {data.champion_name && <p className="muted" style={{ fontSize: '0.9rem' }}>Last week's #1: <strong>{data.champion_name}</strong></p>}
        </div>
      </div>

      {championMessage && (
        <article className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderColor: 'var(--brand)', background: 'rgba(0,0,0, 0.2)' }}>
          <div className="avatar-container" onClick={() => data.champion_link && handleLinkClick(data.champion_link, championMessage.name)}>
            <div className={`avatar big ${getBorderClass(1, !!data.champion_link)}`}>
              {championMessage.profile_pic_url ? <img src={championMessage.profile_pic_url} alt="" /> : championMessage.name?.charAt(0)}
            </div>
            {data.champion_link && <div className="link-badge"><ExternalLink size={12} /></div>}
          </div>
          <div>
            <p className="eyebrow" style={{ color: 'var(--brand)', margin: 0 }}>Message from last week's Champion</p>
            <p style={{ fontStyle: 'italic', margin: '0.4rem 0', fontSize: '1.1rem' }}>"{championMessage.message}"</p>
            <small className="muted">- {championMessage.name}</small>
          </div>
        </article>
      )}

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
                <div className="rank-number">#{row.rank}</div>
                <div className={`avatar-container ${getBorderClass(row.rank, hasLink)}`} onClick={() => hasLink && row.rank <= 10 && handleLinkClick(row.recommended_link, row.name)}>
                  <div className="avatar big">
                    {row.profile_pic_url ? <img src={row.profile_pic_url} alt="" /> : row.name?.charAt(0)}
                  </div>
                  {hasLink && row.rank <= 10 && <div className="link-badge"><ExternalLink size={12} /></div>}
                </div>
                <div className="rank-main">
                  <h3>{row.name} {row.rank === 1 && !row.is_test_user && <Crown size={18} />}</h3>
                  <div className="rank-meta">
                    <span className="pill">{row.active_days} {t(lang, 'activeDays')}</span>
                    <span className="pill">{Number(row.average_lift_kg_this_week || 0).toFixed(1)}kg {t(lang, 'avgLiftThisWeek')}</span>
                  </div>
                </div>
                <strong className="rank-score">{row.score}<br /><small>{t(lang, 'score')}</small></strong>
              </article>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
        <button 
          className={`chip ${showBeta ? 'active' : ''}`} 
          onClick={() => setShowBeta(!showBeta)}
          style={{ gap: '0.4rem', padding: '0.6rem 1rem' }}
        >
          <Users size={14} />
          {showBeta ? 'Hide Beta Users' : t(lang, 'showBeta')}
        </button>
      </div>

    </section>
  );
}
