import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';

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

interface GamificationContextType {
  profile: UserProfile | null;
  earnedAchievements: string[];
  addXp: (amount: number) => void;
  checkForAchievements: (action: string, data?: any) => void;
  showConfetti: boolean;
  triggerConfetti: () => void;
  rank: string;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const GamificationProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [rank, setRank] = useState<string>('Utopiec');
  const [isLoading, setIsLoading] = useState(true);
  const userId = 1; // Assuming a single user with ID 1

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

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  };

  const addXp = useCallback(async (amount: number) => {
    if (!profile) return;

    let newXp = profile.xp + amount;
    let newLevel = profile.level;
    const xpForNextLevel = newLevel * 100;

    if (newXp >= xpForNextLevel) {
      newLevel += 1;
      newXp -= xpForNextLevel;
      console.log(`LEVEL UP! You are now level ${newLevel}!`);
      setRank(getRankForLevel(newLevel));
    }

    const updatedProfile = { ...profile, level: newLevel, xp: newXp };
    setProfile(updatedProfile);
    await window.electron.database.updateProfile(updatedProfile);

  }, [profile]);

  const checkForAchievements = useCallback(async (action: string, data?: any) => {
    if (action === 'TASK_COMPLETED') {
      if (!earnedAchievements.includes('FIRST_TASK')) {
        await window.electron.database.grantAchievement(userId, 'FIRST_TASK');
        setEarnedAchievements(prev => [...prev, 'FIRST_TASK']);
        addXp(10);
        triggerConfetti();
      }
    }
  }, [addXp, earnedAchievements, userId]);

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <GamificationContext.Provider value={{ profile, earnedAchievements, addXp, checkForAchievements, showConfetti, triggerConfetti, rank }}>
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
