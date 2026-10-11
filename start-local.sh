#!/bin/bash

# Exit on error
set -e

echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "🚀 Starting Astro development server..."
if [ -z "$PUBLIC_SUPABASE_URL" ] && [ ! -f ".env" ]; then
  echo "ℹ️  No Supabase configuration detected: running in local offline mock mode (localStorage)."
  export PUBLIC_USE_LOCAL_MOCK=true
else
  echo "ℹ️  Supabase configuration detected: connecting to remote Supabase instance."
fi

npm run dev
