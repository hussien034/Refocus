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

`.env` files, local data, dependencies, and generated build output are excluded from Git. Never commit API keys or other secrets.
