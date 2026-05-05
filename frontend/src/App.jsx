import { useEffect, useMemo, useState } from 'react';
import { Mail, Bell } from 'lucide-react';
import BottomNav from './components/BottomNav.jsx';
import Skeleton from './components/Skeleton.jsx';
import FloatingStopwatch from './components/FloatingStopwatch.jsx';
import { useAuth } from './state/AuthContext.jsx';
import { api, syncOfflineData } from './api/client.js';
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const lang = preferences.language || 'en';

  useEffect(() => {
    // Initial sync
    syncOfflineData();

    // Listen for online events
    const handleOnline = () => {
      syncOfflineData();
    };
    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
  }, []);

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
    
    // Load notifications
    api('/notifications/')
      .then(res => setNotifications(res.results || res))
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

  const markNotificationRead = async (id) => {
    try {
      await api(`/notifications/${id}/`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {}
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const labels = useMemo(
    () => ({
      home: t(lang, 'home'),
      profile: t(lang, 'profile'),
      global: t(lang, 'global'),
      settings: t(lang, 'settings'),
    }),
    [lang]
  );

  const getProfilePic = () => {
    if (!user?.profile_pic_url) return null;
    // If it's a character icon name (doesn't start with http/data and contains .png)
    if (!user.profile_pic_url.startsWith('http') && !user.profile_pic_url.startsWith('data') && user.profile_pic_url.endsWith('.png')) {
      return `/icons/${user.profile_pic_url}`;
    }
    return user.profile_pic_url;
  };

  if (booting) return (
    <div className="loading-screen">
      <img src="/logo.png" className="loading-logo-spin" alt="" />
      <h2 style={{ letterSpacing: '2px', fontWeight: '900', color: 'var(--brand)' }}>LOADING...</h2>
    </div>
  );
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
        <div className="brand-mark" style={{ background: 'none', border: 'none', width: 'auto', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: '36px', height: '36px', background: 'var(--brand)', filter: 'blur(15px)', opacity: 0.3 }}></div>
            <img src="/logo.png" style={{ width: '42px', height: '42px', objectFit: 'contain', position: 'relative', zIndex: 1 }} alt="GymSheet logo" />
          </div>
          <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '1000', letterSpacing: '-1.5px', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
            GYM<span style={{ color: 'var(--brand)' }}>SHEET</span>
          </h2>
        </div>
        
        <div /> {/* Spacer for grid */}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="avatar-btn" onClick={() => setShowNotifications(!showNotifications)}>
            <div className={`avatar-container ${user.current_rank === 1 ? 'border-gold' : user.current_rank === 2 ? 'border-silver' : user.current_rank === 3 ? 'border-bronze' : user.has_link ? 'border-green' : ''}`} aria-label="Current user">
              <div className="avatar">
                {getProfilePic() ? <img src={getProfilePic()} alt="" /> : user.name?.charAt(0)}
              </div>
              {unreadCount > 0 && <div className="notif-dot" />}
            </div>

            {showNotifications && (
              <div className="glass-card shadow-xl" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, width: '280px', zIndex: 1100, marginTop: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '400px', overflowY: 'auto', cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>Notifications</h4>
                  <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>Close</button>
                </div>
                {notifications.length === 0 ? <p className="muted" style={{ fontSize: '0.8rem', textAlign: 'center' }}>No notifications</p> : null}
                {notifications.map((n) => (
                  <div key={n.id} style={{ padding: '0.6rem', background: n.is_read ? 'rgba(255,255,255,0.02)' : 'rgba(var(--brand-rgb), 0.1)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4', textAlign: 'left' }}>{n.message}</p>
                    {!n.is_read && (
                      <button onClick={() => markNotificationRead(n.id)} style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', alignSelf: 'flex-end' }}>
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </button>
        </div>
      </header>

      <main className="screen with-nav">
        {activeTab === 'home' && <Home lang={lang} />}
        {activeTab === 'profile' && <Profile lang={lang} />}
        {activeTab === 'global' && <Global lang={lang} />}
        {activeTab === 'settings' && <Settings preferences={preferences} setPreferences={setPreferences} lang={lang} />}
      </main>

      <FloatingStopwatch />
      <BottomNav active={activeTab} onChange={setActiveTab} labels={labels} />
    </div>
  );
}
