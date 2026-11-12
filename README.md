# Goon Logbook

Goon Logbook is a lightweight, monochrome habit-recovery tracker with a live streak timer, a 10-minute urge reset, a distraction picker, daily check-ins, milestones, and a detailed slip history.

There is no Goon Logbook account, advertising, or app analytics. The app uses a GitHub connection to load and sync your data through your private backup repository. A local browser copy helps with persistence and loading, but **the app requires an internet connection and is not available offline**.

## Features

- Streak timer calculated from the timestamp of your latest slip
- Private cloud backup through your own GitHub repository
- Automatic sync across connected devices
- Urge reset timer and distraction picker
- One editable check-in per day
- Calendar, slip history, won urges, and milestones
- Optional public Progress page with aggregate totals and check-in dates only

**Privacy note:** The public Progress page publishes the streak start date, progress totals, the aggregate number of days with a slip, and check-in dates. Individual slip dates, won-urge dates, check-in mood, urge levels, triggers, and notes are not published.

## Project files

    index.html            main app markup
    progress.html         public progress page
    css/style.css         shared monochrome styles
    js/app.js             app logic and GitHub cloud sync
    manifest.webmanifest  installable app metadata
    sw.js                 retires the previous offline cache/worker
    icons/                app icons
    progress.json         published progress snapshot

## Run locally

Serve the project over localhost, for example:

    python3 -m http.server 8080

Then open http://localhost:8080. A GitHub token with the required access to the private cloud repository is needed to connect and load your data.

## Hosting

The app is a static site and is hosted with GitHub Pages. The private cloud repository stores the source-of-truth data file; a GitHub Actions workflow publishes the allowlisted progress snapshot to the public repository.

## Install on Android

Open the hosted HTTPS site in Chrome, open the browser menu, and choose **Install app** or **Add to Home screen**.

## Important

Keep your GitHub token private. The app is a self-help tool, not medical or mental health care. If the habit feels out of control, consider talking with a doctor or counselor.
