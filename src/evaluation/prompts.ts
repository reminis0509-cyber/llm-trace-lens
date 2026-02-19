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
