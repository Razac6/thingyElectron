# Project: Thingy (Electron Todo App)

## Overview
"Thingy" is a desktop Todo application built with Electron, React, and TypeScript. It appears to be based on the Electron React Boilerplate (ERB).
**Refactor Note:** The application has been converted to run completely offline. It uses `sql.js` (SQLite) for data persistence and has removed external API dependencies (including OpenAI chat integration).

## Key Technologies
*   **Runtime:** Electron
*   **Frontend:** React, TypeScript
*   **UI Framework:** Material UI (MUI) v5, Emotion
*   **Routing:** react-router-dom (MemoryRouter)
*   **State/Data:** Local state, `DatabaseService` (IPC to `sql.js` SQLite database), **No External API**.
*   **Build Tools:** Webpack, electron-builder
*   **Testing:** Jest
*   **Linting/Formatting:** ESLint, Prettier

## Building and Running

### Prerequisites
*   Node.js (>=14.x)
*   npm (>=7.x)

### Commands
*   **Install Dependencies:**
    ```bash
    npm install
    ```
*   **Start Development Server:**
    ```bash
    npm start
    ```
    This will start the renderer process (React) and likely trigger the main process.
*   **Build for Production:**
    ```bash
    npm run build
    ```
    Compiles both main and renderer processes.
*   **Package Application:**
    ```bash
    npm run package
    ```
    Builds and packages the application for the current OS (creates an executable/installer in `release/build`).
*   **Run Tests:**
    ```bash
    npm test
    ```
*   **Lint Code:**
    ```bash
    npm run lint
    ```

## Architecture & Directory Structure

The project follows a standard Electron separation of concerns:

*   **`.erb/`**: Configuration for Electron React Boilerplate (Webpack, scripts).
*   **`assets/`**: Static assets (icons, images).
*   **`src/`**: Source code.
    *   **`main/`**: Electron **Main Process** code.
        *   `main.ts`: Entry point. Handles window creation, IPC events, and app lifecycle.
        *   `preload.ts`: Preload script for secure bridge between main and renderer.
    *   **`renderer/`**: Electron **Renderer Process** (React App).
        *   `App.tsx`: Main React component and Router setup.
        *   `dashboard/`: Dashboard view component.
        *   `pages/`: Top-level page components (e.g., `list`, `chat`).
        *   `components/`: Reusable UI components (e.g., `ProductivityChart`, `Login`).
        *   `services/`: Data services (e.g., `DatabaseService`).
    *   **`interfaces/`**: TypeScript interfaces for data models (Task, User, Session, etc.).
    *   **`enums/`**: Enumerations (Status, Priority).

## Development Conventions

*   **Styling:** The project uses **Material UI (MUI)** components and **Emotion** for styling. Custom styling often uses MUI's `styled` API.
*   **Routing:** `react-router-dom` is used with `MemoryRouter`, which is typical for Electron apps to avoid issues with file-based routing.
*   **Data Management:** Data fetching seems to be encapsulated in service files (e.g., `DatabaseService`). `useEffect` hooks are used in components to trigger data fetching.
*   **Strict Types:** TypeScript is enabled with `strict: true` in `tsconfig.json`.
*   **Code Style:** ESLint (Airbnb config) and Prettier are configured to enforce code style.
