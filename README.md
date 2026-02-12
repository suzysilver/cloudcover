# Cloud Cover App

Simple static web app that shows current cloud cover for the browser's current location.

## Run locally

```bash
cd /Users/suzysilver/Documents/cloudcover
python3 -m http.server 8000
```

Open `http://localhost:8000` and allow location access.

## Host it

### Option 1: GitHub Pages (recommended)

1. Create a new GitHub repo and push this folder.
2. In GitHub, open **Settings -> Pages**.
3. Under **Build and deployment**, set:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (or `master`), folder `/ (root)`
4. Save and wait for the site URL to appear.
5. Open the generated `https://<username>.github.io/<repo>/` URL.

Notes:
- Geolocation works because GitHub Pages uses HTTPS.
- Keep `index.html`, `styles.css`, and `app.js` at repo root.

### Option 2: Netlify Drop (fastest)

1. Zip this folder.
2. Go to `https://app.netlify.com/drop`.
3. Drag and drop the zip.
4. Netlify gives you a live HTTPS URL immediately.
