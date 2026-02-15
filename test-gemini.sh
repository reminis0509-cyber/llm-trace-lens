#!/bin/bash

echo "Testing Gemini provider..."
echo ""

curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "model": "gemini-pro",
    "messages": [
      {
        "role": "user",
        "content": "What is 2+2? Respond in JSON format with answer, confidence, evidence, and alternatives fields."
      }
    ]
  }' | jq .

echo ""
echo "Check the response above for:"
echo "1. Structured JSON with answer, confidence, evidence, alternatives"
echo "2. _trace object with validation results"
