import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { retrieveRelevantChunks } from '../retrieval/vectorSearch';
import { mmrRerank } from '../retrieval/reranker';
import { buildContext } from '../retrieval/contextBuilder';
import { ICitation } from '../../models/Chat';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export interface OrchestratorResult {
  answer: string;
  citations: ICitation[];
  followUpQuestions: string[];
  stepsLog: string[];
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Multi-step RAG Orchestrator
 *
 * Step 1: Query Analysis    — understand intent, extract key terms
 * Step 2: Vector Retrieval  — cosine similarity search on user chunks
 * Step 3: MMR Re-ranking    — diversity filter to top 5 chunks
 * Step 4: Context Building  — format chunks with source references
 * Step 5: Grounded LLM Call — Gemini with strict system prompt
 * Step 6: Follow-up Gen     — generate 3 suggested follow-up questions
 */
export async function runRAGOrchestrator(
  query: string,
  userId: string,
  scopedDocumentIds: string[] | null,
  conversationHistory: ConversationMessage[]
): Promise<OrchestratorResult> {
  const stepsLog: string[] = [];

  // ─── STEP 1: Query Analysis ──────────────────────────────────────────────
  stepsLog.push('Step 1: Analyzing query intent...');
  const analysisResult = await analyzeQuery(query, conversationHistory);
  stepsLog.push(`→ Refined query: "${analysisResult.refinedQuery}"`);
  stepsLog.push(`→ Intent: ${analysisResult.intent}`);

  // ─── STEP 2: Vector Retrieval ────────────────────────────────────────────
  stepsLog.push('Step 2: Retrieving relevant document chunks...');
  const candidates = await retrieveRelevantChunks(
    analysisResult.refinedQuery,
    userId,
    scopedDocumentIds,
    20 // retrieve top-20 candidates
  );
  stepsLog.push(`→ Retrieved ${candidates.length} candidate chunks`);

  if (candidates.length === 0) {
    return {
      answer:
        "I don't have enough information in your uploaded documents to answer this question. Please make sure you've uploaded relevant documents and they've finished processing.",
      citations: [],
      followUpQuestions: [],
      stepsLog,
    };
  }

  // ─── STEP 3: MMR Re-ranking ──────────────────────────────────────────────
  stepsLog.push('Step 3: Re-ranking for relevance and diversity (MMR)...');
  const reranked = mmrRerank(candidates, 5, 0.65);
  stepsLog.push(`→ Selected ${reranked.length} diverse, relevant chunks`);

  // Check if top chunks are relevant enough (score threshold)
  const topScore = reranked[0]?.score ?? 0;
  if (topScore < 0.25) {
    return {
      answer:
        "I couldn't find sufficiently relevant information in your documents to answer this question confidently. Try rephrasing your question or uploading more relevant documents.",
      citations: [],
      followUpQuestions: [],
      stepsLog,
    };
  }

  // ─── STEP 4: Context Building ────────────────────────────────────────────
  stepsLog.push('Step 4: Building context from retrieved chunks...');
  const { contextText, citations } = await buildContext(reranked);
  stepsLog.push(`→ Context built from ${citations.length} sources`);

  // ─── STEP 5: Grounded Generation ────────────────────────────────────────
  stepsLog.push('Step 5: Generating grounded response...');
  const answer = await generateGroundedResponse(
    query,
    contextText,
    conversationHistory
  );
  stepsLog.push('→ Response generated');

  // ─── STEP 6: Follow-up Questions ─────────────────────────────────────────
  stepsLog.push('Step 6: Generating follow-up suggestions...');
  const followUpQuestions = await generateFollowUpQuestions(query, answer, contextText);
  stepsLog.push(`→ Generated ${followUpQuestions.length} follow-up questions`);

  // Map retrieved chunk metadata into ICitation format
  const formattedCitations: ICitation[] = citations.map((c) => ({
    documentId: c.documentId,
    documentName: c.documentName,
    chunkId: c.chunkId,
    content: c.content.slice(0, 300) + (c.content.length > 300 ? '...' : ''),
    page: c.page,
  }));

  return { answer, citations: formattedCitations, followUpQuestions, stepsLog };
}

// ─── Step 1 Helper: Query Analysis ──────────────────────────────────────────

interface QueryAnalysis {
  refinedQuery: string;
  intent: string;
}

async function analyzeQuery(
  query: string,
  history: ConversationMessage[]
): Promise<QueryAnalysis> {
  const historySnippet = history
    .slice(-4)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(
      `You are a query analysis assistant. Given a user's question and recent conversation history,
output a JSON object with:
- "refinedQuery": a clear, standalone version of the question (resolve pronouns using context)
- "intent": one of: fact_lookup | summarization | comparison | explanation | other

Recent conversation:
${historySnippet}

User question: ${query}`
    );

    const parsed = JSON.parse(result.response.text());
    return {
      refinedQuery: parsed.refinedQuery || query,
      intent: parsed.intent || 'other',
    };
  } catch {
    return { refinedQuery: query, intent: 'other' };
  }
}

// ─── Step 5 Helper: Grounded Response Generation ────────────────────────────

async function generateGroundedResponse(
  query: string,
  contextText: string,
  history: ConversationMessage[]
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `You are a precise document assistant. Answer questions ONLY using the provided document context.

RULES:
1. Base your answer strictly on the context below. Do NOT use outside knowledge.
2. When referencing information, cite it as [Source N] matching the context references.
3. If the context doesn't contain enough information, say: "The uploaded documents don't contain enough information to answer this."
4. Be concise and accurate. Format your response with markdown where helpful.

DOCUMENT CONTEXT:
---
${contextText}
---`,
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  });

  const chatHistory = history.slice(-6).map((m) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: chatHistory });
  const result = await chat.sendMessage(query);

  return result.response.text() || 'Unable to generate a response.';
}

// ─── Step 6 Helper: Follow-up Questions ─────────────────────────────────────

async function generateFollowUpQuestions(
  query: string,
  answer: string,
  contextText: string
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(
      `Based on this Q&A and document context, suggest 3 short follow-up questions the user might want to ask next.
Output ONLY a JSON object with a "questions" key containing an array of 3 strings.

Question: ${query}

Answer: ${answer}

Context snippet: ${contextText.slice(0, 500)}`
    );

    const parsed = JSON.parse(result.response.text());
    const questions = parsed.questions || parsed;
    return Array.isArray(questions) ? questions.slice(0, 3) : [];
  } catch {
    return [];
  }
}
