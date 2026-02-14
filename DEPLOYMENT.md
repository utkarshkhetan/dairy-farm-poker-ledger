# GitHub Pages Deployment Guide

## Secret Admin Code

**The admin secret code is: `milkdaddy`**

Use this to unlock the Admin Upload section (bottom-right corner) for CSV uploads.

---

## Pre-Deployment Checklist

Before pushing to GitHub and deploying:

1. **Firebase is configured** – Your `src/lib/firebase.ts` has the Web app config (or `.env.local` with Firebase credentials)
2. **Firestore has data** – Run the seed script if needed: `cd scripts && npm run seed`
3. **Firestore rules** – Ensure rules allow reads (see README)
4. **No secrets in repo** – `.gitignore` excludes `.env*` and Firebase Admin SDK keys. Never commit these.

---

## Step 1: Initialize Git (if not already)

```bash
cd /Users/utkarshkhetan/Projects/dairy-farm-poker-ledger
git init
```

---

## Step 2: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `dairy-farm-poker-ledger` (or your preferred name)
3. Choose **Public**
4. Do **not** initialize with README (you already have one)
5. Click **Create repository**

---

## Step 3: Configure Vite Base Path (if repo name differs)

If your repo name is **not** `dairy-farm-poker-ledger`, update `vite.config.ts`:

```typescript
base: '/your-actual-repo-name/',
```

---

## Step 4: Add Remote and Push

```bash
git add .
git status   # Review what will be committed (ensure no .env or firebase-adminsdk files)
git commit -m "Initial commit: Dairy Farm Poker Ledger"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dairy-farm-poker-ledger.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 5: Deploy to GitHub Pages

```bash
npm run deploy
```

This runs `npm run build` and publishes the `dist` folder to the `gh-pages` branch.

---

## Step 6: Enable GitHub Pages

1. Go to your repo on GitHub
2. **Settings** → **Pages** (left sidebar)
3. Under **Build and deployment**:
   - **Source**: Deploy from a branch
   - **Branch**: `gh-pages` / `/(root)`
4. Click **Save**

---

## Step 7: Access Your Site

Your site will be available at:

```
https://YOUR_USERNAME.github.io/dairy-farm-poker-ledger/
```

It may take 1–2 minutes after the first deploy.

---

## Troubleshooting

### Blank page or 404
- Confirm `base` in `vite.config.ts` matches your repo name (including leading/trailing slashes)
- Re-run `npm run deploy`

### Firebase / Firestore errors
- Check Firebase Console → Firestore → Rules (allow read)
- Ensure Web app config in `firebase.ts` or `.env.local` is correct
- Firebase config is safe to commit (it’s public); only the Admin SDK key must stay private

### Admin upload not working
- Admin upload writes to Firestore; ensure Firestore rules allow writes (or use test mode for development)

---

## Quick Reference

| Item | Value |
|------|-------|
| Admin secret code | `milkdaddy` |
| Deploy command | `npm run deploy` |
| Site URL | `https://YOUR_USERNAME.github.io/dairy-farm-poker-ledger/` |
