export type ConceptStatus = "new" | "mastered" | "review";

export interface Concept {
  id: string;
  title: string;
  summary: string;
  demoIdea: string;
  labCode: string | null;
  status: ConceptStatus;
  lastPracticed: string | null;
  nextReviewDate: string | null;
  correctStreak: number;
}

export interface Session {
  id: string;
  createdAt: string;
  sourceText: string;
  sourceTitle: string;
  concepts: Concept[];
}

export interface Settings {
  learningStyle: "code-first" | "theory-first";
  dailyGoal: number;
  model: "sonnet" | "opus" | "haiku";
  effort: "low" | "medium" | "high" | "max";
}

export interface Stats {
  totalMastered: number;
  currentStreak: number;
  lastActiveDate: string | null;
}

export interface AppData {
  sessions: Session[];
  settings: Settings;
  stats: Stats;
}

export type Screen =
  | { name: "input" }
  | { name: "concepts"; sessionId: string }
  | { name: "lab"; sessionId: string; conceptId: string }
  | { name: "dashboard" };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface ClaudeResponse {
  text: string;
  usage: ClaudeUsage;
}

export interface SessionUsageTotals {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
}
