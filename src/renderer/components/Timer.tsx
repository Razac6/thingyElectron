import { useEffect, useState } from 'react';

interface TimerProps {
  startTimer: number | null;
  spendTime: number;
  estimate: number; // Estimate in hours
  context: 'list' | 'header';
}

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0'),
  ].join(':');
}

function Timer({ startTimer, spendTime, estimate, context }: TimerProps) {
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const estimateInSeconds = (estimate || 0) * 3600;
      const spendTimeInSeconds = (spendTime || 0) / 1000;
      let totalSpent = spendTimeInSeconds;

      if (startTimer) {
        const elapsed = (Date.now() - startTimer) / 1000;
        totalSpent += elapsed;
      }

      const overtime = totalSpent > estimateInSeconds;
      setIsOvertime(overtime);

      if (overtime) {
        setDisplaySeconds(totalSpent - estimateInSeconds);
      } else {
        setDisplaySeconds(estimateInSeconds - totalSpent);
      }
    };

    // Initial calculation
    calculateTime();

    // Set up interval only if timer is running
    if (startTimer) {
      const interval = setInterval(calculateTime, 1000);
      return () => clearInterval(interval);
    }
  }, [startTimer, spendTime, estimate]);

  let textColor = 'inherit';
  if (context === 'header') {
    textColor = 'white'; // Always white in the header
  }
  if (isOvertime) {
    textColor = 'red'; // Overtime is always red, regardless of context
  }


  return (
    <div style={{ color: textColor }}>
      {isOvertime ? `+${formatTime(displaySeconds)}` : formatTime(displaySeconds)}
    </div>
  );
}

export default Timer;
