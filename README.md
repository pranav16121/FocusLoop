# FocusLoop 🧭

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.
> **Get back to what matters.**  
> An ADHD-friendly focus companion designed around **gentle context recovery** instead of punishment.

Official website: [focus-loop.tech](https://www.focus-loop.tech)

Currently, two official plugins are available:
---

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)
## 💡 The Core Problem & Philosophy

## React Compiler
People with ADHD often know exactly what they need to do, but during a work session they lose focus, switch tabs, get distracted, or lose their working memory of what they were just doing.

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).
Traditional productivity tools punish distraction with red streaks, guilt-inducing alerts ("You failed!", "You got distracted again"), or rigid Pomodoro timers.

## Expanding the Oxlint configuration
**FocusLoop is different:**
- **Zero Guilt:** No shaming language. When you step away and return, FocusLoop welcomes you back with: *"Welcome back. Here's where you left off."*
- **One Next Step at a Time:** Breaks overwhelming tasks into tiny, startable micro-actions.
- **Context Recovery ("Where was I?"):** Reconstructs your task, completed progress, and exact next tiny action so you don't have to spend 15 minutes figuring out where you were.
- **Adaptive Continuity:** Automatically recommends the next session length based on your momentum and continuity history.
- **Non-Invasive Privacy:** Uses only browser tab visibility and local page inactivity. No webcams, no facial recognition, no biometric tracking, and no medical claims.

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
---

## 🔄 Core User Flow

```
LANDING / HOME
      ↓
ENTER TASK ("Study Network Analysis for tomorrow's exam")
      ↓
AI TASK BREAKDOWN (5 bite-sized micro-steps with progressive reveal)
      ↓
FOCUS SESSION (Calm, distraction-free timer + current micro-step)
      ↓
DRIFT / INTERRUPTION DETECTION (Detects tab switches or prolonged inactivity)
      ↓
GENTLE RETURN ("Welcome back. You stepped away for about 3 minutes. Ready to continue?")
      ↓
CONTEXT RECOVERY ("Where was I?" — Re-anchors completed steps & next tiny action)
      ↓
SESSION COMPLETE (Lightweight, guilt-free reflection)
      ↓
ADAPTIVE NEXT SESSION (Smart duration recommendation for the next micro-step)
```

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React 19 + Vite 8
- **Styling:** Custom Warm-Neutral Design System (`src/index.css`) with light/dark theme support, reduced-motion compatibility, and high-contrast typography.
- **Backend:** Node.js + Express (`server/`)
- **AI Integration:** Isolated service provider (`anthropicService.js`) with deterministic fallback (`demoService.js`) and client-side offline redundancy (`aiService.js`).
- **Persistence:** LocalStorage with schema versioning and zero-loss state recovery.

---

## 🚀 Getting Started

### 1. Installation

```bash
npm install
```

### 2. Environment Configuration (Optional)

FocusLoop runs **100% out of the box** in demo mode without any API keys.

To enable live Claude AI generation:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your Anthropic API key:
   ```env
   ANTHROPIC_API_KEY=your_key_here
   ANTHROPIC_MODEL=claude-sonnet-4-20250514
   PORT=3001
   ```

### 3. Run the Development Server

```bash
npm run dev
```

This concurrently starts:
- The Express AI API server on `http://localhost:3001`
- The Vite client development server on `http://localhost:5173` (proxied to `/api`)

Open your browser to `http://localhost:5173`.

---

## 🎬 2-Minute Hackathon Demo Script

Follow this script to demonstrate the full end-to-end loop:

1. **Home Screen:**
   - Click the prompt pill: `💡 Try: "Study Network Analysis for tomorrow's exam"` (or type it in).
   - Notice the duration chips default to 20 minutes.
   - Click **"Start Focus"**.

2. **Task Breakdown:**
   - Watch the animated progressive breakdown into 5 actionable micro-steps:
     1. Review KCL
     2. Solve KCL Example 1
     3. Solve KCL Example 2
     4. Review KVL
     5. Solve one KVL problem
   - Click **"Start Focus Session"**.

3. **Active Focus Session:**
   - Notice the calm, distraction-free workspace.
   - Click **"💡 Need help?"** to see the micro-action: *"Write the KCL equation for the first node."*
   - Click **"✓ Finish Step"** to complete step 1 and advance to step 2 ("Solve KCL Example 1").

4. **Drift Detection & Gentle Intervention:**
   - Switch to another browser tab for ~10 seconds (or click the quick **"⚡ Test Drift (3m away)"** button).
   - Return to the tab.
   - A calm modal appears: *"Welcome back. You stepped away for about 3 minutes. Ready to continue with: Solve KCL Example 1?"*

5. **Context Recovery ("Where was I?"):**
   - Click **"🗺️ Where was I?"** inside the modal.
   - Review the complete context reconstruction:
     - Task: *Study Network Analysis*
     - Completed: *✓ Review KCL*
     - Current step: *Solve KCL Example 1*
     - Immediate Next Action: *Write the KCL equation for the first node.*
   - Click **"Continue Session"**.

6. **Session Completion & Reflection:**
   - Click **"End Session"**.
   - Select how it felt: *Easy*, *Okay*, or *Difficult*.
   - Optionally select what got in the way (e.g., *Phone*, *Other tabs*).
   - Read the compassionate nonjudgmental reflection.
   - Click **"Save & view next plan"**.

7. **Adaptive Session & Task Continuity:**
   - Notice the adaptive recommendation tailored to your session continuity.
   - Click **"Take a break & go home"**.
   - Back on the Home screen, observe the **"Continue where you left off"** card ready for whenever you want to jump back in!

---

## 🔒 Privacy & Safety Notice

FocusLoop is designed as a compassionate personal focus companion. It is **not** a medical device, does not diagnose or treat ADHD or any other medical condition, and collects zero surveillance or biometric data.
