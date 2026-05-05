import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import EventModal from './EventModal';
import { useAuth } from '../state/AuthContext';

export default function EventManager() {
  const { user } = useAuth();
  const [modal, setModal] = useState({ open: false, image: '', title: '', message: '' });

  useEffect(() => {
    if (!user) return;

    const checkNotices = async () => {
      try {
        // Check Global Notices (Pop-up + Notification)
        const notices = await api('/global-notices/');
        if (notices && notices.length > 0) {
          const latest = notices[0];
          const seenKey = `seen_notice_${latest.id}`;
          if (!localStorage.getItem(seenKey)) {
            setModal({
              open: true,
              image: '/icons/events/Notice.png',
              title: latest.title,
              message: latest.message
            });
            localStorage.setItem(seenKey, 'true');
            window.dispatchEvent(new CustomEvent('add-local-notification', { 
              detail: { message: `Notice: ${latest.title} - ${latest.message}`, type: 'notice' } 
            }));
            return; // Only show one pop-up at a time
          }
        }

        // Check Broadcast Notifications (Custom messages to everyone)
        const broadcasts = await api('/broadcast-notifications/');
        if (broadcasts && broadcasts.length > 0) {
          const latest = broadcasts[0];
          const seenKey = `seen_broadcast_${latest.id}`;
          if (!localStorage.getItem(seenKey)) {
            setModal({
              open: true,
              image: '/icons/events/Notice.png',
              title: 'New Announcement',
              message: latest.message
            });
            localStorage.setItem(seenKey, 'true');
            window.dispatchEvent(new CustomEvent('add-local-notification', { 
              detail: { message: `Announcement: ${latest.message}`, type: 'notice' } 
            }));
          }
        }
      } catch (err) {
        console.error("Notice check failed", err);
      }
    };

    const checkChampion = async () => {
      try {
        const data = await api('/leaderboard/');
        if (data.champion_id === user.id) {
          const weekKey = `champion_seen_${new Date().getFullYear()}_W${getWeekNumber(new Date())}`;
          if (!localStorage.getItem(weekKey)) {
            setModal({
              open: true,
              image: '/icons/events/Congratulations.png',
              title: 'Weekly Champion!',
              message: 'Congratulations! You were the #1 trainer last week. Keep up the amazing work!'
            });
            localStorage.setItem(weekKey, 'true');
            window.dispatchEvent(new CustomEvent('add-local-notification', { 
              detail: { message: `Champion: You were the #1 trainer last week!`, type: 'congrats' } 
            }));
          }
        }
      } catch (err) {
        console.error("Champion check failed", err);
      }
    };

    const checkWeeklyEvents = async () => {
      try {
        // Current Week
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
            setModal({
              open: true,
              image: '/icons/events/Sleep.png',
              title: 'Weekly Goal Met!',
              message: 'Great, now prioritize sleep to recover'
            });
            localStorage.setItem(weekKey, 'true');
          }
        }

        // Previous Week
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
            setModal({
              open: true,
              image: '/icons/events/Perfect.png',
              title: 'Perfect Performance!',
              message: 'Just what a perfect life form, interested in fighting?'
            });
            localStorage.setItem(prevWeekKey, 'true');
          }
        }
      } catch (err) {
        console.error("Weekly check failed", err);
      }
    };

    checkNotices();
    checkChampion();
    checkWeeklyEvents();

    const handleHydrate = () => {
      setModal({
        open: true,
        image: '/icons/events/Hydrate.png',
        title: 'Stay Hydrated!',
        message: 'You are crushing your workout! Remember to drink some water to stay at peak performance.'
      });
    };

    window.addEventListener('trigger-hydration', handleHydrate);
    return () => window.removeEventListener('trigger-hydration', handleHydrate);
  }, [user]);

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
    />
  );
}
