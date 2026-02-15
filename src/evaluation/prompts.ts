export const FAITHFULNESS_PROMPT = (context: string, answer: string) => `
You are an evaluation assistant. Given a reference context and an answer, score how faithful the answer is to the context.

Faithfulness measures whether the answer is grounded in the provided context and does not contain hallucinations or unsupported claims.

Context:
"""
${context}
"""

Answer:
"""
${answer}
"""

Score the faithfulness from 0.0 to 1.0:
- 1.0: Every claim in the answer is directly supported by the context
- 0.5: Some claims are supported, but some are missing or unsupported
- 0.0: The answer contradicts or ignores the context entirely

Respond with ONLY a JSON object in this exact format:
{"score": <number between 0.0 and 1.0>, "reason": "<one sentence explanation>"}
`;

export const ANSWER_RELEVANCE_PROMPT = (question: string, answer: string) => `
You are an evaluation assistant. Given a question and an answer, score how relevant the answer is to the question.

Answer Relevance measures whether the answer directly addresses what was asked, without being evasive, off-topic, or excessively verbose.

Question:
"""
${question}
"""

Answer:
"""
${answer}
"""

Score the answer relevance from 0.0 to 1.0:
- 1.0: The answer directly and completely addresses the question
- 0.5: The answer is partially relevant but incomplete or tangential
- 0.0: The answer does not address the question at all

Respond with ONLY a JSON object in this exact format:
{"score": <number between 0.0 and 1.0>, "reason": "<one sentence explanation>"}
`;

// ===========================
// RAG 特化プロンプト
// ===========================

export const CONTEXT_UTILIZATION_PROMPT = (context: string, answer: string) => `
You are an evaluation assistant specializing in RAG (Retrieval-Augmented Generation) quality assessment.

Given a retrieved context and a generated answer, score how effectively the answer utilizes the provided context.

Context Utilization measures whether the answer makes good use of the relevant information in the context, without ignoring important details.

Retrieved Context:
"""
${context}
"""

Generated Answer:
"""
${answer}
"""

Score the context utilization from 0.0 to 1.0:
- 1.0: The answer effectively uses all relevant information from the context
- 0.7: The answer uses most key information but misses some relevant details
- 0.4: The answer uses only a small portion of the relevant context
- 0.0: The answer completely ignores the provided context

Respond with ONLY a JSON object in this exact format:
{"score": <number between 0.0 and 1.0>, "reason": "<one sentence explanation>"}
`;

export const HALLUCINATION_DETECTION_PROMPT = (context: string, answer: string) => `
You are an evaluation assistant specializing in hallucination detection for RAG systems.

Given a retrieved context and a generated answer, identify what proportion of the answer contains information NOT supported by the context (hallucinated content).

Retrieved Context:
"""
${context}
"""

Generated Answer:
"""
${answer}
"""

Score the hallucination rate from 0.0 to 1.0:
- 0.0: No hallucination. Every factual claim in the answer is supported by the context
- 0.3: Minor hallucination. Most claims are supported, but some details are fabricated
- 0.7: Significant hallucination. Many claims have no basis in the context
- 1.0: Complete hallucination. The answer is entirely fabricated

Important: General knowledge connectors ("therefore", "in summary") are NOT hallucinations. Only count factual claims not supported by context.

Respond with ONLY a JSON object in this exact format:
{"score": <number between 0.0 and 1.0>, "reason": "<one sentence explanation>"}
`;
