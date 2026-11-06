import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useSettings } from './SettingsContext';

// The main process owns the achievements (see src/main/gamification.ts and db.ts
// syncAchievements). This context mirrors them for the UI and plays the reward
// animations when the main process reports new ones.

type AnimationType =
  | 'cat_movement'
  | 'flirting_dog'
  | 'meditating_fox'
  | 'cat_rocket'
  | 'trophy';

interface GamificationContextType {
  earnedAchievements: string[];
  /** Re-evaluates achievements from the data; true if a new one was earned. */
  checkForAchievements: (action?: string, data?: any) => Promise<boolean>;
  refresh: () => Promise<void>;
  rewardAnimation: AnimationType | null;
  triggerRewardAnimation: (type: 'standard' | 'achievement') => void;
  hideRewardAnimation: () => void;
}

const GamificationContext = createContext<GamificationContextType | undefined>(
  undefined,
);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const [rewardAnimation, setRewardAnimation] = useState<AnimationType | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // The main process may report an achievement just before the page asks for its own
  // "standard" reward animation - the trophy wins
  const lastTrophyAt = useRef(0);

  const triggerRewardAnimation = useCallback(
    (type: 'standard' | 'achievement') => {
      if (settingsRef.current.enableRewardAnimations !== 'true') return;
      if (type === 'achievement') {
        lastTrophyAt.current = Date.now();
        setRewardAnimation('trophy');
        return;
      }
      if (Date.now() - lastTrophyAt.current < 4000) return;
      const animations: AnimationType[] = [
        'cat_movement',
        'flirting_dog',
        'meditating_fox',
        'cat_rocket',
      ];
      setRewardAnimation(
        animations[Math.floor(Math.random() * animations.length)],
      );
    },
    [],
  );

  const hideRewardAnimation = () => setRewardAnimation(null);

  const refresh = useCallback(async () => {
    try {
      const state = await window.electron.database.getGamificationState();
      setEarnedAchievements(
        state.achievements.filter((a: any) => a.earnedAt).map((a: any) => a.id),
      );
    } catch (error) {
      console.error('Failed to load gamification data', error);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  // Achievements the main process granted (quests, Pomodoro, task completion...)
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'gamification:updated',
      (payload: any) => {
        if (payload?.newAchievements?.length) {
          setEarnedAchievements((prev) => [
            ...new Set([
              ...prev,
              ...payload.newAchievements.map((a: any) => a.id),
            ]),
          ]);
          triggerRewardAnimation('achievement');
        }
      },
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [triggerRewardAnimation]);

  const checkForAchievements = useCallback(async () => {
    const { newAchievements } =
      await window.electron.database.syncAchievements();
    if (!newAchievements.length) return false;
    setEarnedAchievements((prev) => [
      ...new Set([...prev, ...newAchievements.map((a) => a.id)]),
    ]);
    return true;
  }, []);

  // Main asks the UI to re-check after health actions / Pomodoro
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'gamification:check',
      async () => {
        if (await checkForAchievements()) {
          triggerRewardAnimation('achievement');
        }
      },
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [checkForAchievements, triggerRewardAnimation]);

  const value = useMemo(
    () => ({
      earnedAchievements,
      checkForAchievements,
      refresh,
      rewardAnimation,
      triggerRewardAnimation,
      hideRewardAnimation,
    }),
    [
      earnedAchievements,
      checkForAchievements,
      refresh,
      rewardAnimation,
      triggerRewardAnimation,
    ],
  );

  if (isLoading) return null;

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error(
      'useGamification must be used within a GamificationProvider',
    );
  }
  return context;
};
