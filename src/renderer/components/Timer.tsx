import { useEffect, useState } from 'react';

interface TimerProps {
  startTimer: number | null;
  spendTime: number;
}

function Timer({ startTimer, spendTime }: TimerProps) {
  const [displayTime, setDisplayTime] = useState(spendTime || 0);

  function formatTime(ms: number, withSec = true): string {
    if (ms < 0) {
      return withSec ? '00h 00m 00s' : '00h 00m';
    }
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds %= 60;
    minutes %= 60;

    const paddedHours = hours.toString().padStart(2, '0');
    const paddedMinutes = minutes.toString().padStart(2, '0');
    const paddedSeconds = seconds.toString().padStart(2, '0');
    if (withSec) {
      return `${paddedHours}h ${paddedMinutes}m ${paddedSeconds}s`;
    }
    return `${paddedHours}h ${paddedMinutes}m`;
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (startTimer) {
      // Jeśli timer jest uruchomiony, ustawiamy interwał
      interval = setInterval(() => {
        const elapsed = Date.now() - startTimer;
        setDisplayTime((spendTime || 0) + elapsed);
      }, 1000);
    } else {
      // Jeśli timer nie jest uruchomiony, po prostu wyświetl całkowity czas
      setDisplayTime(spendTime || 0);
    }

    // Funkcja czyszcząca, która zatrzymuje interwał, gdy komponent jest odmontowywany
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [startTimer, spendTime]);

  return <div>{formatTime(displayTime)}</div>;
}

export default Timer;
