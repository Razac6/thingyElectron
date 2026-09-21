import { useEffect, useState } from 'react';

interface TimerProps {
  startTimer: string | number | null;
  spendTime: number;
  estimate: number; // Estimate in hours
  context: 'list' | 'header';
}

function formatTime(rawSeconds: number): string {
  const seconds = Number.isNaN(rawSeconds) || rawSeconds < 0 ? 0 : rawSeconds;

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

      if (
        startTimer &&
        String(startTimer).trim() !== 'null' &&
        String(startTimer).trim() !== ''
      ) {
        let startTime = Number(startTimer);
        if (Number.isNaN(startTime)) {
          startTime = new Date(startTimer).getTime();
        }

        if (!Number.isNaN(startTime) && startTime > 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          totalSpent += elapsed;
        }
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
    if (
      startTimer &&
      String(startTimer).trim() !== 'null' &&
      String(startTimer).trim() !== ''
    ) {
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
      {isOvertime
        ? `+${formatTime(displaySeconds)}`
        : formatTime(displaySeconds)}
    </div>
  );
}

export default Timer;
