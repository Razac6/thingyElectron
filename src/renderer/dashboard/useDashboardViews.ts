import React from 'react';

// Shared state for the dashboard's view-switcher card (Today / Daily Quest),
// used by both the Classic and Luma dashboards.
export default function useDashboardViews() {
  // Persist state in localStorage
  const [activeView, setActiveView] = React.useState(() => {
    const saved = localStorage.getItem('dashboard_active_view');
    // view 1 was the Mountain Climb - gone
    return saved === '2' ? 2 : 0;
  });

  const availableViews = [0, 2];

  const handleViewChange = (idx: number) => {
    setActiveView(idx);
    localStorage.setItem('dashboard_active_view', idx.toString());
  };

  return {
    activeView,
    availableViews,
    handleViewChange,
  };
}
