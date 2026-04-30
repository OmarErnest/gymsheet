import { useEffect, useState } from 'react';
import { LogOut, Save, Eye, EyeOff, FileText } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../state/AuthContext.jsx';
import { t } from '../i18n.js';

export default function Settings({ preferences, setPreferences, lang }) {
  const { logout, user } = useAuth();
  const [form, setForm] = useState({ ...preferences, auth_mode: user?.auth_mode || 'pin', new_pin: '', new_password: '', leaderboard_message: preferences.leaderboard_message || '', height_cm: preferences.height_cm || '', weight_kg: preferences.weight_kg || '', recommended_link: preferences.recommended_link || '' });
  const [message, setMessage] = useState('');
  const [isChampion, setIsChampion] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [logFile, setLogFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [logUploadStatus, setLogUploadStatus] = useState(null);

  const [showSecret, setShowSecret] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, ...preferences, auth_mode: prev.auth_mode || user?.auth_mode || 'pin', leaderboard_message: preferences.leaderboard_message || '', height_cm: preferences.height_cm || '', weight_kg: preferences.weight_kg || '', recommended_link: preferences.recommended_link || '' }));
  }, [preferences, user]);


  useEffect(() => {
    api('/leaderboard/').then(data => {
      if (data.champion_id === user?.id) setIsChampion(true);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (form.font_size) {
      document.documentElement.dataset.font = form.font_size;
    }
  }, [form.font_size]);

  useEffect(() => {
    return () => {
      if (preferences.font_size) {
        document.documentElement.dataset.font = preferences.font_size;
      }
    };
  }, [preferences.font_size]);

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
    event.preventDefault();
    setMessage('');
    try {
      const body = { ...form };
      if (!body.new_pin) delete body.new_pin;
      if (!body.new_password) delete body.new_password;
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

  async function downloadTemplate() {
    try {
      const token = localStorage.getItem('gym_access');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
      const response = await fetch(`${apiUrl}/logs-csv-template/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to download template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'exercise_logs_template.csv';
      a.click();
    } catch (err) {
      alert(err.message);
    }
  }


  async function handleCsvAction() {
    if (!csvRequest || (!csvRequest.is_approved && csvRequest.id == null)) {
      // Create request
      try {
        const res = await api('/csv-requests/', { method: 'POST', body: '{}' });
        setCsvRequest(res);
      } catch (err) {
        alert(err.message);
      }
    } else if (csvRequest.is_approved) {
      // Download
      try {
        const token = localStorage.getItem('gym_access');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
        const response = await fetch(`${apiUrl}/export-csv/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Failed to export. Request may have expired.");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gym_data.csv';
        a.click();
      } catch (err) {
        alert("Failed to download CSV: " + err.message);
      }
    }
  }

  async function resetTestUser() {
    if (!window.confirm("Are you sure you want to wipe dummy's data?")) return;
    try {
      await api('/auth/reset-test-env/', { method: 'POST', body: '{}' });
      alert('Test user reset successfully.');
    } catch (err) {
      alert(err.message);
    }
  }

  let csvBtnText = "Request CSV";
  let csvBtnClass = "small-btn";
  let csvDisabled = false;

  if (csvRequest) {
    if (csvRequest.is_approved) {
      csvBtnText = "Download CSV Data";
      csvBtnClass = "small-btn success-btn"; // Make it green if possible, or just add inline style
    } else {
      csvBtnText = "Pending Approval";
      csvDisabled = true;
    }
  }

  return (
    <section className="stack">


      <form className="glass-card form-stack" onSubmit={save}>
        <label className="switch-row">
          <span>{t(lang, 'pauseFutureGoals')}<small>{t(lang, 'pauseHelp')}</small></span>
          <input type="checkbox" checked={!!form.goals_paused} onChange={(e) => update('goals_paused', e.target.checked)} />
        </label>

        <label className="field"><span>{t(lang, 'recommendLink')}</span>
          <input 
            type="url" 
            placeholder="https://..." 
            value={form.recommended_link} 
            onChange={(e) => update('recommended_link', e.target.value)} 
            disabled={user?.is_test_user}
          />
          <small className="muted">{t(lang, 'linkHelp')}</small>
        </label>

        <label className="field"><span>{t(lang, 'theme')}</span><select value={form.theme} onChange={(e) => update('theme', e.target.value)}><option value="dark">{t(lang, 'dark')}</option><option value="light">{t(lang, 'light')}</option></select></label>
        <label className="field"><span>Font Size</span><select value={form.font_size || 'medium'} onChange={(e) => update('font_size', e.target.value)}><option value="small">Small</option><option value="medium">Medium</option><option value="big">Big</option></select></label>
        <label className="field"><span>{t(lang, 'language')}</span><select value={form.language} onChange={(e) => update('language', e.target.value)}><option value="en">🇬🇧 English</option><option value="es">🇪🇸 Español</option></select></label>
        
        {showLegal && (
          <div className="modal-overlay" onClick={() => setShowLegal(false)}>
            <div className="glass-card modal-content" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                <FileText className="brand" />
                <h3 style={{ margin: 0 }}>{t(lang, 'legalDisclaimer')}</h3>
              </div>
              <p style={{ lineHeight: '1.6', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{t(lang, 'legalDisclaimerText')}</p>
              <button className="primary-btn" onClick={() => setShowLegal(false)}>OK</button>
            </div>
          </div>
        )}
        
        <label className="field"><span>{t(lang, 'profilePictureUrl')}</span>
          <input type="url" value={form.profile_pic_url_pending} onChange={(e) => update('profile_pic_url_pending', e.target.value)} placeholder="https://..." />
          <small className="muted">Pending admin approval</small>
        </label>
        
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
        {message && <p className="notice">{message}</p>}
      </form>

      {isChampion && (
        <article className="glass-card form-stack" style={{ borderColor: 'var(--brand)' }}>
          <p className="eyebrow" style={{ color: 'var(--brand)' }}>Champion Status</p>
          <h2>You are last week's Champion!</h2>
          <p className="muted">Write a message for everyone to see on the leaderboard. An admin must approve it before it is public.</p>
          <div className="field">
            <textarea 
              value={form.leaderboard_message || ''} 
              onChange={(e) => update('leaderboard_message', e.target.value)} 
              placeholder="Your champion quote..." 
              maxLength="255"
            />
          </div>
          <button className="primary-btn" onClick={save}><Save size={16} /> Save Message</button>
        </article>
      )}

      {user?.is_test_user && (
        <article className="glass-card form-stack" style={{ borderColor: 'var(--brand-2)', background: 'rgba(234, 179, 8, 0.05)' }}>
          <p className="eyebrow" style={{ color: 'var(--brand-2)' }}>{t(lang, 'testUserMessage')}</p>
          <p style={{ margin: 0 }}>{t(lang, 'contactMe')}</p>
        </article>
      )}

      <article className="glass-card form-stack">
        <p className="eyebrow">Data Export</p>
        <p className="muted">Request to download your exercise logs as a CSV file. Once approved by an admin, it will be available here for 24 hours.</p>
        <button 
          className={csvBtnClass} 
          onClick={handleCsvAction}
          disabled={csvDisabled || user?.is_test_user}
          style={csvRequest?.is_approved ? { backgroundColor: 'var(--success)', color: 'white', border: 'none' } : {}}
        >
          {csvBtnText}
        </button>
      </article>


      <article className="glass-card form-stack" style={{ borderLeft: '4px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow">{t(lang, 'uploadLogCSV')}</p>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0.4rem 0' }}>{t(lang, 'uploadLogCSVHelp')}</p>
          </div>
          <button className="small-btn" onClick={downloadTemplate} type="button" style={{ fontSize: '0.7rem' }}>Template</button>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <label className="custom-file-upload" style={{ flex: 1 }}>
            <input type="file" accept=".csv" onChange={(e) => setLogFile(e.target.files[0])} disabled={user?.is_test_user} />
            <span>{logFile ? logFile.name : 'Choose CSV File'}</span>
          </label>
          <button className="primary-btn" type="button" onClick={(e) => handleFileUpload(e, 'logs')} disabled={uploading || !logFile || user?.is_test_user} style={{ padding: '0.8rem' }}>
            {uploading ? <div className="spinner" /> : <Save size={18} />}
          </button>
        </div>
        {logUploadStatus && (
          <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
            Status: <strong style={{ textTransform: 'capitalize' }}>{logUploadStatus.status}</strong> 
            {logUploadStatus.admin_notes && ` — ${logUploadStatus.admin_notes}`}
          </p>
        )}
      </article>



      <div style={{ padding: '2rem 0' }}>
        <button onClick={logout} className="logout-btn primary-btn" style={{ width: '100%', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
          <LogOut size={18} /> {t(lang, 'logout')}
        </button>
      </div>

      <button 
        type="button" 
        className="fab-save" 
        onClick={() => setShowLegal(true)} 
        style={{ 
          bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))',
          right: '1.5rem',
          background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' 
        }}
      >
        <FileText size={28} />
      </button>
    </section>
  );
}
