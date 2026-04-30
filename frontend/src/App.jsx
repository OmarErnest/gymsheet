import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import BottomNav from './components/BottomNav.jsx';
import Skeleton from './components/Skeleton.jsx';
import { useAuth } from './state/AuthContext.jsx';
import { api } from './api/client.js';
import { t } from './i18n.js';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Profile from './pages/Profile.jsx';
import Global from './pages/Global.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { user, booting, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [preferences, setPreferences] = useState({ theme: 'dark', language: 'en', goals_paused: false });
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(localStorage.getItem(`disclaimer_${user?.id}`) === 'true');

  const lang = preferences.language || 'en';

  useEffect(() => {
    if (user) {
      setDisclaimerAccepted(localStorage.getItem(`disclaimer_${user.id}`) === 'true');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api('/settings/')
      .then(setPreferences)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme || 'dark';
    document.documentElement.dataset.font = preferences.font_size || 'medium';
  }, [preferences.theme, preferences.font_size]);

  const handleAccept = () => {
    localStorage.setItem(`disclaimer_${user.id}`, 'true');
    setDisclaimerAccepted(true);
  };

  const labels = useMemo(
    () => ({
      home: t(lang, 'home'),
      profile: t(lang, 'profile'),
      global: t(lang, 'global'),
      settings: t(lang, 'settings'),
    }),
    [lang]
  );

  if (booting) return <main className="screen"><Skeleton count={4} /></main>;
  if (!user) return <Login />;

  if (!disclaimerAccepted) {
    return (
      <div className="modal-overlay">
        <div className="glass-card modal-content" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="login-logo" style={{ background: 'var(--brand)', boxShadow: 'none' }}>
              <img src="/logo.png" alt="" />
            </div>
            <h2 style={{ margin: 0 }}>{t(lang, 'legalDisclaimer')}</h2>
          </div>
          <p style={{ lineHeight: '1.7', color: 'var(--text)', marginBottom: '2rem' }}>
            {t(lang, 'legalDisclaimerText')}
          </p>
          <div className="form-stack">
            <button className="primary-btn" onClick={handleAccept}>
              {t(lang, 'iUnderstand')}
            </button>
            <button 
              className="small-btn" 
              onClick={logout} 
              style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', width: '100%' }}
            >
              {t(lang, 'goBack')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <img src="/logo.png" alt="GymSheet logo" />
        </div>
        <div />
        <div className={`avatar-container ${user.current_rank === 1 ? 'border-gold' : user.current_rank === 2 ? 'border-silver' : user.current_rank === 3 ? 'border-bronze' : user.has_link ? 'border-green' : ''}`} aria-label="Current user">
          <div className="avatar">
            {user.profile_pic_url ? <img src={user.profile_pic_url} alt="" /> : user.name?.charAt(0)}
          </div>
          {user.has_link && <div className="link-badge" style={{ width: '14px', height: '14px', bottom: '-2px', right: '-2px', borderWidth: '1px' }}><ExternalLink size={8} /></div>}
        </div>
      </header>

      <main className="screen with-nav">
        {activeTab === 'home' && <Home lang={lang} />}
        {activeTab === 'profile' && <Profile lang={lang} />}
        {activeTab === 'global' && <Global lang={lang} />}
        {activeTab === 'settings' && <Settings preferences={preferences} setPreferences={setPreferences} lang={lang} />}
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} labels={labels} />
    </div>
  );
}
