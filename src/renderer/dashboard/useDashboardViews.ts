import React from 'react';
import { useSettings } from '../context/SettingsContext';

// Shared state for the dashboard's view-switcher card (Today / Mountain Climb / Daily Quest),
// used by both the Classic and Luma dashboards.
export default function useDashboardViews() {
  const { settings } = useSettings();

  // Persist state in localStorage
  const [activeView, setActiveView] = React.useState(() => {
    const saved = localStorage.getItem('dashboard_active_view');
    return saved !== null ? parseInt(saved, 10) : 0;
  });

  const isMountainClimbEnabled =
    settings && settings.mountain_climb_enabled !== 'false';

  // View 1 (Mountain Climb) only exists when the setting is enabled - views 0 and 2 are
  // always available.
  const availableViews = isMountainClimbEnabled ? [0, 1, 2] : [0, 2];

  // Force back to first view if the current view is the (now-disabled) Mountain Climb one
  React.useEffect(() => {
    if (!isMountainClimbEnabled && activeView === 1) {
      setActiveView(0);
    }
  }, [isMountainClimbEnabled, activeView]);

  const handleViewChange = (idx: number) => {
    setActiveView(idx);
    localStorage.setItem('dashboard_active_view', idx.toString());
  };

  return {
    activeView,
    availableViews,
    isMountainClimbEnabled,
    handleViewChange,
  };
}
