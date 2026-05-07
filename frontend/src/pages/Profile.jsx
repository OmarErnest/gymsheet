import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, CartesianGrid, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Plus, Trash2, Edit2, RefreshCw, Activity, Map as MapIcon, PlusCircle, Target, List, BarChart3, Radar as RadarIcon, GripVertical, Timer, Weight, Zap, ChevronDown } from 'lucide-react';
import { api } from '../api/client.js';
import LinkInput from '../components/LinkInput.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { t } from '../i18n.js';

// DND Kit
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const categories = ['shoulder', 'legs', 'chest', 'back', 'arms', 'calisthenics', 'other'];
const bodyParts = ['biceps', 'forearms', 'chest', 'waist', 'hips', 'thigh', 'calf', 'shoulders', 'other'];
const weekdays = [
  ['Mon', 0], ['Tue', 1], ['Wed', 2], ['Thu', 3], ['Fri', 4], ['Sat', 5], ['Sun', 6],
];
const weekdayNamesLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getGoalDayName(goal) {
  if (goal.repeat_type === 'once') {
    const d = new Date(goal.start_date + 'T12:00:00');
    return weekdayNamesLong[(d.getDay() + 6) % 7];
  }
  if (goal.weekdays && goal.weekdays.length > 0) {
    return goal.weekdays.map(d => weekdayNamesLong[d]).join(', ');
  }
  return 'No Day';
}

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
              {goal.repeat_type === 'weekly' ? t(lang, 'weekly') : t(lang, 'oneDayOnly')} - {getGoalDayName(goal)} ({goal.start_date})
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

function MultiSelect({ label, options, selected, onToggle, onToggleAll, lang, allLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const allSelected = options.length > 0 && selected.length === options.length;
  
  const displayLabel = useMemo(() => {
    if (selected.length === 0) return t(lang, 'none');
    if (allSelected) return allLabel || t(lang, 'all');
    if (selected.length === 1) {
      const item = options.find(o => String(o.id || o) === String(selected[0]));
      return item ? t(lang, item.name || item) : selected[0];
    }
    return `${selected.length} Selected`;
  }, [selected, options, lang, allLabel, allSelected]);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <button 
        type="button"
        className="input-bubble" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '42px', fontSize: '0.85rem', padding: '0 1rem' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <ChevronDown size={14} style={{ opacity: 0.5 }} />
      </button>
      
      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsOpen(false)} />
          <div className="glass-card" style={{ 
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, 
            marginTop: '0.5rem', maxHeight: '250px', overflowY: 'auto',
            padding: '0.5rem', border: '1px solid var(--line)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            background: 'var(--bg-soft)'
          }}>
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <label style={{ 
                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem', 
                borderRadius: '8px', cursor: 'pointer', background: 'transparent',
                transition: 'all 0.2s'
              }}>
                <input 
                  type="checkbox" 
                  checked={allSelected} 
                  onChange={() => onToggleAll(!allSelected)}
                  style={{ accentColor: 'var(--brand)' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>Select All</span>
              </label>
              <div style={{ height: '1px', background: 'var(--line)', margin: '0.2rem 0' }} />
              {options.map((opt) => {
                const id = String(opt.id || opt);
                const isSel = selected.includes(id);
                return (
                  <label key={id} style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem', 
                    borderRadius: '8px', cursor: 'pointer', background: isSel ? 'rgba(var(--brand-rgb), 0.1)' : 'transparent',
                    transition: 'all 0.2s'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={isSel} 
                      onChange={() => onToggle(id)}
                      style={{ accentColor: 'var(--brand)' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: isSel ? '900' : '500' }}>{t(lang, opt.name || opt)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
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
  
  const [selectedCategories, setSelectedCategories] = useState(categories.filter(c => c !== 'other' && c !== 'calisthenics'));
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // all, year, 90, 30, 7

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

  useEffect(() => {
    const handleSubTab = (e) => setActiveTab(e.detail);
    window.addEventListener('change-profile-tab', handleSubTab);
    return () => window.removeEventListener('change-profile-tab', handleSubTab);
  }, []);

  const filteredExercises = useMemo(() => {
    return selectedCategories.length > 0 
      ? exercises.filter((ex) => selectedCategories.includes(ex.category)) 
      : exercises;
  }, [selectedCategories, exercises]);

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
    setSelectedExercises([]); 
  };

  const toggleAllCategories = (selectAll) => {
    setSelectedCategories(selectAll ? categories : []);
    setSelectedExercises([]);
  };

  const toggleExercise = (exId) => {
    const idStr = String(exId);
    setSelectedExercises(prev => 
      prev.includes(idStr) ? prev.filter(e => e !== idStr) : [...prev, idStr]
    );
  };

  const toggleAllExercises = (selectAll) => {
    setSelectedExercises(selectAll ? filteredExercises.map(ex => String(ex.id)) : []);
  };

  const chartData = useMemo(() => {
    const now = new Date();
    const filtered = logs.filter((log) => {
      const matchesCat = selectedCategories.length === 0 || selectedCategories.includes(log.exercise_detail?.category);
      const matchesEx = selectedExercises.length === 0 || selectedExercises.includes(String(log.exercise));
      if (!matchesCat || !matchesEx) return false;

      if (selectedPeriod === 'all') return true;
      const logDate = new Date(log.date);
      const diffTime = Math.abs(now - logDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (selectedPeriod === 'year') return diffDays <= 365;
      if (selectedPeriod === '90') return diffDays <= 90;
      if (selectedPeriod === '30') return diffDays <= 30;
      if (selectedPeriod === '7') return diffDays <= 7;
      return true;
    });

    const grouped = {};
    const userWeight = parseFloat(preferences?.weight_kg) || 70;
    filtered.forEach((log) => {
      const d = log.date;
      if (!grouped[d]) {
        grouped[d] = { date: d.slice(5), weight: 0, count: 0 };
      }
      let weight = Number(log.weight_kg || 0);
      if (log.exercise_detail?.is_time_based) {
        const parts = (log.duration || '0:0').split(':');
        const mins = parts.length === 2 ? (parseInt(parts[0]) + parseInt(parts[1])/60) : (parseFloat(parts[0]) || 0);
        weight = mins * (userWeight / 2);
      }
      grouped[d].weight += weight;
      grouped[d].count += 1;
    });

    return Object.values(grouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        weight: Number((item.weight / item.count).toFixed(1)),
      }));
  }, [logs, selectedExercises, selectedCategories, selectedPeriod]);

  const filteredLogsList = useMemo(() => {
    const now = new Date();
    return logs.filter((log) => {
      const matchesCat = selectedCategories.length === 0 || selectedCategories.includes(log.exercise_detail?.category);
      const matchesEx = selectedExercises.length === 0 || selectedExercises.includes(String(log.exercise));
      if (!matchesCat || !matchesEx) return false;

      if (selectedPeriod === 'all') return true;
      const logDate = new Date(log.date);
      const diffTime = Math.abs(now - logDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (selectedPeriod === 'year') return diffDays <= 365;
      if (selectedPeriod === '90') return diffDays <= 90;
      if (selectedPeriod === '30') return diffDays <= 30;
      if (selectedPeriod === '7') return diffDays <= 7;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [logs, selectedExercises, selectedCategories, selectedPeriod]);

  const pieData = useMemo(() => {
    const dataGroup = {}; // name -> { totalWeight, count }
    
    const userWeight = parseFloat(preferences?.weight_kg) || 70;
    filteredLogsList.forEach(log => {
      const name = (selectedCategories.length === 1) 
        ? t(lang, log.exercise_detail?.name) 
        : t(lang, log.exercise_detail?.category || 'other');
      
      if (!dataGroup[name]) {
        dataGroup[name] = { totalWeight: 0, count: 0 };
      }
      let weight = Number(log.weight_kg || 0);
      if (log.exercise_detail?.is_time_based) {
        const parts = (log.duration || '0:0').split(':');
        const mins = parts.length === 2 ? (parseInt(parts[0]) + parseInt(parts[1])/60) : (parseFloat(parts[0]) || 0);
        weight = mins * (userWeight / 2);
      }
      dataGroup[name].totalWeight += weight;
      dataGroup[name].count += 1;
    });

    return Object.entries(dataGroup).map(([name, stats]) => ({
      name,
      value: Number((stats.totalWeight / stats.count).toFixed(1)) || 0
    })).sort((a, b) => b.value - a.value).slice(0, 8); // Limit to top 8 for readability
  }, [filteredLogsList, lang, selectedCategories]);

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
      <img src="/icon.png" className="loading-logo-spin" alt="" />
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
        <article className="glass-card profile-section" style={{ padding: '1.2rem 0.8rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <p className="eyebrow">{t(lang, 'reviewProgress')}</p>
            <h2>{t(lang, 'strengthGraph')}</h2>
            <div className="tab-pill-box" style={{ margin: '0.8rem auto 0', width: 'fit-content' }}>
              <button className={`tab-pill ${graphMode === 'pie' ? 'active' : ''}`} onClick={() => setGraphMode('pie')}><RadarIcon size={18} /></button>
              <button className={`tab-pill ${graphMode === 'bar' ? 'active' : ''}`} onClick={() => setGraphMode('bar')}><BarChart3 size={18} /></button>
              <button className={`tab-pill ${graphMode === 'list' ? 'active' : ''}`} onClick={() => setGraphMode('list')}><List size={18} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem' }}>
            <MultiSelect 
              label="Groups" 
              allLabel={t(lang, 'allGroups')}
              options={categories} 
              selected={selectedCategories} 
              onToggle={toggleCategory} 
              onToggleAll={toggleAllCategories}
              lang={lang} 
            />
            <MultiSelect 
              label="Exercises" 
              allLabel={t(lang, 'allExercises')}
              options={filteredExercises} 
              selected={selectedExercises} 
              onToggle={toggleExercise} 
              onToggleAll={toggleAllExercises}
              lang={lang} 
            />
            <select style={{ flex: 0.8, height: '42px' }} value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
              <option value="all">{t(lang, 'allTime')}</option>
              <option value="year">{t(lang, 'lastYear')}</option>
              <option value="90">90 {t(lang, 'days')}</option>
              <option value="30">30 {t(lang, 'days')}</option>
              <option value="7">{t(lang, 'last7Days')}</option>
            </select>
          </div>
          <div className="chart-box" style={{ height: '360px', marginTop: '1rem', background: 'transparent', border: 'none' }}>
            {graphMode === 'bar' && (chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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
                    minTickGap={20}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--muted)', fontSize: 10 }}
                    width={35}
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
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="muted" style={{ textAlign: 'center', paddingTop: '4rem' }}>{t(lang, 'noLogs')}</p>)}
            {graphMode === 'pie' && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={pieData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis 
                    dataKey="name" 
                    tick={{ fill: 'var(--text)', fontSize: 10, fontWeight: '700' }} 
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 'auto']} 
                    tick={false} 
                    axisLine={false} 
                  />
                  <Radar
                    name="Volume"
                    dataKey="value"
                    stroke="var(--brand)"
                    fill="var(--brand)"
                    fillOpacity={0.5}
                    animationDuration={1500}
                  />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-soft)', borderRadius: '12px', border: '1px solid var(--line)', color: 'var(--text)' }}
                  />
                </RadarChart>
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
                {(() => {
                  let lastDayLabel = '';
                  return goals.map((g) => {
                    const currentDayLabel = getGoalDayName(g).split(',')[0]; // Use first day for grouping
                    const showSeparator = currentDayLabel !== lastDayLabel;
                    lastDayLabel = currentDayLabel;
                    
                    return (
                      <div key={g.id}>
                        {showSeparator && (
                          <div className="day-separator" style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0 0.8rem', opacity: 0.6 }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{currentDayLabel}</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
                          </div>
                        )}
                        <SortableGoalItem goal={g} lang={lang} onEdit={(goal) => { setGoalForm({ ...goal, goal_exercises: goal.goal_exercises.map(ge => ({ categoryFilter: ge.exercise_detail?.category || '', exercise: ge.exercise, sets: ge.sets, reps: ge.reps })) }); setActiveTab('creategoal'); }} onDelete={deleteGoal} />
                      </div>
                    );
                  });
                })()}
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
            <div className="goal-builder" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem', opacity: 0.7 }}>Exercises ({goalForm.goal_exercises.length}/10)</strong>
              </div>
              
              <button 
                className="dotted-btn" 
                type="button" 
                onClick={addGoalExercise} 
                disabled={goalForm.goal_exercises.length >= 10}
                style={{ 
                  width: '100%', 
                  marginBottom: '1.5rem', 
                  padding: '1.2rem', 
                  border: '2px dashed var(--line)', 
                  borderRadius: '16px', 
                  background: 'rgba(255,255,255,0.02)',
                  color: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Plus size={20} />
                <span style={{ fontWeight: '900', fontSize: '1rem', letterSpacing: '0.5px' }}>{t(lang, 'addExercise')}</span>
              </button>
              {goalForm.goal_exercises.map((item, index) => {
                const availableExercises = item.categoryFilter ? exercises.filter(ex => ex.category === item.categoryFilter) : exercises;
                return (
                  <div className="goal-exercise-row glass-card" key={index} style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <div className="goal-exercise-selectors">
                      <select value={item.categoryFilter} onChange={(e) => updateGoalExercise(index, 'categoryFilter', e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{t(lang, c)}</option>)}</select>
                      <select required value={item.exercise} onChange={(e) => updateGoalExercise(index, 'exercise', e.target.value)} style={{ textOverflow: 'ellipsis' }}><option value="" disabled>Pick Exercise</option>{availableExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</select>
                    </div>
                    <div className="goal-exercise-inputs">
                      <input type="number" placeholder={t(lang, 'sets')} value={item.sets} onFocus={(e) => e.target.select()} onChange={(e) => updateGoalExercise(index, 'sets', e.target.value)} className="input-bubble" style={{ width: '100%', textAlign: 'center' }} />
                      <input type="number" placeholder={t(lang, 'reps')} value={item.reps} onFocus={(e) => e.target.select()} onChange={(e) => updateGoalExercise(index, 'reps', e.target.value)} className="input-bubble" style={{ width: '100%', textAlign: 'center' }} />
                      <button className="small-btn danger-btn" type="button" onClick={() => removeGoalExercise(index)} style={{ minWidth: '46px' }}><Trash2 size={16} /></button>
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
          <div className="body-map">
            <img src={showFrontBody ? "/front_body.png" : "/back_body.png"} style={{ width: '100%', opacity: 0.8 }} />
            {(showFrontBody ? frontDots : backDots).map(dot => {
              const latest = measurements
                .filter(m => m.body_part === dot.part)
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

              return (
                <button 
                  key={dot.part} 
                  className={`body-point ${selectedDot === dot.part ? 'active' : ''}`} 
                  style={{ top: dot.top, left: dot.left, position: 'absolute' }} 
                  onClick={() => { 
                    setSelectedDot(dot.part); 
                    setMeasurementForm(p => ({ 
                      ...p, 
                      body_part: dot.part,
                      value_cm: latest ? latest.value_cm : ''
                    })); 
                  }}
                >
                  <div className="body-dot" />
                  {selectedDot === dot.part && (
                    <div className={`body-popup ${parseFloat(dot.left) > 50 ? 'on-left' : ''}`}>
                      <h4 style={{ textTransform: 'capitalize' }}>{t(lang, dot.part)}</h4>
                      {latest ? (
                        <p>{latest.value_cm}cm <br/><small className="muted">{latest.date}</small></p>
                      ) : (
                        <p className="muted" style={{ fontSize: '0.7rem' }}>No data</p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
            <button className="small-btn" onClick={() => setShowFrontBody(!showFrontBody)} style={{ position: 'absolute', bottom: '1rem', right: '1rem' }}><RefreshCw size={20} /></button>
          </div>
          <form onSubmit={createMeasurement} className="form-stack" style={{ marginTop: '1rem' }}>
            <label className="field">
              <span>{t(lang, 'bodyPart')}</span>
              <select value={measurementForm.body_part} onChange={(e) => setMeasurementForm({ ...measurementForm, body_part: e.target.value })}>{bodyParts.map(p => <option key={p} value={p}>{t(lang, p)}</option>)}</select>
            </label>
            <label className="field">
              <span>{t(lang, 'valueCm')}</span>
              <input type="number" step="0.1" placeholder="cm" value={measurementForm.value_cm} onFocus={(e) => e.target.select()} onChange={(e) => setMeasurementForm({ ...measurementForm, value_cm: e.target.value })} required />
            </label>
            <label className="field">
              <span>{t(lang, 'date')}</span>
              <input type="date" value={measurementForm.date} onChange={(e) => setMeasurementForm({ ...measurementForm, date: e.target.value })} required />
            </label>
            <button className="primary-btn">{t(lang, 'saveMeasure')}</button>
          </form>
        </article>
      )}
    </section>
  );
}
