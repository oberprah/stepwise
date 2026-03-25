# Stepwise

A simple, modern stretching routine timer to guide your daily stretches.

## Features

- **Routine builder** - create custom routines with named exercises
- **Time-based exercises** - circular countdown timer with audio cues
- **Rep-based exercises** - shows rep count, tap "Done" when finished
- **Optional rest periods** between exercises
- **Audio cues** - beeps on transitions and countdown (Web Audio API, no external files)
- **Persistence** - routines saved to browser localStorage
- **Dark mode** - automatic based on system preference
- **Mobile-first** - large touch targets, responsive from 380px to desktop
- **Keyboard shortcuts** - Space (play/pause), Arrow Right (skip), Escape (exit)
- **Zero dependencies** - pure HTML, CSS, and vanilla JavaScript

## Getting Started

### Run locally

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Or simply open `index.html` directly in your browser.

### Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings > Pages**
3. Set source to **Deploy from a branch** > `main` / `/ (root)`
4. Your app will be live at `https://<username>.github.io/<repo-name>/`

## Data Storage

All routines are stored in your browser's **localStorage**. Nothing is sent to a server. Data persists across reloads but is tied to the browser and origin.

## Project Structure

```
index.html        Main app shell
css/style.css     Styles, theming, dark mode, responsive layout
js/app.js         All application logic (no dependencies)
```
