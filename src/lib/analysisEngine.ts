/**
 * Local (non-AI) speech metrics computed from Whisper word timings.
 * All pure functions — no side effects, easy to unit test.
 */

import type {
  TranscriptWord,
  PacingMetrics,
  FillerAnalysis,
} from "@/types/analysis";

// ─── Filler word lexicon ─────────────────────────────────────────────────────

export const FILLER_WORDS = new Set([
  "um", "uh", "er", "ah",
  "like", "you know", "sort of", "kind of",
  "basically", "literally", "actually", "honestly",
  "right", "okay", "so", "well", "i mean",
]);

// ─── Word timing annotation ──────────────────────────────────────────────────

/**
 * Takes raw Whisper word-level segments and annotates each word
 * with whether it's a filler.
 */
export function annotateFillers(
  words: Array<{ word: string; start: number; end: number }>
): TranscriptWord[] {
  return words.map((w) => ({
    word:     w.word,
    start:    w.start,
    end:      w.end,
    isFiller: FILLER_WORDS.has(w.word.toLowerCase().trim()),
  }));
}

// ─── Pacing ──────────────────────────────────────────────────────────────────

export function computePacing(
  words: TranscriptWord[],
  durationSeconds: number
): PacingMetrics {
  if (durationSeconds <= 0) {
    return { wpm: 0, category: "slow" };
  }
  const nonFiller = words.filter((w) => !w.isFiller);
  const wpm = Math.round((nonFiller.length / durationSeconds) * 60);

  let category: PacingMetrics["category"];
  if (wpm < 120)       category = "slow";
  else if (wpm <= 160) category = "ideal";
  else                 category = "fast";

  return { wpm, category };
}

// ─── Filler analysis ─────────────────────────────────────────────────────────

export function computeFillers(
  words: TranscriptWord[],
  durationSeconds: number
): FillerAnalysis {
  const fillers = words.filter((w) => w.isFiller);
  const byWord: Record<string, number> = {};

  for (const fw of fillers) {
    const key = fw.word.toLowerCase().trim();
    byWord[key] = (byWord[key] ?? 0) + 1;
  }

  const totalCount = fillers.length;
  const fillerRate =
    durationSeconds > 0
      ? Math.round((totalCount / durationSeconds) * 60 * 10) / 10
      : 0;

  const topFiller =
    totalCount > 0
      ? Object.entries(byWord).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return { totalCount, fillerRate, byWord, topFiller };
}

// ─── GPT-4o prompt builder ───────────────────────────────────────────────────

export function buildCoherencePrompt(
  transcript: string,
  pacing: PacingMetrics,
  fillers: FillerAnalysis
): string {
  return `You are an expert speech coach. Analyze the following speech transcript and provide structured coaching feedback.

TRANSCRIPT:
"""
${transcript}
"""

METRICS ALREADY COMPUTED (do not re-compute):
- Speaking pace: ${pacing.wpm} WPM (${pacing.category})
- Filler words: ${fillers.totalCount} total (${fillers.fillerRate}/min), most common: "${fillers.topFiller ?? "none"}"

YOUR TASK:
Return a JSON object matching this exact schema (no extra keys, no markdown):
{
  "score": <integer 0-100 reflecting overall speech coherence and clarity>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "strengths": [<up to 3 specific things the speaker did well>],
  "improvements": [<up to 3 specific areas that need work>],
  "tips": [
    {
      "category": <"pacing"|"clarity"|"structure"|"vocabulary"|"confidence">,
      "title": <short imperative phrase, max 8 words>,
      "detail": <1-2 sentence actionable advice>,
      "priority": <"high"|"medium"|"low">
    }
    // 3-5 tips total, sorted by priority descending
  ]
}

SCORING RUBRIC:
- Logical flow and structure (30 pts)
- Clarity of main idea (25 pts)
- Vocabulary and word choice (20 pts)
- Conciseness / lack of rambling (15 pts)
- Confidence markers (10 pts)

Be specific and actionable. Reference actual phrases from the transcript where helpful.`;
}
