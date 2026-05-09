import { useEffect, useState } from 'react';
import { LogOut, Save, Eye, EyeOff, FileText, User as UserIcon, ChevronDown, FileDown, HelpCircle, Mail, X, RefreshCw, MessageSquare, Send, AlertTriangle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../state/AuthContext.jsx';
import { t } from '../i18n.js';
import LinkInput from '../components/LinkInput.jsx';

const CHARACTER_ICONS = [
  'Android16.png', 'Babidi.png', 'Captain.png', 'Doctor.png', 'Hercule.png',
  'Jeice.png', 'Korin.png', 'Nappa.png', 'Piccolo.png', 'Porunga.png', 'Racoome.png', 'Radiz.png', 'Tao.png', 'Tien.png',
  'Tama.png', 'Giru.png'
];

export default function Settings({ preferences, setPreferences, lang }) {
  const { logout, user, setUser, lang: authLang } = useAuth();
  const isDummy = user?.email === 'dummy@gym.sheet';
  const [form, setForm] = useState({
    ...preferences,
    auth_mode: user?.auth_mode || 'pin',
    new_pin: '',
    new_password: '',
    height_cm: preferences.height_cm || '',
    weight_kg: preferences.weight_kg || '',
    recommended_link: preferences.recommended_link || '',
    hide_from_leaderboard: !!preferences.hide_from_leaderboard,
    profile_pic_url: user?.profile_pic_url || ''
  });
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [logFile, setLogFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [logUploadStatus, setLogUploadStatus] = useState(null);
  const [takenIcons, setTakenIcons] = useState([]);

  const [showSecret, setShowSecret] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [showPauseHelp, setShowPauseHelp] = useState(false);
  const [showHideHelp, setShowHideHelp] = useState(false);

  // Sanitize account
  const SANITIZE_PHRASE = 'I wish to sanitize my account today';
  const [sanitizePhrase, setSanitizePhrase] = useState('');
  const [sanitizeRequest, setSanitizeRequest] = useState(null);
  const [sanitizing, setSanitizing] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ...preferences,
      auth_mode: prev.auth_mode || user?.auth_mode || 'pin',
      profile_pic_url: user?.profile_pic_url || '',
      goals_paused: preferences.goals_paused || false,
    }));
  }, [preferences, user]);

  const [savingSettings, setSavingSettings] = useState(false);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);

  async function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'language' || field === 'theme' || field === 'font_size' || field === 'hide_from_leaderboard') {
      if (isDummy) {
        setMessage(lang === 'es' ? 'Acción restringida para cuenta demo' : 'Action restricted for demo account');
        return;
      }
      setPreferences((prev) => ({ ...prev, [field]: value }));
      try {
        await api('/settings/', { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
      } catch (err) {
        console.error("Auto-save failed", err);
      }
    }
  }

  async function save(event) {
    if (event) event.preventDefault();
    if (isDummy) {
      setMessage(lang === 'es' ? 'Acción restringida para cuenta demo' : 'Action restricted for demo account');
      return;
    }
    setMessage('');
    setSavingSettings(true);
    try {
      const body = { ...form };
      if (!body.new_pin) delete body.new_pin;
      if (!body.new_password) delete body.new_password;

      const updatedUser = await api('/auth/me/', { method: 'PATCH', body: JSON.stringify({ profile_pic_url: form.profile_pic_url }) });
      setUser(updatedUser);
      localStorage.setItem('gym_user', JSON.stringify(updatedUser));

      const data = await api('/settings/', { method: 'PATCH', body: JSON.stringify(body) });
      setPreferences(data);
      setMessage(t(data.language || lang, 'settingsSaved'));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  const [csvRequest, setCsvRequest] = useState(null);

  useEffect(() => {
    if (!user) return;
    api('/csv-requests/').then(data => {
      const list = data.results || data;
      if (list.length > 0) setCsvRequest(list[0]);
    }).catch(() => { });

    api('/exercise-csv-uploads/').then(data => {
      const list = data.results || data;
      if (list.length > 0) setUploadStatus(list[0]);
    }).catch(() => { });

    api('/log-csv-uploads/').then(data => {
      const list = data.results || data;
      if (list.length > 0) setLogUploadStatus(list[0]);
    }).catch(() => { });

    api('/auth/taken-icons/').then(setTakenIcons).catch(() => { });

    api('/sanitize-requests/').then(data => {
      const list = data.results || data;
      if (list.length > 0) setSanitizeRequest(list[0]);
    }).catch(() => { });
  }, [user]);

  useEffect(() => {
    if (csvRequest?.is_approved) {
      const lastShownId = localStorage.getItem('last_csv_popup_id');
      if (lastShownId !== String(csvRequest.id)) {
        setShowDownloadPopup(true);
      }
    }
  }, [csvRequest]);

  async function downloadCSV() {
    try {
      const token = localStorage.getItem('gym_access');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
      const response = await fetch(`${apiUrl}/export-csv/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to export.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gym_data.csv';
      a.click();
    } catch (err) { alert(err.message); }
  }

  const [adminMsg, setAdminMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  async function handleFileUpload(e, type) {
    e.preventDefault();
    const file = type === 'logs' ? logFile : csvFile;
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('gym_access');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
      const endpoint = type === 'logs' ? 'log-csv-uploads' : 'exercise-csv-uploads';
      const response = await fetch(`${apiUrl}/${endpoint}/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (!response.ok) throw new Error("Upload failed");
      const res = await response.json();
      if (type === 'logs') {
        setLogUploadStatus(res);
        setLogFile(null);
      } else {
        setUploadStatus(res);
        setCsvFile(null);
      }
      setMessage(t(lang, 'uploadSuccess'));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCsvAction() {
    if (!csvRequest || (!csvRequest.is_approved && csvRequest.id == null)) {
      try {
        const res = await api('/csv-requests/', { method: 'POST', body: '{}' });
        setCsvRequest(res);
      } catch (err) { alert(err.message); }
    } else if (csvRequest.is_approved) {
      downloadCSV();
    }
  }

  async function sendToAdmin(e) {
    if (e) e.preventDefault();
    if (!adminMsg.trim()) return;
    setSendingMsg(true);
    try {
      await api('/admin-messages/', {
        method: 'POST',
        body: JSON.stringify({ message: adminMsg })
      });
      setAdminMsg('');
      setMessage(lang === 'es' ? 'Mensaje enviado al Gran Patriarca.' : 'Message sent to the Grand Elder.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingMsg(false);
    }
  }

  return (
    <section className="stack">
      <form className="glass-card form-stack" onSubmit={save} autoComplete="off">
        <h3 className="eyebrow">{t(lang, 'profile')}</h3>

        {/* Icon Selection */}
        <div className="field">
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setShowIcons(!showIcons)}
          >
            <span style={{ fontWeight: '800' }}>{t(lang, 'chooseIcon')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div className="avatar small" style={{ width: '32px', height: '32px' }}>
                {form.profile_pic_url ? <img src={`/icons/${form.profile_pic_url}`} alt="" /> : <UserIcon size={16} />}
              </div>
              <ChevronDown size={18} style={{ transform: showIcons ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            </div>
          </div>

          {showIcons && (
            <div style={{
              position: 'relative',
              marginTop: '1rem',
              background: 'rgba(128, 128, 128, 0.12)',
              borderRadius: '20px',
              overflow: 'hidden',
              animation: 'slideDown 0.3s ease-out'
            }}>
              <div className="icon-grid" style={{
                display: 'flex',
                gap: '1rem',
                padding: '1.2rem 1rem',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                width: '100%'
              }}>
                <style>{`.icon-grid::-webkit-scrollbar { display: none; }`}</style>
                <button
                  type="button"
                  onClick={() => update('profile_pic_url', '')}
                  style={{
                    padding: '0',
                    background: form.profile_pic_url === '' ? 'var(--brand)' : 'var(--card-strong)',
                    border: 'none',
                    borderRadius: '16px',
                    minWidth: '64px',
                    height: '64px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: form.profile_pic_url === '' ? '0 8px 20px rgba(var(--brand-rgb), 0.4)' : 'none',
                    transform: form.profile_pic_url === '' ? 'scale(1.1)' : 'scale(1)'
                  }}
                >
                  <UserIcon size={28} color={form.profile_pic_url === '' ? '#052e16' : 'var(--muted)'} />
                </button>
                {CHARACTER_ICONS.map(icon => {
                  const isTaken = takenIcons.includes(icon) && user?.profile_pic_url !== icon;
                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => !isTaken && update('profile_pic_url', icon)}
                      disabled={isTaken}
                      title={isTaken ? 'Already taken by another warrior' : icon}
                      style={{
                        padding: '0',
                        background: 'var(--card-strong)',
                        border: form.profile_pic_url === icon ? '3px solid var(--brand)' : '2px solid transparent',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        minWidth: '64px',
                        height: '64px',
                        flexShrink: 0,
                        cursor: isTaken ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: form.profile_pic_url === icon ? '0 8px 20px rgba(var(--brand-rgb), 0.4)' : 'none',
                        transform: form.profile_pic_url === icon ? 'scale(1.1)' : 'scale(1)',
                        opacity: isTaken ? 0.3 : 1,
                        filter: isTaken ? 'grayscale(1)' : 'none'
                      }}
                    >
                      <img src={`/icons/${icon}`} alt={icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  );
                })}
              </div>
              {/* Scroll Shadow Indicator */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '60px',
                background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.22))',
                pointerEvents: 'none',
                zIndex: 2
              }} />
            </div>
          )}
        </div>

        <label className="switch-row">
          <span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {t(lang, 'pauseFutureGoals')}
              <HelpCircle
                size={14}
                style={{ opacity: 0.5, cursor: 'help' }}
                onClick={(e) => { e.preventDefault(); setShowPauseHelp(!showPauseHelp); }}
              />
            </div>
            {showPauseHelp && <small style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: '400' }}>{t(lang, 'pauseHelp')}</small>}
          </span>
          <input type="checkbox" checked={!!form.goals_paused} onChange={(e) => update('goals_paused', e.target.checked)} />
        </label>

        <label className="switch-row">
          <span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {t(lang, 'hideFromLeaderboard')}
              <HelpCircle
                size={14}
                style={{ opacity: 0.5, cursor: 'help' }}
                onClick={(e) => { e.preventDefault(); setShowHideHelp(!showHideHelp); }}
              />
            </div>
            {showHideHelp && <small style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: '400' }}>{t(lang, 'hideHelp')}</small>}
          </span>
          <input type="checkbox" checked={!!form.hide_from_leaderboard} onChange={(e) => update('hide_from_leaderboard', e.target.checked)} />
        </label>

        <LinkInput
          label={t(lang, 'recommendLink')}
          value={form.recommended_link}
          onChange={(val) => update('recommended_link', val)}
          lang={lang}
        />



        <label className="field"><span>{t(lang, 'theme')}</span><select value={form.theme} onChange={(e) => update('theme', e.target.value)}><option value="dark">🌑 {t(lang, 'dark')}</option><option value="light">☀️ {t(lang, 'light')}</option></select></label>
        <label className="field"><span>Font Size</span><select value={form.font_size || 'medium'} onChange={(e) => update('font_size', e.target.value)}><option value="small">Small</option><option value="medium">Medium</option><option value="big">Big</option></select></label>
        <label className="field"><span>{t(lang, 'language')}</span><select value={form.language} onChange={(e) => update('language', e.target.value)}><option value="en">🇬🇧 English</option><option value="es">🇪🇸 Español</option></select></label>

        <div className="paste-input">
          <label className="field"><span>Height (cm)</span><input autoComplete="off" inputMode="numeric" value={form.height_cm} onChange={(e) => update('height_cm', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 175" /></label>
          <label className="field"><span>Weight (kg)</span><input autoComplete="off" inputMode="decimal" value={form.weight_kg} onChange={(e) => update('weight_kg', e.target.value)} placeholder="e.g. 70.5" /></label>
        </div>

        <label className="field"><span>{t(lang, 'loginMethod')}</span><select value={form.auth_mode} onChange={(e) => update('auth_mode', e.target.value)}><option value="pin">{t(lang, 'sixDigitPin')}</option><option value="password">{t(lang, 'securePassword')}</option></select></label>
        {form.auth_mode === 'pin' ? (
          <label className="field">
            <span>{t(lang, 'newPin')}</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input type={showSecret ? "text" : "password"} autoComplete="new-password" inputMode="numeric" maxLength="6" value={form.new_pin} onChange={(e) => update('new_pin', e.target.value.replace(/\D/g, ''))} placeholder={t(lang, 'optional')} style={{ width: '100%', paddingRight: '2.5rem' }} />
              <button type="button" onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        ) : (
          <label className="field">
            <span>{t(lang, 'newPassword')}</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input type={showSecret ? "text" : "password"} autoComplete="new-password" value={form.new_password} onChange={(e) => update('new_password', e.target.value)} placeholder={t(lang, 'optional')} style={{ width: '100%', paddingRight: '2.5rem' }} />
              <button type="button" onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        )}

        {message && <p className="notice" style={{ textAlign: 'center' }}>{message}</p>}
      </form>

      <div style={{ padding: '0 0 1.5rem' }}>
        <button onClick={logout} className="logout-btn primary-btn" style={{ width: '100%', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
          <LogOut size={18} /> {t(lang, 'logout')}
        </button>
      </div>

      {/* Data Management Section */}
      <article className="glass-card form-stack" style={{ borderLeft: '4px solid var(--brand)' }}>
        <h3 className="eyebrow">{t(lang, 'dataManagement')}</h3>

        <div style={{ display: 'grid', gap: '1.5rem', padding: '0.5rem 0' }}>
          {/* Export */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Save size={16} /> {t(lang, 'exportData')}
              </div>
              <small className="muted" style={{ display: 'block', marginTop: '0.2rem' }}>Download your entire training history as CSV</small>
            </div>
            <button
              type="button"
              className="small-btn"
              onClick={handleCsvAction}
              disabled={user?.is_test_user}
              style={{
                background: csvRequest?.is_approved ? 'var(--brand)' : 'var(--card-strong)',
                color: csvRequest?.is_approved ? '#052e16' : 'var(--text)',
                minWidth: '130px'
              }}
            >
              {csvRequest?.is_approved ? 'Download' : csvRequest ? 'Pending...' : 'Request Export'}
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: 0 }} />

          {/* Import / Bulk History */}
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} /> Bulk History Upload
              </div>
              <small className="muted" style={{ display: 'block', marginTop: '0.2rem' }}>Import multiple workouts at once using our CSV template</small>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label className="custom-file-upload" style={{ width: '100%', padding: '1rem', borderStyle: 'dashed', background: 'rgba(255,255,255,0.02)' }}>
                <input type="file" accept=".csv" onChange={e => setLogFile(e.target.files[0])} />
                {logFile ? logFile.name : 'Select CSV File...'}
              </label>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  className="primary-btn"
                  onClick={e => handleFileUpload(e, 'logs')}
                  disabled={uploading || !logFile}
                  style={{ flex: 1 }}
                >
                  {uploading ? 'Uploading...' : 'Upload History'}
                </button>
                <a
                  href={`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}/logs-csv-template/`}
                  className="small-btn"
                  title="Download Template"
                  style={{ width: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <FileDown size={18} />
                </a>
              </div>
            </div>
            {logUploadStatus && (
              <div className={`notice ${logUploadStatus.status === 'failed' ? 'danger' : ''}`} style={{ fontSize: '0.8rem', padding: '0.6rem' }}>
                Status: <strong>{logUploadStatus.status.toUpperCase()}</strong>
                {logUploadStatus.error_message && <p style={{ margin: '0.3rem 0 0', opacity: 0.8 }}>{logUploadStatus.error_message}</p>}
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Support & About Section */}
      <article className="glass-card form-stack" style={{ borderLeft: '4px solid var(--brand)' }}>
        <h3 className="eyebrow">{t(lang, 'about')}</h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
            <span>{t(lang, 'version')}</span>
            <span
              onClick={() => window.dispatchEvent(new CustomEvent('show-patch-notes'))}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}
              title="View Patch Notes"
            >
              <strong className="brand" style={{ fontWeight: '900' }}>v-03a.039</strong>
              <small className="muted" style={{ fontWeight: '800', opacity: 0.8 }}>05.09.26</small>
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0.5rem 0' }} />

          {/* FAQ */}
          <details className="faq-item">
            <summary style={{ fontWeight: '800', cursor: 'pointer', padding: '0.5rem 0' }}>{t(lang, 'faq')}</summary>
            <div style={{ padding: '0.5rem 0', display: 'grid', gap: '1rem', fontSize: '0.9rem', opacity: 0.9 }}>
              <div>
                <p style={{ fontWeight: '700', marginBottom: '0.2rem' }}>Q: {t(lang, 'faq1Q')}</p>
                <p>{t(lang, 'faq1A')}</p>
              </div>
              <div>
                <p style={{ fontWeight: '700', marginBottom: '0.2rem' }}>Q: {t(lang, 'faq2Q')}</p>
                <p>{t(lang, 'faq2A')}</p>
              </div>
              <div>
                <p style={{ fontWeight: '700', marginBottom: '0.2rem' }}>Q: {t(lang, 'faq3Q')}</p>
                <p>{t(lang, 'faq3A')}</p>
              </div>
            </div>
          </details>

          {/* Legal Disclaimer */}
          <details className="faq-item">
            <summary style={{ fontWeight: '800', cursor: 'pointer', padding: '0.5rem 0' }}>{t(lang, 'legalDisclaimer')}</summary>
            <p style={{ padding: '0.5rem 0', fontSize: '0.85rem', lineHeight: '1.6', opacity: 0.8 }}>
              {t(lang, 'legalDisclaimerText').replace('support@gymsheet.com', 'admin@gymsheet.app')}
            </p>
          </details>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '1rem 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand)', marginBottom: '0.5rem' }}>
          <MessageSquare size={18} />
          <h3 className="eyebrow" style={{ color: 'inherit', margin: 0 }}>{t(lang, 'contactAdmin')}</h3>
        </div>
        <form onSubmit={sendToAdmin} className="form-stack">
          <textarea
            autoComplete="off"
            placeholder={lang === 'es' ? "Escribe tu mensaje aquí..." : "Type your message here..."}
            value={adminMsg}
            onChange={(e) => setAdminMsg(e.target.value)}
            required
            style={{
              minHeight: '120px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '0.9rem',
              color: 'var(--text)',
              outline: 'none',
              transition: 'all 0.3s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--brand)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--line)'}
          />
          <button className="primary-btn pixel-text" style={{ fontSize: '0.7rem' }} disabled={sendingMsg || !adminMsg.trim()}>
            {sendingMsg ? <RefreshCw size={18} className="spin" /> : <Send size={18} />}
            <span style={{ marginLeft: '0.5rem' }}>{lang === 'es' ? 'ENVIAR MENSAJE' : 'SEND MESSAGE'}</span>
          </button>
        </form>
      </article>

      {/* Danger Zone */}
      <article className="glass-card form-stack" style={{ borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', marginBottom: '0.3rem' }}>
          <AlertTriangle size={18} />
          <h3 className="eyebrow" style={{ color: 'inherit', margin: 0 }}>
            {lang === 'es' ? 'ZONA DE PELIGRO' : 'DANGER ZONE'}
          </h3>
        </div>

        <p style={{ fontSize: '0.82rem', lineHeight: '1.6', opacity: 0.75, marginBottom: '1rem' }}>
          {lang === 'es'
            ? 'Solicitar la sanitización eliminará permanentemente todos tus registros de ejercicio, metas, medidas corporales e insignias. Esta acción requiere aprobación del administrador.'
            : 'Requesting sanitization will permanently delete all your exercise logs, goals, body measurements, and badges. This action requires admin approval.'}
        </p>

        {sanitizeRequest ? (
          <div style={{
            padding: '1rem',
            borderRadius: '12px',
            background: sanitizeRequest.status === 'approved'
              ? 'rgba(34,197,94,0.08)'
              : sanitizeRequest.status === 'rejected'
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(250,204,21,0.08)',
            border: `1px solid ${sanitizeRequest.status === 'approved' ? 'rgba(34,197,94,0.3)' : sanitizeRequest.status === 'rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(250,204,21,0.3)'}`,
            fontSize: '0.85rem'
          }}>
            <strong style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              {lang === 'es' ? 'Estado de solicitud' : 'Request status'}:&nbsp;
            </strong>
            <span style={{
              fontWeight: '900',
              color: sanitizeRequest.status === 'approved' ? '#22c55e' : sanitizeRequest.status === 'rejected' ? '#ef4444' : '#facc15'
            }}>
              {sanitizeRequest.status.toUpperCase()}
            </span>
            {sanitizeRequest.admin_notes && (
              <p style={{ marginTop: '0.4rem', opacity: 0.7, fontSize: '0.78rem' }}>{sanitizeRequest.admin_notes}</p>
            )}
            {sanitizeRequest.status === 'rejected' && (
              <button
                className="small-btn"
                style={{ marginTop: '0.6rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
                onClick={() => setSanitizeRequest(null)}
              >
                {lang === 'es' ? 'Nueva solicitud' : 'New request'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <label className="field">
              <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.78rem' }}>
                {lang === 'es'
                  ? 'Escribe exactamente: "I wish to sanitize my account today"'
                  : 'Type exactly: "I wish to sanitize my account today"'}
              </span>
              <input
                type="text"
                value={sanitizePhrase}
                onChange={(e) => setSanitizePhrase(e.target.value)}
                placeholder="I wish to sanitize my account today"
                autoComplete="off"
                style={{
                  borderColor: sanitizePhrase.length > 0
                    ? (sanitizePhrase === SANITIZE_PHRASE ? '#22c55e' : '#ef4444')
                    : 'var(--line)',
                  transition: 'border-color 0.2s'
                }}
              />
            </label>
            <button
              className="primary-btn"
              disabled={sanitizePhrase !== SANITIZE_PHRASE || sanitizing}
              style={{
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                opacity: sanitizePhrase !== SANITIZE_PHRASE ? 0.4 : 1,
                transition: 'opacity 0.2s'
              }}
              onClick={async () => {
                setSanitizing(true);
                try {
                  const res = await api('/sanitize-requests/', {
                    method: 'POST',
                    body: JSON.stringify({}),
                  });
                  setSanitizeRequest(res);
                  setSanitizePhrase('');
                } catch (e) {
                  alert(e?.message || 'Error submitting request.');
                } finally {
                  setSanitizing(false);
                }
              }}
            >
              {sanitizing
                ? <RefreshCw size={16} className="spin" />
                : <AlertTriangle size={16} />}
              <span style={{ marginLeft: '0.5rem' }}>
                {lang === 'es' ? 'SOLICITAR SANITIZACIÓN' : 'REQUEST SANITIZATION'}
              </span>
            </button>
          </div>
        )}
      </article>

      <div style={{ padding: '1rem 0 3rem' }}>
        {user?.email === 'spacejavelin@proton.me' && (
          <button
            onClick={() => {
              const dummyBadges = [{
                badge_detail: {
                  icon_name: 'first_step.png',
                  name: 'The First Step',
                  description: 'You completed your first exercise!',
                  dbz_message: 'YOU FOOL! This is only the beginning of your training!'
                }
              }];
              window.dispatchEvent(new CustomEvent('badges-earned', { detail: dummyBadges }));
              setTimeout(() => window.dispatchEvent(new CustomEvent('trigger-hydration')), 1500);
              setTimeout(() => window.dispatchEvent(new CustomEvent('trigger-rest')), 3000);
            }}
            className="primary-btn pixel-text"
            style={{
              width: '100%',
              marginTop: '1rem',
              background: '#f39c12',
              color: '#000'
            }}
          >
            TEST POPUPS (ADMIN)
          </button>
        )}
      </div>

      <div className="bubble-stack">
        <button
          className="bubble-btn"
          onClick={save}
          disabled={savingSettings}
          style={{
            background: 'var(--brand)',
            color: '#052e16',
            boxShadow: savingSettings ? '0 0 20px var(--brand)' : 'none'
          }}
        >
          {savingSettings ? <RefreshCw size={24} className="spin" /> : <Save size={24} />}
        </button>
      </div>

      {showDownloadPopup && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content event-modal glass-card animate-pop" style={{ padding: 0, overflow: 'hidden', maxWidth: '340px', position: 'relative' }}>
            <button
              className="close-modal"
              onClick={() => {
                setShowDownloadPopup(false);
                localStorage.setItem('last_csv_popup_id', String(csvRequest.id));
              }}
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
              <img src="/icons/events/Downloading.png" alt="Download Approved" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>

            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h2 className="pixel-text" style={{ marginBottom: '0.8rem', color: 'var(--brand)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                DATA EXPORT READY!
              </h2>
              <p className="pixel-text muted" style={{ fontSize: '0.65rem', lineHeight: '1.8', textAlign: 'left', wordBreak: 'break-word', minHeight: '2.5rem' }}>
                THE HIGH COUNCIL HAS APPROVED YOUR DATA REQUEST. YOU CAN NOW DOWNLOAD YOUR FULL TRAINING HISTORY.
              </p>
              <button
                className="primary-btn pixel-text"
                style={{ marginTop: '1.5rem', width: '100%', fontSize: '0.65rem' }}
                onClick={() => {
                  downloadCSV();
                  setShowDownloadPopup(false);
                  localStorage.setItem('last_csv_popup_id', String(csvRequest.id));
                }}
              >
                DOWNLOAD NOW
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
