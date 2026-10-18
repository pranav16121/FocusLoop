# FocusLoop 🧭

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.
> **Get back to what matters.**  
> A calm focus companion designed around **gentle context recovery** instead of punishment.

Official website: [focus-loop.tech](https://www.focus-loop.tech)

Currently, two official plugins are available:
---

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)
## 💡 The Core Problem & Philosophy

## React Compiler
People can know exactly what they need to do, yet still lose their working context during a work session.

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
- **AI Integration:** Optional Gemini study summaries and topic plans, with existing Anthropic focus helpers and deterministic local fallbacks.
- **Persistence:** LocalStorage with schema versioning and zero-loss state recovery.

---

## 🚀 Getting Started

### 1. Installation

```bash
npm install
```

### 2. Environment Configuration (Optional)

FocusLoop runs **100% out of the box** in demo mode without any API keys.

When Local mode is active, the client makes zero AI or API requests. The optional connection check is only run after AI-assisted mode is enabled or when you explicitly choose to test the connection. Pasted material and supported files are processed in the browser; AI-assisted mode sends extracted material to the configured Gemini server.

### Hardening notes

Oxlint reports four `react(set-state-in-effect)` warnings: asynchronous plan reveal and group hydration in `TaskBreakdown.jsx`, checklist reset synchronization in `FocusSession.jsx`, and saved-session hydration in `useSessionManager.js`. These effects synchronize local UI state with external/session inputs; none are timer or drift stale-closure warnings. `useTimer` keeps its completion callback in a ref, and `useDriftDetection` includes its signal dependencies.

To enable Gemini study summaries for imported material:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-2.5-flash
   PORT=3001
   ```

Enable **AI-assisted** mode in Settings, then choose one or more TXT, Markdown, PDF, DOCX, or PPTX files. FocusLoop extracts their text in your browser and sends the combined material to Gemini for a summary, study advice, and prioritized topics. Keep Local-only mode enabled when you do not want material sent to an AI provider.

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
# Visual Focus Assist (optional, local-first)

FocusLoop can combine conservative, observable signals to offer its existing context-recovery flow. It is off by default. Enable it in **Settings → Visual Focus Assist**, then start a focus session. It never records or uploads video, recognizes identity, reads window titles, collects keystrokes, or sends camera data to an AI provider. A camera light/status is shown while the pipeline is active; pause/end session stops the extension pipeline immediately.

The decision engine is in `shared/focusEngine.js`. It requires sustained signals and cooldowns, respects Reference Mode and trusted domains, and says only that attention *may* have shifted. If the extension, camera, model, or companion is unavailable, the study timer and all existing FocusLoop features still work.

## Browser extension (Chrome / Edge)

1. Run `npm run extension:assets` after `npm install`.
2. Obtain the pinned official MediaPipe model with `powershell -ExecutionPolicy Bypass -File extension/download-model.ps1`. The script verifies SHA-256 `64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF` and refuses to retain a mismatched asset. This explicit local asset is required; the extension never downloads a model at runtime.
3. Open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select the `extension` directory.
4. Run `npm run dev`, visit the local app, opt in from Settings, and start a session.

The MV3 service worker tracks tab/window transitions and uses an offscreen document for the optional camera pipeline. Permissions are `tabs`, `windows`, `offscreen`, `storage`, and `nativeMessaging`, used for tab duration, browser focus, camera lifecycle, extension state, and the opt-in companion. It is restricted to local FocusLoop development origins. The status line truthfully reports model loading/missing, permission required/denied, unavailable, active, or stopped. Browser suspension or extension reload can interrupt processing; the extension reports that condition and recovers only after a new session command.

## Windows companion

The companion is a Chrome/Edge Native Messaging host. It uses Windows foreground-window/process APIs and sends only executable identity plus duration; it has no screen, title, input, or content access. Build it with:

```powershell
cd desktop-companion
cargo build --release
```

After loading the unpacked extension, copy its ID from the extension details page and register the host (use the Chrome and Edge IDs independently):

```powershell
powershell -ExecutionPolicy Bypass -File desktop-companion/install-native-host.ps1 -ChromeExtensionId YOUR_CHROME_ID -EdgeExtensionId YOUR_EDGE_ID
```

Restart the browser after registration. The extension opens the authenticated native connection only during an opted-in active session and forwards foreground-app events to the same focus engine used for camera/tab signals. The FocusSession status line shows `Companion connected`, `paused`, or `disconnected`. To remove registration, run `desktop-companion/uninstall-native-host.ps1`.

Troubleshooting: `model-missing` means the verified task asset is absent; `permission-denied` must be resolved through the browser site/extension camera prompt; `unavailable` covers camera disconnection or lifecycle failure; `Companion disconnected` means the Rust binary, host manifest, browser restart, or extension ID registration needs attention.
