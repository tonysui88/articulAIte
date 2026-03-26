// ─── Coach / Roleplay session types ──────────────────────────────────────────

export interface CoachSetup {
  scenario:    string;
  targetVocab: string[];
}

export interface ConversationTurn {
  role:        "coach" | "user";
  content:     string;      // coach reply text OR user transcript
  critique?:   string;      // populated on user turns after Gemini analysis
  vocabCheck?: string;
}

export interface CoachTurnResponse {
  userTranscript: string;
  reply:          string;
  critique:       string;
  vocabCheck:     string;
}

export type CoachApiResponse<T> =
  | { success: true;  data: T }
  | { success: false; error: string };

export interface ScenarioPreset {
  title:       string;
  icon:        string;
  scenario:    string;
  targetVocab: string[];
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    title:    "Salary Negotiation",
    icon:     "💼",
    scenario: "You are negotiating a 15% salary increase with your manager at your annual performance review. Your manager is initially resistant and mentions budget constraints.",
    targetVocab: ["leverage", "benchmark", "compensation", "trajectory", "deliverables"],
  },
  {
    title:    "Job Interview",
    icon:     "🎯",
    scenario: "You are interviewing for a senior software engineer role at a top tech company. The interviewer is probing the depth of your technical experience and leadership skills.",
    targetVocab: ["scalable", "initiative", "collaborate", "prioritize", "stakeholder"],
  },
  {
    title:    "Persuading a Skeptical Client",
    icon:     "🤝",
    scenario: "You are pitching a new product feature to a skeptical client who is worried about cost and implementation time. You need to win their approval.",
    targetVocab: ["ROI", "streamline", "robust", "seamless", "compelling"],
  },
  {
    title:    "Handling a Complaint",
    icon:     "🛡",
    scenario: "You are a customer service manager handling a very frustrated customer whose order was delayed by two weeks and who is demanding a full refund and compensation.",
    targetVocab: ["rectify", "empathize", "resolve", "expedite", "goodwill"],
  },
];
