# Thingy - Intelligent Productivity Assistant

**Thingy** is an advanced desktop productivity application (Electron + React) that goes far beyond standard "To-Do" lists. It features a built-in **Artificial Intelligence Engine (Neural Core)** and a suite of **Analytical Algorithms** that learn your work style, predict task duration, and optimize your daily schedule.

All data (including the AI model) is stored and processed **locally** on your device (SQLite + TensorFlow.js), ensuring 100% privacy.

---

## 🧠 The "Brain" of the App

The application relies on two pillars of intelligence:

### 1. Neural Core (The AI)
A custom machine learning model (TensorFlow.js) that trains on your work history.
*   **Model Inputs:** Hour of day, Day of week, Task Priority, Sleep Score, Meeting Load.
*   **Output:** Predicted *actual* duration of a task (in minutes).
*   **"Reality Check" Feature:** A chart comparing your actual work vs. AI predictions. It helps detect "Flow" states (working faster than predicted) or hidden blockers/procrastination.
*   **Maturity:** The model needs data. Below 50% maturity, it learns and observes. Above this threshold, it actively provides advice and visualizations.

### 2. Analytical Algorithms (Productivity Analyst)
A set of deterministic algorithms analyzing your biometric and logistical data:
*   **Tag Difficulty Profile:** The system learns your velocity per tag. For example, it might learn that tasks tagged `#backend` typically take you 150% of your estimated time (Multiplier 1.5), while `#docs` take only 50% (Multiplier 0.5).
*   **Peak Hours:** Identifies the specific hours of the day when you are most productive.
*   **Fatigue Analysis:** Calculates your average session length and recommends optimal break times based on the standard deviation of your focus.
*   **Deep Work Score:** Measures the percentage of time spent in uninterrupted work sessions (>20 min).

---

## ✨ Key Features

### 📅 AI Auto-Planner & Scheduling
*   **One-Click Auto-Schedule:** A magic wand feature that physically reorders your task list. It calculates an optimal "Score" for each task by combining:
    *   **Neural Prediction:** How long will this take *you* today, given your sleep and meeting load?
    *   **Tag Difficulty:** Are you historically fast or slow with this type of task?
    *   **Sprint Pressure:** Is the deadline approaching?
    *   **Priority:** High priority tasks get a base boost.
*   **Result:** A list sorted to maximize your impact, with a "Quick Wins first" strategy within priority tiers.
*   **AI Proposal:** Before applying changes, you see a modal explaining *why* the AI sorted tasks this way (e.g., "🔥 Priority + ⏳ Sprint Ending").

### ⏱️ Time & Context Tracking
*   **Smart Timer:** Integrated stopwatch for tasks.
*   **Smart Insights Widget:** A dashboard widget where you input context: **Sleep Score** and **Meeting Load**. These inputs directly feed into the Neural Core.
*   **Idle Detection:** If you walk away, the system asks if you want to discard the idle time (unless it's a "Meeting" task, where it discreetly asks after the fact).

### 🚀 Sprint Management
*   **Full Lifecycle:** Create, Start, Complete, and Edit sprints.
*   **Capacity Planning:** The system suggests a realistic capacity (in hours) for new sprints based on your historical velocity.
*   **Drag & Drop:** Intuitive manual reordering with visual drop targets.

### 🔨 Habit Forge (Habit Tracker)
*   **Weekly View:** A modern, bubble-based interface to track your habits for the current week.
*   **Visual Streaks:** Automatic streak calculation with "active" status preservation (doesn't reset immediately in the morning).
*   **Interactive Widget:** Toggle your favorite habit directly from the Dashboard.
*   **Detailed Analytics:** Expand habit cards to see a line chart of your "Habit Strength" (7-day moving average).

### 🎮 Gamification
*   **XP System & Levels:** Earn experience points for completing tasks and challenges.
*   **Achievements:** Badges for specific behaviors (e.g., "Frog Eater" for tackling hard tasks first).
*   **Daily Modes:** Set your mode: *Normal*, *Boost* (high performance), or *Recovery* (health focus). The system adapts challenges to your mode.

### 📊 Reporting
*   **AI Daily Report:** Generate a text summary on demand. The AI compares its predictions with your actuals, comments on your pace, and summarizes your logistical stats (meetings, deep work).
*   **Statistics:** Charts for Productivity over Time, Hourly Distribution, Status Breakdown, and Neural Core Health.

---

## 🛠️ Tech Stack

*   **Frontend:** React, Material UI (MUI), Recharts / Chart.js.
*   **Backend (Main Process):** Electron, Node.js.
*   **Database:** SQLite (via `sql.js` - embedded, zero-config).
*   **AI/ML:** TensorFlow.js (running in the Node.js process).

---

## 🎯 Who is this for?

1.  **Freelancers & Developers:** Who need to self-manage and want to know the *real* cost of different task types.
2.  **People with ADHD / Focus Issues:** The "AI Auto-Planner" removes the decision fatigue of "what to do next." The system simply highlights the best next step.
3.  **Productivity Biohackers:** People who want to correlate their performance with sleep, time of day, and habits.

---

## 🚀 Getting Started

1.  **Launch** the app.
2.  Create your first **Sprint**.
3.  **Add tasks** (define Priority and Estimate). Use tags like `#css` or `#api` to let the system learn your context.
4.  In **Smart Insights** (Dashboard), set your Sleep Score.
5.  Click **Start** on a task.
6.  Check **Statistics -> Neural Core AI** after a few days to see the model learning your patterns.