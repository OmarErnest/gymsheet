import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Save, Mail, Calendar as CalendarIcon } from 'lucide-react';
import { api } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import { t } from '../i18n.js';

function iso(date) { return date.toISOString().slice(0, 10); }

/** Build initial inlineLogs from already-saved ExerciseLogs for the day */
function buildInitialLogs(daysData) {
  const logs = {};
  daysData.forEach((day) => {
    // Index existing logs by exercise id
    const savedByExercise = {};
    (day.logs || []).forEach((log) => {
      savedByExercise[String(log.exercise)] = log;
    });

    (day.goals || []).forEach((goal) => {
      (goal.goal_exercises || []).forEach((item) => {
        const exId = String(item.exercise_detail?.id);
        if (savedByExercise[exId]) {
          const saved = savedByExercise[exId];
          logs[item.id] = {
            sets: String(saved.sets),
            reps: String(saved.reps),
            weight_kg: saved.weight_kg !== null && saved.weight_kg !== undefined ? String(saved.weight_kg) : '',
            duration: saved.duration || '',
            log_id: saved.id,
          };
        }
      });
    });
  });
  return logs;
}

export default function Home({ lang }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [days, setDays] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [inlineLogs, setInlineLogs] = useState({});

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [daysData, notifs] = await Promise.all([
        api(`/home/days/?start=${iso(currentDate)}&end=${iso(currentDate)}`),
        api('/notifications/')
      ]);
      setDays(daysData);
      setNotifications(notifs.results || notifs);
      // Pre-populate inputs from saved logs — but only replace state
      // for items that have a saved log (never overwrite user's in-progress edits
      // unless this is a fresh load)
      setInlineLogs(buildInitialLogs(daysData));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentDate]);

  function changeDate(offset) {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset);
      return d;
    });
  }

  function goToToday() { setCurrentDate(new Date()); }

  function handleChange(itemId, field, raw) {
    // Sanitise per field
    let value = raw;
    if (field === 'sets' || field === 'reps') {
      value = raw.replace(/[^0-9]/g, ''); // positive integers only
    } else if (field === 'weight_kg') {
      value = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); // decimal
    } else if (field === 'duration') {
      value = raw.replace(/[^0-9:]/g, ''); // digits and colon only
    }
    setInlineLogs((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  }

  /** Save all exercises for one day that have a value entered */
  async function saveDay(day) {
    setSaving(true);
    setSaveMessage('');
    try {
      const ops = [];
      (day.goals || []).forEach((goal) => {
        (goal.goal_exercises || []).forEach((item) => {
          const logVal = inlineLogs[item.id];
          if (!logVal) return; // never touched → skip
          const isTimeBased = item.exercise_detail?.is_time_based;
          // Only save if the user has actually entered a value
          const hasValue = isTimeBased
            ? (logVal.duration !== undefined && logVal.duration !== '')
            : (logVal.weight_kg !== undefined && logVal.weight_kg !== '');
          if (!hasValue) return;

          // Clean up decimal — strip trailing dot (e.g. "5." → "5")
          const cleanWeight = String(logVal.weight_kg || '').replace(/\.$/, '') || '0';

          const payload = {
            exercise: item.exercise_detail.id,
            date: day.date,
            sets: logVal.sets !== undefined && logVal.sets !== '' ? Number(logVal.sets) : item.sets,
            reps: logVal.reps !== undefined && logVal.reps !== '' ? Number(logVal.reps) : item.reps,
            weight_kg: isTimeBased ? 0 : cleanWeight,
            duration: isTimeBased ? logVal.duration : '',
            source_goal_plan: item.goal_plan || null,
          };

          if (logVal.log_id) {
            ops.push(api(`/exercise-logs/${logVal.log_id}/`, { method: 'PATCH', body: JSON.stringify(payload) }));
          } else {
            ops.push(api('/exercise-logs/', { method: 'POST', body: JSON.stringify(payload) }));
          }
        });
      });

      if (ops.length === 0) {
        setSaveMessage('Nothing to save — enter a value for at least one exercise first.');
        return;
      }
      await Promise.all(ops);
      setSaveMessage(`Saved ${ops.length} exercise(s) ✓`);
      await load();
    } catch (err) {
      setSaveMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function markNotificationRead(id) {
    await api(`/notifications/${id}/`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  if (loading && days.length === 0) return <Skeleton count={6} />;

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const day = days[0];

  return (
    <section className="stack">
      {error && <p className="notice danger">{error}</p>}

      {/* Notification bell */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
        <button
          className="glass-card"
          onClick={() => setShowNotifications(!showNotifications)}
          style={{ padding: '0.8rem', border: 'none', background: 'var(--card-bg)', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Mail size={26} />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {unreadCount}
            </span>
          )}
        </button>
        {showNotifications && (
          <div className="glass-card" style={{ position: 'absolute', top: '100%', right: 0, width: '300px', zIndex: 10, marginTop: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h4 style={{ margin: 0 }}>Notifications</h4>
            {notifications.length === 0 ? <p className="muted" style={{ fontSize: '0.8rem' }}>No notifications</p> : null}
            {notifications.map((n) => (
              <div key={n.id} style={{ padding: '0.5rem', background: n.is_read ? 'transparent' : 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: n.is_read ? 0.6 : 1 }}>{n.message}</p>
                {!n.is_read && (
                  <button onClick={() => markNotificationRead(n.id)} style={{ background: 'transparent', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: '0.7rem' }}>
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Date navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0', gap: '1rem' }}>
        <button className="glass-card" style={{ padding: '0.5rem', border: 'none', background: 'var(--card-bg)', cursor: 'pointer', borderRadius: '50%' }} onClick={() => changeDate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{day?.label}</h3>
          {!day?.is_today && (
            <button className="small-btn" onClick={goToToday} style={{ marginTop: '0.5rem' }}>
              <CalendarIcon size={14} /> Back to Present Day
            </button>
          )}
        </div>
        <button className="glass-card" style={{ padding: '0.5rem', border: 'none', background: 'var(--card-bg)', cursor: 'pointer', borderRadius: '50%' }} onClick={() => changeDate(1)}>
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Day card */}
      {day && (
        <article className={day.is_today ? 'day-card today' : 'day-card'} style={{ opacity: loading ? 0.5 : 1 }}>
          {day.progress?.completed && (
            <div className="day-head" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <CheckCircle2 className="success" />
            </div>
          )}

          {day.goals.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>{t(lang, 'noGoals')}</p>
          ) : day.goals.map((goal) => (
            <div className="goal-block" key={goal.id} style={{ width: '100%', boxSizing: 'border-box', maxWidth: '500px', margin: '0.8rem auto 0 auto' }}>
              <div className="goal-title-row" style={{ display: 'flex', justifyContent: 'center' }}>
                <h4 style={{ textAlign: 'center', margin: 0 }}>{goal.title?.toUpperCase()}</h4>
              </div>
              <div className="exercise-list">
                {goal.goal_exercises?.map((item) => {
                  const isTimeBased = item.exercise_detail?.is_time_based;
                  const logVal = inlineLogs[item.id] || {};
                  const isSaved = !!logVal.log_id;
                  const isFuture = day.is_future;

                  return (
                    <div
                      className="exercise-row"
                      key={item.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.8rem',
                        padding: '1rem',
                        background: isSaved ? 'color-mix(in srgb, var(--brand) 6%, rgba(255,255,255,0.02))' : 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        border: isSaved ? '1px solid color-mix(in srgb, var(--brand) 25%, transparent)' : '1px solid transparent',
                        transition: 'background 0.2s, border 0.2s',
                        opacity: isFuture ? 0.6 : 1,
                        pointerEvents: isFuture ? 'none' : 'auto'
                      }}
                    >
                      {/* Exercise name / YouTube link + personal best */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {item.exercise_detail?.youtube_url ? (
                            <a
                              href={item.exercise_detail.youtube_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                textDecoration: 'none',
                                color: 'var(--text)',
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.25rem 0.6rem',
                                background: 'color-mix(in srgb, var(--brand) 10%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
                              }}
                              aria-label={`Watch ${item.exercise_detail?.name} on YouTube`}
                            >
                              {item.exercise_detail?.name}
                              <span style={{ color: 'var(--brand)', fontSize: '0.9rem' }}>▶</span>
                            </a>
                          ) : (
                            <strong style={{ fontSize: '1.1rem' }}>{item.exercise_detail?.name}</strong>
                          )}
                          {item.personal_best != null && (
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                              background: 'color-mix(in srgb, var(--brand) 15%, transparent)',
                              color: 'var(--brand)',
                              border: '1px solid color-mix(in srgb, var(--brand) 35%, transparent)',
                              whiteSpace: 'nowrap',
                            }}>
                              🏆 {item.personal_best}kg
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>
                          Target: {item.sets} {t(lang, 'sets')} · {item.reps} {t(lang, 'reps')} · {item.exercise_detail?.category}
                        </p>
                        {item.notes && <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.55 }}>{item.notes}</p>}
                      </div>

                      {/* Inputs */}
                      <div style={{ display: 'flex', gap: '0.8rem', width: '100%', justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        {/* Sets */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.3rem' }}>Sets</span>
                          <input
                            onFocus={(e) => e.target.select()}
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            disabled={isFuture}
                            value={logVal.sets !== undefined ? logVal.sets : ''}
                            placeholder={String(item.sets)}
                            onChange={(e) => handleChange(item.id, 'sets', e.target.value)}
                            style={{ width: '60px', height: '60px', borderRadius: '50%', textAlign: 'center', fontSize: '1.2rem', padding: '0', background: 'var(--card-bg)', border: `2px solid ${logVal.sets !== undefined && logVal.sets !== '' ? 'var(--brand)' : 'var(--line)'}`, color: 'var(--text)' }}
                          />
                        </div>
                        {/* Reps */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.3rem' }}>Reps</span>
                          <input
                            onFocus={(e) => e.target.select()}
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            disabled={isFuture}
                            value={logVal.reps !== undefined ? logVal.reps : ''}
                            placeholder={String(item.reps)}
                            onChange={(e) => handleChange(item.id, 'reps', e.target.value)}
                            style={{ width: '60px', height: '60px', borderRadius: '50%', textAlign: 'center', fontSize: '1.2rem', padding: '0', background: 'var(--card-bg)', border: `2px solid ${logVal.reps !== undefined && logVal.reps !== '' ? 'var(--brand)' : 'var(--line)'}`, color: 'var(--text)' }}
                          />
                        </div>
                        {/* Weight or Time */}
                        {isTimeBased ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.3rem' }}>Time</span>
                            <input
                              onFocus={(e) => e.target.select()}
                              type="text"
                              inputMode="numeric"
                              disabled={isFuture}
                              placeholder="MM:SS"
                              value={logVal.duration || ''}
                              onChange={(e) => handleChange(item.id, 'duration', e.target.value)}
                              style={{ width: '80px', height: '60px', borderRadius: '30px', textAlign: 'center', fontSize: '1.1rem', padding: '0', background: 'var(--card-bg)', border: `2px solid ${logVal.duration ? 'var(--brand)' : 'var(--line)'}`, color: 'var(--text)' }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.3rem' }}>Weight (kg)</span>
                            <input
                              onFocus={(e) => e.target.select()}
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.5"
                              disabled={isFuture}
                              placeholder="0"
                              value={logVal.weight_kg !== undefined ? logVal.weight_kg : ''}
                              onChange={(e) => handleChange(item.id, 'weight_kg', e.target.value)}
                              style={{ width: '80px', height: '60px', borderRadius: '30px', textAlign: 'center', fontSize: '1.1rem', padding: '0', background: 'var(--card-bg)', border: `2px solid ${logVal.weight_kg !== undefined && logVal.weight_kg !== '' ? 'var(--brand)' : 'var(--line)'}`, color: 'var(--text)' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </article>
      )}

      {/* Floating Save Button */}
      {days[0]?.goals?.length > 0 && (
        <button
          className="fab-save"
          onClick={() => saveDay(days[0])}
          disabled={saving || days[0].is_future}
          title={t(lang, 'save')}
        >
          {saving ? <div className="spinner" /> : <Save />}
        </button>
      )}

      {saveMessage && (
        <div className="save-toast">
          <CheckCircle2 size={16} />
          <span>{saveMessage}</span>
        </div>
      )}
    </section>
  );
}
