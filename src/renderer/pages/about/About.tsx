import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import DirectionsRunOutlinedIcon from '@mui/icons-material/DirectionsRunOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import ScreenSearchDesktopOutlinedIcon from '@mui/icons-material/ScreenSearchDesktopOutlined';
import CodeIcon from '@mui/icons-material/Code';
import PetsOutlinedIcon from '@mui/icons-material/PetsOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

// About Thingy - what the app does and, honestly, how its "AI" parts work. Keep this in
// sync with the code: numbers here (thresholds, layer sizes...) are the real ones.

const VERSION = '0.17.0';

const FEATURES: { icon: React.ReactNode; title: string; text: string }[] = [
  {
    icon: <TaskAltOutlinedIcon />,
    title: 'Tasks',
    text: 'List and board views, checklists, tags, story points and links to Azure DevOps, GitHub or Jira. Time tracking with a timer or Pomodoro.',
  },
  {
    icon: <TimerOutlinedIcon />,
    title: 'Focus blocks',
    text: 'When you start a task, Thingy proposes one small goal (the next checklist step) and a block length that fits your usual stamina. Finished steps and blocks show up as today’s wins.',
  },
  {
    icon: <DirectionsRunOutlinedIcon />,
    title: 'Sprints',
    text: 'Sprint planning with capacity, excluded days, a velocity check against your past sprints and a risk warning when the remaining work no longer fits.',
  },
  {
    icon: <EventRepeatOutlinedIcon />,
    title: 'Habits',
    text: 'Daily or weekday-specific habits with streaks, a strength chart and reminders. Only habits scheduled for today count towards today’s progress.',
  },
  {
    icon: <InsightsOutlinedIcon />,
    title: 'Statistics',
    text: 'Focused time per day and hour, deep-work share, focus-quality trend, task breakdowns and a day-by-day work history.',
  },
  {
    icon: <ScreenSearchDesktopOutlinedIcon />,
    title: 'Monitoring',
    text: 'Which desktop apps and websites (via the Thingy Companion Chrome extension) took your time, grouped as Work, Learning, Distraction or Neutral. You can recategorise anything.',
  },
  {
    icon: <CodeIcon />,
    title: 'Dev Notes',
    text: 'Markdown, JSON and SQL notes with syntax highlighting, formatting and validation, notebooks, tags, search, version history and .md/.json/.sql import/export, plus tools: compare JSON, SQL or text side by side, DevTools cURL/fetch → WebStorm HTTP Client, and Base64 ↔ file.',
  },
  {
    icon: <PetsOutlinedIcon />,
    title: 'Assistant',
    text: 'An on-screen companion (drop, owl, dog, snake or cat) with short context-aware messages, quick actions and the daily standup report.',
  },
  {
    icon: <EmojiEventsOutlinedIcon />,
    title: 'Gamification',
    text: 'XP, levels, 20 achievements and daily quests for finished work and habits. Optional: pick the Warrior as your assistant to play one board game per sprint – finished tasks earn dice rolls (bigger tasks, more rolls), the map hides treasure and battles, and the gear you collect has to beat the boss before the sprint ends.',
  },
];

const SECTIONS: {
  title: string;
  tags: string[];
  summary: string;
  points: string[];
}[] = [
  {
    title: 'Estimates from your own history',
    tags: ['Statistics', 'No API calls'],
    summary:
      'Suggests how long a new task will really take, based on how your similar past tasks went.',
    points: [
      'Similar tasks are found by tags, task type and the context in the task link: organisation, project and repository for Azure DevOps (dev.azure.com and *.visualstudio.com), GitHub and GitLab, the project key for Jira. Only the URL text is read; nothing is fetched.',
      'For each match, the ratio of actual to estimated time is taken; the suggestion uses a weighted median of these ratios (closer matches weigh more), limited to 0.25×–4×.',
      'It shows how many tasks it is based on and what matched, and is offered when you type an estimate for a new task.',
    ],
  },
  {
    title: 'NeuralCore – duration prediction',
    tags: ['TensorFlow.js', 'Trained locally'],
    summary:
      'A small neural network that learns how long your tasks take from completed tasks with tracked time.',
    points: [
      'Network: 10 inputs → dense 8 → dense 4 → 1 output (minutes), dropout 0.2. Inputs: hour and weekday (sin/cos), priority, sleep score, meeting load, habit score, story points and focus context.',
      'Training: mean squared error with Adam, up to 30 epochs with early stopping (patience 5) and a 20% validation split. Runs once a day and on demand, needs at least 5 tasks and waits 10 minutes between runs.',
      'Maturity is the number of samples the saved model was trained on (100 samples = 100%). The prediction is blended with the history-based estimate above, and the network’s weight grows with maturity, so a young model can’t mislead you.',
      'Accuracy and confidence are only shown when there is data to compute them from.',
    ],
  },
  {
    title: 'Procrastination risk',
    tags: ['TensorFlow.js', 'Classifier'],
    summary:
      'Estimates which open tasks you are likely to put off, so you can split or schedule them early.',
    points: [
      'Network: 8 inputs → 16 → 8 → 1 (sigmoid). Inputs: task age, difficulty (estimate × story points), priority, app switches in the last hour, recent time on distracting sites, time of day and days since a similar task.',
      'Labels come from your history: a finished task counts as procrastinated if it took more than twice its estimate or more than 7 days.',
      'Needs at least 10 finished tasks with an estimate. Until the model is trained it reports no risk at all instead of guessing. Tasks with risk above 70% get a badge on the task list.',
    ],
  },
  {
    title: 'Productivity analysis',
    tags: ['Statistics'],
    summary:
      'Plain statistics over your tracked sessions that feed the dashboard and the planner.',
    points: [
      'Peak hours: time worked per hour of day, sessions from the last 7 days count double. Hours with no work are never reported as peaks.',
      'Stamina: recommended session length = mean + 1.5 standard deviations of your sessions, kept between 30 and 120 minutes. Used for focus-block length.',
      'Trend: linear regression over the last 14 days, reported only with at least 3 days of data.',
      'Also: tag consistency (coefficient of variation), task scoring for the auto-planner (a WSJF variant) and sprint risk (remaining work vs. capacity).',
    ],
  },
  {
    title: 'Focus score',
    tags: ['Monitoring'],
    summary:
      'How much of your recent tracked activity went to work versus distractions.',
    points: [
      'Computed from desktop app and website activity, using their categories. Common developer tools and sites have sensible defaults; you can change any category in Monitoring.',
      'With no recorded activity there is no score – it is never shown as 0% or 100% by default.',
    ],
  },
  {
    title: 'Notifications and assistant messages',
    tags: ['Context-aware'],
    summary: 'Interruptions only when they are likely to help.',
    points: [
      'Notifications: fatigue (long session with falling focus), meeting overload, low sleep, distraction, unfinished habits and flow. At most one every 15 minutes; after a “you’re in the zone” message it stays quiet for 30 minutes.',
      'The habit nudge comes once a day after 14:00 and names only habits scheduled for today without their own reminder.',
      'If a timer was left running for a long time with no activity, Thingy asks whether to count the time only until your last activity.',
      'The assistant speaks only when the context changes (idle for 10+ minutes, focus moving by more than 15 points, sprint mood) and avoids repeating its last 10 messages.',
    ],
  },
  {
    title: 'Daily standup report',
    tags: ['Report'],
    summary:
      'A short summary of the day from the assistant: time worked, tasks finished and in progress, deep work, insights and up to three recommendations.',
    points: [
      'Focus judgements are made only after at least an hour of work, and estimate accuracy uses the median difference so one outlier doesn’t skew it.',
    ],
  },
];

function About() {
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 4 }}>
      <Paper sx={{ p: { xs: 3, md: 4 }, mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 400 }}>
          Thingy
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
          A focus-first productivity app for developers · v{VERSION}
        </Typography>
        <Typography sx={{ mt: 2, maxWidth: 760 }}>
          Thingy helps you cut distractions, stay on one task at a time and
          actually see your progress. It tracks where your time goes, breaks
          work into small goals you can finish, and learns from your own history
          to make estimates and suggestions more realistic.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {FEATURES.map((f) => (
          <Grid item xs={12} sm={6} md={4} key={f.title}>
            <Paper sx={{ p: 2.5, height: '100%' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1,
                  color: 'text.secondary',
                }}
              >
                {f.icon}
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: 'text.primary' }}
                >
                  {f.title}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {f.text}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" sx={{ mt: 4, mb: 0.5, fontWeight: 400 }}>
        How the smart parts work
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Everything below runs on your computer. Models are trained locally on
        your own data, and where there isn’t enough data yet, Thingy says so
        instead of guessing.
      </Typography>

      {SECTIONS.map((section, i) => (
        <Accordion key={section.title} defaultExpanded={i === 0} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {section.title}
                </Typography>
                {section.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {section.summary}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {section.points.map((point) => (
                <Typography
                  component="li"
                  variant="body2"
                  key={point}
                  sx={{ mb: 0.75 }}
                >
                  {point}
                </Typography>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      <Paper
        sx={{
          p: 2.5,
          mt: 3,
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-start',
        }}
      >
        <LockOutlinedIcon sx={{ color: 'text.secondary', mt: 0.25 }} />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Your data stays on this computer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tasks, notes, activity and trained models are stored locally (an
            SQLite database in the app’s data folder). The Chrome extension
            talks only to Thingy’s local server on 127.0.0.1, and the estimate
            and AI features make no network requests.
          </Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 2.5, mt: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Built with
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {[
            'Electron',
            'React 18',
            'TypeScript',
            'Material UI',
            'MUI X DataGrid',
            'Chart.js',
            'TensorFlow.js',
            'sql.js (SQLite)',
            'marked + highlight.js',
            'Lottie',
          ].map((tech) => (
            <Chip key={tech} label={tech} size="small" />
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

export default About;
