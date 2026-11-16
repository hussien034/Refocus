# ReFocus

ReFocus is a digital-wellness app that helps people reduce mindless scrolling, build focus habits, and make more room for offline activities. It includes focus and break timers, habit tracking, screen-time insights, a content library, and an AI coach with a local fallback.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Install dependencies:
   ```sh
   npm install --legacy-peer-deps
   ```
2. Copy `.env.example` to `.env` and add a `GEMINI_API_KEY` if you want to enable Gemini-powered coach responses. The app can also use its local coach fallback without this key.
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

The optional Gemini-backed coach requires the Express server and a configured `GEMINI_API_KEY`; the app can use its local coach fallback without a server.
