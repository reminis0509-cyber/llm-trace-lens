# LLM Trace Lens

A transparent observability layer for LLM applications that enforces structured responses and validates outputs in real-time.

## Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| OpenAI Provider | ✅ Complete | Tested with streaming |
| Anthropic Provider | ✅ Complete | Tested with streaming |
| Gemini Provider | ✅ Complete | Tested with real API |
| DeepSeek Provider | ✅ Complete | OpenAI-compatible |
| Streaming Support | ✅ Complete | OpenAI & Anthropic only |
| Authentication | ✅ Complete | Optional API key auth |
| Automated Tests | ✅ Complete | Vitest + Coverage |
| Design Philosophy | ✅ Complete | See DESIGN_PHILOSOPHY.md |

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev

# Run tests
npm test
```

## Usage

### Basic Request

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ]
  }'
```

### Streaming Request

```bash
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "stream": true,
    "messages": [
      {"role": "user", "content": "Count from 1 to 5."}
    ]
  }'
```

## Supported Providers

- **OpenAI**: GPT-4, GPT-3.5-turbo, etc.
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, etc.
- **Gemini**: gemini-pro, etc.
- **DeepSeek**: deepseek-chat, etc.

## Storage Selection

### PostgreSQL (Recommended for Production)
- **Recommended Services**: Supabase, Neon, AWS RDS, Google Cloud SQL
- **Why**: Scalability, data persistence, complex query support
- **Setup**: `DATABASE_TYPE=postgres` + `DATABASE_URL=postgresql://...`

### Vercel KV (Development/Small-scale Testing)
- **Use Cases**: Prototyping, personal development, small projects
- **Limitations**:
  - Storage limits on free tier
  - Not suitable for complex analytics queries
- **Setup**: `DATABASE_TYPE=kv` + KV credentials

> **Important**: KV is intended for development only. Always use PostgreSQL for production environments.

## Environment Variables

```bash
# Database (PostgreSQL recommended)
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/llm_trace_lens

# Provider API Keys
OPENAI_API_KEY=sk-your-api-key-here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Optional (defaults shown)
PORT=3000
LOG_LEVEL=info
MAX_RETRIES=3
TIMEOUT_MS=30000

# Storage Limits (KV only)
MAX_TRACES=5000          # Maximum traces per workspace
MAX_AGE_DAYS=30          # Trace retention period in days

# Authentication (optional)
ENABLE_AUTH=false
API_KEYS=your-secret-key-1,your-secret-key-2
```

## API Response Format

All responses include structured output with validation results:

```json
{
  "answer": "The answer to your question",
  "confidence": 95,
  "evidence": ["Supporting fact 1", "Supporting fact 2"],
  "alternatives": ["Alternative answer 1"],
  "_trace": {
    "requestId": "req_123...",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "provider": "openai",
    "model": "gpt-4",
    "validationResults": {
      "confidence": {"status": "PASS", "issues": []},
      "risk": {"status": "PASS", "issues": []},
      "overall": "PASS"
    },
    "latencyMs": 1234,
    "internalTrace": null
  }
}
```

## Architecture

See [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) for detailed design principles.

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Manual provider tests
./test-gemini.sh
./test-deepseek.sh
./test-streaming.sh
./test-auth.sh

# Full test suite
./test-all.sh
```

## License

MIT
