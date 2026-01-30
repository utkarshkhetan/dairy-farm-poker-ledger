# Cal Dairy Farm Poker Ledger

A modern, dark-themed poker ledger website for tracking game history, statistics, and standings.

## Features

- 🏆 **Lifetime Standings** - Ranked leaderboard with total winnings
- 📊 **Statistics Dashboard** - Comprehensive stats including:
  - Per-game averages
  - Trending winners/losers (hot/cold streaks)
  - Fun statistics (The Whale, The Shark, Consistency King, etc.)
  - Win/loss distribution charts
  - Cumulative profit/loss over time
- 📋 **Game Log** - View detailed results for any game by date
- 🔐 **Admin Upload** - Secure CSV upload for new games (secret code: `milkdaddy`)
- 🎨 **Dark Mode UI** - Modern, sleek dark theme

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **Charts**: Recharts
- **Database**: Firebase Firestore
- **Hosting**: GitHub Pages

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing, e.g. `dairy-farm-poker-ledger`)
3. Enable Firestore Database:
   - Go to Firestore Database
   - Click "Create database"
   - Start in **test mode** for development (you can secure it later)

**Two different configs:**

- **Admin SDK key** (for seed script): Project Settings → Service accounts → Generate new private key. Save as `dairy-farm-poker-ledger-firebase-adminsdk-fbsvc-*.json` in the project root. This file is gitignored; never commit it.
- **Web app config** (for frontend): Project Settings → General → Your apps → add Web app (or use existing) → copy the `firebaseConfig` object.

### 3. Seed Initial Data (uses Admin SDK key)

1. Place the Admin SDK key JSON file in the project root (see above).
2. Install and run the seed script:
   ```bash
   cd scripts
   npm install
   npm run seed
   ```
3. This **clears all existing players and games**, then imports `Cal Dairy Farm - All Games.csv` into Firestore.
4. Monetary values: game date columns are in **cents** (e.g., -4000 = -$40). Totals and Per Game columns are ignored (calculated from data).
5. The "Num Games Played" column from the CSV is stored on each player for reference.

### 4. Configure Frontend (Web app config)

Copy `.env.example` to `.env.local` and fill in the Web app values:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your `apiKey`, `messagingSenderId`, and `appId` from Firebase Console → Project Settings → General → Your apps → Web app. `projectId` and `authDomain` / `storageBucket` are pre-filled for `dairy-farm-poker-ledger`.

Alternatively, edit `src/lib/firebase.ts` and replace the placeholder values.

### 5. Firestore Security Rules

For production, update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to everyone
    match /{document=**} {
      allow read: if true;
    }
    
    // Allow write access only with authentication or custom logic
    // For now, you can use test mode, but secure it before production
    match /{document=**} {
      allow write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

### 6. Development

```bash
npm run dev
```

Visit `http://localhost:5173` to see the app.

### 7. Build for Production

```bash
npm run build
```

### 8. Deploy to GitHub Pages

1. Update `vite.config.ts` with your GitHub repository name if different:
   ```typescript
   base: '/your-repo-name/',
   ```

2. Deploy:
   ```bash
   npm run deploy
   ```

3. Enable GitHub Pages:
   - Go to your repository Settings > Pages
   - Select source: `gh-pages` branch
   - Save

## Admin Upload

To upload a new game:

1. Click the subtle "Admin" button in the bottom-right corner
2. Enter the secret code: `milkdaddy`
3. Upload a CSV file in the format of `ledger_pglea_*.csv`
4. The system will:
   - Check for duplicate dates
   - Auto-match players by `player_id` or `nickname`
   - Prompt for manual matching if needed
   - Aggregate re-buys (multiple rows for same player)
   - Save the game to Firestore

## Known Player IDs

The following player IDs are pre-configured for automatic matching:
- Garrett: `Gx6CTDK1-V`
- Sampath: `yA8s_xTBKa`
- Abhi: `3eq6PWL0fX`
- Shik: `LxxSO_Q8Xm`
- Ano: `dLUVSEvjqU`

## Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities (Firebase, CSV parser, stats)
│   ├── types/          # TypeScript type definitions
│   └── ...
├── scripts/
│   └── seedData.ts     # Initial data import script
└── ...
```

## License

Private project for Cal Dairy Farm poker games.
