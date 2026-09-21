import React from 'react';
import { SvgIconProps } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import PetsIcon from '@mui/icons-material/Pets';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import FavoriteIcon from '@mui/icons-material/Favorite';
import WavesIcon from '@mui/icons-material/Waves';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import ShieldIcon from '@mui/icons-material/Shield';
import LocalDrinkIcon from '@mui/icons-material/LocalDrink';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import ParkIcon from '@mui/icons-material/Park';
import PublicIcon from '@mui/icons-material/Public';
import BoltIcon from '@mui/icons-material/Bolt';
import CelebrationIcon from '@mui/icons-material/Celebration';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import AvTimerIcon from '@mui/icons-material/AvTimer';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import AlarmIcon from '@mui/icons-material/Alarm';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import PsychologyIcon from '@mui/icons-material/Psychology';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import TimerIcon from '@mui/icons-material/Timer';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

// Emoji -> MUI icon component. Keys are normalized (variation selector U+FE0F stripped -
// see stripVariationSelector below) so "⚠" and "⚠️" both match the same entry.
export const EMOJI_ICON_MAP: Record<
  string,
  React.ComponentType<SvgIconProps>
> = {
  '🍅': TimerIcon,
  '⚠': WarningAmberIcon,
  '🏆': EmojiEventsIcon,
  '💧': WaterDropIcon,
  '🐾': PetsIcon,
  '🔥': LocalFireDepartmentIcon,
  '🤞': FavoriteIcon,
  '🌊': WavesIcon,
  '💪': FitnessCenterIcon,
  '🧘‍♀': SelfImprovementIcon,
  '🧘‍♂': SelfImprovementIcon,
  '🛡': ShieldIcon,
  '🥛': LocalDrinkIcon,
  '🤸': AccessibilityNewIcon,
  '🎯': TrackChangesIcon,
  '🚀': RocketLaunchIcon,
  '😴': BedtimeIcon,
  '👀': VisibilityIcon,
  '🏖': BeachAccessIcon,
  '🤖': SmartToyIcon,
  '📈': TrendingUpIcon,
  '☕': LocalCafeIcon,
  '🌳': ParkIcon,
  '🌍': PublicIcon,
  '🌐': PublicIcon,
  '🖥': DesktopWindowsIcon,
  '💥': BoltIcon,
  '⚡': BoltIcon,
  '🙌': CelebrationIcon,
  '🚨': ReportProblemIcon,
  '🔴': FiberManualRecordIcon,
  '⏳': HourglassEmptyIcon,
  '💡': LightbulbIcon,
  '✅': CheckCircleIcon,
  '🔄': AutorenewIcon,
  '🌟': AutoAwesomeIcon,
  '📦': Inventory2Icon,
  '🤔': HelpOutlineIcon,
  '📊': BarChartIcon,
  '⏱': AvTimerIcon,
  '📅': CalendarTodayIcon,
  '☀': WbSunnyIcon,
  '⏰': AlarmIcon,
  '🎉': CelebrationIcon,
  '🏃': DirectionsRunIcon,
  '🧠': PsychologyIcon,
  '❓': HelpCenterIcon,
  '←': ArrowBackIcon,
  '↵': KeyboardReturnIcon,
};

// Strips variation selector-16 (U+FE0F) - many emoji appear both with and without it
// depending on how they were typed, but visually/semantically they're the same glyph.
const stripVariationSelector = (s: string) => s.replace(/️/g, '');

const MAP_KEYS = Object.keys(EMOJI_ICON_MAP).sort(
  (a, b) => b.length - a.length,
);
const MATCH_REGEX = new RegExp(
  `(${MAP_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'gu',
);

/**
 * Renders a string, replacing any emoji found in EMOJI_ICON_MAP with an inline MUI icon.
 * Emoji not in the map are left as literal text (safe fallback - nothing disappears).
 * Use wherever text that may contain emoji is displayed, whether the string was authored
 * in a renderer component or received from the main process (AI messages, notifications
 * relayed into the UI, task scheduler reasons, etc).
 */
export function renderTextWithIcons(
  text: string | null | undefined,
  iconProps?: SvgIconProps,
): React.ReactNode {
  if (!text) return text;
  const normalized = stripVariationSelector(text);
  const parts = normalized.split(MATCH_REGEX).filter((p) => p !== '');

  return parts.map((part, i) => {
    const Icon = EMOJI_ICON_MAP[part];
    if (Icon) {
      return (
        <Icon
          key={i}
          fontSize="inherit"
          sx={{ verticalAlign: 'text-bottom', mx: '2px' }}
          {...iconProps}
        />
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
