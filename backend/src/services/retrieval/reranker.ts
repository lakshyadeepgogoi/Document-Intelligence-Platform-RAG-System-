import { RetrievedChunk } from './vectorSearch';

/**
 * Maximal Marginal Relevance (MMR) re-ranker.
 *
 * Selects chunks that are both relevant to the query AND diverse from each other.
 * This prevents returning 5 nearly-identical chunks from the same paragraph.
 *
 * @param candidates  - Top-K chunks from vector search (sorted by relevance desc)
 * @param topN        - Final number of chunks to return
 * @param lambda      - Trade-off: 1.0 = pure relevance, 0.0 = pure diversity
 */
export function mmrRerank(
  candidates: RetrievedChunk[],
  topN = 5,
  lambda = 0.6
): RetrievedChunk[] {
  if (candidates.length <= topN) return candidates;

  const selected: RetrievedChunk[] = [];
  const remaining = [...candidates];

  while (selected.length < topN && remaining.length > 0) {
    let bestScore = -Infinity;
    let bestIdx = 0;

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].score;

      // Max similarity to already-selected chunks (content-based Jaccard approx)
      const maxSim =
        selected.length === 0
          ? 0
          : Math.max(
              ...selected.map((s) => jaccardSimilarity(remaining[i].content, s.content))
            );

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

/**
 * Token-level Jaccard similarity between two text strings.
 * Fast approximation of content overlap.
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
