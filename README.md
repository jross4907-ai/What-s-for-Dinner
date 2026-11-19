# What's for Dinner?

A household dinner picker. Deal five meals and take turns striking them, or vote from everyone's phones. Then plan the week, build the shopping list, and keep a shared history.

## Files
- `app.html`: the app's source, published as the claude.ai artifact.
- `index.html`: the GitHub Pages copy. It's `app.html` with a mobile-ready page header added, so it fits phone screens. Don't edit it by hand; run `./build.sh` after changing `app.html`.
- `build.sh`: rebuilds `index.html` from `app.html`.
- `original/what_s_for_dinner.tsx`: the first React + Firebase version.

## Where it runs
The live, shared version is a Claude artifact. It keeps its data (meals, week plan, votes, history, activity log) in the artifact's own database, which only works on claude.ai.

If you open `index.html` anywhere else, such as GitHub Pages or a local file, it runs in **"This device"** mode. You can try the veto game and the screens there, but nothing syncs and phone voting is turned off.
