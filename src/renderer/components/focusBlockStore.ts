import { useSyncExternalStore } from 'react';

// The running focus block, shared between the card that starts it (FocusBlockCard), the
// timer pill that shows its countdown, and Layout (which keeps Boost open during it).

export interface RunningBlock {
  goal: string;
  minutes: number;
  endsAt: number;
  boost: boolean; // opened the full-screen Boost view
}

let current: RunningBlock | null = null;
const listeners = new Set<() => void>();

export const setRunningBlock = (block: RunningBlock | null) => {
  current = block;
  listeners.forEach((l) => l());
};

export const getRunningBlock = () => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useRunningBlock = () =>
  useSyncExternalStore(subscribe, getRunningBlock, getRunningBlock);
