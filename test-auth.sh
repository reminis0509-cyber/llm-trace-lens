#!/bin/bash

echo "Testing authentication..."
echo ""

echo "1. Testing without auth (should work if ENABLE_AUTH=false)"
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hi"}]
  }' | jq .

echo ""
echo ""
echo "2. Set ENABLE_AUTH=true and API_KEYS=test-key-123 in .env, then restart server"
echo "3. Test with invalid key (should get 401):"
echo ""

curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong-key" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hi"}]
  }' | jq .

echo ""
echo ""
echo "4. Test with valid key (should work):"
echo ""

curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key-123" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hi"}]
  }' | jq .
