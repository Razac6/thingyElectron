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
    if (action === 'TASK_COMPLETED') {
      if (!earnedAchievements.includes('FIRST_TASK')) {
        await window.electron.database.grantAchievement(userId, 'FIRST_TASK');
        setEarnedAchievements(prev => [...prev, 'FIRST_TASK']);
        addXp(10);
        return true; // Achievement earned
      }
    }
    return false; // No new achievement
  }, [addXp, earnedAchievements, userId]);

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
