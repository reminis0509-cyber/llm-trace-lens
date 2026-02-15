#!/bin/bash

echo "========================================="
echo "LLM Trace Lens MVP - Full Test Suite"
echo "========================================="
echo ""

echo "[1/5] Testing Gemini provider..."
./test-gemini.sh
echo ""

echo "[2/5] Testing Streaming (OpenAI)..."
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "stream": true,
    "messages": [{"role": "user", "content": "Hi"}]
  }' 2>/dev/null | head -20
echo ""

echo "[3/5] Running automated tests..."
npm test
echo ""

echo "[4/5] Testing authentication..."
echo "NOTE: Set ENABLE_AUTH=true in .env to test auth"
echo ""

echo "[5/5] Verifying DESIGN_PHILOSOPHY.md exists..."
if [ -f "DESIGN_PHILOSOPHY.md" ]; then
  echo "✓ DESIGN_PHILOSOPHY.md found"
else
  echo "✗ DESIGN_PHILOSOPHY.md not found"
fi
echo ""

echo "========================================="
echo "Test suite complete!"
echo "========================================="
