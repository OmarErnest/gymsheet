import { useEffect, useRef, useState } from 'react';

const WAKE_DELAY_MS = 1500;    // Show screen if backend hasn't responded after 1.5s
const FILL_DURATION_MS = 50000; // Progress bar fills over 50 seconds
const POLL_INTERVAL_MS = 4000;  // Re-ping backend every 4 seconds
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const MESSAGES = [
  "Waking the server up...",
  "Free tier servers sleep when idle 😴",
  "This usually takes about 50 seconds...",
  "Fetching your training data...",
  "Almost there, hang tight!",
  "The server is stretching its legs...",
];

export default function WakeUpScreen({ onReady }) {
  const [progress, setProgress] = useState(0);      // 0–100
  const [msgIdx, setMsgIdx] = useState(0);
  const [dots, setDots] = useState('');
  const startTime = useRef(Date.now());
  const frameRef = useRef(null);
  const pollRef = useRef(null);
  const doneRef = useRef(false);

  // Animate the progress bar over FILL_DURATION_MS
  useEffect(() => {
    const tick = () => {
      if (doneRef.current) return;
      const elapsed = Date.now() - startTime.current;
      const pct = Math.min((elapsed / FILL_DURATION_MS) * 100, 99); // Cap at 99 until real response
      setProgress(pct);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // Cycle through messages every 6s
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx(i => (i + 1) % MESSAGES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Poll the backend health until it responds
  useEffect(() => {
    async function ping() {
      if (doneRef.current) return;
      try {
        const res = await fetch(`${API_URL}/auth/me/`, {
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        // Any response (including 401) means the server is alive
        if (res.status !== 0) {
          doneRef.current = true;
          setProgress(100);
          cancelAnimationFrame(frameRef.current);
          clearInterval(pollRef.current);
          // Short delay to let the bar visually hit 100%
          setTimeout(onReady, 400);
        }
      } catch {
        // Still sleeping — keep polling
      }
    }

    ping(); // immediate first ping
    pollRef.current = setInterval(ping, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [onReady]);

  const pctDisplay = Math.round(progress);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0a0a0a)',
      zIndex: 9999,
      gap: '2rem',
      padding: '2rem',
    }}>
      {/* Logo */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          position: 'absolute',
          width: '80px', height: '80px',
          background: 'var(--brand, #22c55e)',
          filter: 'blur(30px)',
          opacity: 0.35,
          borderRadius: '50%',
        }} />
        <img
          src="/icon.png"
          alt="GymSheet"
          style={{
            width: '72px', height: '72px',
            objectFit: 'contain',
            position: 'relative', zIndex: 1,
            animation: 'spin-slow 4s linear infinite',
          }}
        />
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontSize: '1.6rem',
          fontWeight: '1000',
          letterSpacing: '-1.5px',
          color: 'var(--text, #fff)',
          margin: '0 0 0.3rem',
        }}>
          GYM<span style={{ color: 'var(--brand, #22c55e)' }}>SHEET</span>
        </h2>
        <p style={{
          fontSize: '0.82rem',
          color: 'var(--muted, rgba(255,255,255,0.5))',
          margin: 0,
          minHeight: '1.2em',
          transition: 'opacity 0.5s',
        }}>
          {MESSAGES[msgIdx]}{dots}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: '320px' }}>
        <div style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--brand, #22c55e), #86efac)',
            borderRadius: '999px',
            transition: 'width 0.3s ease-out',
            boxShadow: '0 0 10px var(--brand, #22c55e)',
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '0.5rem',
          fontSize: '0.7rem',
          color: 'var(--muted, rgba(255,255,255,0.35))',
          fontWeight: '700',
        }}>
          <span>WAKING SERVER</span>
          <span>{pctDisplay}%</span>
        </div>
      </div>

      {/* Hint */}
      <p style={{
        fontSize: '0.68rem',
        color: 'var(--muted, rgba(255,255,255,0.3))',
        textAlign: 'center',
        maxWidth: '260px',
        lineHeight: '1.6',
        margin: 0,
      }}>
        The server goes to sleep after 15 min of inactivity.
        <br />It will wake up automatically — no action needed.
      </p>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
