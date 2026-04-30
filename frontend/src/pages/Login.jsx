import { useState, useEffect } from 'react';
import { Table2, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import { t } from '../i18n.js';

export default function Login() {
  const { loginPin, loginPassword, testEnvLogin } = useAuth();
  const [lang, setLang] = useState('en');
  const [mode, setMode] = useState('pin');
  const [localTheme, setLocalTheme] = useState('dark');
  const [form, setForm] = useState({
    email: '',
    pin: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Apply theme to the main element via data-theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localTheme);
    return () => {
      // Restore default or whatever App.jsx does
    };
  }, [localTheme]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'pin') {
        await loginPin(form.email, form.pin);
      } else {
        await loginPassword(form.email, form.password);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTestEnv() {
    setLoading(true);
    setMessage('');
    try {
      await testEnvLogin();
    } catch (err) {
      setMessage(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div className="login-logo">
            <img src="/logo.png" alt="GymSheet" />
          </div>
          <button 
            type="button" 
            className="theme-toggle-btn"
            onClick={() => setLocalTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {localTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <h1>{t(lang, 'appName')}</h1>

        <div className="segmented">
          <button className={lang === 'en' ? 'active' : ''} type="button" onClick={() => setLang('en')}>EN</button>
          <button className={lang === 'es' ? 'active' : ''} type="button" onClick={() => setLang('es')}>ES</button>
        </div>

        <div className="segmented ghost" style={{ marginTop: '1rem' }}>
          <button className={mode === 'pin' ? 'active' : ''} type="button" onClick={() => setMode('pin')}>{t(lang, 'pin')}</button>
          <button className={mode === 'password' ? 'active' : ''} type="button" onClick={() => setMode('password')}>{t(lang, 'password')}</button>
        </div>

        <form onSubmit={submit} className="form-stack">
          <label className="field"><span>{t(lang, 'email')}</span><input value={form.email} onChange={(e) => update('email', e.target.value)} /></label>

          {mode === 'pin' && (
            <label className="field">
              <span>{t(lang, 'sixDigitPin')}</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input type={showSecret ? "text" : "password"} inputMode="numeric" maxLength="6" value={form.pin} onChange={(e) => update('pin', e.target.value.replace(/\D/g, ''))} style={{ width: '100%', paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
                  {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {mode === 'password' && (
            <label className="field">
              <span>{t(lang, 'password')}</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input type={showSecret ? "text" : "password"} value={form.password} onChange={(e) => update('password', e.target.value)} style={{ width: '100%', paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
                  {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          <button className="primary-btn" disabled={loading}>{loading ? t(lang, 'loading') : t(lang, 'enterApp')}</button>
          {message && <p className="notice">{message}</p>}
        </form>

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: '1rem' }}>Want to try it out without an account?</p>
          <button className="small-btn" onClick={handleTestEnv} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>Enter Public Beta Environment</button>
        </div>
      </section>
    </main>
  );
}
