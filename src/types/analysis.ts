// ─── Shared types used across frontend and backend ───────────────────────────

export interface TranscriptWord {
  word:  string;
  start: number; // seconds
  end:   number; // seconds
  isFiller: boolean;
}

export interface PacingMetrics {
  wpm:          number;   // words per minute
  category:     "slow" | "ideal" | "fast";
  // WPM reference: <120 slow, 120-160 ideal, >160 fast
}

export interface FillerAnalysis {
  totalCount:    number;
  fillerRate:    number;  // fillers per minute
  byWord:        Record<string, number>; // { "um": 4, "like": 2 }
  topFiller:     string | null;
}

export interface CoherenceAnalysis {
  score:         number;  // 0–100
  grade:         "A" | "B" | "C" | "D" | "F";
  strengths:     string[];
  improvements:  string[];
  tips:          ActionableTip[];
}

export interface ActionableTip {
  category: "pacing" | "clarity" | "structure" | "vocabulary" | "confidence";
  title:    string;
  detail:   string;
  priority: "high" | "medium" | "low";
}

export interface AnalysisResult {
  transcript:  string;
  words:       TranscriptWord[];
  duration:    number;  // seconds
  pacing:      PacingMetrics;
  fillers:     FillerAnalysis;
  coherence:   CoherenceAnalysis;
  processedAt: string;  // ISO timestamp
}

// API response envelope
export type AnalyzeResponse =
  | { success: true;  data: AnalysisResult }
  | { success: false; error: string };
