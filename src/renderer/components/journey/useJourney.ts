import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import type { JourneyState } from '../../../main/journey';

/** The journey mini-game is on while the warrior is the assistant character. */
export const useJourneyEnabled = () => {
  const { settings } = useSettings();
  return settings.companion_character === 'warrior';
};

/** Journey state from the main process, kept fresh when work earns rolls / chests. */
export default function useJourney() {
  const enabled = useJourneyEnabled();
  const [state, setState] = useState<JourneyState | null>(null);

  const reload = useCallback(async () => {
    try {
      setState(await window.electron.database.getJourney());
    } catch (e) {
      console.error('Failed to load journey', e);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    reload();
    const unsubscribe = window.electron.ipcRenderer.on(
      'journey:updated',
      (next: any) => setState(next),
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [enabled, reload]);

  return { enabled, state, setState, reload };
}
