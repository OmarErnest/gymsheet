import { useEffect, useMemo, useState } from 'react';
import BottomNav from './components/BottomNav.jsx';
import Skeleton from './components/Skeleton.jsx';
import { RefreshCw } from 'lucide-react';
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
import SearchModal from './components/SearchModal.jsx';
import { Search } from 'lucide-react';
import BadgeModal from './components/BadgeModal.jsx';

export default function App() {
  const { user, booting, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [preferences, setPreferences] = useState({ theme: 'light', language: 'en', goals_paused: false });
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(localStorage.getItem(`disclaimer_${user?.id}`) === 'true');

  const lang = preferences.language || 'en';
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [badgeQueue, setBadgeQueue] = useState([]);

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
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme || 'light';
    document.documentElement.dataset.font = preferences.font_size || 'medium';
  }, [preferences.theme, preferences.font_size]);

  const handleAccept = () => {
    localStorage.setItem(`disclaimer_${user.id}`, 'true');
    setDisclaimerAccepted(true);
  };

  const [syncPending, setSyncPending] = useState(0);

  useEffect(() => {
    const handleQueue = (e) => setSyncPending(e.detail);
    
    // Check initial queue length
    const q = JSON.parse(localStorage.getItem('gym_offline_queue') || '[]');
    setSyncPending(q.length);

    window.addEventListener('queue-updated', handleQueue);
    return () => {
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
    const handleBadges = (e) => {
      setBadgeQueue(prev => [...prev, ...e.detail]);
    };
    window.addEventListener('badges-earned', handleBadges);
    return () => window.removeEventListener('badges-earned', handleBadges);
  }, []);

  const closeBadgeModal = () => {
    setBadgeQueue(prev => prev.slice(1));
  };

  useEffect(() => {
    if (activeTab !== 'home') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeTab]);

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
        <div className="glass-card modal-content" style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          maxHeight: '80vh', 
          display: 'flex', 
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <div className="login-logo" style={{ background: 'var(--brand)', boxShadow: 'none' }}>
                <img src="/icon.png" alt="" />
              </div>
              <h2 style={{ margin: 0 }}>{t(lang, 'legalDisclaimer')}</h2>
            </div>
          </div>

          <div style={{ 
            overflowY: 'auto', 
            padding: '0 0.5rem', 
            textAlign: 'left',
            flexGrow: 1,
            borderTop: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)',
            paddingTop: '1rem',
            paddingBottom: '1rem'
          }}>
            <p style={{ lineHeight: '1.7', color: 'var(--text)', margin: 0 }}>
              {t(lang, 'legalDisclaimerText')}
            </p>
          </div>

          <div className="form-stack" style={{ flexShrink: 0 }}>
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

          <button 
            className="icon-btn" 
            onClick={() => setShowSearch(true)}
            style={{ 
              background: 'var(--card-soft)', 
              color: 'var(--text)', 
              border: '1px solid var(--line)', 
              borderRadius: '10px', 
              width: '38px', 
              height: '38px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Search size={18} />
          </button>

          <div className="avatar-btn" onClick={() => setShowProfilePopup(true)} style={{ cursor: 'pointer' }}>
            <div className={`avatar-container ${user.current_rank === 1 ? 'border-gold' : user.current_rank === 2 ? 'border-silver' : user.current_rank === 3 ? 'border-bronze' : user.has_link ? 'border-green' : ''}`} aria-label="Current user">
              <div className="avatar">
                {getProfilePic() ? <img src={getProfilePic()} alt="" /> : user.name?.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {showProfilePopup && (
        <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setShowProfilePopup(false)}>
          <div className="modal-content event-modal glass-card animate-pop" style={{ padding: 0, overflow: 'hidden', maxWidth: '380px', position: 'relative', minHeight: '450px', border: '1px solid var(--brand)' }} onClick={e => e.stopPropagation()}>
            
            {/* Background Image Container */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              {getProfilePic() ? (
                <img src={getProfilePic()} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10rem', opacity: 0.1, fontWeight: '900' }}>
                  {user.name?.charAt(0)}
                </div>
              )}
              {/* Gradient Overlay for Readability */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)' }} />
            </div>

            {/* Content Overlaid */}
            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '2.2rem', minHeight: '450px' }}>
              <h2 className="pixel-text" style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.8rem', letterSpacing: '1px', textShadow: '2px 2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, -2px -2px 0 #000, 4px 4px 0 var(--brand)' }}>{user.name?.toUpperCase()}</h2>
              
              <button className="primary-btn pixel-text" style={{ width: '100%', padding: '1.2rem', fontSize: '0.9rem', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }} onClick={() => setShowProfilePopup(false)}>
                {lang === 'es' ? 'ACEPTAR' : 'ACCEPT'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="screen with-nav">
        <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}><Home lang={lang} /></div>
        <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }}><Profile preferences={preferences} lang={lang} /></div>
        <div style={{ display: activeTab === 'global' ? 'block' : 'none' }}><Global lang={lang} /></div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}><Settings preferences={preferences} setPreferences={setPreferences} lang={lang} /></div>
        {user?.is_staff && <div style={{ display: activeTab === 'admin' ? 'block' : 'none' }}><Admin lang={lang} /></div>}
      </main>

      <EventManager activeTab={activeTab} user={user} lang={lang} />
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} lang={lang} />}
      {badgeQueue.length > 0 && (
        <BadgeModal 
          badge={badgeQueue[0]} 
          onClose={closeBadgeModal} 
          isNew={true} 
        />
      )}
      <BottomNav active={activeTab} onChange={setActiveTab} labels={labels} isStaff={user?.is_staff} />
    </div>
  );
}
