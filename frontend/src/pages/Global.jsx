import { useEffect, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { api } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import { t } from '../i18n.js';

export default function Global({ lang }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/leaderboard/')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <Skeleton count={4} />;
  
  const rows = data.leaderboard || [];
  const championMessage = data.champion_message;

  return (
    <section className="stack">
      <div className="hero-card global-hero sheet-hero">
        <Trophy />
        <div>
          <p className="eyebrow">TL;DR · {t(lang, 'weeklyRefresh')}</p>
          <h2>{t(lang, 'leaderboard')}</h2>
          <p className="muted">{t(lang, 'leaderboardHelp')}</p>
        </div>
      </div>

      {championMessage && (
        <article className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderColor: 'var(--brand)', background: 'rgba(0,0,0, 0.2)' }}>
          <div className="avatar big">
            {championMessage.profile_pic_url ? <img src={championMessage.profile_pic_url} alt="" /> : championMessage.name?.charAt(0)}
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
          return (
            <div key={row.id}>
              {isFirstTestUser && (
                <div style={{ margin: '2rem 0 1rem', textAlign: 'center' }}>
                  <p className="eyebrow muted">Public Beta Environment Users</p>
                  <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '0.5rem 0' }} />
                </div>
              )}
              <article className="rank-card" style={row.is_test_user ? { opacity: 0.7 } : {}}>
                <div className="rank-number">#{row.rank}</div>
                <div className="avatar big">{row.profile_pic_url ? <img src={row.profile_pic_url} alt="" /> : row.name?.charAt(0)}</div>
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
    </section>
  );
}
