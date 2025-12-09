import React, { useMemo } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip } from 'react-tooltip';
import 'react-calendar-heatmap/dist/styles.css';
import { Paper, Box } from '@mui/material';
import { useTimer } from '../context/TimerContext';

const formatTooltipContent = (value: any) => {
  if (!value || !value.date) {
    return 'No activity';
  }
  const date = new Date(value.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const minutes = value.count || 0;
  if (minutes === 0) {
    return `${date}: No activity`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${date}: ${hours}h ${remainingMinutes}m`;
  }
  return `${date}: ${remainingMinutes}m`;
};

const ContributionGraph = () => {
  const { contributionData } = useTimer();

  const data = useMemo(() => {
     return contributionData.map((r: any) => ({
      date: r.date,
      count: Math.ceil(r.totalDuration / (1000 * 60)), // Convert to minutes
    }));
  }, [contributionData]);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 1);

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        '.react-calendar-heatmap-week:nth-of-type(1)': { display: 'none' },
        '.react-calendar-heatmap .color-empty': {
          fill: '#eeeeee',
        },
        '.react-calendar-heatmap .color-scale-1': {
          fill: '#8ecae6',
        },
        '.react-calendar-heatmap .color-scale-2': {
          fill: '#219ebc',
        },
        '.react-calendar-heatmap .color-scale-3': {
          fill: '#116581',
        },
        '.react-calendar-heatmap .color-scale-4': {
          fill: '#023047',
        },
      }}
    >
      <Box sx={{ overflowX: 'auto', pb: 2 }}>
        <CalendarHeatmap
          startDate={startDate}
          endDate={endDate}
          values={data}
          classForValue={(value) => {
            if (!value || value.count === 0) {
              return 'color-empty';
            }
            if (value.count > 480) return 'color-scale-4'; // 8+ hours
            if (value.count > 240) return 'color-scale-3'; // 4+ hours
            if (value.count > 60) return 'color-scale-2';  // 1+ hour
            return 'color-scale-1';   // Any work
          }}
          tooltipDataAttrs={(value: any) => ({
            'data-tooltip-id': 'contribution-tooltip',
            'data-tooltip-content': formatTooltipContent(value),
          })}
        />
      </Box>
      <Tooltip id="contribution-tooltip" />
    </Paper>
  );
};

export default ContributionGraph;
