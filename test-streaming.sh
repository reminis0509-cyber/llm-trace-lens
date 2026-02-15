#!/bin/bash

echo "Testing OpenAI Streaming..."
echo ""

curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Count from 1 to 5 slowly."
      }
    ]
  }'

echo ""
echo ""
echo "Testing Anthropic Streaming..."
echo ""

curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Count from 1 to 5 slowly."
      }
    ]
  }'

echo ""
echo ""
echo "Check that:"
echo "1. Tokens arrive progressively (not all at once)"
echo "2. Final chunk contains _trace object"
echo "3. Stream ends with [DONE]"
