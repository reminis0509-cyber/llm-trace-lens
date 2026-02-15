#!/bin/bash

echo "Testing DeepSeek provider..."
echo ""

curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deepseek",
    "model": "deepseek-chat",
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum computing in one sentence."
      }
    ]
  }' | jq .

echo ""
echo "Check the response above for:"
echo "1. Structured JSON with answer, confidence, evidence, alternatives"
echo "2. _trace object with validation results"
