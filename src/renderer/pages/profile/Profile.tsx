import React from 'react';
import { Box, Paper, Typography, Grid, LinearProgress, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { useGamification } from '../../context/GamificationContext';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DailyChallengeWidget from '../../components/DailyChallengeWidget';

const allAchievements = [
  { id: 'FIRST_TASK', name: 'First Step', description: 'Complete your first task.' },
  { id: 'FIVE_TASKS', name: 'Apprentice', description: 'Complete 5 tasks.' },
  { id: 'TEN_TASKS', name: 'Journeyman', description: 'Complete 10 tasks.' },
];

function Profile() {
  const { profile, earnedAchievements, rank } = useGamification();

  if (!profile) {
    return <Typography>Loading profile...</Typography>;
  }

  const xpForNextLevel = profile.level * 100;
  const xpProgress = (profile.xp / xpForNextLevel) * 100;

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12}>
          <Paper sx={{ padding: 3, textAlign: 'center' }}>
            <Typography variant="h3" component="div" gutterBottom>
              {rank}
            </Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
              Level {profile.level}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress variant="determinate" value={xpProgress} sx={{ height: 10, borderRadius: 5 }} />
              </Box>
              <Box sx={{ minWidth: 60 }}>
                <Typography variant="body2" color="text.secondary">{`${profile.xp}/${xpForNextLevel} XP`}</Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Daily Challenge */}
        <Grid item xs={12} md={6}>
            <DailyChallengeWidget />
        </Grid>

        {/* Achievements Card */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom>Achievements</Typography>
            <List>
              {allAchievements.map(ach => {
                const isEarned = earnedAchievements.includes(ach.id);
                return (
                  <ListItem key={ach.id} sx={{ opacity: isEarned ? 1 : 0.4 }}>
                    <ListItemIcon>
                      <EmojiEventsIcon color={isEarned ? "warning" : "disabled"} />
                    </ListItemIcon>
                    <ListItemText
                      primary={ach.name}
                      secondary={ach.description}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Profile;

