# Thingy - Intelligent Productivity Assistant

**Thingy** is an advanced desktop productivity application (Electron + React) designed for developers and knowledge workers. It combines a powerful task manager with a local **Neural AI Core** to predict task durations, optimize schedules, and act as an interactive productivity companion.

All data (including the AI model and activity logs) is stored and processed **locally** on your device (SQLite + TensorFlow.js), ensuring 100% privacy.

---

## 🧠 The "Brain": Neural Core 2.0

Thingy learns how you work using a custom TensorFlow.js model trained on your history.

### 8-Dimensional Prediction Model
Unlike simple average calculators, Thingy considers 8 factors to predict task duration:
1.  **Time of Day:** Are you a night owl or an early bird?
2.  **Day of Week:** Do Mondays drag on?
3.  **Task Priority:** How does urgency affect your speed?
4.  **Sleep Score:** (From Daily Bio) Are you rested?
5.  **Meeting Load:** Is your day fragmented by calls?
6.  **Habit Discipline:** Are you maintaining your routines?
7.  **Story Points:** How complex is the task? The AI learns your personal "Velocity".
8.  **Focus Context:** Were you distracted (social media) or focused (IDE) before starting?

---

## ✨ Key Features

### 🐾 AI Companion & Health Guardian
A new interactive companion (the Cat) lives on your desktop to support your well-being and focus.
*   **Animated Companion:** A Lottie-animated cat that reacts to your productivity streaks and health needs.
*   **Health Reminders:** Configurable reminders for:
    *   💧 **Hydration:** Smart nudges based on your work intervals.
    *   🏃 **Stretching:** Alerts to correct posture (with smart idle detection).
    *   🧘‍♀️ **Immersive Meditation:** A dedicated, calming full-screen mode with a **Liquid Timer** to help you recharge.
*   **Daily Standup:** Every morning (or on demand), the Cat provides a comprehensive report:
    *   Yesterday's summary (Focus time, completed tasks).
    *   Today's **Daily Quest** (Gamified challenge).
    *   AI-suggested starting task.
*   **Glassmorphism UI:** Modern, translucent UI for the companion's bubble.

### 🔥 Boost Mode (Deep Work Overlay)
Toggle "Boost Mode" to enter a hyper-focused state.
*   **Liquid Timer:** A beautiful, animated liquid progress bar keeps you aware of time passing.
*   **🍅 Pomodoro Integration:** Run dedicated Pomodoro sessions (25 min default) with a specialized red theme and downward-flowing liquid animation.
*   **Subtasks:** Manage granular checklists directly within the Boost overlay without leaving your flow.

### 🛡️ Advanced Distraction Blocking
*   **Chrome Integration:** Syncs with a companion extension to block distracting sites.
*   **"Always Block" Mode:** Permanently block specific URLs (like `youtube.com/shorts`) regardless of timers.
*   **UI Hiding:** Dynamic logic to remove distracting elements (like YouTube Shorts sidebar) directly from the browser UI.

### 📅 AI Auto-Planner
*   **One-Click Scheduling:** The AI reorders your daily to-do list based on predicted effort, deadlines, and your current energy level.
*   **Smart Suggestions:** "You have a 30m gap before the next meeting. Here's a quick task you can finish."

### 🎮 Gamification 2.0
*   **XP & Ranks:** Progress through Slavic Bestiary-inspired ranks (Utopiec, Leszy, Bies...).
*   **Daily Quests:** Dynamic challenges like "Pomodoro Marathon" or "Hydration Hero".
*   **Achievements:** Unlock badges for health and productivity milestones (e.g., "Zen Master", "Pomodoro Master").

---

## 🛠️ Tech Stack

*   **Frontend:** React, Material UI (MUI), Framer Motion / Lottie.
*   **Backend:** Electron, Node.js.
*   **Database:** SQLite (via `sql.js` - embedded).
*   **AI:** TensorFlow.js (Linear Regression / Dense Layers).
*   **Integration:** Chrome Extension API (DeclarativeNetRequest + Content Scripts).

---

## 🚀 Getting Started

1.  **Install:** Run `npm install`.
2.  **Dev Mode:** Run `npm start`.
3.  **Extension:** Load the `./chrome-extension/dist` folder in Chrome (Developer Mode).
4.  **Version Management:** Use `npm run bump` for app and `npm run bump:plugin` for the extension.

## 🔒 Privacy First
Thingy is designed for privacy. It does **not** send your task data, browsing history, or AI model to the cloud. Everything lives locally.
