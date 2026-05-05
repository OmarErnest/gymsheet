import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Plus, Trash2, Edit2, RefreshCw, Activity, Map as MapIcon, PlusCircle, Target, List, BarChart3, PieChart as PieIcon, GripVertical, Timer, Weight, Zap } from 'lucide-react';
import { api } from '../api/client.js';
import LinkInput from '../components/LinkInput.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { t } from '../i18n.js';

// DND Kit
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

function SortableGoalItem({ goal, lang, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: goal.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative'
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="goal-block glass-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--muted)' }}>
            <GripVertical size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0 }}>{goal.title}</h4>
            <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
              {goal.repeat_type === 'weekly' ? t(lang, 'weekly') : t(lang, 'oneDayOnly')} - {goal.start_date}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="small-btn" onClick={() => onEdit(goal)}><Edit2 size={16} /> </button>
          <button className="small-btn danger-btn" onClick={() => onDelete(goal.id)}><Trash2 size={16} /> </button>
        </div>
      </div>
    </div>
  );
}

export default function Profile({ preferences, lang }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [goals, setGoals] = useState([]);
  
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');

  const [activeTab, setActiveTab] = useState('strength');
  const [graphMode, setGraphMode] = useState('pie'); 
  const [showFrontBody, setShowFrontBody] = useState(true);
  const [selectedDot, setSelectedDot] = useState(null);

  const [exerciseForm, setExerciseForm] = useState({ name: '', youtube_url: '', category: '', is_public: true, is_time_based: false });
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  async function createExercise(event) {
    event.preventDefault();
    setMessage('');
    try {
      await api('/exercises/', { method: 'POST', body: JSON.stringify(exerciseForm) });
      setExerciseForm({ name: '', youtube_url: '', category: '', is_public: true, is_time_based: false });
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
      } else {
        await api('/goal-plans/', { method: 'POST', body: JSON.stringify(body) });
      }
      setGoalForm({ id: null, title: '', start_date: new Date().toISOString().slice(0, 10), repeat_type: 'weekly', weekdays: [], repeat_weeks: '', goal_exercises: [emptyGoalExercise()] });
      await load();
      setMessage(t(lang, 'settingsSaved'));
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function deleteGoal(id) {
    if (!confirm("Are you sure?")) return;
    try {
      await api(`/goal-plans/${id}/`, { method: 'DELETE' });
      await load();
    } catch (err) { setMessage(err.message); }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setGoals((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (loading && exercises.length === 0) return (
    <div className="loading-screen">
      <img src="/logo.png" className="loading-logo-spin" alt="" />
      <h2 style={{ letterSpacing: '2px', fontWeight: '900', color: 'var(--brand)' }}>LOADING PROFILE...</h2>
    </div>
  );

  return (
    <section className="stack profile-page" style={{ paddingBottom: '8rem' }}>
      {message && <p className="notice">{message}</p>}

      <div className="profile-nav-grid" style={{ margin: '1rem 0' }}>
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
            <p className="eyebrow">{t(lang, 'reviewProgress')}</p>
            <h2>{t(lang, 'strengthGraph')}</h2>
            <div className="tab-pill-box" style={{ margin: '0.8rem auto 0', width: 'fit-content' }}>
              <button className={`tab-pill ${graphMode === 'pie' ? 'active' : ''}`} onClick={() => setGraphMode('pie')}><PieIcon size={18} /></button>
              <button className={`tab-pill ${graphMode === 'bar' ? 'active' : ''}`} onClick={() => setGraphMode('bar')}><BarChart3 size={18} /></button>
              <button className={`tab-pill ${graphMode === 'list' ? 'active' : ''}`} onClick={() => setGraphMode('list')}><List size={18} /></button>
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
          <div className="chart-box" style={{ height: '300px', marginTop: '1.5rem', background: 'transparent', border: 'none' }}>
            {graphMode === 'bar' && (chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--brand)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--muted)', fontSize: 10 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--muted)', fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-soft)', borderRadius: '12px', border: '1px solid var(--line)', color: 'var(--text)' }}
                    itemStyle={{ color: 'var(--brand)', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="var(--brand)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorWeight)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="muted" style={{ textAlign: 'center', paddingTop: '4rem' }}>{t(lang, 'noLogs')}</p>)}
            {graphMode === 'pie' && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={pieData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60}
                    outerRadius={80} 
                    paddingAngle={5}
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${140 + index * 40}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-soft)', borderRadius: '12px', border: '1px solid var(--line)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {graphMode === 'list' && (
              <div className="exercise-list" style={{ overflowY: 'auto', maxHeight: '100%' }}>
                {filteredLogsList.map((log) => (<div key={log.id} className="exercise-row"><div><strong>{log.exercise_detail?.name}</strong><p>{log.date} — {log.sets}x{log.reps} @ {log.weight_kg}kg</p></div></div>))}
              </div>
            )}
          </div>
        </article>
      )}

      {activeTab === 'goals' && (
        <article className="glass-card profile-section">
          <p className="eyebrow">{t(lang, 'yourGoals')}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{t(lang, 'existingGoals')}</h2>
            <small className="muted">Drag to reorder</small>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={goals.map(g => g.id)} strategy={verticalListSortingStrategy}>
              <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                {goals.map(g => (
                  <SortableGoalItem key={g.id} goal={g} lang={lang} onEdit={(goal) => { setGoalForm({ ...goal, goal_exercises: goal.goal_exercises.map(ge => ({ categoryFilter: ge.exercise_detail?.category || '', exercise: ge.exercise, sets: ge.sets, reps: ge.reps })) }); setActiveTab('creategoal'); }} onDelete={deleteGoal} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </article>
      )}

      {activeTab === 'addexercise' && (
        <article className="glass-card profile-section">
          <p className="eyebrow">{t(lang, 'createExercise')}</p>
          <h2>{t(lang, 'addExercise')}</h2>
          <form onSubmit={createExercise} className="form-stack">
            <label className="field"><span>{t(lang, 'name')}</span><input value={exerciseForm.name} onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })} /></label>
            <div className="segmented ghost" style={{ marginTop: '0.5rem' }}>
              <button type="button" className={!exerciseForm.is_time_based ? 'active' : ''} onClick={() => setExerciseForm({ ...exerciseForm, is_time_based: false })}><Weight size={16} /> {t(lang, 'weight')}</button>
              <button type="button" className={exerciseForm.is_time_based ? 'active' : ''} onClick={() => setExerciseForm({ ...exerciseForm, is_time_based: true })}><Timer size={16} /> {t(lang, 'time')}</button>
            </div>
            <LinkInput label={t(lang, 'youtubeLink')} value={exerciseForm.youtube_url} onChange={(youtube_url) => setExerciseForm({ ...exerciseForm, youtube_url })} lang={lang} />
            <label className="field"><span>{t(lang, 'category')}</span><select required value={exerciseForm.category} onChange={(e) => setExerciseForm({ ...exerciseForm, category: e.target.value })}><option value="" disabled>Select Category</option>{categories.map((category) => <option key={category} value={category}>{t(lang, category)}</option>)}</select></label>
            <button className="primary-btn">{t(lang, 'createExerciseButton')}</button>
          </form>
        </article>
      )}

      {activeTab === 'creategoal' && (
        <article className="glass-card profile-section">
          <p className="eyebrow">{t(lang, 'createGoal')}</p>
          <h2>{goalForm.id ? "Edit Goal" : t(lang, 'buildRoutine')}</h2>
          <form onSubmit={saveGoal} className="form-stack">
            <label className="field"><span>{t(lang, 'goalTitle')}</span><input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="Leg day, Push day..." required /></label>
            <label className="field"><span>{t(lang, 'startDate')}</span><input type="date" value={goalForm.start_date} onChange={(e) => setGoalForm({ ...goalForm, start_date: e.target.value })} required /></label>
            <label className="field"><span>{t(lang, 'repeat')}</span><select value={goalForm.repeat_type} onChange={(e) => setGoalForm({ ...goalForm, repeat_type: e.target.value })}><option value="once">{t(lang, 'oneDayOnly')}</option><option value="weekly">{t(lang, 'weekly')}</option></select></label>
            {goalForm.repeat_type === 'weekly' && <div className="weekday-row">{weekdays.map(([label, value]) => <button className={goalForm.weekdays.includes(value) ? 'chip active' : 'chip'} type="button" key={value} onClick={() => toggleWeekday(value)}>{label}</button>)}</div>}
            <div className="goal-builder" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <strong>Exercises ({goalForm.goal_exercises.length}/10)</strong>
                <button className="small-btn" type="button" onClick={addGoalExercise} disabled={goalForm.goal_exercises.length >= 10}><Plus size={16} /></button>
              </div>
              {goalForm.goal_exercises.map((item, index) => {
                const availableExercises = item.categoryFilter ? exercises.filter(ex => ex.category === item.categoryFilter) : exercises;
                return (
                  <div className="goal-exercise-row glass-card" key={index} style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                      <select value={item.categoryFilter} onChange={(e) => updateGoalExercise(index, 'categoryFilter', e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{t(lang, c)}</option>)}</select>
                      <select required value={item.exercise} onChange={(e) => updateGoalExercise(index, 'exercise', e.target.value)}><option value="" disabled>Pick</option>{availableExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                      <input type="number" placeholder="Sets" value={item.sets} onChange={(e) => updateGoalExercise(index, 'sets', e.target.value)} style={{ width: '100%', textAlign: 'center' }} />
                      <input type="number" placeholder="Reps" value={item.reps} onChange={(e) => updateGoalExercise(index, 'reps', e.target.value)} style={{ width: '100%', textAlign: 'center' }} />
                      <button className="small-btn danger-btn" type="button" onClick={() => removeGoalExercise(index)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="primary-btn">{goalForm.id ? "Update" : "Create"}</button>
          </form>
        </article>
      )}

      {activeTab === 'bodymap' && (
        <article className="glass-card profile-section">
          <p className="eyebrow">{t(lang, 'bodyMap')}</p>
          <div className="body-map-container" style={{ position: 'relative' }}>
            <img src={showFrontBody ? "/front_body.png" : "/back_body.png"} style={{ width: '100%', opacity: 0.8 }} />
            {(showFrontBody ? frontDots : backDots).map(dot => (
              <button key={dot.part} className={`body-point ${selectedDot === dot.part ? 'active' : ''}`} style={{ top: dot.top, left: dot.left, position: 'absolute' }} onClick={() => { setSelectedDot(dot.part); setMeasurementForm(p => ({ ...p, body_part: dot.part })); }}>
                <div className="body-dot" />
              </button>
            ))}
            <button className="small-btn" onClick={() => setShowFrontBody(!showFrontBody)} style={{ position: 'absolute', bottom: '1rem', right: '1rem' }}><RefreshCw size={20} /></button>
          </div>
          <form onSubmit={createMeasurement} className="form-stack" style={{ marginTop: '1rem' }}>
            <select value={measurementForm.body_part} onChange={(e) => setMeasurementForm({ ...measurementForm, body_part: e.target.value })}>{bodyParts.map(p => <option key={p} value={p}>{t(lang, p)}</option>)}</select>
            <input type="number" step="0.1" placeholder="cm" value={measurementForm.value_cm} onChange={(e) => setMeasurementForm({ ...measurementForm, value_cm: e.target.value })} required />
            <button className="primary-btn">{t(lang, 'saveMeasure')}</button>
          </form>
        </article>
      )}
    </section>
  );
}
