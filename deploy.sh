#!/usr/bin/env bash
# Run this script from the project root to push to GitHub and deploy to GitHub Pages
# Usage: ./deploy.sh [YOUR_GITHUB_USERNAME]

set -e

GITHUB_USER="${1:-utkarshkhetan}"
REPO_NAME="dairy-farm-poker-ledger"
REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "=== Dairy Farm Poker Ledger - Deployment ==="
echo "GitHub username: $GITHUB_USER"
echo ""

# 1. Initialize git if needed
if [ ! -d .git ]; then
  echo "Initializing git..."
  git init
else
  echo "Git already initialized."
fi

# 2. Add all files
echo "Adding files..."
git add .
git status

# 3. Commit
echo ""
echo "Committing..."
git commit -m "Initial commit: Dairy Farm Poker Ledger" || echo "(Nothing to commit or already committed)"

# 4. Ensure main branch
git branch -M main

# 5. Add remote (remove if exists to avoid errors)
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

# 6. Push to GitHub
echo ""
echo "Pushing to GitHub..."
git push -u origin main

# 7. Deploy to GitHub Pages
echo ""
echo "Deploying to GitHub Pages..."
npm run deploy

echo ""
echo "=== Done! ==="
echo "Your site will be at: https://${GITHUB_USER}.github.io/${REPO_NAME}/"
echo "Enable Pages in repo Settings > Pages > Source: gh-pages branch"
