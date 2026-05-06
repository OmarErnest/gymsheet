import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import EventModal from './EventModal';

export default function EventManager({ activeTab, user }) {
  const [modal, setModal] = useState({ open: false, image: '', title: '', message: '', subMessage: '', type: '' });

  const triggerEvent = (config) => {
    console.log("triggerEvent called with:", config.image);
    // Tab-specific filtering
    const tabMapping = {
      '/icons/events/Perfect.png': 'profile',
      '/icons/events/Hydrate.png': 'home',
      '/icons/events/Sleep.png': 'home',
      '/icons/events/Congratulations.png': 'home',
      '/icons/events/Scouter.png': 'global',
      '/icons/events/Trash.png': 'global'
    };

    const targetTab = tabMapping[config.image];
    if (targetTab && targetTab !== activeTab) {
      console.log(`Event ${config.image} skipped: target ${targetTab}, current ${activeTab}`);
      return false;
    }

    console.log("Opening modal for:", config.image);
    setModal({
      open: true,
      image: config.image,
      title: config.title || 'NEW EVENT',
      message: config.message,
      subMessage: config.subMessage || '',
      type: config.type || 'notice'
    });
    return true;
  };

  useEffect(() => {
    if (!user) return;

    const checkNotices = async () => {
      console.log("Polling for notices...");
      try {
        // 1. Global Notices
        api('/global-notices/').then(res => {
          const notices = res.results || res;
          if (notices && Array.isArray(notices) && notices.length > 0) {
            const latest = notices[0];
            const seenKey = `seen_notice_${latest.id}`;
            if (!localStorage.getItem(seenKey)) {
              console.log("New Global Notice Detected:", latest.id);
              const shown = triggerEvent({
                image: '/icons/events/Notice.png',
                title: 'SYSTEM NOTICE',
                message: latest.message.toUpperCase(),
                type: 'notice'
              });
              if (shown) {
                localStorage.setItem(seenKey, 'true');
                window.dispatchEvent(new CustomEvent('add-local-notification', { 
                  detail: { message: `Notice: ${latest.title}`, type: 'notice' } 
                }));
              }
            }
          }
        }).catch(err => console.error("Global notice check failed:", err));

        // 2. Maintenance Notices
        api('/maintenance-notices/').then(maintRes => {
          const maints = maintRes.results || maintRes;
          if (maints && Array.isArray(maints) && maints.length > 0) {
            const latest = maints[0];
            const seenKey = `seen_maint_${latest.id}`;
            if (!localStorage.getItem(seenKey)) {
              console.log("New Maintenance Alert Detected!", latest.id);
              const start = new Date(latest.start_time).toLocaleString();
              const end = new Date(latest.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const shown = triggerEvent({
                image: '/icons/events/Maintenence.png',
                title: 'MAINTENANCE',
                message: `${latest.message}\n\nSCHEDULE:\n${start} - ${end} ${latest.timezone}`,
                type: 'notice'
              });
              if (shown) {
                localStorage.setItem(seenKey, 'true');
                window.dispatchEvent(new CustomEvent('add-local-notification', { 
                  detail: { message: `Maint: ${latest.message.substring(0, 20)}...`, type: 'notice' } 
                }));
              }
            }
          }
        }).catch(err => console.error("Maintenance check failed:", err));

      } catch (err) {
        console.error("Critical poll failure:", err);
      }
    };

    checkNotices();
    checkLeaderboardEvents();
    checkWeeklyEvents();

    const noticeInterval = setInterval(checkNotices, 10000);

    const handleHydrate = () => {
      triggerEvent({
        image: '/icons/events/Hydrate.png',
        title: 'STAY HYDRATED',
        message: 'YOU ARE CRUSHING THIS WORKOUT! DRINK WATER TO MAINTAIN PEAK PERFORMANCE.',
        type: 'hydrate'
      });
    };

    window.addEventListener('trigger-hydration', handleHydrate);
    return () => {
      window.removeEventListener('trigger-hydration', handleHydrate);
      clearInterval(noticeInterval);
    };
  }, [user, activeTab]);

  function getWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  const checkLeaderboardEvents = async () => {
    try {
      const data = await api('/leaderboard/');
      const self = (data.leaderboard || []).find(u => u.id === user.id);
      if (!self) return;

      const currentScore = self.score;
      const prevScore = self.last_week_score || 10;
      const growth = ((currentScore - prevScore) / prevScore) * 100;

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
      
      const currentDaysRes = await api(`/home/days/?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}`);
      const currentDays = currentDaysRes.results || currentDaysRes;
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

      const prevDaysRes = await api(`/home/days/?start=${prevStart.toISOString().slice(0,10)}&end=${prevEnd.toISOString().slice(0,10)}`);
      const prevDays = prevDaysRes.results || prevDaysRes;
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
