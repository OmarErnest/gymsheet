import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { Plus, Trash2, Edit2, Settings as SettingsIcon, RefreshCw, Activity, Map as MapIcon, PlusCircle, Target, List, BarChart3, PieChart as PieIcon } from 'lucide-react';
import { api } from '../api/client.js';
import LinkInput from '../components/LinkInput.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { t } from '../i18n.js';

const categories = ['shoulder', 'legs', 'chest', 'back', 'arms', 'other'];
const bodyParts = ['biceps', 'forearms', 'chest', 'waist', 'hips', 'thigh', 'calf', 'shoulders', 'other'];
const weekdays = [
  ['Mon', 0], ['Tue', 1], ['Wed', 2], ['Thu', 3], ['Fri', 4], ['Sat', 5], ['Sun', 6],
];

const emptyGoalExercise = () => ({ categoryFilter: '', exercise: '', sets: 4, reps: 10 });

const frontDots = [
  { part: 'shoulders', top: '23%', left: '30%' },
  { part: 'chest', top: '28%', left: '50%' },
  { part: 'biceps', top: '33%', left: '22%' },
  { part: 'forearms', top: '42%', left: '18%' },
  { part: 'waist', top: '42%', left: '50%' },
  { part: 'thigh', top: '58%', left: '42%' },
];
const backDots = [
  { part: 'hips', top: '48%', left: '38%' },
  { part: 'calf', top: '75%', left: '40%' }
];

export default function Profile({ lang }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [goals, setGoals] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('strength');
  const [graphMode, setGraphMode] = useState('pie'); // bar, pie, list
  const [showFrontBody, setShowFrontBody] = useState(true);
  const [selectedDot, setSelectedDot] = useState(null);

  const [exerciseForm, setExerciseForm] = useState({ name: '', youtube_url: '', category: '', is_public: true });
  const [measurementForm, setMeasurementForm] = useState({
    body_part: 'biceps', value_cm: '', date: new Date().toISOString().slice(0, 10), notes: ''
  });

  const [goalForm, setGoalForm] = useState({
    id: null,
    title: '',
    start_date: new Date().toISOString().slice(0, 10),
    repeat_type: 'weekly',
    weekdays: [],
    repeat_weeks: '',
    goal_exercises: [emptyGoalExercise()],
  });

  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const [exerciseData, logData, measurementData, goalsData] = await Promise.all([
      api('/exercises/'),
      api('/exercise-logs/'),
      api('/body-measurements/'),
      api('/goal-plans/')
    ]);
    setExercises(exerciseData.results || exerciseData);
    setLogs(logData.results || logData);
    setMeasurements(measurementData.results || measurementData);
    setGoals(goalsData.results || goalsData);
    setSelectedExercise((prev) => prev || '');
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filteredExercises = useMemo(() => {
    return selectedCategory ? exercises.filter((ex) => ex.category === selectedCategory) : exercises;
  }, [selectedCategory, exercises]);

  const chartData = useMemo(() => {
    const filtered = logs.filter((log) => {
      const matchesCat = !selectedCategory || log.exercise_detail?.category === selectedCategory;
      const matchesEx = !selectedExercise || String(log.exercise) === String(selectedExercise);
      return matchesCat && matchesEx;
    });

    const grouped = {};
    filtered.forEach((log) => {
      const d = log.date;
      if (!grouped[d]) {
        grouped[d] = { date: d.slice(5), weight: 0, count: 0 };
      }
      grouped[d].weight += Number(log.weight_kg || 0);
      grouped[d].count += 1;
    });

    return Object.values(grouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        weight: Number((item.weight / item.count).toFixed(1)),
      }));
  }, [logs, selectedExercise, selectedCategory]);

  const pieData = useMemo(() => {
    const counts = {};
    logs.forEach(log => {
      const cat = log.exercise_detail?.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: t(lang, name), value }));
  }, [logs, lang]);

  const filteredLogsList = useMemo(() => {
    return logs.filter((log) => {
      const matchesCat = !selectedCategory || log.exercise_detail?.category === selectedCategory;
      const matchesEx = !selectedExercise || String(log.exercise) === String(selectedExercise);
      return matchesCat && matchesEx;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [logs, selectedExercise, selectedCategory]);


  const measurementsForSelectedPart = useMemo(() => {
    const list = measurements.filter((item) => item.body_part === measurementForm.body_part).sort((a, b) => a.date.localeCompare(b.date));
    if (list.length === 0) return [];
    if (list.length === 1) return [list[0]];
    return [list[0], list[list.length - 1]]; // Oldest and Newest
  }, [measurements, measurementForm.body_part]);

  async function createExercise(event) {
    event.preventDefault();
    setMessage('');
    try {
      await api('/exercises/', { method: 'POST', body: JSON.stringify(exerciseForm) });
      setExerciseForm({ name: '', youtube_url: '', category: '', is_public: true });
      setMessage(t(lang, 'exerciseCreated'));
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function createMeasurement(event) {
    event.preventDefault();
    setMessage('');
    try {
      await api('/body-measurements/', { method: 'POST', body: JSON.stringify(measurementForm) });
      setMeasurementForm((prev) => ({ ...prev, value_cm: '', notes: '' }));
      setMessage(t(lang, 'measurementSaved'));
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  function toggleWeekday(day) {
    setGoalForm((prev) => {
      const has = prev.weekdays.includes(day);
      return { ...prev, weekdays: has ? prev.weekdays.filter((item) => item !== day) : [...prev.weekdays, day].sort() };
    });
  }

  function updateGoalExercise(index, field, value) {
    setGoalForm((prev) => ({
      ...prev,
      goal_exercises: prev.goal_exercises.map((item, idx) => {
        if (idx === index) {
          if (field === 'categoryFilter') return { ...item, categoryFilter: value, exercise: '' };
          return { ...item, [field]: value };
        }
        return item;
      }),
    }));
  }

  function addGoalExercise() {
    setGoalForm((prev) => {
      if (prev.goal_exercises.length >= 10) return prev;
      return { ...prev, goal_exercises: [...prev.goal_exercises, emptyGoalExercise()] };
    });
  }

  function removeGoalExercise(index) {
    setGoalForm((prev) => ({
      ...prev,
      goal_exercises: prev.goal_exercises.length === 1
        ? [emptyGoalExercise()]
        : prev.goal_exercises.filter((_, idx) => idx !== index),
    }));
  }

  async function saveGoal(event) {
    event.preventDefault();
    setMessage('');
    const payloadExercises = goalForm.goal_exercises
      .filter((item) => item.exercise)
      .map((item, index) => ({
        exercise: item.exercise,
        sets: Number(item.sets || 0),
        reps: Number(item.reps || 0),
        notes: item.notes || '',
        order: index + 1,
      }));

    const body = {
      title: goalForm.title,
      start_date: goalForm.start_date,
      repeat_type: goalForm.repeat_type,
      weekdays: goalForm.repeat_type === 'weekly' ? goalForm.weekdays : [],
      repeat_weeks: goalForm.repeat_weeks || null,
      goal_exercises: payloadExercises,
    };

    try {
      if (goalForm.id) {
        await api(`/goal-plans/${goalForm.id}/`, { method: 'PUT', body: JSON.stringify(body) });
        setMessage("Goal updated successfully.");
      } else {
        await api('/goal-plans/', { method: 'POST', body: JSON.stringify(body) });
        setMessage(t(lang, 'goalCreated'));
      }
      setGoalForm({ id: null, title: '', start_date: new Date().toISOString().slice(0, 10), repeat_type: 'weekly', weekdays: [], repeat_weeks: '', goal_exercises: [emptyGoalExercise()] });
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function deleteGoal(id) {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    try {
      await api(`/goal-plans/${id}/`, { method: 'DELETE' });
      setMessage("Goal deleted.");
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function deleteGlobalExercise(id) {
    if (!confirm("Are you sure you want to delete this exercise? This will affect all users!")) return;
    try {
      await api(`/exercises/${id}/`, { method: 'DELETE' });
      setMessage("Exercise deleted globally.");
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  function editGoal(goal) {
    setGoalForm({
      id: goal.id,
      title: goal.title,
      start_date: goal.start_date,
      repeat_type: goal.repeat_type,
      weekdays: goal.weekdays || [],
      repeat_weeks: goal.repeat_weeks || '',
      goal_exercises: goal.goal_exercises.length ? goal.goal_exercises.map(ge => ({
        categoryFilter: ge.exercise_detail?.category || '',
        exercise: ge.exercise,
        sets: ge.sets,
        reps: ge.reps
      })) : [emptyGoalExercise()],
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const showsOverrideWarning = goalForm.repeat_type === 'once' && goalForm.start_date === todayStr && goals.some(g => g.repeat_type === 'weekly' && g.weekdays.includes(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1));

  if (loading && exercises.length === 0) return <Skeleton count={5} />;

  return (
    <section className="stack profile-page">
      {message && <p className="notice">{message}</p>}

      <div className="profile-nav-grid" style={{ marginBottom: '1rem' }}>
        <button className={`nav-square ${activeTab === 'strength' ? 'active' : ''}`} onClick={() => setActiveTab('strength')}>
          <Activity />
          <span>{t(lang, 'strength')}</span>
        </button>
        <button className={`nav-square ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')}>
          <Target />
          <span>{t(lang, 'yourGoals')}</span>
        </button>
        <button className={`nav-square ${activeTab === 'creategoal' ? 'active' : ''}`} onClick={() => setActiveTab('creategoal')}>
          <Plus />
          <span>{t(lang, 'createGoal')}</span>
        </button>
        <button className={`nav-square ${activeTab === 'bodymap' ? 'active' : ''}`} onClick={() => setActiveTab('bodymap')}>
          <MapIcon />
          <span>{t(lang, 'bodyMap')}</span>
        </button>
        <button className={`nav-square ${activeTab === 'addexercise' ? 'active' : ''}`} onClick={() => setActiveTab('addexercise')}>
          <PlusCircle />
          <span>{t(lang, 'addEx')}</span>
        </button>
      </div>



      {activeTab === 'strength' && (
        <article className="glass-card profile-section">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p className="eyebrow">1/5 · {t(lang, 'reviewProgress')}</p>
            <h2>{t(lang, 'strengthGraph')}</h2>
            <div className="tab-pill-box" style={{ margin: '0.8rem auto 0', width: 'fit-content' }}>
              <button className={`tab-pill ${graphMode === 'pie' ? 'active' : ''}`} onClick={() => setGraphMode('pie')} title={t(lang, 'pie')}><PieIcon size={18} /></button>
              <button className={`tab-pill ${graphMode === 'bar' ? 'active' : ''}`} onClick={() => setGraphMode('bar')} title={t(lang, 'line')}><BarChart3 size={18} /></button>
              <button className={`tab-pill ${graphMode === 'list' ? 'active' : ''}`} onClick={() => setGraphMode('list')} title={t(lang, 'list')}><List size={18} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
            <select style={{ flex: 1 }} value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedExercise(''); }}>
              <option value="">{t(lang, 'allGroups')}</option>
              {categories.map((category) => <option key={category} value={category}>{t(lang, category)}</option>)}
            </select>
            <select style={{ flex: 1 }} value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)}>
              <option value="">{t(lang, 'allExercises')}</option>
              {filteredExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
            </select>
          </div>

          <div className="chart-box" style={{ height: graphMode === 'list' ? '400px' : '300px', overflowY: graphMode === 'list' ? 'auto' : 'hidden' }}>
            {graphMode === 'bar' && (
              chartData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }} />
                    <Bar dataKey="weight" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="muted">{t(lang, 'noLogs')}</p>
            )}

            {graphMode === 'pie' && (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="var(--brand)" label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${140 + index * 30}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}

            {graphMode === 'list' && (
              <div className="exercise-list">
                {filteredLogsList.map((log) => (
                  <div key={log.id} className="exercise-row">
                    <div>
                      <strong>{log.exercise_detail?.name}</strong>
                      <p>{log.date} — {log.sets}x{log.reps} @ {log.weight_kg}kg</p>
                    </div>
                  </div>
                ))}
                {filteredLogsList.length === 0 && <p className="muted">{t(lang, 'noLogs')}</p>}
              </div>
            )}
          </div>
        </article>
      )}

      {activeTab === 'bodymap' && (
        <article className="glass-card two-col-card profile-section">
          <div style={{ textAlign: 'center' }}>
            <p className="eyebrow">4/5 · {t(lang, 'bodyMeasurements')}</p>
            <h2>{t(lang, 'bodyMap')}</h2>

            <div className="body-map">
              <img
                src={showFrontBody ? "/front_body.png" : "/back_body.png"}
                alt="Body Profile"
                style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }}
              />

              {(showFrontBody ? frontDots : backDots).map((dot) => (
                <button
                  key={dot.part}
                  className={`body-point ${selectedDot === dot.part ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDot(dot.part);
                    setMeasurementForm(prev => ({ ...prev, body_part: dot.part }));
                  }}
                  style={{ top: dot.top, left: dot.left }}
                >
                  <div className="body-dot" />
                  <span className="body-label">{t(lang, dot.part)}</span>

                  {selectedDot === dot.part && (() => {
                    const partData = measurements.filter(m => m.body_part === selectedDot).sort((a, b) => a.date.localeCompare(b.date));
                    if (partData.length === 0) return null;
                    const latest = partData[partData.length - 1];
                    return (
                      <div className={`body-popup ${parseFloat(dot.left) > 50 ? 'on-left' : ''}`}>
                        <h4>{t(lang, dot.part)}</h4>
                        <p>{latest.value_cm} cm</p>
                      </div>
                    );
                  })()}
                </button>
              ))}

              <button
                className="small-btn"
                onClick={() => { setShowFrontBody(!showFrontBody); setSelectedDot(null); }}
                style={{ position: 'absolute', bottom: '1rem', right: '1rem', borderRadius: '50%', width: '44px', height: '44px', padding: 0 }}
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={createMeasurement} className="form-stack sticky-panel">
            <label className="field">
              <span>{t(lang, 'bodyPart')}</span>
              <select value={measurementForm.body_part} onChange={(e) => setMeasurementForm({ ...measurementForm, body_part: e.target.value })}>
                {bodyParts.map((part) => <option key={part} value={part}>{t(lang, part)}</option>)}
              </select>
            </label>
            <label className="field"><span>{t(lang, 'valueCm')}</span><input type="number" step="0.1" value={measurementForm.value_cm} onChange={(e) => setMeasurementForm({ ...measurementForm, value_cm: e.target.value })} required /></label>
            <label className="field"><span>{t(lang, 'date')}</span><input type="date" value={measurementForm.date} onChange={(e) => setMeasurementForm({ ...measurementForm, date: e.target.value })} /></label>
            <label className="field"><span>{t(lang, 'notes')}</span><textarea value={measurementForm.notes} onChange={(e) => setMeasurementForm({ ...measurementForm, notes: e.target.value })} placeholder={t(lang, 'stickyPlaceholder')} /></label>
            <button className="primary-btn">{t(lang, 'saveMeasure')}</button>
          </form>
        </article>
      )}

      {activeTab === 'addexercise' && (
        <article className="glass-card profile-section">
          <p className="eyebrow">5/5 · {t(lang, 'createExercise')}</p>
          <h2>{t(lang, 'addExercise')}</h2>
          <form onSubmit={createExercise} className="form-stack">
            <label className="field"><span>{t(lang, 'name')}</span><input value={exerciseForm.name} onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })} /></label>
            <LinkInput label={t(lang, 'youtubeLink')} value={exerciseForm.youtube_url} onChange={(youtube_url) => setExerciseForm({ ...exerciseForm, youtube_url })} lang={lang} />
            <label className="field"><span>{t(lang, 'category')}</span><select required value={exerciseForm.category} onChange={(e) => setExerciseForm({ ...exerciseForm, category: e.target.value })}><option value="" disabled>Select Category</option>{categories.map((category) => <option key={category} value={category}>{t(lang, category)}</option>)}</select></label>
            <button className="primary-btn">{t(lang, 'createExerciseButton')}</button>
          </form>
        </article>
      )}

      {activeTab === 'goals' && (
        <article className="glass-card profile-section">
          <p className="eyebrow">2/5 · {t(lang, 'yourGoals')}</p>
          <h2>{t(lang, 'existingGoals')}</h2>
          {goals.length === 0 ? <p className="muted">No goals found.</p> : (
            <div className="stack" style={{ gap: '1rem' }}>
              {goals.map(g => (
                <div key={g.id} className="goal-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{g.title}</h4>
                    <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>{g.repeat_type === 'weekly' ? t(lang, 'weekly') : t(lang, 'oneDayOnly')} - {g.start_date}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="small-btn" onClick={() => { editGoal(g); setActiveTab('creategoal'); }}><Edit2 size={16} /> </button>
                    <button className="small-btn danger-btn" onClick={() => deleteGoal(g.id)}><Trash2 size={16} /> </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {activeTab === 'creategoal' && (
        <article className="glass-card profile-section">
          <p className="eyebrow">3/5 · {t(lang, 'createGoal')}</p>
          <h2>{goalForm.id ? "Edit Goal" : t(lang, 'buildRoutine')}</h2>
          {showsOverrideWarning && <p className="notice warning">Note: A "One Day Only" goal for today will supercede any repeating goals you have for today.</p>}
          <p className="muted">{t(lang, 'maxTen')}</p>
          <form onSubmit={saveGoal} className="form-stack">
            <label className="field"><span>{t(lang, 'goalTitle')}</span><input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="Leg day, Push day..." required /></label>
            <label className="field"><span>{t(lang, 'startDate')}</span><input type="date" value={goalForm.start_date} onChange={(e) => setGoalForm({ ...goalForm, start_date: e.target.value })} required /></label>
            <label className="field"><span>{t(lang, 'repeat')}</span><select value={goalForm.repeat_type} onChange={(e) => setGoalForm({ ...goalForm, repeat_type: e.target.value })}><option value="once">{t(lang, 'oneDayOnly')}</option><option value="weekly">{t(lang, 'weekly')}</option></select></label>
            {goalForm.repeat_type === 'weekly' && <div className="weekday-row">{weekdays.map(([label, value]) => <button className={goalForm.weekdays.includes(value) ? 'chip active' : 'chip'} type="button" key={value} onClick={() => toggleWeekday(value)}>{label}</button>)}</div>}
            <label className="field"><span>{t(lang, 'limitWeeks')}</span><input inputMode="numeric" value={goalForm.repeat_weeks} onChange={(e) => setGoalForm({ ...goalForm, repeat_weeks: e.target.value })} placeholder={t(lang, 'emptyUnlimited')} /></label>

            <div className="goal-builder">
              <div className="section-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.8rem', marginBottom: '1rem' }}>
                <div>
                  <p className="eyebrow">{t(lang, 'routineExercises')}</p>
                  <strong>{goalForm.goal_exercises.length}/10</strong>
                </div>
                <button className="small-btn" type="button" onClick={addGoalExercise} disabled={goalForm.goal_exercises.length >= 10}><Plus size={16} /> {t(lang, 'addExerciseRow')}</button>
              </div>

              {goalForm.goal_exercises.map((item, index) => {
                const availableExercises = item.categoryFilter ? exercises.filter(ex => ex.category === item.categoryFilter) : exercises;
                return (
                  <div className="goal-exercise-row" key={index} style={{ border: '1px solid var(--line)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', background: 'var(--bg-soft)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                      <label className="field"><span>Category</span>
                        <select required value={item.categoryFilter} onChange={(e) => updateGoalExercise(index, 'categoryFilter', e.target.value)}>
                          <option value="">All</option>
                          {categories.map((category) => <option key={category} value={category}>{t(lang, category)}</option>)}
                        </select>
                      </label>
                      <label className="field"><span>{t(lang, 'exercises')}</span>
                        <select required value={item.exercise} onChange={(e) => updateGoalExercise(index, 'exercise', e.target.value)}>
                          <option value="" disabled>Pick</option>
                          {availableExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                        </select>
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t(lang, 'sets')}</span>
                        <input type="number" onFocus={(e) => e.target.select()} inputMode="numeric" value={item.sets} onChange={(e) => updateGoalExercise(index, 'sets', e.target.value)} style={{ width: '50px', height: '50px', borderRadius: '50%', textAlign: 'center', fontSize: '1rem', padding: 0 }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t(lang, 'reps')}</span>
                        <input type="number" onFocus={(e) => e.target.select()} inputMode="numeric" value={item.reps} onChange={(e) => updateGoalExercise(index, 'reps', e.target.value)} style={{ width: '50px', height: '50px', borderRadius: '50%', textAlign: 'center', fontSize: '1rem', padding: 0 }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="small-btn danger-btn" type="button" onClick={() => removeGoalExercise(index)}><Trash2 size={16} /> </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="primary-btn">{goalForm.id ? "Update Goal" : t(lang, 'createGoal')}</button>
            {goalForm.id && <button type="button" className="small-btn" onClick={() => setGoalForm({ id: null, title: '', start_date: new Date().toISOString().slice(0, 10), repeat_type: 'weekly', weekdays: [], repeat_weeks: '', goal_exercises: [emptyGoalExercise()] })} style={{ marginTop: '0.5rem' }}>Cancel Edit</button>}
          </form>
        </article>
      )}
    </section>
  );
}
