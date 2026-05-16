import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, CartesianGrid, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Plus, Trash2, Edit2, RefreshCw, Activity, Map as MapIcon, PlusCircle, Target, List, BarChart3, Radar as RadarIcon, GripVertical, Timer, Weight, Dumbbell, ChevronDown, Zap, Trophy, Medal, Menu, Settings, Flame, Maximize2, Minimize2, TrendingUp, CircleDot, LayoutGrid } from 'lucide-react';
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

const emptyGoalExercise = () => ({ categoryFilter: '', exercise: '', sets: 4, reps: 10, superset_id: null, is_pr_set: false });

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

const ActivityMap = ({ logs, lang }) => {
  const today = new Date();
  const days = [];
  const safeLogs = Array.isArray(logs) ? logs : [];
  // 6 months = ~26 weeks
  for (let i = 181; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = safeLogs.filter(l => l && l.date === dateStr);
    days.push({ date: dateStr, count: dayLogs.length });
  }

  const getColor = (count) => {
    if (count === 0) return 'rgba(255,255,255,0.05)';
    if (count === 1) return 'rgba(34, 197, 94, 0.2)';
    if (count >= 2 && count <= 6) return 'rgba(34, 197, 94, 0.45)';
    if (count >= 7 && count <= 10) return 'rgba(34, 197, 94, 0.85)';
    return 'rgba(34, 197, 94, 1)';
  };

  return (
    <div className="activity-map glass-card" style={{ padding: '0.8rem', marginTop: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', marginLeft: '0.2rem' }}>
        <div style={{
          width: '14px', height: '14px', border: '1px solid #10b981', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '900', color: '#10b981', fontFamily: "'Ma Shan Zheng', cursive"
        }}>勤</div>
        <span className="pixel-text" style={{ fontSize: '0.6rem', fontWeight: '900', color: '#10b981', letterSpacing: '1px' }}>ACTIVITY MAP</span>
      </div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(26, 1fr)', 
        gridTemplateRows: 'repeat(7, 1fr)', 
        gridAutoFlow: 'column',
        gap: '4px',
        height: '80px'
      }}>
        {days.map(d => (
          <div 
            key={d.date} 
            title={`${d.date}: ${d.count} exercises`}
            style={{ 
              background: getColor(d.count), 
              borderRadius: '2px',
              border: d.count > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none'
            }} 
          />
        ))}
      </div>
    </div>
  );
};

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

function MultiSelect({ label, options, selected, onToggle, onToggleAll, lang, allLabel, align = 'left' }) {
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
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '52px',
          fontSize: '0.95rem',
          padding: '0 1.2rem',
          borderRadius: '14px',
          border: '1px solid var(--line)',
          background: 'var(--bg-soft)',
          color: 'var(--text)',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <ChevronDown size={18} style={{ opacity: 0.5 }} />
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsOpen(false)} />
          <div className="glass-card" style={{
            position: 'absolute',
            top: '100%',
            [align]: '0',
            zIndex: 100,
            marginTop: '0.5rem',
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '0.5rem',
            border: '1px solid var(--line)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            background: 'var(--bg-strong)',
            minWidth: '220px',
            width: 'calc(200% + 0.6rem)',
            maxWidth: '85vw'
          }}>
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem',
                borderRadius: '10px', cursor: 'pointer', background: 'transparent',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll(!allSelected)}
                  style={{ accentColor: 'var(--brand)', width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '1rem', fontWeight: '900' }}>Select All</span>
              </label>
              <div style={{ height: '1px', background: 'var(--line)', margin: '0.4rem 0' }} />
              {options.map((opt) => {
                const id = String(opt.id || opt);
                const isSel = selected.includes(id);
                return (
                  <label key={id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem',
                    borderRadius: '10px', cursor: 'pointer', background: isSel ? 'rgba(var(--brand-rgb), 0.1)' : 'transparent',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => onToggle(id)}
                      style={{ accentColor: 'var(--brand)', width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '1rem', fontWeight: '600', color: isSel ? 'var(--brand)' : 'var(--text)' }}>
                      {t(lang, opt.name || opt)}
                    </span>
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

function CustomSingleSelect({ value, options, onChange, lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => String(o.id) === String(value)) || options[0];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '52px',
          fontSize: '0.95rem',
          padding: '0 1.2rem',
          borderRadius: '14px',
          border: '1px solid var(--line)',
          background: 'var(--bg-soft)',
          color: 'var(--text)',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <span style={{ fontWeight: '900' }}>{selectedOption.name}</span>
        <ChevronDown size={18} style={{ opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsOpen(false)} />
          <div className="glass-card animate-pop" style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 1000,
            marginTop: '0.5rem',
            padding: '0.4rem',
            border: '1px solid var(--brand)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            background: 'var(--bg-strong)',
            minWidth: '100%',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px'
          }}>
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  background: String(opt.id) === String(value) ? 'rgba(var(--brand-rgb), 0.15)' : 'transparent',
                  color: String(opt.id) === String(value) ? 'var(--brand)' : 'var(--text)',
                  border: 'none',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Profile({ preferences, lang }) {
  const { user } = useAuth();
  const isDummy = user?.email === 'dummy@gym.sheet';
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loadedData, setLoadedData] = useState({
    exercises: false,
    logs: false,
    measurements: false,
    goals: false,
    badges: false
  });

  const [userBadges, setUserBadges] = useState([]);

  const [selectedCategories, setSelectedCategories] = useState(() => {
    const saved = localStorage.getItem('selectedCategories');
    return saved ? JSON.parse(saved) : categories.filter(c => c !== 'other' && c !== 'calisthenics');
  });
  const [selectedExercises, setSelectedExercises] = useState(() => {
    const saved = localStorage.getItem('selectedExercises');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return localStorage.getItem('selectedPeriod') || 'all';
  });

  const [activeTab, setActiveTab] = useState('strength');
  const [graphMode, setGraphMode] = useState('pie');
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({ id: null, name: '', youtube_url: '', category: '', exercise_type: 'machine', is_public: false, is_time_based: false });
  const [editingExercise, setEditingExercise] = useState(null);
  const [measurementForm, setMeasurementForm] = useState({
    body_part: 'biceps', value_cm: '', date: new Date().toISOString().slice(0, 10), notes: ''
  });
  const [showWarriorStats, setShowWarriorStats] = useState(false);
  const [showFrontBody, setShowFrontBody] = useState(true);
  const [selectedDot, setSelectedDot] = useState(null);

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


  const highestWeeklyPower = useMemo(() => {
    if (!logs || logs.length === 0) return 0;

    const weeklyLogs = {};

    // Group logs by week and date
    logs.forEach(log => {
      const [year, month, day] = log.date.split('-').map(Number);
      const d = new Date(year, month - 1, day, 12, 0, 0);

      const dayOfWeek = d.getDay();
      const diff = d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      const monday = new Date(d);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      const mondayStr = monday.toISOString().split('T')[0];

      if (!weeklyLogs[mondayStr]) weeklyLogs[mondayStr] = {};
      if (!weeklyLogs[mondayStr][log.date]) weeklyLogs[mondayStr][log.date] = [];
      weeklyLogs[mondayStr][log.date].push(log);
    });

    const weeklyScores = Object.keys(weeklyLogs).map(mondayStr => {
      const daysInWeek = weeklyLogs[mondayStr];
      let score = 0;

      const userWeight = parseFloat(preferences?.weight_kg) || 70;

      Object.keys(daysInWeek).forEach(dateStr => {
        const dayLogs = daysInWeek[dateStr];
        // QUALIFIED DAY RULE: Must have at least 2 logs to count toward weekly score
        if (dayLogs.length >= 2) {
          dayLogs.forEach(log => {
            let logEffort = Number(log.weight_kg || 0);
            if (log.exercise_detail?.exercise_type === 'calisthenics') logEffort += (userWeight * 0.5);

            // Match backend leaderboard.py: no time-based special multiplier
            score += logEffort * (Number(log.sets) || 0) * (Number(log.reps) || 0);
          });
        }
      });
      return Math.floor(score);
    });

    return weeklyScores.length > 0 ? Math.max(...weeklyScores) : 0;
  }, [logs]);

  const activeDaysThisWeek = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const logsByDate = {};
    logs.forEach(log => {
      const d = new Date(log.date + 'T12:00:00');
      if (d >= monday) {
        if (!logsByDate[log.date]) logsByDate[log.date] = [];
        logsByDate[log.date].push(log);
      }
    });

    // Count qualified days (>= 2 logs) to match leaderboard logic
    return Object.values(logsByDate).filter(dayLogs => dayLogs.length >= 2).length;
  }, [logs]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function fetchExercises() {
    try {
      const exRes = await api('/exercises/');
      const list = exRes.results || exRes;
      setExercises(list.sort((a, b) => (t(lang, a.name) || '').localeCompare(t(lang, b.name) || '')));
      setLoadedData(prev => ({ ...prev, exercises: true }));
    } catch (err) { }
  }

  async function fetchLogs() {
    if (loadedData.logs) return;
    const data = await api('/exercise-logs/');
    setLogs(data.results || data);
    setLoadedData(prev => ({ ...prev, logs: true }));
  }

  async function fetchMeasurements() {
    if (loadedData.measurements) return;
    const data = await api('/body-measurements/');
    setMeasurements(data.results || data);
    setLoadedData(prev => ({ ...prev, measurements: true }));
  }

  async function fetchGoals() {
    if (loadedData.goals) return;
    const data = await api('/goal-plans/');
    setGoals(data.results || data);
    setLoadedData(prev => ({ ...prev, goals: true }));
  }

  async function fetchBadges() {
    if (loadedData.badges) return;
    try {
      const data = await api('/badges/my/');
      setUserBadges(data.results || data);
      setLoadedData(prev => ({ ...prev, badges: true }));
    } catch (err) { }
  }

  useEffect(() => {
    async function loadTab() {
      const needsExercises = (activeTab === 'strength' || activeTab === 'goals' || activeTab === 'creategoal' || activeTab === 'addexercise') && !loadedData.exercises;
      const needsLogs = (activeTab === 'strength' || showWarriorStats) && !loadedData.logs;
      const needsGoals = (activeTab === 'goals' || activeTab === 'creategoal') && !loadedData.goals;
      const needsMeasurements = (activeTab === 'bodymap') && !loadedData.measurements;
      const needsBadges = showWarriorStats && !loadedData.badges;

      if (needsExercises || needsLogs || needsGoals || needsMeasurements || needsBadges) {
        setLoading(true);
        try {
          if (activeTab === 'strength') {
            await Promise.all([fetchExercises(), fetchLogs()]);
          } else if (activeTab === 'goals' || activeTab === 'creategoal') {
            await Promise.all([fetchExercises(), fetchGoals()]);
          } else if (activeTab === 'bodymap') {
            await fetchMeasurements();
          } else if (activeTab === 'addexercise') {
            await fetchExercises();
          }
          
          if (showWarriorStats) {
            await Promise.all([fetchLogs(), fetchBadges()]);
          }
        } catch (err) { }
        setLoading(false);
      }
    }
    loadTab();
  }, [activeTab, showWarriorStats]);

  useEffect(() => {
    const handleSubTab = (e) => setActiveTab(e.detail);
    const handleStats = () => setShowWarriorStats(true);
    window.addEventListener('change-profile-tab', handleSubTab);
    window.addEventListener('open-fighter-stats', handleStats);
    return () => {
      window.removeEventListener('change-profile-tab', handleSubTab);
      window.removeEventListener('open-fighter-stats', handleStats);
    };
  }, []);

  useEffect(() => {
    const handleBack = () => {
      if (isChartExpanded) setIsChartExpanded(false);
      else if (showWarriorStats) setShowWarriorStats(false);
    };
    window.addEventListener('app-back-button', handleBack);
    return () => window.removeEventListener('app-back-button', handleBack);
  }, [isChartExpanded, showWarriorStats]);

  useEffect(() => {
    localStorage.setItem('selectedCategories', JSON.stringify(selectedCategories));
    localStorage.setItem('selectedExercises', JSON.stringify(selectedExercises));
    localStorage.setItem('selectedPeriod', selectedPeriod);
    localStorage.setItem('graphMode', graphMode);
  }, [selectedCategories, selectedExercises, selectedPeriod, graphMode]);

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
      if (log.is_pr_set) return false;
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
      if (log.exercise_detail?.exercise_type === 'calisthenics') {
        weight += 2;
      }
      if (log.exercise_detail?.is_time_based) {
        const parts = (log.duration || '0:0').split(':');
        const mins = parts.length === 2 ? (parseInt(parts[0]) + parseInt(parts[1]) / 60) : (parseFloat(parts[0]) || 0);
        weight = mins * (userWeight / 2) + (log.exercise_detail?.exercise_type === 'calisthenics' ? 2 : 0);
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
      if (log.is_pr_set) return false;
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
      if (log.exercise_detail?.exercise_type === 'calisthenics') {
        weight += userWeight * 0.7;
      }
      if (log.exercise_detail?.is_time_based) {
        const parts = (log.duration || '0:0').split(':');
        const mins = parts.length === 2 ? (parseInt(parts[0]) + parseInt(parts[1]) / 60) : (parseFloat(parts[0]) || 0);
        weight = mins * (userWeight / 2) + (log.exercise_detail?.exercise_type === 'calisthenics' ? 2 : 0);
      }
      dataGroup[name].totalWeight += weight;
      dataGroup[name].count += 1;
    });

    const entries = Object.entries(dataGroup).map(([name, stats]) => ({
      name,
      value: Number((stats.totalWeight / stats.count).toFixed(1)) || 0
    })).sort((a, b) => b.value - a.value).slice(0, 8);

    if (entries.length === 0) {
      // Ghost data to show the chart even if empty
      return ['Strength', 'Endurance', 'Flexibility', 'Balance', 'Speed'].map(n => ({ name: n, value: 0 }));
    }
    return entries;
  }, [filteredLogsList, lang, selectedCategories]);

  async function handleCreateExercise(e) {
    e.preventDefault();
    if (isDummy) {
      setMessage(lang === 'es' ? 'Acción restringida para cuenta demo' : 'Action restricted for demo account');
      return;
    }
    setMessage('');

    const isUpdate = !!exerciseForm.id;
    const method = isUpdate ? 'PATCH' : 'POST';
    const endpoint = isUpdate ? `/exercises/${exerciseForm.id}/` : '/exercises/';

    try {
      await api(endpoint, {
        method,
        body: JSON.stringify(exerciseForm),
      });
      setExerciseForm({ id: null, name: '', youtube_url: '', category: '', exercise_type: 'machine', is_public: false, is_time_based: false });
      setEditingExercise(null);
      await fetchExercises();
      setMessage(isUpdate ? "Exercise updated!" : t(lang, 'exerciseCreated'));
    } catch (err) {
      setMessage(err.message);
    }
  }

  const handleEditExercise = (ex) => {
    setExerciseForm({
      id: ex.id,
      name: ex.name,
      youtube_url: ex.youtube_url || '',
      category: ex.category,
      exercise_type: ex.exercise_type,
      is_public: ex.is_public,
      is_time_based: ex.is_time_based
    });
    setEditingExercise(ex.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExercise = async (id) => {
    if (!window.confirm(lang === 'es' ? '¿Estás seguro de que quieres eliminar este ejercicio?' : 'Are you sure you want to delete this exercise?')) return;
    try {
      await api(`/exercises/${id}/`, { method: 'DELETE' });
      await fetchExercises();
    } catch (err) {
      setMessage(err.message);
    }
  };

  async function addMeasurement(e) {
    if (e) e.preventDefault();
    if (isDummy) {
      setMessage(lang === 'es' ? 'Acción restringida para cuenta demo' : 'Action restricted for demo account');
      return;
    }
    setMessage('');
    try {
      await api('/body-measurements/', { method: 'POST', body: JSON.stringify(measurementForm) });
      setMeasurementForm((prev) => ({ ...prev, value_cm: '', notes: '' }));
      setMessage(t(lang, 'measurementSaved'));
      await fetchMeasurements();
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
    setGoalForm((prev) => {
      const newExs = [...prev.goal_exercises];
      let val = value;
      if (field === 'exercise') {
        const fullEx = exercises.find(ex => String(ex.id) === String(value));
        if (fullEx && fullEx.exercise_type === 'pr') {
          newExs[index].is_pr_set = true;
          newExs[index].sets = 1;
          newExs[index].reps = 1;
        }
      }
      if (field === 'sets' || field === 'reps') {
        if (newExs[index].is_pr_set) {
          val = Math.min(2, Math.max(1, parseInt(value) || 1));
        }
      }
      newExs[index] = { ...newExs[index], [field]: val };
      return { ...prev, goal_exercises: newExs };
    });
  }

  function toggleSuperset(index) {
    setGoalForm((prev) => {
      const newExs = [...prev.goal_exercises];
      const current = newExs[index];
      const next = newExs[index + 1];
      if (!next) return prev;

      if (current.superset_id && current.superset_id === next.superset_id) {
        // Break link
        newExs[index] = { ...current, superset_id: null };
        newExs[index + 1] = { ...next, superset_id: null };
      } else {
        // Create link
        const sid = `ss-${Date.now()}`;
        newExs[index] = { ...current, superset_id: sid };
        newExs[index + 1] = { ...next, superset_id: sid };
      }
      return { ...prev, goal_exercises: newExs };
    });
  }

  function togglePR(index) {
    setGoalForm((prev) => {
      const newExs = [...prev.goal_exercises];
      const isPR = !newExs[index].is_pr_set;
      newExs[index] = { 
        ...newExs[index], 
        is_pr_set: isPR,
        sets: isPR ? 1 : newExs[index].sets,
        reps: isPR ? 1 : newExs[index].reps
      };
      return { ...prev, goal_exercises: newExs };
    });
  }

  function addGoalExercise() {
    setGoalForm((prev) => {
      if (prev.goal_exercises.length >= 10) return prev;
      return { ...prev, goal_exercises: [...prev.goal_exercises, emptyGoalExercise()] };
    });
  }

  function removeGoalExercise(index) {
    setGoalForm((prev) => {
      const newExs = prev.goal_exercises.filter((_, idx) => idx !== index);
      return { ...prev, goal_exercises: newExs.length === 0 ? [emptyGoalExercise()] : newExs };
    });
  }

  async function saveGoal(e) {
    if (e) e.preventDefault();
    if (isDummy) {
      setMessage(lang === 'es' ? 'Acción restringida para cuenta demo' : 'Action restricted for demo account');
      return;
    }
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
      await fetchGoals();
      setMessage(t(lang, 'settingsSaved'));
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function deleteGoal(id) {
    if (!confirm("Are you sure?")) return;
    if (isDummy) {
      setMessage(lang === 'es' ? 'Acción restringida para cuenta demo' : 'Action restricted for demo account');
      return;
    }
    try {
      await api(`/goal-plans/${id}/`, { method: 'DELETE' });
      await fetchGoals();
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
    <section className="stack profile-page animate-fade-in" style={{ paddingBottom: '6rem' }}>
      {message && <p className="notice">{message}</p>}
      <div className="stats-expander" style={{ marginBottom: showWarriorStats ? '0.8rem' : '-0.9rem', transition: 'margin 0.3s ease' }}>
        <button
          onClick={() => setShowWarriorStats(!showWarriorStats)}
          style={{
            width: 'fit-content',
            margin: '0 auto',
            padding: '0.2rem 1rem',
            background: 'none',
            border: 'none',
            color: showWarriorStats ? 'var(--brand)' : 'var(--muted)',
            fontSize: '0.65rem',
            fontWeight: '1000',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            opacity: 0.8
          }}
        >
          {showWarriorStats ? (lang === 'es' ? 'Ocultar Estadísticas' : 'Hide Stats') : (lang === 'es' ? 'Ver Estadísticas' : 'View Fighter Stats')}
          {showWarriorStats ? <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /> : <ChevronDown size={14} />}
        </button>

        {showWarriorStats && (
          <div className="profile-stats-grid animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '0.8rem' }}>
            <div className="glass-card stat-card" style={{ padding: '0.8rem', textAlign: 'center' }}>
              <div style={{ position: 'relative', width: '30px', height: '30px', margin: '0 auto 0.4rem' }}>
                <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <path d="M50 8 L92 82 L8 82 Z" fill="none" stroke="#f59e0b" strokeWidth="8" strokeLinejoin="round" />
                </svg>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: '5px',
                  fontSize: '14px',
                  fontWeight: '900',
                  color: '#f59e0b',
                  fontFamily: "'Ma Shan Zheng', cursive",
                }}>
                  敵
                </div>
              </div>
              <h3 className="pixel-text" style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#f59e0b' }}>{logs.filter(l => !l.is_pr_set).length}</h3>
              <p className="muted pixel-text" style={{ margin: 0, fontSize: '0.5rem', fontWeight: '800', textTransform: 'uppercase' }}>
                {lang === 'es' ? 'Oponentes' : 'Opponents'}
              </p>
            </div>
            <div className="glass-card stat-card" style={{ padding: '0.8rem', textAlign: 'center', border: '1px solid rgba(var(--brand-rgb), 0.2)' }}>
              <div style={{
                width: '28px',
                height: '28px',
                margin: '0 auto 0.4rem',
                border: '2px solid #8b5cf6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                fontWeight: '900',
                color: '#8b5cf6',
                fontFamily: "'Ma Shan Zheng', cursive",
              }}>
                覇
              </div>
              <h3 className="pixel-text" style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#8b5cf6' }}>{highestWeeklyPower.toLocaleString()}</h3>
              <p className="muted pixel-text" style={{ margin: 0, fontSize: '0.5rem', fontWeight: '800', textTransform: 'uppercase' }}>
                {lang === 'es' ? 'Poder Máximo' : 'Max Power'}
              </p>
            </div>
          </div>
        )}

        {showWarriorStats && <ActivityMap logs={logs} lang={lang} />}

        {showWarriorStats && (
          <div className="fighter-badges-section animate-fade-in" style={{ marginTop: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', marginLeft: '0.4rem' }}>
              <Trophy size={14} style={{ color: 'var(--brand)' }} />
              <span className="pixel-text" style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--brand)', letterSpacing: '1px' }}>FIGHTER BADGES</span>
            </div>
            
            <div className="glass-card" style={{ 
              padding: '0.8rem', 
              background: 'rgba(var(--brand-rgb), 0.05)',
              borderRadius: '20px',
              border: '1px solid rgba(var(--brand-rgb), 0.1)'
            }}>
              <div className="badge-scroll-row" style={{ 
                display: 'flex', 
                gap: '0.8rem', 
                overflowX: 'auto',
                padding: '0.4rem 0.2rem',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
              }}>
                <style>{`.badge-scroll-row::-webkit-scrollbar { display: none; }`}</style>
                
                {userBadges.length === 0 ? (
                  <div style={{ width: '100%', textAlign: 'center', padding: '1rem' }}>
                    <p className="muted pixel-text" style={{ fontSize: '0.5rem', margin: 0 }}>
                      {lang === 'es' ? 'Aún no has ganado ninguna medalla...' : 'No badges earned yet...'}
                    </p>
                  </div>
                ) : (
                  userBadges.map((ub) => (
                    <button
                      key={ub.id}
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('badges-earned', { detail: [ub] }));
                      }}
                      style={{
                        padding: '0',
                        background: 'transparent',
                        border: '2px solid transparent',
                        borderRadius: '50%',
                        minWidth: '56px',
                        height: '56px',
                        flexShrink: 0,
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.borderColor = 'var(--brand)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      <img 
                        src={`/icons/badges/${ub.badge_detail.icon_name}`} 
                        alt={ub.badge_detail.name} 
                        style={{ width: '85%', height: '85%', objectFit: 'contain', borderRadius: '50%' }}
                        onError={(e) => { e.target.src = '/icons/badges/default.png'; }}
                      />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="profile-tabs-container" style={{ display: 'grid', gap: 0, marginTop: 0 }}>
        <div className="profile-nav-grid" style={{ margin: 0, paddingLeft: 0, paddingRight: 0 }}>
          <button className={`nav-square ${activeTab === 'strength' ? 'active' : ''}`} onClick={() => setActiveTab('strength')}>
            <Activity />
            <span>{t(lang, 'strength')}</span>
          </button>
          <button className={`nav-square ${activeTab === 'warmup' ? 'active' : ''}`} style={{ opacity: 0.4, cursor: 'not-allowed', filter: 'grayscale(1)' }} onClick={() => {}}>
            <Flame />
            <span>{lang === 'es' ? 'Warm Up' : 'Warm Up'}</span>
          </button>
          <button className={`nav-square ${activeTab === 'bodymap' ? 'active' : ''}`} onClick={() => setActiveTab('bodymap')}>
            <MapIcon />
            <span>{t(lang, 'bodyMap')}</span>
          </button>
          <button className={`nav-square ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')}>
            <Target />
            <span>{t(lang, 'yourGoals')}</span>
          </button>
          <button className={`nav-square ${activeTab === 'creategoal' ? 'active' : ''}`} onClick={() => setActiveTab('creategoal')}>
            <Plus />
            <span>{t(lang, 'createGoal')}</span>
          </button>
          <button className={`nav-square ${activeTab === 'addexercise' ? 'active' : ''}`} onClick={() => setActiveTab('addexercise')}>
            <PlusCircle />
            <span>{t(lang, 'addEx')}</span>
          </button>
          <button className={`nav-square ${activeTab === 'menu' ? 'active' : ''}`} style={{ opacity: 0.4, cursor: 'not-allowed', filter: 'grayscale(1)' }} onClick={() => {}}>
            <Menu />
            <span>{lang === 'es' ? 'Menú' : 'Menu'}</span>
          </button>
        </div>

        {activeTab === 'strength' && (
          <article className="glass-card profile-section" style={{ padding: '0.8rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <div className="segmented ghost" style={{ flex: 1, minWidth: '220px', margin: '0.8rem auto 0', width: 'fit-content', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <button className={graphMode === 'pie' ? 'active' : ''} onClick={() => setGraphMode('pie')}><Target size={18} /></button>
                <button className={graphMode === 'area' ? 'active' : ''} onClick={() => setGraphMode('area')}><TrendingUp size={18} /></button>
                <button className={graphMode === 'scatter' ? 'active' : ''} onClick={() => setGraphMode('scatter')}><CircleDot size={18} /></button>
                <button className={graphMode === 'list' ? 'active' : ''} onClick={() => setGraphMode('list')}><List size={18} /></button>
              </div>
            </div>
            
            <div className="strength-filters" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', margin: '0 -0.4rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: 0, padding: '0 0.4rem' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: '1000', color: 'var(--muted)', marginLeft: '0.5rem', letterSpacing: '1px' }}>GROUPS</span>
                  <MultiSelect
                    label="Groups"
                    align="left"
                    allLabel={t(lang, 'allGroups')}
                    options={categories}
                    selected={selectedCategories}
                    onToggle={toggleCategory}
                    onToggleAll={toggleAllCategories}
                    lang={lang}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: 0, padding: '0 0.4rem' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: '1000', color: 'var(--muted)', marginLeft: '0.5rem', letterSpacing: '1px' }}>EXERCISES</span>
                  <MultiSelect
                    label="Exercises"
                    align="right"
                    allLabel={t(lang, 'allExercises')}
                    options={filteredExercises}
                    selected={selectedExercises}
                    onToggle={toggleExercise}
                    onToggleAll={toggleAllExercises}
                    lang={lang}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: '1000', color: 'var(--muted)', marginLeft: '0.5rem', letterSpacing: '1px' }}>PERIOD</span>
                <CustomSingleSelect
                  value={selectedPeriod}
                  options={[
                    { id: '7', name: '7 Days' },
                    { id: '30', name: '30 Days' },
                    { id: '90', name: '90 Days' },
                    { id: 'year', name: '1 Year' },
                    { id: 'all', name: 'All Time' }
                  ]}
                  onChange={setSelectedPeriod}
                />
              </div>
            </div>

            <div className={`chart-box ${isChartExpanded ? 'expanded' : ''}`} style={isChartExpanded ? {
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.95)',
              backdropFilter: 'blur(10px)',
              padding: '4rem 1.5rem 1.5rem',
              height: '100vh',
              marginTop: 0,
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.3s ease'
            } : {
              height: '360px',
              minHeight: '360px',
              marginTop: '1rem',
              background: 'var(--bg-soft)',
              border: '1px solid var(--line)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              overflow: 'hidden'
            }}>
              
              <button 
                onClick={() => setIsChartExpanded(!isChartExpanded)}
                style={{
                  position: 'absolute',
                  top: isChartExpanded ? '1.5rem' : '0.5rem',
                  right: isChartExpanded ? '1.5rem' : '0.5rem',
                  zIndex: 10,
                  background: isChartExpanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: 'var(--text)',
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                {isChartExpanded ? <Minimize2 size={24} /> : <Maximize2 size={16} />}
              </button>

              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {chartData.length === 0 && graphMode !== 'list' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.9rem', fontWeight: '800' }}>
                    {t(lang, 'noLogs')}
                  </div>
                ) : null}
                
                {graphMode === 'pie' && chartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="65%" data={pieData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <PolarGrid stroke="var(--line)" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text)', fontSize: 10, fontWeight: '700' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                      <Radar name="Volume" dataKey="value" stroke="var(--brand)" fill="var(--brand)" fillOpacity={0.5} animationDuration={1500} />
                      <Tooltip contentStyle={{ background: 'var(--bg-soft)', borderRadius: '12px', border: '1px solid var(--line)', color: 'var(--text)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}

                {graphMode === 'area' && chartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: 'var(--bg-soft)', borderRadius: '12px', border: '1px solid var(--line)' }} />
                      <Area type="monotone" dataKey="weight" stroke="var(--brand)" fill="url(#colorArea)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {graphMode === 'scatter' && chartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                      <XAxis type="category" dataKey="date" name="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                      <YAxis type="number" dataKey="weight" name="weight" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                      <ZAxis type="number" dataKey="count" range={[50, 400]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3', stroke: 'var(--brand)', strokeWidth: 1 }} contentStyle={{ background: 'var(--bg-soft)', borderRadius: '12px', border: '1px solid var(--line)' }} />
                      <Scatter name="Workouts" data={chartData} fill="var(--brand)">
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="var(--brand)" />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                )}

                {graphMode === 'list' && (
                  <div className="exercise-list" style={{ overflowY: 'auto', height: '100%', padding: '0.5rem' }}>
                    {filteredLogsList.map((log) => (
                      <div key={log.id} className="exercise-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <div className="text-brand">
                            {log.exercise_detail?.exercise_type === 'calisthenics' ? <Activity size={18} /> : <Dumbbell size={18} />}
                          </div>
                          <div>
                            <strong>{log.exercise_detail?.name}</strong>
                            <p>
                              {log.date} — {log.sets}x{String(log.reps).padStart(2, '0')}
                              {!(log.exercise_detail?.exercise_type === 'calisthenics' && Number(log.weight_kg) === 0) && ` @ ${log.weight_kg}kg`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                          <SortableGoalItem goal={g} lang={lang} onEdit={(goal) => { setGoalForm({ ...goal, goal_exercises: goal.goal_exercises.map(ge => ({ categoryFilter: ge.exercise_detail?.category || '', exercise: ge.exercise, sets: ge.sets, reps: ge.reps, superset_id: ge.superset_id, is_pr_set: ge.is_pr_set })) }); setActiveTab('creategoal'); }} onDelete={deleteGoal} />
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
            <form onSubmit={handleCreateExercise} className="form-stack">
              <label className="field"><span>{t(lang, 'name')}</span><input value={exerciseForm.name} onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })} required /></label>
              <div className="segmented ghost" style={{ marginTop: '0.5rem' }}>
                <button type="button" className={!exerciseForm.is_time_based ? 'active' : ''} onClick={() => setExerciseForm({ ...exerciseForm, is_time_based: false })}><Weight size={16} /> {t(lang, 'weight')}</button>
                <button type="button" className={exerciseForm.is_time_based ? 'active' : ''} onClick={() => setExerciseForm({ ...exerciseForm, is_time_based: true })}><Timer size={16} /> {t(lang, 'time')}</button>
              </div>
              <div className="segmented ghost" style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'nowrap' }}>
                <button type="button" style={{ flex: 1 }} className={exerciseForm.exercise_type === 'machine' ? 'active' : ''} onClick={() => setExerciseForm({ ...exerciseForm, exercise_type: 'machine' })}><Dumbbell size={16} /> {t(lang, 'machine')}</button>
                <button type="button" style={{ flex: 1 }} className={exerciseForm.exercise_type === 'calisthenics' ? 'active' : ''} onClick={() => setExerciseForm({ ...exerciseForm, exercise_type: 'calisthenics' })}><Activity size={16} /> {t(lang, 'calisthenics')}</button>
                <button type="button" className={exerciseForm.exercise_type === 'pr' ? 'active' : ''} onClick={() => setExerciseForm({ ...exerciseForm, exercise_type: 'pr' })} style={{ flex: 1 }}><Medal size={16} /> PR</button>
              </div>
              <LinkInput label={t(lang, 'youtubeLink')} value={exerciseForm.youtube_url} onChange={(youtube_url) => setExerciseForm({ ...exerciseForm, youtube_url })} lang={lang} />
              <label className="field"><span>{t(lang, 'category')}</span><select required value={exerciseForm.category} onChange={(e) => setExerciseForm({ ...exerciseForm, category: e.target.value })}><option value="" disabled>Select Category</option>{categories.map((category) => <option key={category} value={category}>{t(lang, category)}</option>)}</select></label>

              <button className="primary-btn" type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>
                {editingExercise ? (lang === 'es' ? 'ACTUALIZAR EJERCICIO' : 'UPDATE EXERCISE') : t(lang, 'createExerciseButton')}
              </button>
              {editingExercise && (
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    setEditingExercise(null);
                    setExerciseForm({ id: null, name: '', youtube_url: '', category: '', exercise_type: 'machine', is_public: false, is_time_based: false });
                  }}
                  style={{ width: '100%', background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)' }}
                >
                  {lang === 'es' ? 'CANCELAR EDICIÓN' : 'CANCEL EDIT'}
                </button>
              )}
            </form>

            {/* Manage Private Exercises List */}
            <article className="glass-card" style={{ marginTop: '1.5rem' }}>
              <h3 className="eyebrow" style={{ color: 'var(--brand)', marginBottom: '1rem' }}>
                {lang === 'es' ? 'MIS EJERCICIOS PRIVADOS' : 'MY PRIVATE EXERCISES'}
              </h3>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                {exercises.filter(ex => ex.created_by === user?.id).length === 0 ? (
                  <p className="muted" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                    {lang === 'es' ? 'No has creado ejercicios privados todavía.' : 'You haven\'t created any private exercises yet.'}
                  </p>
                ) : (
                  exercises.filter(ex => ex.created_by === user?.id).map(ex => (
                    <div key={ex.id} className="glass-card" style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>{ex.name}</div>
                        <div className="muted" style={{ fontSize: '0.7rem' }}>{t(lang, ex.category)} • {ex.is_time_based ? t(lang, 'time') : t(lang, 'weight')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEditExercise(ex)}
                          style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: '4px' }}
                          title="Edit"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteExercise(ex.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
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

                {goalForm.goal_exercises.map((item, index) => {
                  const availableExercises = item.categoryFilter ? exercises.filter(ex => ex.category === item.categoryFilter) : exercises;
                  return (
                    <div key={index} className="goal-exercise-row glass-card" style={{ display: 'grid', gap: '0.6rem', position: 'relative', padding: '1rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <select value={item.categoryFilter} onChange={(e) => updateGoalExercise(index, 'categoryFilter', e.target.value)} style={{ flex: 1 }}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{t(lang, c)}</option>)}</select>
                        <select required value={item.exercise} onChange={(e) => updateGoalExercise(index, 'exercise', e.target.value)} style={{ flex: 2, textOverflow: 'ellipsis' }}><option value="" disabled>Pick Exercise</option>{availableExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</select>
                      </div>
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flex: 1, gap: '0.3rem' }}>
                          <div style={{ flex: 1 }}>
                            <small style={{ fontSize: '0.6rem', opacity: 0.6, display: 'block', textAlign: 'center' }}>SETS</small>
                            <input type="number" value={item.sets} onFocus={(e) => e.target.select()} onChange={(e) => updateGoalExercise(index, 'sets', e.target.value)} className="input-bubble" style={{ width: '100%', textAlign: 'center' }} max={item.is_pr_set ? "2" : "8"} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <small style={{ fontSize: '0.6rem', opacity: 0.6, display: 'block', textAlign: 'center' }}>REPS</small>
                            <input type="number" value={item.reps} onFocus={(e) => e.target.select()} onChange={(e) => updateGoalExercise(index, 'reps', e.target.value)} className="input-bubble" style={{ width: '100%', textAlign: 'center' }} max={item.is_pr_set ? "2" : "99"} />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button 
                            type="button" 
                            onClick={() => togglePR(index)} 
                            className={`small-btn ${item.is_pr_set ? 'active' : ''}`}
                            style={{ padding: '0.4rem', borderRadius: '8px', fontSize: '0.6rem', fontWeight: '900', minWidth: '35px', background: item.is_pr_set ? 'rgba(var(--brand-rgb), 0.2)' : 'rgba(255,255,255,0.05)', color: item.is_pr_set ? 'var(--brand)' : 'var(--text)' }}
                          >PR</button>
                          
                          {index < goalForm.goal_exercises.length - 1 && (
                            <button 
                              disabled
                              type="button" 
                              className="small-btn"
                              style={{ padding: '0.4rem', borderRadius: '8px', opacity: 0.3, cursor: 'not-allowed', background: (item.superset_id && item.superset_id === goalForm.goal_exercises[index+1].superset_id) ? 'rgba(var(--brand-rgb), 0.2)' : 'rgba(255,255,255,0.05)', color: (item.superset_id && item.superset_id === goalForm.goal_exercises[index+1].superset_id) ? 'var(--brand)' : 'var(--text)' }}
                            >
                              <RefreshCw size={14} style={{ transform: (item.superset_id && item.superset_id === goalForm.goal_exercises[index+1].superset_id) ? 'rotate(90deg)' : 'none' }} />
                            </button>
                          )}
                          
                          <button className="small-btn danger-btn" type="button" onClick={() => removeGoalExercise(index)} style={{ padding: '0.4rem', minWidth: '35px' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                      
                      {item.superset_id && index < goalForm.goal_exercises.length - 1 && item.superset_id === goalForm.goal_exercises[index+1].superset_id && (
                        <div style={{ position: 'absolute', left: '-12px', top: '50%', bottom: '-20px', width: '3px', background: 'var(--brand)', borderRadius: '2px', opacity: 0.4 }} />
                      )}
                    </div>
                  );
                })}

                {goalForm.goal_exercises.length < 10 && (
                  <button
                    className="dotted-btn"
                    type="button"
                    onClick={addGoalExercise}
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
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
                )}
              </div>
              <button className="primary-btn">{goalForm.id ? "Update" : "Create"}</button>
            </form>
          </article>
        )}

        {activeTab === 'bodymap' && (
          <article className="glass-card profile-section animate-fade-in" style={{ padding: '1.2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <p className="eyebrow">{t(lang, 'measures')}</p>
              <h2 style={{ marginBottom: '0.5rem' }}>{t(lang, 'bodyMap')}</h2>
            </div>

            <div className="body-map-container" style={{ position: 'relative', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
              <img
                src={showFrontBody ? '/front_body.png' : '/back_body.png'}
                alt="Body Map"
                style={{ width: '100%', opacity: 0.8, filter: 'brightness(0.8) contrast(1.2)' }}
              />

              {/* Rotation Toggle Button */}
              <button
                type="button"
                onClick={() => setShowFrontBody(!showFrontBody)}
                className="glass-card"
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--line)',
                  background: 'rgba(var(--brand-rgb), 0.1)',
                  color: 'var(--brand)',
                  zIndex: 20
                }}
              >
                <RefreshCw size={20} />
              </button>

              {(showFrontBody ? frontDots : backDots).map((dot) => {
                if (!dot) return null;
                const latest = (Array.isArray(measurements) ? measurements : [])
                  .filter(m => m && m.body_part === dot.part)
                  .sort((a, b) => {
                    const da = a && a.date ? new Date(a.date).getTime() : 0;
                    const db = b && b.date ? new Date(b.date).getTime() : 0;
                    return db - da;
                  })[0];
                const isActive = selectedDot === dot.part;

                return (
                  <button
                    key={dot.part}
                    type="button"
                    onClick={() => {
                      setSelectedDot(dot.part);
                      setMeasurementForm(p => ({
                        ...p,
                        body_part: dot.part,
                        value_cm: latest ? latest.value_cm : ''
                      }));
                    }}
                    style={{
                      position: 'absolute',
                      top: dot.top,
                      left: dot.left,
                      width: '16px',
                      height: '16px',
                      background: isActive ? 'var(--brand)' : 'rgba(255,255,255,0.4)',
                      border: isActive ? '2px solid white' : '1.5px solid rgba(255,255,255,0.8)',
                      borderRadius: '50%',
                      transform: 'translate(-50%, -50%)',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 0 15px var(--brand)' : '0 2px 4px rgba(0,0,0,0.3)',
                      zIndex: 10,
                      transition: 'all 0.2s',
                      backdropFilter: 'blur(2px)'
                    }}
                  />
                );
              })}
            </div>

            <form onSubmit={addMeasurement} className="form-stack glass-card" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label className="field">
                  <span>{t(lang, 'bodyPart')}</span>
                  <select value={measurementForm.body_part} onChange={(e) => setMeasurementForm({ ...measurementForm, body_part: e.target.value })} style={{ textTransform: 'capitalize' }}>
                    {bodyParts.map(p => <option key={p} value={p}>{t(lang, p)}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>{t(lang, 'valueCm')}</span>
                  <input type="number" step="0.1" placeholder="cm" value={measurementForm.value_cm} onFocus={(e) => e.target.select()} onChange={(e) => setMeasurementForm({ ...measurementForm, value_cm: e.target.value })} required />
                </label>
              </div>
              <label className="field" style={{ marginTop: '0.5rem' }}>
                <span>{t(lang, 'date')}</span>
                <input type="date" value={measurementForm.date} onChange={(e) => setMeasurementForm({ ...measurementForm, date: e.target.value })} required />
              </label>
              <button className="primary-btn" style={{ marginTop: '1rem' }}>{t(lang, 'saveMeasure')}</button>
            </form>
          </article>
        )}
        {activeTab === 'menu' && (
          <article className="profile-section animate-fade-in" style={{
            padding: '4rem 2rem',
            textAlign: 'left',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '400px',
            background: '#0a0a0a',
            border: '2px solid #333',
            borderRadius: '8px',
            fontFamily: 'monospace'
          }}>
            {/* CRT Scanning Line */}
            <div className="crt-scanline" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))', backgroundSize: '100% 4px, 3px 100%', pointerEvents: 'none', zIndex: 5 }} />
            <div className="crt-beam" style={{ position: 'absolute', top: '-10%', left: 0, right: 0, height: '120px', background: 'linear-gradient(to bottom, transparent, rgba(var(--brand-rgb), 0.1), transparent)', animation: 'scan 4s linear infinite', pointerEvents: 'none', zIndex: 6 }} />

            <div style={{ position: 'relative', zIndex: 10, animation: 'flicker 0.15s infinite' }}>
              <p className="pixel-text" style={{ fontSize: '1.1rem', color: 'var(--brand)', letterSpacing: '1px', lineHeight: '2', margin: 0, textShadow: '0 0 8px var(--brand)' }}>
                Z:\&gt; INITIALIZING SCOUTER PROTOCOL...<br />
                Z:\&gt; SCANNING FOR BIO-SIGNATURES...<br />
                Z:\&gt; DATA RESTRICTED: KI FREQUENCY UNKNOWN.<br />
                Z:\&gt; <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
              </p>
            </div>

            <style>{`
            @keyframes scan {
              0% { top: -10%; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { top: 110%; opacity: 0; }
            }
            @keyframes pulse {
              0% { transform: scale(1); opacity: 0.4; }
              50% { transform: scale(1.05); opacity: 0.8; }
              100% { transform: scale(1); opacity: 0.4; }
            }
            @keyframes flicker {
              0% { opacity: 0.95; }
              5% { opacity: 0.85; }
              10% { opacity: 0.95; }
              15% { opacity: 0.9; }
              20% { opacity: 1; }
              100% { opacity: 1; }
            }
            @keyframes blink {
              from, to { opacity: 1; }
              50% { opacity: 0; }
            }
          `}</style>
        </article>
        )}
        {activeTab === 'warmup' && (
          <article className="profile-section animate-fade-in" style={{
            padding: '4rem 2rem',
            textAlign: 'left',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '400px',
            background: '#0a0a0a',
            border: '2px solid #333',
            borderRadius: '8px',
            fontFamily: 'monospace'
          }}>
            {/* CRT Scanning Line */}
            <div className="crt-scanline" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))', backgroundSize: '100% 4px, 3px 100%', pointerEvents: 'none', zIndex: 5 }} />
            <div className="crt-beam" style={{ position: 'absolute', top: '-10%', left: 0, right: 0, height: '120px', background: 'linear-gradient(to bottom, transparent, rgba(var(--brand-rgb), 0.1), transparent)', animation: 'scan 4s linear infinite', pointerEvents: 'none', zIndex: 6 }} />

            <div style={{ position: 'relative', zIndex: 10, animation: 'flicker 0.15s infinite' }}>
              <p className="pixel-text" style={{ fontSize: '1.1rem', color: 'var(--brand)', letterSpacing: '1px', lineHeight: '2', margin: 0, textShadow: '0 0 8px var(--brand)' }}>
                Z:\&gt; CALIBRATING GRAVITY CHAMBER...<br />
                Z:\&gt; LOADING PRE-COMBAT DRILLS...<br />
                Z:\&gt; ERROR: WARM UP MODULE OFFLINE.<br />
                Z:\&gt; <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
              </p>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
