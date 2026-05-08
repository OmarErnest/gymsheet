import { useEffect, useState, useRef, useMemo, Fragment } from 'react';
import { Save, Plus, Trash2, CheckCircle2, ChevronRight, ChevronLeft, Trophy, Medal, Play, Timer, Pause, RotateCcw, Droplets, Square, Settings, Table, LayoutGrid, CalendarDays, RefreshCw, Activity, Dumbbell } from 'lucide-react';
import { api, iso } from '../api/client.js';
import Skeleton from '../components/Skeleton.jsx';
import { t } from '../i18n.js';
import { useAuth } from '../state/AuthContext.jsx';




/** Build initial inlineLogs and infer replacements from already-saved ExerciseLogs for the day */
function buildInitialLogs(daysData) {
  const logs = {};
  const newOverrides = {};

  daysData.forEach((day) => {
    const logsByPlan = {};
    const unassignedLogs = [];
    const dayUsedLogIds = new Set();

    (day.logs || []).forEach((log) => {
      if (log.source_goal_plan) {
        if (!logsByPlan[log.source_goal_plan]) logsByPlan[log.source_goal_plan] = [];
        logsByPlan[log.source_goal_plan].push(log);
      } else {
        unassignedLogs.push(log);
      }
    });

    (day.goals || []).forEach((goal) => {
      // We combine logs explicitly tied to this plan with logs that have no plan (legacy or manual)
      const planLogs = [...(logsByPlan[goal.id] || []), ...unassignedLogs];

      // Pass 1: Exact matches by Exercise ID
      (goal.goal_exercises || []).forEach((item) => {
        const exId = String(item.exercise_detail?.id);
        const exactLog = planLogs.find(l => !dayUsedLogIds.has(l.id) && String(l.exercise) === exId);
        
        if (exactLog) {
          dayUsedLogIds.add(exactLog.id);
          logs[item.id] = {
            sets: String(exactLog.sets),
            reps: String(exactLog.reps),
            weight_kg: exactLog.weight_kg !== null && exactLog.weight_kg !== undefined ? String(exactLog.weight_kg) : '',
            duration: exactLog.duration || '',
            log_id: exactLog.id,
          };
        }
      });

      // Pass 2: Unmatched logs map to unlogged exercises (infer replacements)
      (goal.goal_exercises || []).forEach((item) => {
        if (!logs[item.id]) {
          const replacementLog = planLogs.find(l => !dayUsedLogIds.has(l.id));
          if (replacementLog) {
            dayUsedLogIds.add(replacementLog.id);
            const tempId = `temp-override-${replacementLog.id}`;
            if (!newOverrides[goal.id]) newOverrides[goal.id] = [];
            
            newOverrides[goal.id].push({
              ...item,
              id: tempId,
              exercise_detail: replacementLog.exercise_detail,
              _replacedId: item.id,
              _isExtra: false
            });
            
            logs[tempId] = {
              sets: String(replacementLog.sets),
              reps: String(replacementLog.reps),
              weight_kg: replacementLog.weight_kg !== null && replacementLog.weight_kg !== undefined ? String(replacementLog.weight_kg) : '',
              duration: replacementLog.duration || '',
              log_id: replacementLog.id,
            };
          }
        }
      });

      // Pass 3: Any remaining unused logs tied to THIS plan are Extra Exercises!
      // (Note: we don't automatically add all unassignedLogs as extras here to avoid duplication across goals)
      const specificPlanLogs = logsByPlan[goal.id] || [];
      specificPlanLogs.forEach((log) => {
        if (!dayUsedLogIds.has(log.id)) {
          dayUsedLogIds.add(log.id);
          const tempId = `temp-extra-${log.id}`;
          if (!newOverrides[goal.id]) newOverrides[goal.id] = [];
          
          newOverrides[goal.id].push({
            id: tempId,
            exercise_detail: log.exercise_detail,
            sets: log.sets,
            reps: log.reps,
            _isExtra: true
          });
          
          logs[tempId] = {
            sets: String(log.sets),
            reps: String(log.reps),
            weight_kg: log.weight_kg !== null && log.weight_kg !== undefined ? String(log.weight_kg) : '',
            duration: log.duration || '',
            log_id: log.id,
          };
        }
      });
    });

    // Pass 4: Any remaining unassigned logs that didn't match ANY goal for the day
    // We'll attach them to the first goal or create a dummy container if needed
    if (unassignedLogs.length > 0) {
      unassignedLogs.forEach(log => {
        if (!dayUsedLogIds.has(log.id)) {
          dayUsedLogIds.add(log.id);
          const goalId = day.goals?.[0]?.id || 'manual-logs';
          const tempId = `temp-extra-${log.id}`;
          if (!newOverrides[goalId]) newOverrides[goalId] = [];
          
          newOverrides[goalId].push({
            id: tempId,
            exercise_detail: log.exercise_detail,
            sets: log.sets,
            reps: log.reps,
            _isExtra: true
          });
          
          logs[tempId] = {
            sets: String(log.sets),
            reps: String(log.reps),
            weight_kg: log.weight_kg !== null && log.weight_kg !== undefined ? String(log.weight_kg) : '',
            duration: log.duration || '',
            log_id: log.id,
          };
        }
      });
    }
  });
  
  return { logs, newOverrides };
}

export default function Home({ lang }) {
  const { user } = useAuth();
  const isDummy = user?.email === 'dummy@gym.sheet';
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
  const [toDelete, setToDelete] = useState([]); // Array of log_ids or item.ids to delete from the session
  const [firstLoad, setFirstLoad] = useState(true);
  const [viewMode, setViewMode] = useState('feed'); // 'feed' or 'spreadsheet'

  const [relativeWeek, setRelativeWeek] = useState(0);
  const [pushMenuDay, setPushMenuDay] = useState(null); // dayIdx of active push menu

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
      const { logs, newOverrides } = buildInitialLogs(res);
      setInlineLogs(logs);
      setTodayOverrides(newOverrides);
      
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

  const fetchExercises = () => {
    api('/exercises/?page_size=1000').then(res => {
      const data = res.results || res;
      setAllExercises([...data].sort((a, b) => t(lang, a.name).localeCompare(t(lang, b.name))));
    }).catch(() => {});
  };

  useEffect(() => {
    fetchExercises();
  }, [lang]);

  useEffect(() => {
    const handleTab = (e) => {
      if (e.detail === 'home') {
        setRelativeWeek(0);
        setShouldScrollToToday(true);
        fetchExercises(); // Refetch to catch any new custom exercises
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
      let digits = raw.replace(/[^0-9]/g, '');
      if (digits.length > 0) {
        digits = parseInt(digits, 10).toString();
        if (digits === 'NaN' || digits === '0') digits = '';
      }
      if (digits.length > 0) {
        const padded = digits.padStart(4, '0').slice(-4);
        value = `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
      } else {
        value = '';
      }
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
    if (saving) return;
    if (isDummy) {
      setSaveMessage(lang === 'es' ? 'Acción restringida para cuenta demo' : 'Action restricted for demo account');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }
    setSaving(true);
    setSaveMessage('');
    let sessionLogsCount = 0;
    
    try {
      const creates = [];
      const updates = [];
      const deletes = [];
      
      for (const day of days) {
        for (const goal of day.goals || []) {
          const overrides = todayOverrides[goal.id] || [];
          const allCurrent = [...(goal.goal_exercises || []), ...overrides];
          
          for (const item of allCurrent) {
            const isReplaced = !item._isExtra && overrides.some(o => o._replacedId === item.id);
            const oldLogVal = inlineLogs[item.id];
            
            // If item was replaced, we delete its old log if it existed.
            if (isReplaced) {
              if (oldLogVal?.log_id && !deletes.includes(oldLogVal.log_id)) {
                deletes.push(oldLogVal.log_id);
              }
              continue;
            }

            // If item was marked for deletion by user
            if (toDelete.includes(item.id) || (oldLogVal?.log_id && toDelete.includes(oldLogVal.log_id))) {
               if (oldLogVal?.log_id && !deletes.includes(oldLogVal.log_id)) {
                 deletes.push(oldLogVal.log_id);
               }
               continue;
            }

            const logVal = inlineLogs[item.id || `extra-${allCurrent.indexOf(item)}` ];
            if (!logVal && !item._isExtra) continue;
            
            const isTimeBased = item.exercise_detail?.is_time_based;
            const hasValue = isTimeBased
              ? (logVal?.duration !== undefined && logVal?.duration !== '')
              : (logVal?.weight_kg !== undefined && logVal?.weight_kg !== '');

            if (!hasValue && !item._isExtra) {
              if (logVal?.log_id && !deletes.includes(logVal.log_id)) {
                deletes.push(logVal.log_id);
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
              is_pr_set: logVal?.is_pr_set ?? item.is_pr_set,
              source_goal_plan: goal.id || null, 
            };

            if (logVal?.log_id) {
              updates.push({ ...payload, id: logVal.log_id });
            } else if (hasValue || item._isExtra) {
              creates.push(payload);
              if (day.is_today) sessionLogsCount++;
            }
          }
        }
      }

      if (creates.length === 0 && updates.length === 0 && deletes.length === 0) {
        setSaveMessage('Nothing to save');
        setSaving(false);
        setTimeout(() => setSaveMessage(''), 3000);
        return;
      }
      
      await api('/exercise-logs/bulk_save/', {
        method: 'POST',
        body: JSON.stringify({ creates, updates, deletes })
      });
      
      setSaveMessage(`Saved ✓`);
      setToDelete([]);
      setTimeout(() => setSaveMessage(''), 3000);

      const updatedDays = await loadInitial();
      
      // Check if today has > 6 exercises to trigger rest reminder
      const todayDay = updatedDays?.find(d => d.is_today);
      if (todayDay) {
        const todayLogsCount = todayDay.logs?.length || 0;
        if (todayLogsCount > 6) {
          window.dispatchEvent(new CustomEvent('trigger-rest'));
        }
      }

      const allLogsRes = await api('/exercise-logs/');
      const totalGlobalLogs = allLogsRes.count || allLogsRes.length || 0;
      
      if (totalGlobalLogs > 0 && totalGlobalLogs % 3 === 0) {
        window.dispatchEvent(new CustomEvent('trigger-hydration'));
      }
    } catch (err) {
      setSaveMessage(err.message);
      setTimeout(() => setSaveMessage(''), 5000);
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
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ 
              fontSize: '0.9rem', 
              fontWeight: '1000', 
              color: 'var(--brand)',
              minWidth: '35px',
              textAlign: 'right'
            }}>
              {relativeWeek > 0 ? `+${relativeWeek}` : relativeWeek}
            </span>
            <button 
              onClick={() => {
                if (relativeWeek !== 0) {
                  setRelativeWeek(0);
                  setShouldScrollToToday(true);
                } else {
                  todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }} 
              style={{ 
                background: relativeWeek === 0 ? 'rgba(var(--brand-rgb), 0.05)' : 'rgba(var(--brand-rgb), 0.1)', 
                border: relativeWeek === 0 ? '1px solid var(--line)' : '1px solid rgba(var(--brand-rgb), 0.3)', 
                color: 'var(--brand)', 
                cursor: 'pointer', 
                padding: '8px 12px', 
                borderRadius: '999px', 
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: relativeWeek === 0 ? 0.7 : 1
              }}
              title={relativeWeek === 0 ? "Scroll to Today" : "Back to Present"}
            >
              <CalendarDays size={18} strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => setViewMode(prev => prev === 'feed' ? 'spreadsheet' : 'feed')} 
              style={{ 
                background: 'rgba(var(--brand-rgb), 0.1)', 
                border: '1px solid rgba(var(--brand-rgb), 0.3)', 
                color: 'var(--brand)', 
                fontSize: '0.65rem', 
                fontWeight: '1000', 
                cursor: 'pointer', 
                padding: '8px 14px', 
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
        <div className="glass-card spreadsheet-container" style={{ maxWidth: '100%' }}>
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th className="spreadsheet-th">Day</th>
                <th className="spreadsheet-th">Exercise</th>
                <th className="spreadsheet-th" style={{ textAlign: 'center' }}>Sets x Reps</th>
                <th className="spreadsheet-th" style={{ textAlign: 'right' }}>Weight / Time</th>
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const allExercises = day.goals?.flatMap(g => g.goal_exercises || []) || [];
                const rowCount = Math.max(allExercises.length, 1);
                
                const dayCell = (
                  <td rowSpan={rowCount} className="day-cell" style={{ 
                    background: day.is_today ? 'rgba(var(--brand-rgb), 0.05)' : 'transparent'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="day-label-main" style={{ color: day.is_today ? 'var(--brand)' : 'var(--text)' }}>
                        {day.label.split(',')[0]}
                      </span>
                      <span className="day-label-sub">
                        {day.label.split(',')[1]}
                      </span>
                    </div>
                  </td>
                );

                if (allExercises.length === 0) {
                  return (
                    <tr key={day.date} style={{ background: day.is_today ? 'rgba(var(--brand-rgb), 0.08)' : 'transparent' }}>
                      {dayCell}
                      <td colSpan={3} className="spreadsheet-td" style={{ textAlign: 'center', color: 'var(--brand)', opacity: 0.2 }}>
                        —
                      </td>
                    </tr>
                  );
                }

                return (
                  <Fragment key={day.date}>
                    {allExercises.map((item, idx) => {
                      const logVal = inlineLogs[item.id] || {};
                      const isDone = !!logVal.log_id;
                      const nextItem = allExercises[idx + 1];
                      const prevItem = allExercises[idx - 1];
                      const nextLog = nextItem ? (inlineLogs[nextItem.id] || {}) : {};
                      const prevLog = prevItem ? (inlineLogs[prevItem.id] || {}) : {};
                      
                      const currentSid = logVal.superset_id ?? item.superset_id;
                      const nextSid = nextLog.superset_id ?? nextItem?.superset_id;
                      const prevSid = prevLog.superset_id ?? prevItem?.superset_id;

                      const isSupersetWithNext = currentSid && nextSid && currentSid === nextSid;
                      const isSupersetWithPrev = currentSid && prevSid && currentSid === prevSid;
                      const isPR = logVal.is_pr_set ?? item.is_pr_set;
                      const isTimeBased = item.exercise_detail?.is_time_based;
                      
                      return (
                        <tr 
                          key={item.id} 
                          className={`spreadsheet-row ${isDone ? 'done' : ''} ${day.is_today ? 'today' : ''}`}
                          style={{ 
                            borderBottom: isSupersetWithNext ? 'none' : '1px solid rgba(255,255,255,0.05)',
                            background: (isSupersetWithNext || isSupersetWithPrev) ? 'rgba(var(--brand-rgb), 0.01)' : 'transparent'
                          }}
                        >
                          {idx === 0 && dayCell}
                          <td className="spreadsheet-td exercise-name-cell" style={{ 
                            color: isDone ? 'var(--brand)' : 'var(--text)',
                            borderLeft: (isSupersetWithNext || isSupersetWithPrev) ? '2px solid var(--brand)' : 'none',
                            paddingLeft: (isSupersetWithNext || isSupersetWithPrev) ? '1.5rem' : '1rem'
                          }}>
                            <div className="flex-center-gap">
                              {item.exercise_detail?.exercise_type === 'calisthenics' ? <Activity size={16} /> : 
                               item.exercise_detail?.exercise_type === 'pr' ? <Trophy size={16} /> :
                               <Dumbbell size={16} />}
                              {t(lang, item.exercise_detail?.name)}
                              {isPR && <span style={{ fontSize: '0.6rem', color: 'var(--brand)', border: '1px solid var(--brand)', padding: '0 4px', borderRadius: '4px', marginLeft: '0.3rem' }}>PR</span>}
                            </div>
                          </td>
                          <td className="spreadsheet-td" style={{ textAlign: 'center' }}>
                            <span className={`sets-reps-pill ${isDone ? 'done' : ''}`}>
                              {logVal.sets ?? item.sets}x{String(logVal.reps ?? item.reps).padStart(2, '0')}
                            </span>
                          </td>
                          <td className="spreadsheet-td weight-time-cell">
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
          ) : days.map((day, dayIdx) => {
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
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {isCurrentWeek && (
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setPushMenuDay(pushMenuDay === dayIdx ? null : dayIdx)}
                              className="small-btn"
                              title="Shift goals"
                              style={{ padding: '0.5rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <CalendarDays size={16} />
                              <span style={{ fontSize: '0.6rem', fontWeight: '900' }}>PUSH</span>
                            </button>

                            {pushMenuDay === dayIdx && (
                              <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setPushMenuDay(null)} />
                                <div className="glass-card" style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  zIndex: 101,
                                  marginTop: '0.4rem',
                                  padding: '0.3rem',
                                  display: 'flex',
                                  gap: '0.3rem',
                                  background: 'var(--bg-strong)',
                                  border: '1px solid var(--line)',
                                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                  borderRadius: '12px'
                                }}>
                                  <button
                                    className="small-btn"
                                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', fontWeight: '900', color: '#10b981' }}
                                    onClick={async () => {
                                      try {
                                        await api('/weekly-shift/', { method: 'POST', body: JSON.stringify({ today: day.date, day_index: dayIdx, direction: 1 }) });
                                        setPushMenuDay(null);
                                        loadInitial();
                                      } catch (err) { setError(err.message); }
                                    }}
                                  >+1</button>
                                  <button
                                    className="small-btn"
                                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', fontWeight: '900', color: '#ef4444' }}
                                    onClick={async () => {
                                      try {
                                        await api('/weekly-shift/', { method: 'POST', body: JSON.stringify({ today: day.date, day_index: dayIdx, direction: -1 }) });
                                        setPushMenuDay(null);
                                        loadInitial();
                                      } catch (err) { setError(err.message); }
                                    }}
                                  >-1</button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
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
                      </div>
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

                              const logKey = item.id || `extra-${idx}`;
                              const logVal = inlineLogs[logKey] || {};
                              
                              // If marked for deletion, hide it
                              if (toDelete.includes(item.id) || (logVal?.log_id && toDelete.includes(logVal.log_id))) return null;
                              const isExtra = !!item._isExtra;
                              const isTimeBased = item.exercise_detail?.is_time_based;
                              const isCalisthenics = item.exercise_detail?.exercise_type === 'calisthenics';
                              
                              const currentSid = logVal.superset_id ?? item.superset_id;
                              const nextItem = allCurrentExercises[idx + 1];
                              const nextLog = nextItem ? (inlineLogs[nextItem.id || `extra-${idx+1}`] || {}) : {};
                              const nextSid = nextItem ? (nextLog.superset_id ?? nextItem.superset_id) : null;
                              const isSupersetWithNext = currentSid && nextSid && currentSid === nextSid;
                              const isPR = logVal.is_pr_set ?? item.is_pr_set;

                              return (
                                <div key={item.id || `extra-${idx}`} style={{ position: 'relative' }}>
                                  <div className="exercise-item-old" style={{ 
                                    marginBottom: isSupersetWithNext ? '-0.8rem' : '0',
                                    paddingBottom: isSupersetWithNext ? '1.2rem' : '1rem',
                                    borderBottom: isSupersetWithNext ? 'none' : '1px solid var(--line)',
                                    borderRadius: isSupersetWithNext ? '16px 16px 0 0' : '16px',
                                    position: 'relative',
                                    zIndex: 2,
                                    background: 'rgba(255,255,255,0.02)', width: '100%'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                          {editMode && isCurrentWeek ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                                              <select 
                                                style={{ flex: 1, background: 'none', border: '1px solid var(--line)', color: 'var(--brand)', fontWeight: '900', fontSize: '0.9rem', padding: '2px 4px', borderRadius: '4px' }}
                                                value={item.exercise_detail?.id}
                                                onChange={(e) => {
                                                  const newEx = allExercises.find(ex => String(ex.id) === e.target.value);
                                                  const updateFn = (it) => ({ ...it, exercise_detail: newEx });
                                                  if (isExtra) {
                                                    setTodayOverrides(prev => ({ ...prev, [goal.id]: prev[goal.id].map((it, i) => i === (idx - (goal.goal_exercises?.length || 0)) ? updateFn(it) : it) }));
                                                  } else {
                                                    const tempId = `temp-override-${Date.now()}`;
                                                    setTodayOverrides(prev => ({ ...prev, [goal.id]: [...(prev[goal.id] || []), { ...item, id: tempId, _replacedId: item.id, exercise_detail: newEx }] }));
                                                  }
                                                }}
                                              >
                                                {allExercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                                              </select>

                                              <button 
                                                type="button"
                                                className={`small-btn ${isPR ? 'active' : ''}`}
                                                style={{ 
                                                  padding: '0.2rem 0.4rem', 
                                                  borderRadius: '6px', 
                                                  fontSize: '0.6rem', 
                                                  fontWeight: '900', 
                                                  background: isPR ? 'rgba(var(--brand-rgb), 0.2)' : 'rgba(255,255,255,0.05)', 
                                                  color: isPR ? 'var(--brand)' : 'var(--text)' 
                                                }}
                                                onClick={() => {
                                                  const nextPR = !isPR;
                                                  handleChange(logKey, 'is_pr_set', nextPR);
                                                  if (nextPR) {
                                                    handleChange(logKey, 'sets', '1');
                                                    handleChange(logKey, 'reps', '1');
                                                  }
                                                }}
                                              >PR</button>

                                              {idx < allCurrentExercises.length - 1 && (
                                                <button 
                                                  disabled
                                                  className="small-btn"
                                                  style={{ padding: '0.2rem 0.4rem', borderRadius: '6px', opacity: 0.3, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                                                >
                                                  <RefreshCw size={12} />
                                                </button>
                                              )}

                                              <button 
                                                onClick={() => {
                                                  if (window.confirm("Delete for today?")) {
                                                    setToDelete(prev => [...prev, item.id]);
                                                  }
                                                }}
                                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                                              >
                                                <Trash2 size={16} />
                                              </button>
                                            </div>
                                          ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              {isPR ? <Medal size={16} style={{ color: 'var(--brand)' }} /> : isCalisthenics ? <Activity size={16} style={{ color: 'var(--brand)' }} /> : <Dumbbell size={16} style={{ color: 'var(--brand)' }} />}
                                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                {t(lang, item.exercise_detail?.name)}
                                                {isPR && <span style={{ fontSize: '0.6rem', background: 'rgba(var(--brand-rgb), 0.2)', color: 'var(--brand)', padding: '2px 6px', borderRadius: '4px' }}>PR</span>}
                                              </h4>
                                              {item.personal_best && (
                                                <div style={{ fontSize: '0.65rem', color: 'var(--brand)', fontWeight: '900', background: 'rgba(34, 197, 94, 0.1)', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--brand)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                                  <Medal size={10} /> {item.personal_best}kg
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {!editMode && (
                                          <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: '0.1rem 0' }}>
                                            {t(lang, item.exercise_detail?.category)}
                                          </p>
                                        )}
                                      </div>
                                      {item.exercise_detail?.youtube_url && !editMode && (
                                        <a href={item.exercise_detail.youtube_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', display: 'flex', alignItems: 'center' }}>
                                          <Play size={16} fill="var(--brand)" />
                                        </a>
                                      )}
                                    </div>


                                    <div style={{ display: 'flex', gap: '0.6rem', width: '100%', flexWrap: 'wrap' }}>
                                      <input
                                        placeholder="S"
                                        className="input-bubble"
                                        type="number"
                                        disabled={isLocked}
                                        onFocus={(e) => e.target.select()}
                                        value={logVal.sets ?? item.sets}
                                        onChange={(e) => {
                                          let val = e.target.value;
                                          if (isPR && val !== '') {
                                            val = Math.min(2, Math.max(1, parseInt(val) || 1));
                                          }
                                          handleChange(item.id || `extra-${idx}`, 'sets', val);
                                        }}
                                        style={{ flex: 1, minHeight: '40px', textAlign: 'center' }}
                                        max={isPR ? 2 : 8}
                                      />
                                      <input
                                        placeholder="R"
                                        className="input-bubble"
                                        type="number"
                                        disabled={isLocked || isTimeBased}
                                        onFocus={(e) => e.target.select()}
                                        value={isTimeBased ? "1" : (logVal.reps ?? item.reps)}
                                        onChange={(e) => {
                                          let val = e.target.value;
                                          if (isPR && val !== '') {
                                            val = Math.min(2, Math.max(1, parseInt(val) || 1));
                                          }
                                          handleChange(item.id || `extra-${idx}`, 'reps', val);
                                        }}
                                        style={{ flex: 1, minHeight: '40px', textAlign: 'center' }}
                                        max={isPR ? 2 : 99}
                                      />
                                      {isTimeBased ? (
                                        <div style={{ flex: '1 1 100%', position: 'relative' }}>
                                          {activeTimer?.id === (item.id || `extra-${idx}`) ? (
                                            <InlineTimer
                                              initialSeconds={activeTimer.time}
                                              onFinish={(s) => handleTimerFinish(item.id || `extra-${idx}`, s)}
                                              onCancel={() => setActiveTimer(null)}
                                            />
                                          ) : (
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                              <input
                                                placeholder="MM:SS"
                                                className="input-bubble"
                                                disabled={isLocked}
                                                onFocus={(e) => e.target.select()}
                                                value={logVal.duration || ''}
                                                onChange={(e) => handleChange(item.id || `extra-${idx}`, 'duration', e.target.value)}
                                                style={{ flex: 1, minHeight: '40px' }}
                                              />
                                              <button
                                                className="small-btn"
                                                disabled={isLocked}
                                                onClick={() => setActiveTimer({ id: item.id || `extra-${idx}`, time: 0 })}
                                                style={{ height: '40px', background: 'rgba(var(--brand-rgb), 0.1)', color: 'var(--brand)', border: '1px solid var(--brand)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 10px' }}
                                              >
                                                <Timer size={18} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div style={{ flex: '1 1 100%', position: 'relative', minWidth: 0 }}>
                                          <input
                                            placeholder="kg"
                                            className="input-bubble"
                                            type="number"
                                            disabled={isLocked}
                                            onFocus={(e) => e.target.select()}
                                            value={logVal.weight_kg ?? ''}
                                            onChange={(e) => handleChange(item.id || `extra-${idx}`, 'weight_kg', e.target.value)}
                                            style={{ width: '100%', minHeight: '40px' }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {isSupersetWithNext && (
                                    <div style={{ position: 'absolute', left: '0.8rem', top: '50%', bottom: '-0.8rem', width: '2px', background: 'var(--brand)', zIndex: 1, opacity: 0.5 }} />
                                  )}
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
                                    [goal.id]: [...(prev[goal.id] || []), { id: `temp-new-extra-${Date.now()}`, exercise_detail: firstEx, sets: 4, reps: 10, _isExtra: true }]
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
              background: 'var(--bg-card)', 
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
          style={{ 
            background: 'var(--brand)', 
            color: '#052e16',
            boxShadow: saving ? '0 0 20px var(--brand)' : 'none'
          }}
        >
          {saving ? <RefreshCw size={24} className="spin" /> : <Save size={24} />}
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
