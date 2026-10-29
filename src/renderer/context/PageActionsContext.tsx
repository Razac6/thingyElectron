import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useIsLuma } from '../themes';

export interface PageAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  // The page's main action ("New task") - shown as a labelled pill, the rest as icons
  primary?: boolean;
}

type SetPageActions = (actions: PageAction[]) => void;

// Provided by Layout, which renders the registered actions in Luma's floating toolbar
export const PageActionsContext = createContext<SetPageActions | null>(null);

/**
 * Registers a page's actions (add, toggles...) with the floating toolbar next to search.
 * Only active in the Luma theme - returns true when the toolbar shows them, so the page
 * should skip rendering its own SpeedDial / FAB.
 */
export function usePageActions(actions: PageAction[]): boolean {
  const setActions = useContext(PageActionsContext);
  const isLuma = useIsLuma();
  const enabled = isLuma && setActions !== null;

  // Handlers close over fresh page state every render; keep the latest ones in a ref so
  // the toolbar only re-registers when what it shows (keys/labels) actually changes.
  const latest = useRef(actions);
  latest.current = actions;
  const signature = actions.map((a) => `${a.key}:${a.label}`).join('|');

  useEffect(() => {
    if (!enabled || !setActions) return undefined;
    setActions(
      latest.current.map((action) => ({
        ...action,
        onClick: () =>
          latest.current.find((a) => a.key === action.key)?.onClick(),
      })),
    );
    return () => setActions([]);
  }, [enabled, setActions, signature]);

  return enabled;
}
