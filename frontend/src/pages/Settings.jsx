import { useEffect, useState } from 'react';
import { LogOut, Save, Eye, EyeOff, FileText, User as UserIcon, ChevronDown, FileDown } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../state/AuthContext.jsx';
import { t } from '../i18n.js';

const CHARACTER_ICONS = [
  'Android16.png', 'Babidi.png', 'Captain.png', 'Doctor.png', 'Hercule.png',
  'Jeice.png', 'Nappa.png', 'Piccolo.png', 'Racoome.png', 'Radiz.png', 'Korin.png'
];

export default function Settings({ preferences, setPreferences, lang }) {
  const { logout, user, setUser } = useAuth();
  const [form, setForm] = useState({ 
    ...preferences, 
    auth_mode: user?.auth_mode || 'pin', 
    new_pin: '', 
    new_password: '', 
    height_cm: preferences.height_cm || '', 
    weight_kg: preferences.weight_kg || '', 
    recommended_link: preferences.recommended_link || '',
    profile_pic_url: user?.profile_pic_url || ''
  });
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [logFile, setLogFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [logUploadStatus, setLogUploadStatus] = useState(null);

  const [showSecret, setShowSecret] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showIcons, setShowIcons] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ 
      ...prev, 
      ...preferences, 
      auth_mode: prev.auth_mode || user?.auth_mode || 'pin', 
      profile_pic_url: user?.profile_pic_url || ''
    }));
  }, [preferences, user]);

  async function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'language' || field === 'theme' || field === 'font_size') {
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
    setMessage('');
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
    }
  }

  const [csvRequest, setCsvRequest] = useState(null);

  useEffect(() => {
    if (!user) return;
    api('/csv-requests/').then(data => {
      const list = data.results || data;
      if (list.length > 0) setCsvRequest(list[0]);
    }).catch(() => {});

    api('/exercise-csv-uploads/').then(data => {
      const list = data.results || data;
      if (list.length > 0) setUploadStatus(list[0]);
    }).catch(() => {});

    api('/log-csv-uploads/').then(data => {
      const list = data.results || data;
      if (list.length > 0) setLogUploadStatus(list[0]);
    }).catch(() => {});
  }, [user]);

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
  }

  return (
    <section className="stack">
      <form className="glass-card form-stack" onSubmit={save}>
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
            <div className="icon-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', 
              gap: '1rem', 
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '16px',
              animation: 'slideDown 0.3s ease-out'
            }}>
              <button 
                type="button" 
                onClick={() => update('profile_pic_url', '')}
                style={{ 
                  padding: '0', 
                  background: form.profile_pic_url === '' ? 'var(--brand)' : 'var(--card-strong)', 
                  border: 'none',
                  borderRadius: '12px', 
                  aspectRatio: '1', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: form.profile_pic_url === '' ? '0 0 15px var(--brand)' : 'none',
                  transform: form.profile_pic_url === '' ? 'scale(1.1)' : 'scale(1)'
                }}
              >
                <UserIcon size={24} color={form.profile_pic_url === '' ? '#052e16' : 'var(--muted)'} />
              </button>
              {CHARACTER_ICONS.map(icon => (
                <button 
                  key={icon}
                  type="button" 
                  onClick={() => update('profile_pic_url', icon)}
                  style={{ 
                    padding: '0', 
                    background: 'var(--card-strong)', 
                    border: form.profile_pic_url === icon ? '3px solid var(--brand)' : '2px solid transparent', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    aspectRatio: '1', 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: form.profile_pic_url === icon ? '0 0 15px var(--brand)' : 'none',
                    transform: form.profile_pic_url === icon ? 'scale(1.1)' : 'scale(1)'
                  }}
                >
                  <img src={`/icons/${icon}`} alt={icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="switch-row">
          <span>{t(lang, 'pauseFutureGoals')}<small>{t(lang, 'pauseHelp')}</small></span>
          <input type="checkbox" checked={!!form.goals_paused} onChange={(e) => update('goals_paused', e.target.checked)} />
        </label>

        <label className="field"><span>{t(lang, 'recommendLink')}</span>
          <input type="url" placeholder="https://..." value={form.recommended_link} onChange={(e) => update('recommended_link', e.target.value)} disabled={user?.is_test_user} />
        </label>

        <label className="field"><span>{t(lang, 'theme')}</span><select value={form.theme} onChange={(e) => update('theme', e.target.value)}><option value="dark">🌑 {t(lang, 'dark')}</option><option value="light">☀️ {t(lang, 'light')}</option></select></label>
        <label className="field"><span>Font Size</span><select value={form.font_size || 'medium'} onChange={(e) => update('font_size', e.target.value)}><option value="small">Small</option><option value="medium">Medium</option><option value="big">Big</option></select></label>
        <label className="field"><span>{t(lang, 'language')}</span><select value={form.language} onChange={(e) => update('language', e.target.value)}><option value="en">🇬🇧 English</option><option value="es">🇪🇸 Español</option></select></label>
        
        <div className="paste-input">
          <label className="field"><span>Height (cm)</span><input inputMode="numeric" value={form.height_cm} onChange={(e) => update('height_cm', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 175" /></label>
          <label className="field"><span>Weight (kg)</span><input inputMode="decimal" value={form.weight_kg} onChange={(e) => update('weight_kg', e.target.value)} placeholder="e.g. 70.5" /></label>
        </div>

        <label className="field"><span>{t(lang, 'loginMethod')}</span><select value={form.auth_mode} onChange={(e) => update('auth_mode', e.target.value)}><option value="pin">{t(lang, 'sixDigitPin')}</option><option value="password">{t(lang, 'securePassword')}</option></select></label>
        {form.auth_mode === 'pin' ? (
          <label className="field">
            <span>{t(lang, 'newPin')}</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input type={showSecret ? "text" : "password"} inputMode="numeric" maxLength="6" value={form.new_pin} onChange={(e) => update('new_pin', e.target.value.replace(/\D/g, ''))} placeholder={t(lang, 'optional')} style={{ width: '100%', paddingRight: '2.5rem' }} />
              <button type="button" onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        ) : (
          <label className="field">
            <span>{t(lang, 'newPassword')}</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input type={showSecret ? "text" : "password"} value={form.new_password} onChange={(e) => update('new_password', e.target.value)} placeholder={t(lang, 'optional')} style={{ width: '100%', paddingRight: '2.5rem' }} />
              <button type="button" onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        )}
        <button className="primary-btn"><Save size={16} /> {t(lang, 'saveSettings')}</button>
        {message && <p className="notice" style={{ textAlign: 'center' }}>{message}</p>}
      </form>

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

      {/* About Section */}
      <article className="glass-card form-stack" style={{ borderLeft: '4px solid var(--brand-2)' }}>
        <h3 className="eyebrow">{t(lang, 'about')}</h3>
        
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
            <span>{t(lang, 'version')}</span>
            <strong className="brand">v-03a.21</strong>
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

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0.5rem 0' }} />

          {/* Contact Admin */}
            <label className="field">
              <span>{t(lang, 'messageAdmin')}</span>
              <textarea 
                placeholder={t(lang, 'writeToAdmin')}
                className="glass-input"
                style={{ minHeight: '120px', fontSize: '0.9rem', resize: 'vertical' }}
                id="adminMessageInput"
              />
            </label>
            <button 
              className="primary-btn" 
              onClick={async (e) => {
                const input = document.getElementById('adminMessageInput');
                if (!input.value.trim()) return;
                try {
                  await api('/admin-messages/', { method: 'POST', body: JSON.stringify({ message: input.value }) });
                  input.value = '';
                  setMessage(t(lang, 'messageSent'));
                } catch (err) {
                  alert(err.message);
                }
              }}
            >
              <Save size={16} /> {t(lang, 'send')}
            </button>
          </div>
      </article>

      <div style={{ padding: '1rem 0 3rem' }}>
        <button onClick={logout} className="logout-btn primary-btn" style={{ width: '100%', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
          <LogOut size={18} /> {t(lang, 'logout')}
        </button>
      </div>
    </section>
  );
}
