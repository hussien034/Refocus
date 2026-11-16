# ReFocus

ReFocus is a digital-wellness app that helps people reduce mindless scrolling, build focus habits, and make more room for offline activities. It includes focus and break timers, habit tracking, screen-time insights, a content library, and Gemini-powered AI coaching.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Install dependencies:
   ```sh
   npm install --legacy-peer-deps
   ```
2. Copy `.env.example` to `.env`, add your `GEMINI_API_KEY`, and set `CORS_ORIGIN` to your frontend origin.
3. Start the development server:
   ```sh
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Checks

```sh
npm test
npm run lint
npm run build
```

Accounts and app progress are stored locally in the browser on the current device. They are not uploaded or synchronized across devices, and clearing this site's browser data removes them. Passwords are stored as salted hashes. `.env` files, local data, dependencies, and generated build output are excluded from Git. Never commit API keys or other secrets.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` tests and builds the app, then deploys the `dist` output whenever changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Local account creation and sign-in work on GitHub Pages and do not require a backend.

The AI Coach requires the Express backend and a configured `GEMINI_API_KEY`; it does not substitute canned local responses when the AI service is unavailable.

### Deploy the AI Coach backend

1. In Render, create a new **Blueprint** from this repository and apply `render.yaml`.
2. Add your Gemini API key as the Render service's `GEMINI_API_KEY` secret, then deploy. Confirm `/api/health` reports `"geminiConfigured": true`.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add `VITE_API_BASE_URL` with the backend origin, for example `https://refocus-ai-coach-hussien034.onrender.com` (no trailing slash).
4. Re-run the **Build and deploy to GitHub Pages** workflow, or push a change to `main`. The Pages frontend will then send AI chat and weekly-report requests to the backend.

The Gemini key stays on the backend and must never be added to the frontend or GitHub Pages build.
