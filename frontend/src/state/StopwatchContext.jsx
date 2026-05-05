import { createContext, useContext, useState, useEffect, useRef } from 'react';

const StopwatchContext = createContext();

export function StopwatchProvider({ children }) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime(prev => prev + 10);
      }, 10);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  useEffect(() => {
    const handleTrigger = () => {
      setIsMinimized(false);
      setIsRunning(true);
    };
    window.addEventListener('trigger-stopwatch', handleTrigger);
    return () => window.removeEventListener('trigger-stopwatch', handleTrigger);
  }, []);

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    // Show only MM:SS for the header, or full for the floating
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeFull = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setTime(0);
    setIsRunning(false);
  };

  return (
    <StopwatchContext.Provider value={{ 
      time, 
      isRunning, 
      setIsRunning, 
      isMinimized, 
      setIsMinimized, 
      formatTime, 
      formatTimeFull,
      reset 
    }}>
      {children}
    </StopwatchContext.Provider>
  );
}

export const useStopwatch = () => useContext(StopwatchContext);
