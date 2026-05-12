import { useEffect, useState, useRef, useMemo, Fragment } from 'react';
import { Save, Plus, Trash2, CheckCircle2, ChevronRight, ChevronLeft, Trophy, Medal, Play, Timer, Pause, RotateCcw, Droplets, Square, Settings, Table, LayoutGrid, CalendarDays, RefreshCw, Activity, Dumbbell, X } from 'lucide-react';
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
            isHidden: Number(exactLog.sets) === 0
          };
        } else {
          // No direct log for this plan exercise
          logs[item.id] = { isHidden: false };
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
            isHidden: Number(log.sets) === 0
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
            isHidden: Number(log.sets) === 0
          };
        }
      });
    }
  });
  
  return { logs, newOverrides };
}

const WEEKS = [1, 0, -1, -2, -3, -4, -5, -6];

export default function Home({ lang }) {
  const { user } = useAuth();
  const isDummy = user?.email === 'dummy@gym.sheet';
  const [weeksData, setWeeksData] = useState({}); // { [rel]: days[] }
  const [loadingWeeks, setLoadingWeeks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null); // { id: exerciseId, time: seconds }
  
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [completedCount, setCompletedCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  
  const groupedExercises = useMemo(() => {
    const groups = {};
    allExercises.forEach(ex => {
      const cat = ex.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ex);
    });
    // Order categories: chest, back, legs, shoulder, arms, other
    const order = ['chest', 'back', 'legs', 'shoulder', 'arms', 'other'];
    const sortedGroups = {};
    order.forEach(cat => {
      if (groups[cat]) sortedGroups[cat] = groups[cat];
    });
    // Add any categories not in the predefined order
    Object.keys(groups).forEach(cat => {
      if (!sortedGroups[cat]) sortedGroups[cat] = groups[cat];
    });
    return sortedGroups;
  }, [allExercises]);
  
  const [todayOverrides, setTodayOverrides] = useState({}); // { goalId: [ { exercise_detail, sets, reps, is_time_based } ] }
  const [inlineLogs, setInlineLogs] = useState({});
  const [toDelete, setToDelete] = useState([]); // Array of log_ids or item.ids to delete from the session
  const [firstLoad, setFirstLoad] = useState(true);
  const [viewMode, setViewMode] = useState('feed'); // 'feed' or 'spreadsheet'

  const [relativeWeek, setRelativeWeek] = useState(0);
  const days = weeksData[relativeWeek] || [];
  const [pushMenuDay, setPushMenuDay] = useState(null); // dayIdx of active push menu
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapDate, setSwapDate] = useState(null);

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
  const [selectingExerciseForGoal, setSelectingExerciseForGoal] = useState(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showRecordModal, setShowRecordModal] = useState(false);

  async function fetchWeek(rel, force = false) {
    if (weeksData[rel] && !firstLoad && !force) return;
    
    setLoadingWeeks(prev => ({ ...prev, [rel]: true }));
    try {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() + rel * 7);
      
      const start = new Date(monday);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const todayStr = iso(new Date());
      const res = await api(`/home/days/?start=${iso(start)}&end=${iso(end)}&today=${todayStr}`);
      
      setWeeksData(prev => ({ ...prev, [rel]: res }));
      const { logs, newOverrides } = buildInitialLogs(res);
      setInlineLogs(prev => ({ ...prev, ...logs }));
      setTodayOverrides(prev => ({ ...prev, ...newOverrides }));
      
      if (rel === 0) {
        const isPresentWeek = res.some(d => d.is_today);
        setShowBackToPresent(!isPresentWeek);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingWeeks(prev => ({ ...prev, [rel]: false }));
      if (firstLoad) {
        setLoading(false);
        setFirstLoad(false);
      }
    }
  }


  useEffect(() => {
    fetchWeek(relativeWeek);
  }, [relativeWeek]);

  useEffect(() => {
    const handleBack = () => {
      if (showRecordModal) setShowRecordModal(false);
      else if (editMode) setEditMode(false);
      else if (selectingExerciseForGoal) setSelectingExerciseForGoal(null);
    };
    window.addEventListener('app-back-button', handleBack);
    return () => window.removeEventListener('app-back-button', handleBack);
  }, [showRecordModal, editMode, selectingExerciseForGoal]);

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

  const changeWeek = (targetRel) => {
    if (targetRel >= -6 && targetRel <= 1) {
      setRelativeWeek(targetRel);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
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

  async function handleDaySwap(date) {
    if (!swapDate) {
      setSwapDate(date);
      return;
    }
    if (swapDate === date) {
      setSwapDate(null);
      return;
    }
    
    setSaving(true);
    try {
      await api('/swap-days/', {
        method: 'POST',
        body: JSON.stringify({ date1: swapDate, date2: date })
      });
      setSwapDate(null);
      setIsSwapMode(false);
      await fetchWeek(relativeWeek);
      setSaveMessage(lang === 'es' ? 'Días intercambiados!' : 'Days swapped!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Swap failed');
    } finally {
      setSaving(false);
    }
  }


  const handleChange = (id, field, val) => {
    if (relativeWeek !== 0) {
      setSaveMessage(t(lang, 'notCurrentWeek'));
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }
    let value = val;
    if (field === 'sets' || field === 'reps') {
      value = val.replace(/[^0-9]/g, '');
    } else if (field === 'weight_kg') {
      value = val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    } else if (field === 'duration') {
      let digits = val.replace(/[^0-9]/g, '');
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
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleTimerFinish = (id, seconds) => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    handleChange(id, 'duration', `${mm}:${ss}`);
    setActiveTimer(null);
  };

  const handleDelete = (id, isGoal) => {
    if (!window.confirm(lang === 'es' ? '¿Borrar este ejercicio hoy?' : 'Delete this exercise for today?')) return;
    setToDelete(prev => [...prev, id]);
    if (!isGoal) {
      setTodayOverrides(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(gid => {
          next[gid] = (next[gid] || []).filter(ex => ex.id !== id);
        });
        return next;
      });
    }
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
            const logKey = item.id;
            const logVal = inlineLogs[logKey];
            
            // 1. Handle Deletions
            const isMarkedDelete = toDelete.some(td => String(td) === String(item.id)) || (logVal?.log_id && toDelete.some(td => String(td) === String(logVal.log_id)));

            if (isMarkedDelete) {
               if (item._isExtra) {
                 // Extra exercise: hard delete from server
                 if (logVal?.log_id && !deletes.includes(logVal.log_id)) {
                   deletes.push(logVal.log_id);
                 }
               } else {
                 // Planned exercise: soft delete for this day by saving sets=0
                 const payload = {
                   exercise: item.exercise_detail.id,
                   date: day.date,
                   sets: 0,
                   reps: 0,
                   weight_kg: 0,
                   duration: '',
                   source_goal_plan: goal.id,
                 };
                 if (logVal?.log_id) {
                   updates.push({ ...payload, id: logVal.log_id });
                 } else {
                   creates.push(payload);
                 }
               }
               continue;
            }

            // 2. Filter out non-changes for planned exercises
            // BUT: ALWAYS keep extra exercises so they persist even if user didn't type anything yet
            if (!logVal && !item._isExtra) continue;
            
            const isTimeBased = item.exercise_detail?.is_time_based;
            const hasValue = isTimeBased
              ? (logVal?.duration !== undefined && logVal?.duration !== '')
              : (logVal?.weight_kg !== undefined && logVal?.weight_kg !== '');

            // Skip planned exercises with no input
            if (!hasValue && !item._isExtra) {
              continue;
            }

            // 3. Build Payload
            const cleanWeight = String(logVal?.weight_kg || item.weight_kg || '').replace(/\.$/, '') || '0';
            const payload = {
              exercise: item.exercise_detail.id,
              date: day.date,
              sets: logVal?.sets !== undefined && logVal?.sets !== '' ? Number(logVal.sets) : (item.sets || 4),
              reps: isTimeBased ? 1 : (logVal?.reps !== undefined && logVal?.reps !== '' ? Number(logVal.reps) : (item.reps || 10)),
              weight_kg: isTimeBased ? 0 : cleanWeight,
              duration: isTimeBased ? (logVal?.duration || '') : '',
              is_pr_set: logVal?.is_pr_set ?? item.is_pr_set ?? false,
              source_goal_plan: goal.id || null, 
            };

            if (logVal?.log_id) {
              updates.push({ ...payload, id: logVal.log_id });
            } else {
              // Always create extras, or planned ones if they have value
              if (item._isExtra || hasValue) {
                creates.push(payload);
                if (day.is_today) sessionLogsCount++;
              }
            }
          }
        }
      }

      if (creates.length === 0 && updates.length === 0 && deletes.length === 0) {
        setSaveMessage(lang === 'es' ? 'Sin cambios' : 'Nothing to save');
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
      setTimeout(() => setSaveMessage(''), 2000);

      // Force a clean refresh to sync local state with server IDs
      await fetchWeek(relativeWeek, true);
      
      // Check if today has >= 6 exercises to trigger rest reminder
      const todayDay = days?.find(d => d.is_today);
      if (todayDay) {
        const todayLogsCount = todayDay.logs?.filter(l => 
          (parseFloat(l.weight_kg) > 0) || (l.duration && l.duration !== '')
        ).length || 0;
        if (todayLogsCount >= 6) {
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

      <div className="nav-arrows" style={{ justifyContent: 'center', gap: '1rem', padding: '0.5rem 1rem', alignItems: 'center' }}>
        <button 
          onClick={() => changeWeek(relativeWeek - 1)} 
          disabled={relativeWeek <= -6}
          style={{ 
            background: 'rgba(var(--brand-rgb), 0.1)', 
            border: '1px solid rgba(var(--brand-rgb), 0.3)', 
            color: 'var(--brand)', 
            borderRadius: '999px', 
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            opacity: relativeWeek <= -6 ? 0.3 : 1
          }}
          title="Past Week"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button 
              onClick={() => {
                if (relativeWeek !== 0) {
                  changeWeek(0);
                  setShouldScrollToToday(true);
                } else {
                  todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }} 
              style={{ 
                background: 'rgba(var(--brand-rgb), 0.1)', 
                border: '1px solid rgba(var(--brand-rgb), 0.3)', 
                color: 'var(--brand)', 
                cursor: 'pointer', 
                padding: '8px 12px', 
                borderRadius: '999px', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                gap: '8px'
              }}
              title={relativeWeek === 0 ? "Scroll to Today" : "Back to Present"}
            >
              <CalendarDays size={18} strokeWidth={2.5} />
              <div style={{ width: '1px', height: '14px', background: 'rgba(var(--brand-rgb), 0.3)' }} />
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: '1000', 
                minWidth: '22px',
                textAlign: 'center',
                fontFamily: 'monospace',
                letterSpacing: '-0.5px'
              }}>
                {relativeWeek > 0 ? `+${relativeWeek}` : relativeWeek}
              </span>
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
              {viewMode === 'feed' ? 'SHEET' : 'FEED'}
            </button>
            <button 
              onClick={() => {
                setIsSwapMode(!isSwapMode);
                setSwapDate(null);
              }} 
              style={{ 
                background: isSwapMode ? 'var(--brand)' : 'rgba(var(--brand-rgb), 0.1)', 
                border: '1px solid rgba(var(--brand-rgb), 0.3)', 
                color: isSwapMode ? '#052e16' : 'var(--brand)', 
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
                boxShadow: isSwapMode ? '0 0 15px var(--brand)' : '0 2px 10px rgba(0,0,0,0.1)'
              }}
              title="Swap Days"
            >
              <RefreshCw size={13} strokeWidth={2.5} className={isSwapMode ? 'spin' : ''} />
            </button>
        </div>

        <button 
          onClick={() => changeWeek(relativeWeek + 1)} 
          disabled={relativeWeek >= 1}
          style={{ 
            background: 'rgba(var(--brand-rgb), 0.1)', 
            border: '1px solid rgba(var(--brand-rgb), 0.3)', 
            color: 'var(--brand)', 
            borderRadius: '999px', 
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            opacity: relativeWeek >= 1 ? 0.3 : 1
          }}
          title="Future Week"
        >
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{ padding: '0 1rem' }}>
        {loadingWeeks[relativeWeek] && !days.length ? (
          <div className="stack">
            <Skeleton height="200px" />
            <Skeleton height="200px" />
            <Skeleton height="200px" />
          </div>
        ) : (
          <div className="stack">
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
                      const allExRaw = [];
                      day.goals?.forEach(g => {
                        const overrides = todayOverrides[g.id] || [];
                        allExRaw.push(...(g.goal_exercises || []), ...overrides);
                      });
                      const allExercises = allExRaw.filter(it => {
                        const lVal = inlineLogs[it.id] || {};
                        const isDel = toDelete.some(td => String(td) === String(it.id)) || 
                                     (lVal?.log_id && toDelete.some(td => String(td) === String(lVal.log_id))) || 
                                     lVal.isHidden || lVal.sets === '0';
                        return !isDel;
                      });
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
                            {editMode && day.goals?.length > 0 && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectingExerciseForGoal(day.goals[0].id);
                                }}
                                style={{ marginTop: '0.5rem', background: 'var(--brand)', color: '#000', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '0.6rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Plus size={10} /> {t(lang, 'addExercise')}
                              </button>
                            )}
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
                          {(() => {
                            const filtered = allExercises;
                            
                            if (filtered.length === 0) return (
                              <tr key={day.date} style={{ background: day.is_today ? 'rgba(var(--brand-rgb), 0.08)' : 'transparent' }}>
                                {dayCell}
                                <td colSpan={3} className="spreadsheet-td" style={{ textAlign: 'center', color: 'var(--brand)', opacity: 0.2 }}>
                                  —
                                </td>
                              </tr>
                            );

                            return filtered.map((item, fIdx) => {
                              const logVal = inlineLogs[item.id] || {};
                              const isDone = !!logVal.log_id;
                              const nextItem = filtered[fIdx + 1];
                              const prevItem = filtered[fIdx - 1];
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
                                  key={item.id || `f-${fIdx}`} 
                                  className={`spreadsheet-row ${isDone ? 'done' : ''} ${day.is_today ? 'today' : ''}`}
                                  style={{ 
                                    borderBottom: isSupersetWithNext ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                    background: (isSupersetWithNext || isSupersetWithPrev) ? 'rgba(var(--brand-rgb), 0.01)' : 'transparent'
                                  }}
                                >
                                  {fIdx === 0 && dayCell}
                                  <td className="spreadsheet-td exercise-name-cell" style={{ 
                                    color: isDone ? 'var(--brand)' : 'var(--text)',
                                    borderLeft: (isSupersetWithNext || isSupersetWithPrev) ? '2px solid var(--brand)' : 'none',
                                    paddingLeft: (isSupersetWithNext || isSupersetWithPrev) ? '1.5rem' : '1rem'
                                  }}>
                                    <div className="flex-center-gap" style={{ justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {item.exercise_detail?.exercise_type === 'calisthenics' ? <Activity size={16} /> : 
                                         item.exercise_detail?.exercise_type === 'pr' ? <Trophy size={16} /> :
                                         <Dumbbell size={16} />}
                                        <span style={{ color: item._isExtra ? 'var(--brand)' : 'inherit' }}>
                                          {t(lang, item.exercise_detail?.name)}
                                        </span>
                                        {isPR && <span style={{ fontSize: '0.6rem', color: 'var(--brand)', border: '1px solid var(--brand)', padding: '0 4px', borderRadius: '4px' }}>PR</span>}
                                      </div>
                                      
                                      {editMode && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id, false); }}
                                          style={{ background: 'none', border: 'none', color: '#ef4444', padding: '2px', cursor: 'pointer', display: 'flex' }}
                                        >
                                          <X size={14} />
                                        </button>
                                      )}
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
                            });
                          })()}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="days-feed">
                {days.map((day, dayIdx) => {
                  const isDayCompleted = day.progress?.completed;
                  const isDayCurrentWeek = relativeWeek === 0;

                  return (
                    <article
                      key={day.date}
                      ref={day.is_today ? todayRef : null}
                      onClick={() => isSwapMode && handleDaySwap(day.date)}
                      className={day.is_today ? 'day-card today' : 'day-card'}
                      style={{ 
                        marginBottom: 'clamp(1rem, 4vw, 1.5rem)',
                        cursor: isSwapMode ? 'pointer' : 'default',
                        outline: isSwapMode && swapDate === day.date ? '3px solid var(--brand)' : 'none',
                        outlineOffset: '2px',
                        opacity: isSwapMode && swapDate && swapDate !== day.date ? 0.8 : 1,
                        transform: isSwapMode && swapDate === day.date ? 'scale(1.02)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                           <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950' }}>{day.label.split(',')[0]}</h3>
                           <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '800' }}>{day.label.split(',')[1]}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {isDayCurrentWeek && (
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPushMenuDay(pushMenuDay === dayIdx ? null : dayIdx); }}
                                  className="small-btn"
                                  title="Shift goals"
                                  style={{ padding: '0.5rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <CalendarDays size={16} />
                                  <span style={{ fontSize: '0.6rem', fontWeight: '900' }}>PUSH</span>
                                </button>

                                {pushMenuDay === dayIdx && (
                                  <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={(e) => { e.stopPropagation(); setPushMenuDay(null); }} />
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
                                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', fontWeight: '900', color: '#ef4444' }}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await api('/weekly-shift/', { method: 'POST', body: JSON.stringify({ today: day.date, day_index: dayIdx, direction: -1 }) });
                                            setPushMenuDay(null);
                                            fetchWeek(relativeWeek);
                                          } catch (err) { setError(err.message); }
                                        }}
                                      >-1</button>
                                      <button
                                        className="small-btn"
                                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', fontWeight: '900', color: '#10b981' }}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await api('/weekly-shift/', { method: 'POST', body: JSON.stringify({ today: day.date, day_index: dayIdx, direction: 1 }) });
                                            setPushMenuDay(null);
                                            fetchWeek(relativeWeek);
                                          } catch (err) { setError(err.message); }
                                        }}
                                      >+1</button>
                                    </div>
                                  </>
                                )}
                              </div>
                               <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (relativeWeek !== 0 && !editMode) {
                                    alert(t(lang, 'notCurrentWeek'));
                                    return;
                                  }
                                  setEditMode(!editMode); 
                                }}
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
                          {isDayCompleted && !editMode && <CheckCircle2 size={18} className="success" />}
                        </div>
                      </div>

                      {(!day.goals || day.goals.length === 0) ? (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
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
                            const isLocked = !isDayCurrentWeek;

                            return (
                              <div key={goal.id} className={editMode && isDayCurrentWeek ? 'edit-pulse' : ''} style={{ 
                                border: editMode && isDayCurrentWeek ? '1px solid var(--brand)' : 'none',
                                borderRadius: '16px',
                                padding: editMode && isDayCurrentWeek ? '0.5rem' : '0',
                                background: editMode && isDayCurrentWeek ? 'rgba(var(--brand-rgb), 0.02)' : 'transparent'
                              }}>
                                <div className="exercise-stack" style={{ display: 'grid', gap: '0.8rem' }}>
                                  {allCurrentExercises.map((item, idx) => {
                                    const logKey = item.id || `extra-${idx}`;
                                    const logVal = inlineLogs[logKey] || {};
                                    
                                    if (toDelete.some(td => String(td) === String(item.id)) || (logVal?.log_id && toDelete.some(td => String(td) === String(logVal.log_id))) || logVal.isHidden || logVal.sets === '0') return null;
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
                                                 {editMode && isDayCurrentWeek ? (
                                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                                                     <span style={{ flex: 1, color: 'var(--brand)', fontWeight: '900', fontSize: '0.95rem' }}>
                                                       {t(lang, item.exercise_detail?.name)}
                                                     </span>

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
                                                       onClick={(e) => {
                                                         e.stopPropagation();
                                                         const nextPR = !isPR;
                                                         handleChange(logKey, 'is_pr_set', nextPR);
                                                         if (nextPR) {
                                                           handleChange(logKey, 'sets', '1');
                                                           handleChange(logKey, 'reps', '1');
                                                         }
                                                       }}
                                                     >PR</button>

                                                     <button 
                                                       onClick={(e) => {
                                                         e.stopPropagation();
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
                                                    {item.personal_best_details && (
                                                      <div 
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedRecord({
                                                            ...item.personal_best_details,
                                                            exercise_name: item.exercise_detail?.name
                                                          });
                                                          setShowRecordModal(true);
                                                        }}
                                                        style={{ fontSize: '0.65rem', color: 'var(--brand)', fontWeight: '900', background: 'rgba(34, 197, 94, 0.1)', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--brand)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                                                      >
                                                        <Medal size={10} /> {item.personal_best_details.weight}kg
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
                                                       onClick={(e) => { e.stopPropagation(); setActiveTimer({ id: item.id || `extra-${idx}`, time: 0 }); }}
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
                                  
                                  {editMode && isDayCurrentWeek && selectingExerciseForGoal === goal.id ? (
                                    <div className="glass-card animate-pop" style={{ 
                                      padding: '1rem', marginTop: '0.5rem', border: '2px solid var(--brand)', 
                                      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
                                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                                    }}>
                                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <input 
                                          autoFocus
                                          placeholder={t(lang, 'searching') + '...'}
                                          className="input-bubble"
                                          value={exerciseSearch}
                                          onChange={(e) => setExerciseSearch(e.target.value)}
                                          style={{ flex: 1, height: '42px', border: '1px solid var(--brand)' }}
                                        />
                                        <button className="small-btn" onClick={() => { setSelectingExerciseForGoal(null); setExerciseSearch(''); }} style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
                                          <X size={18} />
                                        </button>
                                      </div>
                                      <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '4px' }}>
                                        {Object.entries(groupedExercises).map(([cat, exs]) => {
                                          const filtered = exs.filter(ex => 
                                            t(lang, ex.name).toLowerCase().includes(exerciseSearch.toLowerCase())
                                          );
                                          if (filtered.length === 0) return null;

                                          return (
                                            <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                              <h4 style={{ 
                                                margin: '0 0 0.2rem 0', 
                                                fontSize: '0.75rem', 
                                                textTransform: 'uppercase', 
                                                color: 'var(--muted)', 
                                                letterSpacing: '1px',
                                                paddingLeft: '0.2rem',
                                                borderLeft: '2px solid var(--brand)'
                                              }}>
                                                {t(lang, cat)}
                                              </h4>
                                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.4rem' }}>
                                                {filtered.map(ex => (
                                                  <button 
                                                    key={ex.id}
                                                    className="glass-card"
                                                    style={{ 
                                                      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem', 
                                                      textAlign: 'left', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)',
                                                      transition: 'all 0.2s', cursor: 'pointer', width: '100%'
                                                    }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const tempId = `temp-new-extra-${Date.now()}-${ex.id}`;
                                                      setTodayOverrides(prev => ({
                                                        ...prev,
                                                        [goal.id]: [...(prev[goal.id] || []), { id: tempId, exercise_detail: ex, sets: 4, reps: 10, _isExtra: true }]
                                                      }));
                                                      setSelectingExerciseForGoal(null);
                                                      setExerciseSearch('');
                                                    }}
                                                  >
                                                    <div style={{ width: '24px', height: '24px', minWidth: '24px', borderRadius: '6px', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                                                      {ex.exercise_type === 'calisthenics' ? <Activity size={12} /> : <Dumbbell size={12} />}
                                                    </div>
                                                    <span style={{ fontWeight: '700', fontSize: '0.75rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                      {t(lang, ex.name)}
                                                    </span>
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })}
                                        
                                        {Object.values(groupedExercises).every(exs => 
                                          exs.filter(ex => t(lang, ex.name).toLowerCase().includes(exerciseSearch.toLowerCase())).length === 0
                                        ) && (
                                          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, fontSize: '0.8rem' }}>
                                            {t(lang, 'noLogs')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : editMode && isDayCurrentWeek && allCurrentExercises.filter(it => {
                                    const lVal = inlineLogs[it.id] || {};
                                    const isDel = toDelete.some(td => String(td) === String(it.id)) || (lVal?.log_id && toDelete.some(td => String(td) === String(lVal.log_id))) || lVal.isHidden || lVal.sets === '0';
                                    return !isDel;
                                  }).length < 10 && (
                                    <button 
                                      className="dotted-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectingExerciseForGoal(goal.id);
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
                                      <Plus size={18} /> {t(lang, 'addExercise')}
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
          </div>
        )}
      </div>



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
      {isSwapMode && (
        <div style={{
          position: 'fixed',
          bottom: '5.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--brand)',
          color: '#052e16',
          padding: '0.8rem 1.5rem',
          borderRadius: '999px',
          zIndex: 1000,
          fontWeight: '1000',
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
          boxShadow: '0 8px 32px rgba(var(--brand-rgb), 0.4)',
          fontSize: '0.85rem',
          border: '2px solid rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap'
        }} className="animate-pop">
          <RefreshCw size={18} className="spin" />
          <span>
            {!swapDate 
              ? (lang === 'es' ? 'SELECCIONA EL PRIMER DÍA' : 'SELECT THE FIRST DAY')
              : (lang === 'es' ? 'AHORA EL SEGUNDO DÍA' : 'NOW THE SECOND DAY')}
          </span>
          <button 
            onClick={() => { setIsSwapMode(false); setSwapDate(null); }}
            style={{ 
              background: 'rgba(0,0,0,0.1)', 
              border: 'none', 
              color: '#052e16', 
              cursor: 'pointer', 
              padding: '0.2rem', 
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showRecordModal && selectedRecord && (
        <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setShowRecordModal(false)}>
          <div className="glass-card modal-content animate-pop" style={{ padding: '2rem', border: '1px solid var(--brand)', maxWidth: '320px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'rgba(var(--brand-rgb), 0.1)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '2px solid var(--brand)' }}>
              <Trophy size={32} color="var(--brand)" />
            </div>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.4rem', fontWeight: '950' }}>{t(lang, selectedRecord.exercise_name || 'records')}</h3>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t(lang, 'weight')}</p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '1.5rem', fontWeight: '900', color: 'var(--brand)' }}>{selectedRecord.weight}kg</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--line)' }}>
                  <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{t(lang, 'sets')}</p>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '1.1rem', fontWeight: '900' }}>{selectedRecord.sets}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--line)' }}>
                  <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{t(lang, 'reps')}</p>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '1.1rem', fontWeight: '900' }}>{selectedRecord.reps}</p>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{t(lang, 'date')}</p>
                <p style={{ margin: '0.1rem 0 0', fontSize: '0.9rem', fontWeight: '800' }}>{new Date(selectedRecord.date).toLocaleDateString()}</p>
              </div>
            </div>
            <button className="primary-btn" style={{ width: '100%' }} onClick={() => setShowRecordModal(false)}>
              {t(lang, 'iUnderstand')}
            </button>
          </div>
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
