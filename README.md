# Stepwise

> A simple, modern stretching routine timer to guide your daily stretches. Or other workouts.

https://oberprah.github.io/stepwise/

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

## Data Storage

All routines are stored in your browser's **localStorage**. Nothing is sent to a server. Data persists across reloads but is tied to the browser and origin.
