import { useEffect, useState } from 'react';
import { Shield, Send, Bell, MessageSquare, Check, Users, Zap, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { t } from '../i18n.js';

export default function Admin({ lang }) {
  const [globalNotices, setGlobalNotices] = useState([]);
  const [maintenanceNotices, setMaintenanceNotices] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ 
    target: 'all-popup', 
    userId: '', 
    title: '', 
    message: '',
    startTime: '',
    endTime: '',
    timezone: 'EST'
  });
  const [status, setStatus] = useState('');
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState('');
  const [sanitizeRequests, setSanitizeRequests] = useState([]);
  const [sanitizeNotes, setSanitizeNotes] = useState({});

  useEffect(() => {
    loadData();
    loadUsers();
    loadSanitizeRequests();
  }, []);

  async function loadData() {
    try {
      const [noticesRes, maintRes] = await Promise.all([
        api('/global-notices/'),
        api('/maintenance-notices/')
      ]);
      setGlobalNotices(noticesRes.results || noticesRes);
      setMaintenanceNotices(maintRes.results || maintRes);
    } catch (err) {}
  }

  async function loadUsers() {
    try {
      const res = await api('/users/');
      setUsers(res.results || res);
    } catch (err) {}
  }

  async function loadSanitizeRequests() {
    try {
      const res = await api('/sanitize-requests/');
      setSanitizeRequests((res.results || res).filter(r => r.status === 'pending'));
    } catch (err) {}
  }

  async function approveSanitize(id) {
    const notes = sanitizeNotes[id] || 'Approved by admin.';
    if (!window.confirm(`Approve and WIPE all data for this user? Notes: "${notes}"`)) return;
    try {
      await api(`/sanitize-requests/${id}/approve/`, { method: 'POST', body: JSON.stringify({ notes }) });
      await loadSanitizeRequests();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function rejectSanitize(id) {
    const notes = sanitizeNotes[id] || 'Rejected by admin.';
    try {
      await api(`/sanitize-requests/${id}/reject/`, { method: 'POST', body: JSON.stringify({ notes }) });
      await loadSanitizeRequests();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function sendNotification(e) {
    e.preventDefault();
    setStatus('Sending...');
    try {
      if (form.target === 'all-popup') {
        await api('/global-notices/', {
          method: 'POST',
          body: JSON.stringify({ title: form.title, message: form.message })
        });
      } else if (form.target === 'all-standard') {
        await api('/broadcast-notifications/', {
          method: 'POST',
          body: JSON.stringify({ message: form.message })
        });
      } else if (form.target === 'maintenance') {
        await api('/maintenance-notices/', {
          method: 'POST',
          body: JSON.stringify({ 
            start_time: form.startTime, 
            end_time: form.endTime, 
            timezone: form.timezone,
            message: form.message 
          })
        });
      }
      setForm({ ...form, title: '', message: '', startTime: '', endTime: '' });
      setStatus('Sent successfully!');
      loadData();
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus('Passwords do not match');
      return;
    }
    setPasswordStatus('Updating...');
    try {
      await api('/settings/', {
        method: 'PATCH',
        body: JSON.stringify({ new_password: passwordForm.newPassword, auth_mode: 'password' })
      });
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setPasswordStatus('Password changed successfully!');
      setTimeout(() => setPasswordStatus(''), 3000);
    } catch (err) {
      setPasswordStatus('Error: ' + err.message);
    }
  }

  return (
    <section className="stack">
      <div className="hero-card global-hero" style={{ background: 'linear-gradient(135deg, #7c2d12 0%, #431407 100%)' }}>
        <Shield size={32} />
        <div>
          <h2 style={{ letterSpacing: '-1px' }}>ADMIN CONTROL</h2>
          <p className="muted">Manage system notices and user messages</p>
        </div>
      </div>

      <article className="glass-card form-stack">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand)', marginBottom: '0.5rem' }}>
          <Shield size={18} />
          <h3 className="eyebrow" style={{ color: 'inherit', margin: 0 }}>CHANGE ADMIN PASSWORD</h3>
        </div>
        
        <form onSubmit={changePassword} className="form-stack">
          <label className="field">
            <span>New Password</span>
            <input 
              type="password" 
              value={passwordForm.newPassword} 
              onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} 
              required 
            />
          </label>
          <label className="field">
            <span>Confirm Password</span>
            <input 
              type="password" 
              value={passwordForm.confirmPassword} 
              onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} 
              required 
            />
          </label>
          <button className="primary-btn" disabled={!passwordForm.newPassword || !passwordForm.confirmPassword}>
            Update Password
          </button>
          {passwordStatus && <p className="notice" style={{ textAlign: 'center', fontWeight: 'bold', color: passwordStatus.includes('Error') || passwordStatus.includes('not match') ? 'var(--danger)' : 'var(--brand)' }}>{passwordStatus}</p>}
        </form>
      </article>

      <article className="glass-card form-stack">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand)', marginBottom: '0.5rem' }}>
          <Bell size={18} />
          <h3 className="eyebrow" style={{ color: 'inherit', margin: 0 }}>SEND NOTIFICATION</h3>
        </div>
        
        <form onSubmit={sendNotification} className="form-stack">
          <label className="field">
            <span>Send To</span>
            <select 
              value={form.target} 
              onChange={e => {
                const val = e.target.value;
                let msg = form.message;
                if (val === 'maintenance' && !form.message) {
                  msg = "MAINTENANCE WORK IN PROGRESS. DON'T WORRY, YOUR DATA IS SAFE.";
                }
                setForm({...form, target: val, message: msg});
              }}
              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', border: '1px solid var(--line)', padding: '0.8rem', borderRadius: '8px' }}
            >
              <option value="all-popup">All Users (Big Popup)</option>
              <option value="maintenance">Maintenance Alert (Hotfix.png + Dates)</option>
            </select>
          </label>

          {form.target === 'maintenance' && (
            <div className="form-stack animate-pop" style={{ background: 'rgba(var(--brand-rgb), 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label className="field">
                  <span>Start (Local Time)</span>
                  <input 
                    type="datetime-local" 
                    value={form.startTime} 
                    onChange={e => setForm({...form, startTime: e.target.value})} 
                    required 
                  />
                </label>
                <label className="field">
                  <span>End (Local Time)</span>
                  <input 
                    type="datetime-local" 
                    value={form.endTime} 
                    onChange={e => setForm({...form, endTime: e.target.value})} 
                    required 
                  />
                </label>
              </div>
              <label className="field">
                <span>Timezone</span>
                <input 
                  placeholder="EST" 
                  value={form.timezone} 
                  onChange={e => setForm({...form, timezone: e.target.value})} 
                  required 
                />
              </label>
            </div>
          )}

          {form.target === 'all-popup' && (
            <label className="field animate-pop">
              <span>Notice Title</span>
              <input 
                placeholder="e.g. MAINTENANCE ALERT" 
                value={form.title} 
                onChange={e => setForm({...form, title: e.target.value})} 
                required 
              />
            </label>
          )}

          <label className="field">
            <span>Message Content</span>
            <textarea 
              placeholder={form.target === 'all-popup' ? "This will appear in a big popup for everyone..." : "Message content..."}
              value={form.message} 
              onChange={e => setForm({...form, message: e.target.value})} 
              required
              style={{ minHeight: '100px' }}
            />
          </label>

          <button className="primary-btn" disabled={!form.message || (form.target === 'all-popup' && !form.title) || (form.target === 'maintenance' && (!form.startTime || !form.endTime))}>
            <Send size={16} /> Send Notification
          </button>
          {status && <p className="notice" style={{ textAlign: 'center', fontWeight: 'bold', color: status.includes('Error') ? 'var(--danger)' : 'var(--brand)' }}>{status}</p>}
        </form>
      </article>


      <article className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand)', marginBottom: '1rem' }}>
          <Zap size={18} />
          <h3 className="eyebrow" style={{ color: 'inherit', margin: 0 }}>DIAGNOSTICS & TESTING</h3>
        </div>
        <div className="stack" style={{ gap: '1rem' }}>
          <p className="muted" style={{ fontSize: '0.8rem' }}>Trigger system-wide events to verify UI components and notification delivery.</p>
          <button 
            className="secondary-btn" 
            onClick={async () => {
              setStatus('Running test sequence...');
              try {
                // 1. Global Notice
                await api('/global-notices/', { method: 'POST', body: JSON.stringify({ title: "DIAGNOSTIC TEST", message: "System-wide popup event triggered successfully." }) });
                // 2. Hydration Trigger (local)
                window.dispatchEvent(new CustomEvent('trigger-hydration'));
                // 3. Maintenance Notice
                const now = new Date();
                const end = new Date(now.getTime() + 2*60*60*1000);
                await api('/maintenance-notices/', { method: 'POST', body: JSON.stringify({ start_time: now.toISOString(), end_time: end.toISOString(), timezone: 'UTC', message: 'DIAGNOSTIC MAINTENANCE TEST' }) });
                
                setStatus('Test sequence complete!');
                loadData();
              } catch (err) {
                setStatus('Diagnostic Error: ' + err.message);
              }
            }}
          >
            <RefreshCw size={16} /> Trigger All Events (Dummy Test)
          </button>
        </div>
      </article>

      <article className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand)', marginBottom: '1rem' }}>
          <Shield size={18} />
          <h3 className="eyebrow" style={{ color: 'inherit', margin: 0 }}>ACTIVE SYSTEM NOTICES</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {globalNotices.length === 0 && maintenanceNotices.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>No active notices</p>}
          
          {globalNotices.map(n => (
            <div key={n.id} style={{ padding: '0.8rem', background: 'rgba(var(--brand-rgb), 0.05)', borderRadius: '12px', border: '1px solid rgba(var(--brand-rgb), 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                <Bell size={14} className="text-brand" />
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{n.title}</h4>
              </div>
              <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0 0 0.5rem 0' }}>{n.message}</p>
              <small className="muted">{new Date(n.created_at).toLocaleDateString()}</small>
            </div>
          ))}

          {maintenanceNotices.map(n => (
            <div key={n.id} style={{ padding: '0.8rem', background: 'rgba(234, 88, 12, 0.1)', borderRadius: '12px', border: '1px solid rgba(234, 88, 12, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', color: '#ea580c' }}>
                <Shield size={14} />
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>MAINTENANCE ALERT</h4>
              </div>
              <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0 0 0.5rem 0' }}>{n.message}</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="pill" style={{ fontSize: '0.65rem', background: 'rgba(0,0,0,0.2)' }}>
                  {new Date(n.start_time).toLocaleString()} - {new Date(n.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {n.timezone}
                </span>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* Sanitize Requests */}
      <article className="glass-card" style={{ borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
            <AlertTriangle size={18} />
            <h3 className="eyebrow" style={{ color: 'inherit', margin: 0 }}>SANITIZE REQUESTS</h3>
          </div>
          <button className="small-btn" onClick={loadSanitizeRequests} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {sanitizeRequests.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>
            No pending sanitize requests.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sanitizeRequests.map(sr => (
              <div key={sr.id} style={{
                padding: '1rem',
                borderRadius: '12px',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                display: 'grid',
                gap: '0.6rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: '900', margin: 0 }}>{sr.user_name || sr.user_email}</p>
                    <small className="muted">{sr.user_email}</small>
                  </div>
                  <small className="muted">{new Date(sr.created_at).toLocaleDateString()}</small>
                </div>
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontSize: '0.72rem' }}>Admin notes (optional)</span>
                  <input
                    type="text"
                    placeholder="Reason..."
                    value={sanitizeNotes[sr.id] || ''}
                    onChange={e => setSanitizeNotes(prev => ({ ...prev, [sr.id]: e.target.value }))}
                    style={{ fontSize: '0.82rem' }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="primary-btn"
                    style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8rem' }}
                    onClick={() => approveSanitize(sr.id)}
                  >
                    <Trash2 size={14} /> Approve & Wipe
                  </button>
                  <button
                    className="small-btn"
                    style={{ flex: 1, fontSize: '0.8rem' }}
                    onClick={() => rejectSanitize(sr.id)}
                  >
                    <Check size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
