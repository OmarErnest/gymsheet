import { useEffect, useState, useRef, useMemo, Fragment } from 'react';
import { Save, Plus, Trash2, CheckCircle2, ChevronRight, ChevronLeft, Trophy, Play, Timer, Pause, RotateCcw, Droplets, Square, Settings, Table, LayoutGrid, CalendarDays } from 'lucide-react';
import { api, iso } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import { t } from '../i18n.js';




/** Build initial inlineLogs from already-saved ExerciseLogs for the day */
function buildInitialLogs(daysData) {
  const logs = {};
  daysData.forEach((day) => {
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
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null); // { id: exerciseId, time: seconds }
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [completedCount, setCompletedCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  const [todayOverrides, setTodayOverrides] = useState({}); // { goalId: [ { exercise_detail, sets, reps, is_time_based } ] }
  const [inlineLogs, setInlineLogs] = useState({});
  const [firstLoad, setFirstLoad] = useState(true);
  const [viewMode, setViewMode] = useState('feed'); // 'feed' or 'spreadsheet'

  const [relativeWeek, setRelativeWeek] = useState(0);

  const currentWeekStart = useMemo(() => {
    const d = new Date();
    // Get to Monday of current week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    // Offset by relative week
    monday.setDate(monday.getDate() + relativeWeek * 7);
    return monday;
  }, [relativeWeek]);

  const [showBackToPresent, setShowBackToPresent] = useState(false);

  // Workout State
  const [workoutActive, setWorkoutActive] = useState(localStorage.getItem('workout_active') === 'true');
  const [workoutStart, setWorkoutStart] = useState(localStorage.getItem('workout_start'));

  const todayRef = useRef(null);
  const [shouldScrollToToday, setShouldScrollToToday] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const start = new Date(currentWeekStart);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const todayStr = iso(new Date());
      const res = await api(`/home/days/?start=${iso(start)}&end=${iso(end)}&today=${todayStr}`);
      setDays(res);
      setInlineLogs(buildInitialLogs(res));
      
      const isPresentWeek = res.some(d => d.is_today);
      setShowBackToPresent(!isPresentWeek);

      return res;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, [currentWeekStart]);

  useEffect(() => {
    const handleTab = (e) => {
      if (e.detail === 'home') {
        setRelativeWeek(0);
        setShouldScrollToToday(true);
      }
    };
    window.addEventListener('change-app-tab', handleTab);
    return () => window.removeEventListener('change-app-tab', handleTab);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    api('/exercises/').then(res => setAllExercises(res.results || res)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && days.some(d => d.is_today) && shouldScrollToToday) {
      if (todayRef.current) {
        todayRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
        setShouldScrollToToday(false);
      }
    }
  }, [loading, days, shouldScrollToToday]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Hydration logic
  useEffect(() => {
    if (workoutActive && workoutStart) {
      const startTime = new Date(workoutStart).getTime();
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const diffMins = (now - startTime) / (1000 * 60);

        if (diffMins > 0 && diffMins <= 150 && Math.floor(diffMins) % 30 === 0) {
          window.dispatchEvent(new CustomEvent('trigger-hydration'));
        }

        if (diffMins > 150) {
          stopWorkout();
        }
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [workoutActive, workoutStart]);


  const startWorkout = () => {
    const now = new Date().toISOString();
    setWorkoutActive(true);
    setWorkoutStart(now);
    localStorage.setItem('workout_active', 'true');
    localStorage.setItem('workout_start', now);
  };

  const stopWorkout = () => {
    setWorkoutActive(false);
    setWorkoutStart(null);
    localStorage.removeItem('workout_active');
    localStorage.removeItem('workout_start');
  };

  const changeWeek = (dir) => {
    setShouldScrollToToday(false);
    setRelativeWeek(prev => {
      const next = prev + dir;
      if (next < -6) return -6;
      if (next > 1) return 1;
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  function handleChange(itemId, field, raw) {
    let value = raw;
    if (field === 'sets' || field === 'reps') {
      value = raw.replace(/[^0-9]/g, '');
    } else if (field === 'weight_kg') {
      value = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    } else if (field === 'duration') {
      value = raw.replace(/[^0-9:]/g, '');
    }
    setInlineLogs((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  }

  const handleTimerFinish = (id, seconds) => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    handleChange(id, 'duration', `${mm}:${ss}`);
    setActiveTimer(null);
  };

  async function saveAll() {
    setSaving(true);
    setSaveMessage('');
    let sessionLogsCount = 0;
    try {
      let opsCount = 0;
      for (const day of days) {
        for (const goal of day.goals || []) {
          const overrides = todayOverrides[goal.id] || [];
          const allCurrent = [...(goal.goal_exercises || []), ...overrides];
          
          for (const item of allCurrent) {
            // If it's a replaced item, skip the original
            if (!item._isExtra && overrides.some(o => o._replacedId === item.id)) continue;

            const logVal = inlineLogs[item.id || `extra-${allCurrent.indexOf(item)}` ];
            if (!logVal && !item._isExtra) continue;
            
            const isTimeBased = item.exercise_detail?.is_time_based;
            const hasValue = isTimeBased
              ? (logVal?.duration !== undefined && logVal?.duration !== '')
              : (logVal?.weight_kg !== undefined && logVal?.weight_kg !== '');

            if (!hasValue && !item._isExtra) {
              if (logVal?.log_id) {
                await api(`/exercise-logs/${logVal.log_id}/`, { method: 'DELETE' });
                opsCount++;
              }
              continue;
            }

            const cleanWeight = String(logVal?.weight_kg || item.weight_kg || '').replace(/\.$/, '') || '0';
            const payload = {
              exercise: item.exercise_detail.id,
              date: day.date,
              sets: logVal?.sets !== undefined && logVal?.sets !== '' ? Number(logVal.sets) : item.sets,
              reps: isTimeBased ? 1 : (logVal?.reps !== undefined && logVal?.reps !== '' ? Number(logVal.reps) : item.reps),
              weight_kg: isTimeBased ? 0 : cleanWeight,
              duration: isTimeBased ? (logVal?.duration || '') : '',
              source_goal_plan: goal.id || null, 
            };

            if (logVal?.log_id) {
              await api(`/exercise-logs/${logVal.log_id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
              opsCount++;
            } else if (hasValue || item._isExtra) {
              await api('/exercise-logs/', { method: 'POST', body: JSON.stringify(payload) });
              opsCount++;
              if (day.is_today) sessionLogsCount++;
            }
          }
        }
      }

      if (opsCount === 0) {
        setSaveMessage('Nothing to save');
        setSaving(false);
        return;
      }
      setSaveMessage(`Saved ✓`);

      await loadInitial();
      
      // Hydration Trigger: GLOBAL total logs count is divisible by 3
      const allLogsRes = await api('/exercise-logs/');
      const totalGlobalLogs = allLogsRes.count || allLogsRes.length || 0;
      
      if (totalGlobalLogs > 0 && totalGlobalLogs % 3 === 0) {
        window.dispatchEvent(new CustomEvent('trigger-hydration'));
      }
    } catch (err) {
      setSaveMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && firstLoad) return (
    <div className="loading-screen">
      <img src="/icon.png" className="loading-logo-spin" alt="" />
      <h2 style={{ letterSpacing: '2px', fontWeight: '900', color: 'var(--brand)' }}>LOADING FEED...</h2>
    </div>
  );

  return (
    <section className="stack" style={{ paddingBottom: '8rem' }}>
      {error && <p className="notice danger">{error}</p>}

      <div className="nav-arrows">
        <button className="arrow-btn" onClick={() => changeWeek(-1)} disabled={relativeWeek <= -6}><ChevronLeft size={20} /></button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: '900', fontSize: '0.9rem', color: 'var(--brand)', minWidth: '180px', display: 'block' }}>
            {relativeWeek === 0 ? 'CURRENT WEEK' : 
             relativeWeek === 1 ? '1 WEEK IN THE FUTURE' : 
             `${Math.abs(relativeWeek)} ${Math.abs(relativeWeek) === 1 ? 'WEEK' : 'WEEKS'} IN THE PAST`}
          </span>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginTop: '0.4rem' }}>
            {relativeWeek !== 0 && (
              <button 
                onClick={() => {
                  setRelativeWeek(0);
                  setShouldScrollToToday(true);
                }} 
                style={{ 
                  background: 'rgba(var(--brand-rgb), 0.1)', 
                  border: '1px solid rgba(var(--brand-rgb), 0.3)', 
                  color: 'var(--brand)', 
                  fontSize: '0.65rem', 
                  fontWeight: '1000', 
                  cursor: 'pointer', 
                  padding: '6px 14px', 
                  borderRadius: '999px', 
                  transition: 'all 0.3s ease',
                  letterSpacing: '1px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
              >
                BACK TO PRESENT
              </button>
            )}
            <button 
              onClick={() => setViewMode(prev => prev === 'feed' ? 'spreadsheet' : 'feed')} 
              style={{ 
                background: 'rgba(var(--brand-rgb), 0.1)', 
                border: '1px solid rgba(var(--brand-rgb), 0.3)', 
                color: 'var(--brand)', 
                fontSize: '0.65rem', 
                fontWeight: '1000', 
                cursor: 'pointer', 
                padding: '6px 14px', 
                borderRadius: '999px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                transition: 'all 0.3s ease',
                letterSpacing: '1px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}
            >
              {viewMode === 'feed' ? <Table size={13} strokeWidth={2.5} /> : <LayoutGrid size={13} strokeWidth={2.5} />}
              {viewMode === 'feed' ? 'SPREADSHEET' : 'FEED'}
            </button>
          </div>
        </div>
        <button className="arrow-btn" onClick={() => changeWeek(1)} disabled={relativeWeek >= 1}><ChevronRight size={20} /></button>
      </div>


      {viewMode === 'spreadsheet' ? (
        <div className="glass-card" style={{ padding: '0', overflowX: 'auto', borderRadius: '24px', border: '1px solid var(--line)', animation: 'slideUp 0.4s ease-out' }}>
          <table className="spreadsheet-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '1.2rem 1rem', textAlign: 'left', background: 'rgba(255,255,255,0.03)', borderBottom: '2px solid var(--line)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '1px', fontWeight: '900' }}>Day</th>
                <th style={{ padding: '1.2rem 1rem', textAlign: 'left', background: 'rgba(255,255,255,0.03)', borderBottom: '2px solid var(--line)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '1px', fontWeight: '900' }}>Exercise</th>
                <th style={{ padding: '1.2rem 1rem', textAlign: 'left', background: 'rgba(255,255,255,0.03)', borderBottom: '2px solid var(--line)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '1px', fontWeight: '900' }}>Sets x Reps</th>
                <th style={{ padding: '1.2rem 1rem', textAlign: 'left', background: 'rgba(255,255,255,0.03)', borderBottom: '2px solid var(--line)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '1px', fontWeight: '900' }}>Weight / Time</th>
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const allExercises = day.goals?.flatMap(g => g.goal_exercises || []) || [];
                const rowCount = Math.max(allExercises.length, 1);
                
                const dayCell = (
                  <td rowSpan={rowCount} style={{ 
                    padding: '1.2rem 1rem', 
                    verticalAlign: 'top', 
                    borderBottom: '1px solid var(--line)',
                    width: '120px',
                    borderRight: '1px solid var(--line)',
                    background: day.is_today ? 'rgba(var(--brand-rgb), 0.05)' : 'transparent'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '1000', fontSize: '1rem', color: day.is_today ? 'var(--brand)' : 'var(--text)' }}>
                        {day.label.split(',')[0]}
                      </span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: '800' }}>
                        {day.label.split(',')[1]}
                      </span>
                    </div>
                  </td>
                );

                if (allExercises.length === 0) {
                  return (
                    <tr key={day.date} style={{ background: day.is_today ? 'rgba(var(--brand-rgb), 0.08)' : 'transparent' }}>
                      {dayCell}
                      <td colSpan={3} style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--line)', fontStyle: 'italic', opacity: 0.3 }}>
                        Rest Day
                      </td>
                    </tr>
                  );
                }

                return (
                  <Fragment key={day.date}>
                    {allExercises.map((item, idx) => {
                      const isTimeBased = item.exercise_detail?.is_time_based;
                      const logVal = inlineLogs[item.id] || {};
                      const isDone = !!logVal.log_id;
                      
                      return (
                        <tr key={item.id} style={{ 
                          background: isDone ? 'rgba(var(--brand-rgb), 0.08)' : (day.is_today ? 'rgba(var(--brand-rgb), 0.03)' : 'transparent'),
                          transition: 'background 0.3s'
                        }}>
                          {idx === 0 && dayCell}
                          <td style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--line)', fontWeight: '700', color: isDone ? 'var(--brand)' : 'var(--text)' }}>
                            {t(lang, item.exercise_detail?.name)}
                          </td>
                          <td style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--line)' }}>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: '900', 
                              padding: '4px 10px', 
                              background: isDone ? 'var(--brand)' : 'var(--card-strong)',
                              color: isDone ? '#052e16' : 'var(--muted)',
                              borderRadius: '8px',
                              whiteSpace: 'nowrap'
                            }}>
                              {logVal.sets ?? item.sets}x{String(logVal.reps ?? item.reps).padStart(2, '0')}
                            </span>
                          </td>
                          <td style={{ padding: '1.2rem 1rem', borderBottom: '1px solid var(--line)', fontSize: '0.8rem', fontWeight: '800', opacity: 0.8, whiteSpace: 'nowrap' }}>
                            {isTimeBased ? `${logVal.duration || item.duration || '00:00'} min` : `${logVal.weight_kg || '0'}kg`}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="days-feed">
          {loading ? (
            <div className="stack" style={{ padding: '0 1rem' }}>
              <Skeleton count={3} />
            </div>
          ) : days.map((day) => {
            const isCompleted = day.progress?.completed;
            const showStart = day.is_today && !isCompleted;
            const isCurrentWeek = days.some(d => d.is_today);

            return (
              <article
                key={day.date}
                ref={day.is_today ? todayRef : null}
                className={day.is_today ? 'day-card today' : 'day-card'}
                style={{ marginBottom: 'clamp(1rem, 4vw, 1.5rem)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950' }}>{day.label.split(',')[0]}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '800' }}>{day.label.split(',')[1]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {isCurrentWeek && (
                      <button
                        onClick={() => setEditMode(!editMode)}
                        className={editMode ? 'small-btn active' : 'small-btn'}
                        style={{ 
                          padding: '0.5rem', 
                          borderRadius: '12px', 
                          background: editMode ? 'var(--brand)' : 'rgba(255,255,255,0.05)',
                          color: editMode ? '#052e16' : 'var(--text)',
                          border: 'none',
                          boxShadow: editMode ? '0 0 15px var(--brand)' : 'none',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <Settings size={18} className={editMode ? 'spin' : ''} />
                      </button>
                    )}
                    {isCompleted && !editMode && <CheckCircle2 size={18} className="success" />}
                  </div>
                </div>

                {(!day.goals || day.goals.length === 0) ? (
                  <div 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('change-app-tab', { detail: 'profile' }));
                      window.dispatchEvent(new CustomEvent('change-profile-tab', { detail: 'creategoal' }));
                    }}
                    className="dotted-btn"
                    style={{ textAlign: 'center', padding: '1.5rem 0', fontSize: '0.85rem', cursor: 'pointer', borderRadius: '12px' }}
                  >
                    <p style={{ margin: 0 }}>{t(lang, 'noGoals')}</p>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Tap to create one</span>
                  </div>
                ) : (
                  <div className="goals-container" style={{ display: 'grid', gap: '1rem' }}>
                    {(day.goals || []).map((goal) => {
                      const overrides = todayOverrides[goal.id] || [];
                      const allCurrentExercises = [...(goal.goal_exercises || []), ...overrides];
                      const isLocked = !isCurrentWeek;

                      return (
                        <div key={goal.id} className={editMode && isCurrentWeek ? 'edit-pulse' : ''} style={{ 
                          border: editMode && isCurrentWeek ? '1px solid var(--brand)' : 'none',
                          borderRadius: '16px',
                          padding: editMode && isCurrentWeek ? '0.5rem' : '0',
                          background: editMode && isCurrentWeek ? 'rgba(var(--brand-rgb), 0.02)' : 'transparent'
                        }}>
                          <div className="exercise-stack" style={{ display: 'grid', gap: '0.8rem' }}>
                            {allCurrentExercises.map((item, idx) => {
                              // If this is an original item that has been replaced, don't show it
                              if (!item._isExtra && overrides.some(o => o._replacedId === item.id)) return null;

                              const isExtra = !!item._isExtra;
                              const isTimeBased = item.exercise_detail?.is_time_based;
                              const isCalisthenics = item.exercise_detail?.exercise_type === 'calisthenics';
                              const logKey = item.id || `extra-${idx}`;
                              const logVal = inlineLogs[logKey] || {};

                              return (
                                <div key={item.id || `extra-${idx}`} className="exercise-item-old">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {editMode && isCurrentWeek ? (
                                          <select 
                                            style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--brand)', fontWeight: '900', fontSize: '0.9rem', padding: '2px 4px', borderRadius: '4px' }}
                                            value={item.exercise_detail?.id}
                                            onChange={(e) => {
                                              const newEx = allExercises.find(ex => String(ex.id) === e.target.value);
                                              if (isExtra) {
                                                setTodayOverrides(prev => ({
                                                  ...prev,
                                                  [goal.id]: prev[goal.id].map((it, i) => i === (idx - (goal.goal_exercises?.length || 0)) ? { ...it, exercise_detail: newEx } : it)
                                                }));
                                              } else {
                                                // Replace existing
                                                setTodayOverrides(prev => ({
                                                  ...prev,
                                                  [goal.id]: [...(prev[goal.id] || []), { ...item, exercise_detail: newEx, _isExtra: true, _replacedId: item.id }]
                                                }));
                                              }
                                            }}
                                          >
                                            {allExercises.map(ex => <option key={ex.id} value={ex.id}>{t(lang, ex.name)}</option>)}
                                          </select>
                                        ) : (
                                          <strong style={{ fontSize: '0.95rem' }}>{t(lang, item.exercise_detail?.name)}</strong>
                                        )}
                                        {item.exercise_detail?.youtube_url && (
                                          <a
                                            href={item.exercise_detail.youtube_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--brand)', display: 'flex', alignItems: 'center' }}
                                            title="Watch Video"
                                          >
                                            <Play size={16} fill="var(--brand)" />
                                          </a>
                                        )}
                                      </div>
                                      <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: '0.1rem 0' }}>
                                        {item.sets}x{item.reps} · {t(lang, item.exercise_detail?.category)}
                                      </p>
                                    </div>
                                    {item.personal_best && (
                                      <div style={{ fontSize: '0.65rem', color: 'var(--brand)', fontWeight: '900', background: 'rgba(34, 197, 94, 0.1)', padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--brand)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Trophy size={12} /> {item.personal_best}kg
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                                    <input
                                      placeholder="S"
                                      className="input-bubble"
                                      type="number"
                                      disabled={isLocked}
                                      onFocus={(e) => e.target.select()}
                                      value={logVal.sets ?? item.sets}
                                      onChange={(e) => handleChange(item.id || `extra-${idx}`, 'sets', e.target.value)}
                                      style={{ flex: 1, minHeight: '40px' }}
                                    />
                                    <input
                                      placeholder="R"
                                      className="input-bubble"
                                      type="number"
                                      disabled={isLocked || isTimeBased}
                                      onFocus={(e) => e.target.select()}
                                      value={isTimeBased ? "1" : (logVal.reps ?? item.reps)}
                                      onChange={(e) => handleChange(item.id || `extra-${idx}`, 'reps', e.target.value)}
                                      style={{ flex: 1, minHeight: '40px' }}
                                    />
                                    {isTimeBased ? (
                                      <input
                                        placeholder="MM:SS"
                                        className="input-bubble"
                                        disabled={isLocked}
                                        onFocus={(e) => e.target.select()}
                                        value={logVal.duration || ''}
                                        onChange={(e) => handleChange(item.id || `extra-${idx}`, 'duration', e.target.value)}
                                        style={{ flex: 1.5, minHeight: '40px' }}
                                      />
                                    ) : (
                                      <div style={{ flex: 2, position: 'relative' }}>
                                        <input
                                          placeholder={isCalisthenics ? "+kg" : "kg"}
                                          className="input-bubble"
                                          type="number"
                                          disabled={isLocked}
                                          onFocus={(e) => e.target.select()}
                                          value={logVal.weight_kg || ''}
                                          onChange={(e) => handleChange(item.id || `extra-${idx}`, 'weight_kg', e.target.value)}
                                          style={{ width: '100%', minHeight: '40px' }}
                                        />
                                        {isCalisthenics && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', opacity: 0.5, pointerEvents: 'none' }}>2kg base</span>}
                                      </div>
                                    )}
                                    {isTimeBased && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1.5, position: 'relative' }}>
                                        {activeTimer?.id === (item.id || `extra-${idx}`) ? (
                                          <InlineTimer
                                            initialSeconds={activeTimer.time}
                                            onFinish={(s) => handleTimerFinish(item.id || `extra-${idx}`, s)}
                                            onCancel={() => setActiveTimer(null)}
                                          />
                                        ) : (
                                          <button
                                            className="small-btn"
                                            disabled={isLocked}
                                            onClick={() => setActiveTimer({ id: item.id || `extra-${idx}`, time: 0 })}
                                            style={{ height: '40px', background: 'rgba(var(--brand-rgb), 0.1)', color: 'var(--brand)', border: '1px solid var(--brand)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                          >
                                            <Timer size={18} />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {editMode && isCurrentWeek && allCurrentExercises.length < 10 && (
                              <button 
                                className="dotted-btn"
                                onClick={() => {
                                  const firstEx = allExercises[0];
                                  setTodayOverrides(prev => ({
                                    ...prev,
                                    [goal.id]: [...(prev[goal.id] || []), { exercise_detail: firstEx, sets: 4, reps: 10, _isExtra: true }]
                                  }));
                                }}
                                style={{ 
                                  padding: '1rem', 
                                  border: '2px dashed var(--line)', 
                                  borderRadius: '16px', 
                                  background: 'transparent',
                                  color: 'var(--brand)',
                                  fontWeight: '800',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.5rem'
                                }}
                              >
                                <Plus size={18} /> Add Exercise
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="bubble-stack">
        {showScrollTop && (
          <button
            className="bubble-btn"
            onClick={scrollToTop}
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              color: 'var(--muted)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--line)',
              width: '44px',
              height: '44px'
            }}
            title="Back to Top"
          >
            <ChevronRight size={20} style={{ transform: 'rotate(-90deg)' }} />
          </button>
        )}
        <button
          className="bubble-btn"
          onClick={saveAll}
          disabled={saving}
          style={{ background: 'var(--brand)', color: '#052e16' }}
        >
          <Save size={24} />
        </button>
      </div>

      {saveMessage && (
        <div className="save-toast">
          <CheckCircle2 size={16} />
          <span>{saveMessage}</span>
        </div>
      )}
    </section>
  );
}

function InlineTimer({ initialSeconds, onFinish, onCancel }) {
  const [seconds, setSeconds] = useState(initialSeconds || 0);
  const [isActive, setIsActive] = useState(initialSeconds > 0);
  const [originalTime, setOriginalTime] = useState(initialSeconds || 0);

  useEffect(() => {
    let interval = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else if (isActive && seconds === 0) {
      onFinish(originalTime);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds, onFinish, originalTime]);

  const handleStop = () => {
    onFinish(originalTime - seconds);
  };

  const increments = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];

  return (
    <div className="glass-card" style={{ 
      position: 'absolute',
      top: '100%',
      right: 0,
      zIndex: 10,
      padding: '0.6rem', 
      border: '1px solid var(--brand)', 
      borderRadius: '12px', 
      background: 'var(--bg-soft)', 
      minWidth: '180px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      marginTop: '0.5rem'
    }}>
      {seconds === 0 && !isActive ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
          {increments.map(s => (
            <button key={s} onClick={() => { setSeconds(s); setOriginalTime(s); setIsActive(true); }} className="small-btn" style={{ fontSize: '0.7rem', padding: '4px' }}>{s}s</button>
          ))}
          <button onClick={onCancel} className="small-btn" style={{ gridColumn: 'span 4', color: 'var(--danger)', fontSize: '0.7rem' }}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: '900', fontFamily: 'monospace', color: 'var(--brand)' }}>
            {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
          </span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button onClick={() => setIsActive(!isActive)} className="small-btn" style={{ padding: '4px' }}>
              {isActive ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={handleStop} className="small-btn" style={{ padding: '4px', background: 'var(--danger)', color: 'white' }}>
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
