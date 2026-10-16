import { useEffect, useState } from "react";

// Each update includes the server timestamp, so device clock skew doesn't change the timer.
export function useGameClock(deadline: number | null, serverNow: number, pausedRemainingMs: number | null = null) {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) {
      setSeconds(pausedRemainingMs === null ? null : Math.ceil(pausedRemainingMs / 1000));
      return;
    }
    const started = Date.now();
    const remainingAtStart = deadline - serverNow;
    const tick = () => setSeconds(Math.max(0, Math.ceil((remainingAtStart - (Date.now() - started)) / 1000)));
    tick();
    const handle = setInterval(tick, 250);
    return () => clearInterval(handle);
  }, [deadline, serverNow, pausedRemainingMs]);
  return seconds;
}
