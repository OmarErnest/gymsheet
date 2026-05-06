import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import EventModal from './EventModal';
import { useAuth } from '../state/AuthContext';

export default function EventManager({ activeTab }) {
  const { user } = useAuth();
  const [modal, setModal] = useState({ open: false, image: '', title: '', message: '', subMessage: '', type: '' });

  const triggerEvent = (config) => {
    // Tab-specific filtering
    const tabMapping = {
      '/icons/events/Perfect.png': 'profile',
      '/icons/events/Hydrate.png': 'home',
      '/icons/events/Sleep.png': 'home',
      '/icons/events/Notice.png': 'home',
      '/icons/events/Congratulations.png': 'home',
      '/icons/events/Scouter.png': 'global',
      '/icons/events/Trash.png': 'global'
    };

    const targetTab = tabMapping[config.image];
    if (targetTab && targetTab !== activeTab) {
      console.log(`Event ${config.image} skipped: target ${targetTab}, current ${activeTab}`);
      return;
    }

    setModal({
      open: true,
      image: config.image,
      title: config.title || 'NEW EVENT',
      message: config.message,
      subMessage: config.subMessage || '',
      type: config.type || 'notice'
    });
  };

  useEffect(() => {
    if (!user) return;

    const checkNotices = async () => {
      try {
        const notices = await api('/global-notices/');
        if (notices && notices.length > 0) {
          const latest = notices[0];
          const seenKey = `seen_notice_${latest.id}`;
          if (!localStorage.getItem(seenKey)) {
            triggerEvent({
              image: '/icons/events/Notice.png',
              title: 'SYSTEM NOTICE',
              message: latest.message.toUpperCase(),
              type: 'notice'
            });
            localStorage.setItem(seenKey, 'true');
            window.dispatchEvent(new CustomEvent('add-local-notification', { 
              detail: { message: `Notice: ${latest.title}`, type: 'notice' } 
            }));
          }
        }
      } catch (err) {}
    };

    const checkLeaderboardEvents = async () => {
      try {
        const data = await api('/leaderboard/');
        const self = (data.leaderboard || []).find(u => u.id === user.id);
        if (!self) return;

        const currentScore = self.score;
        const prevScore = self.last_week_score || 10;
        const growth = ((currentScore - prevScore) / prevScore) * 100;

        // Scouter: +8% growth
        if (growth >= 8) {
          const weekKey = `scouter_seen_${new Date().getFullYear()}_W${getWeekNumber(new Date())}`;
          if (!localStorage.getItem(weekKey)) {
            triggerEvent({
              image: '/icons/events/Scouter.png',
              title: 'POWER DETECTED',
              message: `YOUR POWER LEVEL HAS GROWN MORE THAN ${Math.floor(growth)}% IN A COUPLE OF DAYS. HOW IS THAT EVEN POSSIBLE!?`,
              subMessage: `(PREV. ${prevScore})`,
              type: 'scouter'
            });
            localStorage.setItem(weekKey, 'true');
          }
        } 
        // Trash: -20% decline
        else if (growth <= -20) {
          const weekKey = `trash_seen_${new Date().getFullYear()}_W${getWeekNumber(new Date())}`;
          if (!localStorage.getItem(weekKey)) {
            triggerEvent({
              image: '/icons/events/Trash.png',
              title: 'WEAKNESS DETECTED',
              message: `YOU ARE JUST SOME ${prevScore} LEVEL TRASH! HA HA HA HA!`,
              type: 'trash'
            });
            localStorage.setItem(weekKey, 'true');
          }
        }

        // Champion
        if (data.champion_id === user.id) {
          const weekKey = `champion_seen_${new Date().getFullYear()}_W${getWeekNumber(new Date())}`;
          if (!localStorage.getItem(weekKey)) {
            triggerEvent({
              image: '/icons/events/Congratulations.png',
              title: 'WORLD CHAMPION',
              message: 'CONGRATULATIONS! YOU ARE THE #1 TRAINER. KEEP CRUSHING IT!',
              type: 'congrats'
            });
            localStorage.setItem(weekKey, 'true');
          }
        }
      } catch (err) {}
    };

    const checkWeeklyEvents = async () => {
      try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        
        const currentDays = await api(`/home/days/?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}`);
        const allCompleted = currentDays.every(d => d.goals.length === 0 || d.progress?.completed);
        const hasGoals = currentDays.some(d => d.goals.length > 0);

        if (hasGoals && allCompleted) {
          const weekKey = `sleep_seen_${start.toISOString().slice(0,10)}`;
          if (!localStorage.getItem(weekKey)) {
            triggerEvent({
              image: '/icons/events/Sleep.png',
              title: 'GOAL ACHIEVED',
              message: 'GREAT WORK. NOW PRIORITIZE SLEEP TO MAXIMIZE YOUR RECOVERY.',
              type: 'sleep'
            });
            localStorage.setItem(weekKey, 'true');
          }
        }

        const prevStart = new Date(start);
        prevStart.setDate(start.getDate() - 7);
        const prevEnd = new Date(prevStart);
        prevEnd.setDate(prevStart.getDate() + 6);

        const prevDays = await api(`/home/days/?start=${prevStart.toISOString().slice(0,10)}&end=${prevEnd.toISOString().slice(0,10)}`);
        const prevAllCompleted = prevDays.every(d => d.goals.length === 0 || d.progress?.completed);
        const prevHasGoals = prevDays.some(d => d.goals.length > 0);

        if (prevHasGoals && prevAllCompleted) {
          const prevWeekKey = `perfect_seen_${prevStart.toISOString().slice(0,10)}`;
          if (!localStorage.getItem(prevWeekKey)) {
            triggerEvent({
              image: '/icons/events/Perfect.png',
              title: 'PERFECT FORM',
              message: 'JUST WHAT A PERFECT LIFE FORM. INTERESTED IN A REAL FIGHT?',
              type: 'perfect'
            });
            localStorage.setItem(prevWeekKey, 'true');
          }
        }
      } catch (err) {}
    };

    checkNotices();
    checkLeaderboardEvents();
    checkWeeklyEvents();

    const handleHydrate = () => {
      triggerEvent({
        image: '/icons/events/Hydrate.png',
        title: 'STAY HYDRATED',
        message: 'YOU ARE CRUSHING THIS WORKOUT! DRINK WATER TO MAINTAIN PEAK PERFORMANCE.',
        type: 'hydrate'
      });
    };

    window.addEventListener('trigger-hydration', handleHydrate);
    return () => window.removeEventListener('trigger-hydration', handleHydrate);
  }, [user, activeTab]);

  function getWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  return (
    <EventModal 
      isOpen={modal.open} 
      onClose={() => setModal({ ...modal, open: false })}
      image={modal.image}
      title={modal.title}
      message={modal.message}
      subMessage={modal.subMessage}
      type={modal.type}
    />
  );
}
