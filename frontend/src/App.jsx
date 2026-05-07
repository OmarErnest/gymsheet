import { useEffect, useMemo, useState } from 'react';
import BottomNav from './components/BottomNav.jsx';
import Skeleton from './components/Skeleton.jsx';
import { Mail, Bell, RefreshCw } from 'lucide-react';
import { useAuth } from './state/AuthContext.jsx';
import { api, syncOfflineData } from './api/client.js';
import { t } from './i18n.js';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Profile from './pages/Profile.jsx';
import Global from './pages/Global.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';
import EventManager from './components/EventManager.jsx';

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

    window.checkHydration = () => {
      window.dispatchEvent(new CustomEvent('trigger-hydration'));
    };

    return () => {
      window.removeEventListener('online', handleOnline);
      delete window.checkHydration;
    };
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
      .then(res => {
        const list = res.results || res;
        setNotifications(list.filter(n => !n.is_read));
      })
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
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {}
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const [syncPending, setSyncPending] = useState(0);

  useEffect(() => {
    const handleAddNotif = (e) => {
      setNotifications(prev => {
        if (e.detail.type === 'hydrate' && prev.some(n => n.type === 'hydrate')) {
          return prev;
        }
        const newNotif = {
          id: `local-${Date.now()}`,
          message: e.detail.message,
          type: e.detail.type,
          is_read: false,
          created_at: new Date().toISOString(),
          _isLocal: true
        };
        return [newNotif, ...prev].slice(0, 10);
      });
    };
    const handleQueue = (e) => setSyncPending(e.detail);
    
    // Check initial queue length
    const q = JSON.parse(localStorage.getItem('gym_offline_queue') || '[]');
    setSyncPending(q.length);

    window.addEventListener('add-local-notification', handleAddNotif);
    window.addEventListener('queue-updated', handleQueue);
    return () => {
      window.removeEventListener('add-local-notification', handleAddNotif);
      window.removeEventListener('queue-updated', handleQueue);
    };
  }, []);

  // Auto-sync effect
  useEffect(() => {
    if (syncPending > 0) {
      const interval = setInterval(() => {
        if (navigator.onLine) syncOfflineData();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [syncPending]);

  useEffect(() => {
    const handleTab = (e) => setActiveTab(e.detail);
    window.addEventListener('change-app-tab', handleTab);
    return () => window.removeEventListener('change-app-tab', handleTab);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  const labels = useMemo(
    () => ({
      home: t(lang, 'home'),
      profile: t(lang, 'profile'),
      global: t(lang, 'global'),
      settings: t(lang, 'settings'),
      admin: 'Admin',
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
      <img src="/icon.png" className="loading-logo-spin" alt="" />
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
              <img src="/icon.png" alt="" />
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
            <img src="/icon.png" style={{ width: '42px', height: '42px', objectFit: 'contain', position: 'relative', zIndex: 1 }} alt="GymSheet logo" />
          </div>
          <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '1000', letterSpacing: '-1.5px', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
            GYM<span style={{ color: 'var(--brand)' }}>SHEET</span>
          </h2>
        </div>
        
        <div /> {/* Spacer for grid */}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {syncPending > 0 && (
            <button 
              className="sync-btn pending" 
              onClick={() => syncOfflineData()}
              title="Sync Pending"
              style={{ 
                background: 'rgba(var(--brand-rgb), 0.05)', 
                color: 'var(--brand)', 
                border: '1px solid var(--line)', 
                borderRadius: '8px', 
                padding: '6px 10px', 
                fontSize: '0.65rem', 
                fontWeight: '900', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                animation: 'pulse-subtle 2s infinite'
              }}
            >
              <RefreshCw size={12} className="spin" />
              {lang === 'es' ? 'SINCRONIZANDO' : 'SYNCING'}...
            </button>
          )}
          <button className="avatar-btn" onClick={() => setShowNotifications(!showNotifications)}>
            <div className={`avatar-container ${user.current_rank === 1 ? 'border-gold' : user.current_rank === 2 ? 'border-silver' : user.current_rank === 3 ? 'border-bronze' : user.has_link ? 'border-green' : ''}`} aria-label="Current user">
              <div className="avatar">
                {getProfilePic() ? <img src={getProfilePic()} alt="" /> : user.name?.charAt(0)}
              </div>
              {unreadCount > 0 && <div className="notif-dot" />}
            </div>

            {showNotifications && (
              <div className="glass-card shadow-xl" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, width: '300px', zIndex: 1100, marginTop: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '450px', overflowY: 'auto', cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Notifications</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={clearAllNotifications} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>Clear All</button>
                    <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.7rem' }}>Close</button>
                  </div>
                </div>
                {notifications.length === 0 ? <p className="muted" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>No notifications</p> : null}
                {notifications.map((n) => (
                  <div key={n.id} style={{ padding: '0.7rem', background: n.is_read ? 'rgba(255,255,255,0.02)' : 'rgba(var(--brand-rgb), 0.05)', border: n.is_read ? '1px solid transparent' : '1px solid rgba(var(--brand-rgb), 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem', transition: 'all 0.2s' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4', textAlign: 'left', color: 'var(--text)' }}>{n.message}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!n.is_read && (
                        <button onClick={() => markNotificationRead(n.id)} style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '900' }}>
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </button>
        </div>
      </header>

      <main className="screen with-nav">
        <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}><Home lang={lang} /></div>
        <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }}><Profile preferences={preferences} lang={lang} /></div>
        <div style={{ display: activeTab === 'global' ? 'block' : 'none' }}><Global lang={lang} /></div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}><Settings preferences={preferences} setPreferences={setPreferences} lang={lang} /></div>
        {user?.is_staff && <div style={{ display: activeTab === 'admin' ? 'block' : 'none' }}><Admin lang={lang} /></div>}
      </main>

      <EventManager activeTab={activeTab} user={user} />
      <BottomNav active={activeTab} onChange={setActiveTab} labels={labels} isStaff={user?.is_staff} />
    </div>
  );
}
