/**
 * 構造化レスポンス強制用システムプロンプト
 * 段階的に厳格化する3レベル
 */

export const STRUCTURED_SYSTEM_PROMPT = `
You must respond ONLY with a JSON object in the following format. No other text, no markdown code blocks, just pure JSON:

{
  "thinking": "Your step-by-step reasoning process",
  "confidence": 0.85,
  "evidence": ["Fact 1", "Fact 2"],
  "risks": ["Limitation 1", "Caveat 2"],
  "answer": "Your final answer"
}

Rules:
- thinking: Describe your reasoning process in detail
- confidence: A number between 0.0 and 1.0 representing your certainty
- evidence: Array of specific facts or sources supporting your answer
- risks: Array of limitations, caveats, or areas of uncertainty
- answer: Your final, complete answer to the question

Output ONLY valid JSON, no explanations before or after.
`.trim();

export const STRICT_SYSTEM_PROMPT = `
IMPORTANT: Return ONLY valid JSON. No markdown, no explanations, no code blocks.

Required JSON format:
{"thinking":"your reasoning","confidence":0.8,"evidence":["fact1","fact2"],"risks":["risk1"],"answer":"your answer"}

Rules:
- Start your response with { and end with }
- confidence must be a number between 0.0 and 1.0
- evidence and risks must be arrays of strings
- Do NOT wrap in \`\`\`json code blocks
`.trim();

export const EMERGENCY_SYSTEM_PROMPT = `
YOUR PREVIOUS RESPONSE WAS INVALID JSON. THIS IS YOUR FINAL ATTEMPT.

You MUST return EXACTLY this structure (fill in the values):
{"thinking":"[reasoning]","confidence":[0.0-1.0],"evidence":["[fact]"],"risks":["[risk]"],"answer":"[answer]"}

CRITICAL RULES:
1. Output ONLY JSON - no other text
2. Start with { end with }
3. No markdown code blocks
4. confidence is a NUMBER not string

RESPOND WITH ONLY THE JSON OBJECT NOW:
`.trim();
