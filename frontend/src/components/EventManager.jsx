import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import EventModal from './EventModal';
import { t } from '../i18n';

export default function EventManager({ activeTab, user, lang }) {
  const [modal, setModal] = useState({ open: false, image: '', title: '', message: '', subMessage: '', type: '' });
  const [eventQueue, setEventQueue] = useState([]);

  // Process the queue when the modal closes or a new event arrives
  useEffect(() => {
    if (!modal.open && eventQueue.length > 0) {
      const nextEvent = eventQueue[0];
      setModal({
        open: true,
        image: nextEvent.image,
        title: nextEvent.title || 'NEW EVENT',
        message: nextEvent.message,
        subMessage: nextEvent.subMessage || '',
        type: nextEvent.type || 'notice'
      });
      setEventQueue(prev => prev.slice(1));
    }
  }, [modal.open, eventQueue]);

  const triggerEvent = useCallback((config) => {
    console.log("Queueing event:", config.image);
    setEventQueue(prev => [...prev, config]);
    return true;
  }, []);

  function getWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  const checkLeaderboardEvents = useCallback(async () => {
    try {
      const data = await api('/leaderboard/');
      const self = (data.leaderboard || []).find(u => u.id === user.id);
      if (!self) return;

      const currentScore = self.score;
      const prevScore = self.last_week_score || 0;
      const growth = prevScore > 0 ? ((currentScore - prevScore) / prevScore) * 100 : (currentScore > 0 ? 100 : 0);

      if (growth >= 8) {
        const weekKey = `scouter_seen_v2_${new Date().getFullYear()}_W${getWeekNumber(new Date())}`;
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
      } else if (growth <= -20) {
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

      if (data.champion_id === user.id) {
        const weekKey = `champion_seen_v2_${new Date().getFullYear()}_W${getWeekNumber(new Date())}`;
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
    } catch (err) { }
  }, [user, triggerEvent]);

  const checkWeeklyEvents = useCallback(async () => {
    try {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const currentDaysRes = await api(`/home/days/?start=${start.toISOString().slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`);
      const currentDays = currentDaysRes.results || currentDaysRes;
      const allCompleted = currentDays.every(d => d.goals.length === 0 || d.progress?.completed);
      const hasGoals = currentDays.some(d => d.goals.length > 0);

      if (hasGoals && allCompleted) {
        const weekKey = `sleep_seen_${start.toISOString().slice(0, 10)}`;
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

      const prevDaysRes = await api(`/home/days/?start=${prevStart.toISOString().slice(0, 10)}&end=${prevEnd.toISOString().slice(0, 10)}`);
      const prevDays = prevDaysRes.results || prevDaysRes;
      const prevAllCompleted = prevDays.every(d => d.goals.length === 0 || d.progress?.completed);
      const prevHasGoals = prevDays.some(d => d.goals.length > 0);

      if (prevHasGoals && prevAllCompleted) {
        const prevWeekKey = `perfect_seen_${prevStart.toISOString().slice(0, 10)}`;
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
    } catch (err) { }
  }, [triggerEvent]);

  useEffect(() => {
    if (!user) return;

    const checkNotices = async () => {
      console.log("Polling for notices...");
      try {
        api('/global-notices/').then(res => {
          const notices = res.results || res;
          if (notices && Array.isArray(notices) && notices.length > 0) {
            const latest = notices[0];
            const seenKey = `seen_notice_v2_${latest.id}`;
            if (!localStorage.getItem(seenKey)) {
              triggerEvent({
                image: '/icons/events/Notice.png',
                title: 'SYSTEM NOTICE',
                message: latest.message.toUpperCase(),
                type: 'notice'
              });
              localStorage.setItem(seenKey, 'true');
            }
          }
        }).catch(err => console.error("Global notice check failed:", err));

        api('/maintenance-notices/').then(maintRes => {
          const maints = maintRes.results || maintRes;
          if (maints && Array.isArray(maints) && maints.length > 0) {
            const latest = maints[0];
            const seenKey = `seen_maint_v2_${latest.id}`;
            if (!localStorage.getItem(seenKey)) {
              const start = new Date(latest.start_time).toLocaleString();
              const end = new Date(latest.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              triggerEvent({
                image: '/icons/events/Hotfix.png',
                title: 'MAINTENANCE',
                message: `${latest.message}\n\nSCHEDULE:\n${start} - ${end} ${latest.timezone}`,
                type: 'notice'
              });
              localStorage.setItem(seenKey, 'true');
            }
          }
        }).catch(err => console.error("Maintenance check failed:", err));
      } catch (err) { }
    };

    checkNotices();
    checkLeaderboardEvents();
    checkWeeklyEvents();

    const noticeInterval = setInterval(checkNotices, 300000); // 5 minutes
    return () => clearInterval(noticeInterval);
  }, [user, triggerEvent, checkLeaderboardEvents, checkWeeklyEvents]);

  useEffect(() => {
    if (!user) return;

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
  }, [user, triggerEvent]);

  useEffect(() => {
    if (!user) return;

    const handleRest = () => {
      triggerEvent({
        image: '/icons/events/Rest.png',
        title: t(lang, 'Take it easy, pal.'),
        message: t(lang, 'We are all out of senzu beans. Take a nap or something...'),
        type: 'rest'
      });
    };

    window.addEventListener('trigger-rest', handleRest);
    return () => window.removeEventListener('trigger-rest', handleRest);
  }, [user, triggerEvent, lang]);

  return (
    <EventModal
      isOpen={modal.open}
      onClose={() => setModal(prev => ({ ...prev, open: false }))}
      image={modal.image}
      title={modal.title}
      message={modal.message}
      subMessage={modal.subMessage}
      type={modal.type}
    />
  );
}
