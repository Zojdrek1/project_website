# project_site
Personal website for my projects and developer profile.

## Packaging / Desktop Build Prep

1. Run `node scripts/build.mjs` from the repo root (Node 18+ recommended). This clears and recreates a `dist/` folder containing `index.html`, shared assets, and the full `carGame/` app with relative paths intact.
2. Point your Tauri/Electron bundler at the generated `dist/` directory (e.g. set `tauri.conf.json > build.distDir` or Electron `BrowserWindow` `loadFile('dist/index.html')`).
3. When assets change, rerun the build script to refresh `dist/` before packaging.

## Crew Investments & Perks

- **Heat Suppression Unit** — reduces heat gain from activity by ~15% so you can take more risks before cops notice.
- **Contraband Network** — applies a discount to illegal-market purchases using your back-channel contacts.
- **Elite Pit Crew** — lowers repair costs and helps cars bounce back faster after races.

Install each upgrade once from the Garage → Crew Investments panel to unlock the passive boosts.

## New Game Setup

- You must pick a crew alias; it is used for saves and the local leaderboards.
- Difficulty presets adjust starting cash:
  * Easy — ₴40,000 bankroll to get rolling quickly.
  * Medium — ₴20,000 classic experience.
  * Hard — ₴12,000 lean start for experts.
