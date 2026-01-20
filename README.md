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
7.  **Story Points:** (New!) How complex is the task? The AI learns your personal "Velocity".
8.  **Focus Context:** (New!) Were you distracted (social media) or focused (IDE) before starting?

---

## ✨ Key Features

### 🔥 Boost Mode (Deep Work Overlay)
Toggle "Boost Mode" to enter a hyper-focused state.
*   **Immersive Overlay:** When you start a timer, the entire interface is dimmed and blurred.
*   **Liquid Timer:** A beautiful, animated liquid progress bar keeps you aware of time passing without numeric stress.
*   **Visual Focus:** No distractions, just your current task and the flow.

### 🤖 AI Personality & Companion
Your dashboard isn't static. A built-in AI bot observes your work style in real-time.
*   **Context-Aware:** It cheers you on during high-focus streaks ("Grind Mode") and gently nudges you if you get distracted by social media.
*   **Interactive Bubble:** Reacts to your "Daily Bio" state (e.g., suggests a break if you're fatigued).
*   **Localized:** Fully supports Polish language interactions.

### 🌐 Chrome Integration & Azure DevOps
Thingy extends beyond the desktop with a companion Chrome Extension.
*   **Quick Capture:** Right-click any task in **Azure DevOps**, Jira, or GitHub to instantly add it to Thingy.
    *   Parses **ID**, **Title**, and **Story Points** automatically.
*   **Focus Context:** The extension monitors (privately) if you are visiting distracting sites (FB, YT) vs. work sites, feeding this data to the Neural Core to adjust predictions.

### 📅 AI Auto-Planner
*   **One-Click Scheduling:** The AI reorders your daily to-do list based on predicted effort, deadlines, and your current energy level.
*   **Smart Suggestions:** "You have a 30m gap before the next meeting. Here's a quick task you can finish."

### 🎮 Gamification
*   **XP System:** Earn experience for completing tasks, maintaining streaks, and working in "Deep Work" blocks.
*   **Achievements:** Unlock badges for milestones (e.g., "Bug Squasher", "Marathon Runner").
*   **Habit Forge:** Track daily habits with visual streaks and heatmaps.

---

## 🛠️ Tech Stack

*   **Frontend:** React, Material UI (MUI), Framer Motion / Lottie.
*   **Backend:** Electron, Node.js.
*   **Database:** SQLite (via `sql.js` - embedded).
*   **AI:** TensorFlow.js (Linear Regression / Dense Layers).
*   **Integration:** Chrome Extension API, Local HTTP Server.

---

## 🚀 Getting Started

1.  **Install:** Run `npm install`.
2.  **Dev Mode:** Run `npm start`.
3.  **Extension:** Load the `./chrome-extension` folder in Chrome (Developer Mode).
4.  **Usage:**
    *   Set your **Daily Bio** (Sleep/Mood).
    *   Add tasks (optionally import from Azure via right-click).
    *   Click **Boost** (🔥 icon) and start a timer to see the Liquid Overlay.
    *   Watch the AI learn and adapt to your style!

## 🔒 Privacy First
Thingy is designed for privacy. It does **not** send your task data, browsing history, or AI model to the cloud. Everything lives in your `%AppData%/Thingy` folder.
