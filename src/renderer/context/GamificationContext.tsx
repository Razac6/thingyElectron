import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useSettings } from './SettingsContext';

// --- Ranks from Slavic Bestiary ---
const ranks = [
  { level: 1, name: 'Utopiec' },
  { level: 5, name: 'Leszy' },
  { level: 10, name: 'Bies' },
  { level: 15, name: 'Południca' },
  { level: 20, name: 'Strzyga' },
  { level: 25, name: 'Wąpierz' },
];

export const getRankForLevel = (level: number) => {
  let currentRank = ranks[0].name;
  for (const rank of ranks) {
    if (level >= rank.level) {
      currentRank = rank.name;
    } else {
      break;
    }
  }
  return currentRank;
};


// --- Interfaces ---
interface UserProfile {
  userId: number;
  level: number;
  xp: number;
}

type AnimationType = 'cat_movement' | 'flirting_dog' | 'meditating_fox' | 'cat_rocket' | 'trophy';

interface GamificationContextType {
  profile: UserProfile | null;
  earnedAchievements: string[];
  addXp: (amount: number) => void;
  checkForAchievements: (action: string, data?: any) => Promise<boolean>; // Returns true if achievement was earned
  rewardAnimation: AnimationType | null;
  triggerRewardAnimation: (type: 'standard' | 'achievement') => void;
  hideRewardAnimation: () => void;
  rank: string;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const GamificationProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const [rewardAnimation, setRewardAnimation] = useState<AnimationType | null>(null);
  const [rank, setRank] = useState<string>('Utopiec');
  const [isLoading, setIsLoading] = useState(true);
  const userId = 1;
  const { settings } = useSettings();

  useEffect(() => {
    const loadData = async () => {
      try {
        const userProfile = await window.electron.database.getProfile(userId);
        const userAchievements = await window.electron.database.getEarnedAchievements(userId);
        setProfile(userProfile);
        setEarnedAchievements(userAchievements);
        if (userProfile) {
          setRank(getRankForLevel(userProfile.level));
        }
      } catch (error) {
        console.error("Failed to load gamification data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const triggerRewardAnimation = (type: 'standard' | 'achievement') => {
    if (settings.enableRewardAnimations !== 'true') return;

    if (type === 'achievement') {
      setRewardAnimation('trophy');
    } else {
      const animations: AnimationType[] = ['cat_movement', 'flirting_dog', 'meditating_fox', 'cat_rocket'];
      const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
      setRewardAnimation(randomAnimation);
    }
  };

  const hideRewardAnimation = () => {
    setRewardAnimation(null);
  };

  const addXp = useCallback(async (amount: number) => {
    if (!profile) return;
    let newXp = profile.xp + amount;
    let newLevel = profile.level;
    const xpForNextLevel = newLevel * 100;

    if (newXp >= xpForNextLevel) {
      newLevel += 1;
      newXp -= xpForNextLevel;
      setRank(getRankForLevel(newLevel));
    }

    const updatedProfile = { ...profile, level: newLevel, xp: newXp };
    setProfile(updatedProfile);
    await window.electron.database.updateProfile(updatedProfile);
  }, [profile]);

  const checkForAchievements = useCallback(async (action: string, data?: any): Promise<boolean> => {
    let earned = false;

    if (action === 'TASK_COMPLETED') {
      // 1. First Task
      if (!earnedAchievements.includes('FIRST_TASK')) {
        await window.electron.database.grantAchievement(userId, 'FIRST_TASK');
        setEarnedAchievements(prev => [...prev, 'FIRST_TASK']);
        addXp(10);
        earned = true;
      }

      // 2. Count Tasks
      const tasks = await window.electron.database.getTasks(userId);
      const completedCount = tasks.filter((t: any) => t.status === 'Completed').length;

      if (completedCount >= 5 && !earnedAchievements.includes('FIVE_TASKS')) {
          await window.electron.database.grantAchievement(userId, 'FIVE_TASKS');
          setEarnedAchievements(prev => [...prev, 'FIVE_TASKS']);
          addXp(50);
          earned = true;
      }

      if (completedCount >= 10 && !earnedAchievements.includes('TEN_TASKS')) {
          await window.electron.database.grantAchievement(userId, 'TEN_TASKS');
          setEarnedAchievements(prev => [...prev, 'TEN_TASKS']);
          addXp(100);
          earned = true;
      }
    }

    if (action === 'SPRINT_CREATED') {
        if (!earnedAchievements.includes('THE_PLANNER')) {
            await window.electron.database.grantAchievement(userId, 'THE_PLANNER');
            setEarnedAchievements(prev => [...prev, 'THE_PLANNER']);
            addXp(25);
            earned = true;
        }
    }

    if (action === 'WORK_SESSION_ENDED') {
        const durationMin = data?.duration / (1000 * 60);
        if (durationMin >= 120 && !earnedAchievements.includes('DEEP_DIVE')) {
            await window.electron.database.grantAchievement(userId, 'DEEP_DIVE');
            setEarnedAchievements(prev => [...prev, 'DEEP_DIVE']);
            addXp(50);
            earned = true;
        }
    }

    if (action === 'HEALTH_ACTION' || action === 'POMODORO_COMPLETED') {
        // Fetch fresh stats
        // @ts-ignore
        const stats = await window.electron.database.getLifetimeStats(userId);
        
        if (stats.pomodoros >= 1 && !earnedAchievements.includes('POMODORO_MASTER')) {
            await window.electron.database.grantAchievement(userId, 'POMODORO_MASTER');
            setEarnedAchievements(prev => [...prev, 'POMODORO_MASTER']);
            addXp(30);
            earned = true;
        }

        if (stats.meditationSessions >= 5 && !earnedAchievements.includes('ZEN_MASTER')) {
            await window.electron.database.grantAchievement(userId, 'ZEN_MASTER');
            setEarnedAchievements(prev => [...prev, 'ZEN_MASTER']);
            addXp(40);
            earned = true;
        }

        if (stats.water >= 10 && !earnedAchievements.includes('HYDRO_HOMIE')) {
            await window.electron.database.grantAchievement(userId, 'HYDRO_HOMIE');
            setEarnedAchievements(prev => [...prev, 'HYDRO_HOMIE']);
            addXp(25);
            earned = true;
        }

        if (stats.stretchingSessions >= 5 && !earnedAchievements.includes('FLEXIBLE')) {
            await window.electron.database.grantAchievement(userId, 'FLEXIBLE');
            setEarnedAchievements(prev => [...prev, 'FLEXIBLE']);
            addXp(30);
            earned = true;
        }
    }

    return earned;
  }, [addXp, earnedAchievements, userId]);

  useEffect(() => {
    const handleCheck = async (event: any, action: string) => {
        const earned = await checkForAchievements(action);
        if (earned) triggerRewardAnimation('achievement');
    };
    
    // @ts-ignore
    window.electron.ipcRenderer.on('gamification:check', handleCheck);
    
    return () => {
        // @ts-ignore
        window.electron.ipcRenderer.removeListener('gamification:check', handleCheck);
    };
  }, [checkForAchievements]);

  if (isLoading) {
    return null;
  }

  return (
    <GamificationContext.Provider value={{ profile, earnedAchievements, addXp, checkForAchievements, rewardAnimation, triggerRewardAnimation, hideRewardAnimation, rank }}>
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};
