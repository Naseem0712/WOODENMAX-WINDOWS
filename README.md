# WoodenMax Window Designer

Free **online & offline** (PWA) app to design aluminium windows, doors, partitions, louvers, ventilators, and more — with quotations and material-style summaries.

**Live app:** [window.woodenmax.in](https://window.woodenmax.in) (WEOS by WoodenMax)  
**Company:** [woodenmax.in](https://www.woodenmax.in) · [allukraft.com](https://www.allukraft.com) · **Email:** info@woodenmax.com

Installed PWA clients auto-update when you open the app after a new deploy (`registerType: 'autoUpdate'` + periodic update checks).

## Prerequisites

- Node.js 18+ (recommended LTS)

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Output: `dist/`. Use any static host; configure SPA fallback so client routes (`/design/...`, `/guides/...`) serve `index.html`.

- **Cloudflare Pages:** build command `npm run build`, output directory `dist`. `public/_redirects` is copied for SPA rewrites.
- **Vercel:** `vercel.json` includes SPA rewrites.

## Tech stack

React 18, TypeScript, Vite, react-router-dom, PWA (vite-plugin-pwa).

## Repository

[github.com/Naseem0712/WOODENMAX-WINDOWS](https://github.com/Naseem0712/WOODENMAX-WINDOWS)
