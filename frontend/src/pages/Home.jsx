import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, ChevronUp, ChevronDown, Save, Play, Square, Droplets, Timer, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { api } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import { t } from '../i18n.js';

function iso(date) { return date.toISOString().slice(0, 10); }

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
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [inlineLogs, setInlineLogs] = useState({});
  const [showBackToPresent, setShowBackToPresent] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  
  // Week Navigation State
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    return d;
  });

  // Workout State
  const [workoutActive, setWorkoutActive] = useState(localStorage.getItem('workout_active') === 'true');
  const [workoutStart, setWorkoutStart] = useState(localStorage.getItem('workout_start'));
  const [hydrationReminder, setHydrationReminder] = useState(null);

  const todayRef = useRef(null);

  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const start = new Date(currentWeekStart);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const res = await api(`/home/days/?start=${iso(start)}&end=${iso(end)}`);
      setDays(res);
      setInlineLogs(buildInitialLogs(res));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, [currentWeekStart]);

  useEffect(() => {
    if (!todayRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        // If today is visible, hide the button
        if (entry.isIntersecting) {
          setShowBackToPresent(false);
        } else {
          // If not visible, show button only if we've scrolled enough
          const scrollPos = window.scrollY || document.documentElement.scrollTop;
          if (scrollPos > 400) {
            setShowBackToPresent(true);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(todayRef.current);
    
    const handleScroll = () => {
      if (!todayRef.current) return;
      const rect = todayRef.current.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      
      if (isVisible) {
        setShowBackToPresent(false);
      } else {
        const scrollPos = window.scrollY || document.documentElement.scrollTop;
        if (scrollPos > 400) setShowBackToPresent(true);
        else setShowBackToPresent(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [loading, days]); // Re-run when days load to find todayRef

  useEffect(() => {
    if (!loading && days.some(d => d.is_today)) {
      setTimeout(() => {
        if (todayRef.current) {
          todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 600);
    }
  }, [loading]);

  // Hydration logic
  useEffect(() => {
    if (workoutActive && workoutStart) {
      const startTime = new Date(workoutStart).getTime();
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const diffMins = (now - startTime) / (1000 * 60);
        
        if (diffMins > 0 && diffMins <= 150 && Math.floor(diffMins) % 30 === 0) {
          setHydrationReminder('Time to hydrate! 💧');
          setTimeout(() => setHydrationReminder(null), 10000);
        }
        
        if (diffMins > 150) {
          stopWorkout();
        }
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [workoutActive, workoutStart]);

  useEffect(() => {
    if (completedCount > 0 && completedCount % 2 === 0) {
      setHydrationReminder('Excellent progress! Time for some water 💧');
      setTimeout(() => setHydrationReminder(null), 8000);
    }
  }, [completedCount]);

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
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + dir * 7);
    setCurrentWeekStart(d);
  };

  const scrollToToday = () => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const todayEl = document.querySelector('.day-card.today');
      if (todayEl) todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
    setInlineLogs((prev) => {
      const isNewLog = !prev[itemId]?.log_id && (field === 'weight_kg' || field === 'duration');
      if (isNewLog && value !== '') {
        setCompletedCount(c => c + 1);
      }
      return {
        ...prev,
        [itemId]: { ...prev[itemId], [field]: value },
      };
    });
  }

  async function saveAll() {
    setSaving(true);
    setSaveMessage('');
    try {
      const ops = [];
      days.forEach(day => {
        (day.goals || []).forEach((goal) => {
          (goal.goal_exercises || []).forEach((item) => {
            const logVal = inlineLogs[item.id];
            if (!logVal) return;
            const isTimeBased = item.exercise_detail?.is_time_based;
            const hasValue = isTimeBased
              ? (logVal.duration !== undefined && logVal.duration !== '')
              : (logVal.weight_kg !== undefined && logVal.weight_kg !== '');
            if (!hasValue) return;

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
      });

      if (ops.length === 0) {
        setSaveMessage('Nothing to save');
        return;
      }
      await Promise.all(ops);
      setSaveMessage(`Saved ✓`);
      loadInitial();
    } catch (err) {
      setSaveMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="loading-screen">
      <img src="/logo.png" className="loading-logo-spin" alt="" />
      <h2 style={{ letterSpacing: '2px', fontWeight: '900', color: 'var(--brand)' }}>LOADING FEED...</h2>
    </div>
  );

  return (
    <section className="stack" style={{ paddingBottom: '8rem' }}>
      {error && <p className="notice danger">{error}</p>}

      <div className="nav-arrows">
        <button className="arrow-btn" onClick={() => changeWeek(-1)}><ChevronLeft size={20} /></button>
        <span style={{ fontWeight: '900', fontSize: '0.9rem', color: 'var(--brand)', minWidth: '140px', textAlign: 'center' }}>
          {currentWeekStart.toLocaleDateString(lang, { month: 'short', day: 'numeric' }).toUpperCase()}
        </span>
        <button className="arrow-btn" onClick={() => changeWeek(1)}><ChevronRight size={20} /></button>
      </div>

      {hydrationReminder && (
        <div className="save-toast" style={{ background: 'var(--bg-soft)', color: '#60a5fa', borderColor: '#3b82f6', bottom: '160px' }}>
          <Droplets size={16} />
          <span>{hydrationReminder}</span>
        </div>
      )}

      <div className="days-feed">
        {days.map((day) => {
          const isCompleted = day.progress?.completed;
          const showStart = day.is_today && !isCompleted;

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
                  {showStart && (
                    <button 
                      onClick={workoutActive ? stopWorkout : startWorkout}
                      className={workoutActive ? 'small-btn danger' : 'small-btn primary'}
                      style={{ gap: '0.4rem', padding: '0.4rem 0.8rem', height: '34px', fontSize: '0.75rem', borderRadius: '999px' }}
                    >
                      {workoutActive ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                      {workoutActive ? 'End' : 'Start'}
                    </button>
                  )}
                  {isCompleted && <CheckCircle2 size={18} className="success" />}
                </div>
              </div>

              {day.goals.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: '1rem 0', fontSize: '0.85rem' }}>{t(lang, 'noGoals')}</p>
              ) : (
                <div className="goals-container" style={{ display: 'grid', gap: '1rem' }}>
                  {day.goals.map((goal) => (
                    <div key={goal.id}>
                      <div className="exercise-stack" style={{ display: 'grid', gap: '0.8rem' }}>
                        {goal.goal_exercises?.map((item) => {
                          const isTimeBased = item.exercise_detail?.is_time_based;
                          const logVal = inlineLogs[item.id] || {};
                          
                          return (
                            <div key={item.id} className="exercise-item-old">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <strong style={{ fontSize: '0.95rem' }}>{item.exercise_detail?.name}</strong>
                                    {isTimeBased && <Timer size={12} style={{ color: 'var(--brand)' }} />}
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
                                  value={logVal.sets ?? item.sets}
                                  onChange={(e) => handleChange(item.id, 'sets', e.target.value)}
                                  style={{ flex: 1, minHeight: '40px' }}
                                />
                                <input 
                                  placeholder="R"
                                  className="input-bubble"
                                  type="number"
                                  value={logVal.reps ?? item.reps}
                                  onChange={(e) => handleChange(item.id, 'reps', e.target.value)}
                                  style={{ flex: 1, minHeight: '40px' }}
                                />
                                {isTimeBased ? (
                                  <input 
                                    placeholder="MM:SS"
                                    className="input-bubble"
                                    value={logVal.duration || ''}
                                    onChange={(e) => handleChange(item.id, 'duration', e.target.value)}
                                    style={{ flex: 2, minHeight: '40px' }}
                                  />
                                ) : (
                                  <input 
                                    placeholder="kg"
                                    className="input-bubble"
                                    type="number"
                                    value={logVal.weight_kg || ''}
                                    onChange={(e) => handleChange(item.id, 'weight_kg', e.target.value)}
                                    style={{ flex: 2, minHeight: '40px' }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {showBackToPresent && (
        <button 
          className="arrow-btn" 
          onClick={scrollToToday}
          style={{ 
            position: 'fixed', 
            top: '5.5rem', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 1000, 
            width: '48px', 
            height: '48px', 
            background: 'var(--brand)', 
            color: '#052e16',
            boxShadow: '0 4px 20px rgba(var(--brand-rgb), 0.4)',
            borderRadius: '24px',
            transition: 'all 0.3s'
          }}
        >
          <ChevronUp size={24} />
        </button>
      )}

      <div className="bubble-stack">
        <button 
          className="fab-save" 
          onClick={saveAll} 
          disabled={saving}
          style={{ position: 'static', width: '64px', height: '64px' }}
        >
          <Save size={32} />
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
