import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllSettings, setSetting } from '../services/DatabaseService';

interface SettingsContextType {
  settings: any;
  updateSetting: (key: string, value: string) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      // Default fallback if DB is empty/init
      const defaults = {
          complexityThreshold: '8',
          enableRewardAnimations: 'true',
          enableFatigueWarnings: 'true'
      };
      
      const data = await getAllSettings();
      setSettings({ ...defaults, ...data });
      setLoading(false);
    };
    loadSettings();
  }, []);

  const updateSetting = async (key: string, value: string) => {
    await setSetting(key, value);
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
