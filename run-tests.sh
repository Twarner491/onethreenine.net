#!/bin/bash
set -e

echo "🧪 Running Unit & Integration Tests (Vitest)..."
npx vitest run

echo ""
echo "🎭 Running End-to-End Tests (Playwright)..."
npx playwright test

echo ""
echo "✅ All tests passed successfully!"
