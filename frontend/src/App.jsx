import { useEffect, useMemo, useState } from 'react';
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
  const { user, booting } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [preferences, setPreferences] = useState({ theme: 'dark', language: 'en', goals_paused: false });
  const lang = preferences.language || 'en';

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <img src="/logo.png" alt="GymSheet logo" />
        </div>
        <div />
        <div className="avatar" aria-label="Current user">
          {user.profile_pic_url ? <img src={user.profile_pic_url} alt="" /> : user.name?.charAt(0)}
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
