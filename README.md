# Pi Tracker

A companion app for Pi Network Pioneers — track holdings, estimate mining
rate, follow role progress, and check off the Mainnet checklist.

## What's real vs. what's not yet

- **Real**: every calculator and tool, snapshot history, the historical
  chart, CSV export, theme switching, and the actual Pi payment flow (once
  deployed and opened inside Pi Browser).
- **Not yet live**: ads. The interstitial ad call only fires once this app
  is approved for the Pi Ad Network — until then it silently does nothing.

## Deploying (free, no Claude Code needed)

1. **Create a free Vercel account** at vercel.com (no credit card needed).
2. **Upload this folder** — easiest way: drag the whole `pi-tracker` folder
   into a new Vercel project (Vercel auto-detects the Vite framework and the
   `/api` folder as serverless functions; no extra config needed).
3. **Add one environment variable** in Vercel project settings:
   - `PI_API_KEY` — get this from the Pi Developer Portal (see below)
     after registering your app. This key must stay secret — never put it
     in any file inside `src/`.
4. Click Deploy. You'll get a real `https://your-app.vercel.app` URL.

## Registering with Pi

1. Open **Pi Browser** on your phone.
2. Go to `pi://develop.pinet.com` to reach the Pi Developer Portal.
3. Register a new app, get your API key (paste into Vercel as `PI_API_KEY`
   above), and keep the app in **sandbox/testnet mode** while testing.
4. Once you're happy with how it behaves in sandbox mode, go back to the Pi
   app → **App Studio → Convert App**, and paste in your live Vercel URL.

## Local development

```
npm install
npm run dev
```

Note: the Pi SDK features (login, payments) only work for real inside Pi
Browser. Running locally in a normal browser, the app still works — it just
shows the default "Welcome to Pi Tracker" greeting instead of a username,
and tipping will show a friendly message instead of opening a real wallet
prompt.

## Project structure

```
pi-tracker/
├── api/                     # Vercel serverless functions (Pi payment backend)
│   ├── approve-payment.js
│   └── complete-payment.js
├── src/
│   ├── App.jsx              # The whole app UI
│   ├── pi.js                # All Pi SDK calls live here
│   └── main.jsx             # React entry point
├── index.html
├── package.json
└── vite.config.js
```
