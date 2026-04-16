import type { AppData, Session, Concept, ConceptStatus } from "./types";

const STORAGE_KEY = "microlab_data";

const DEFAULT_DATA: AppData = {
  sessions: [],
  settings: {
    learningStyle: "code-first",
    dailyGoal: 3,
  },
  stats: {
    totalMastered: 0,
    currentStreak: 0,
    lastActiveDate: null,
  },
};

export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_DATA);

  try {
    return JSON.parse(raw) as AppData;
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function createSession(
  data: AppData,
  sourceText: string,
  sourceTitle: string,
  concepts: Omit<Concept, "id" | "labCode" | "status" | "lastPracticed" | "nextReviewDate" | "correctStreak">[]
): AppData {
  const session: Session = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    sourceText,
    sourceTitle,
    concepts: concepts.map((c) => ({
      ...c,
      id: generateId(),
      labCode: null,
      status: "new" as ConceptStatus,
      lastPracticed: null,
      nextReviewDate: null,
      correctStreak: 0,
    })),
  };

  const updated = {
    ...data,
    sessions: [session, ...data.sessions],
  };
  saveData(updated);
  return updated;
}

export function updateConceptInSession(
  data: AppData,
  sessionId: string,
  conceptId: string,
  patch: Partial<Concept>
): AppData {
  const updated: AppData = {
    ...data,
    sessions: data.sessions.map((s) =>
      s.id !== sessionId
        ? s
        : {
            ...s,
            concepts: s.concepts.map((c) =>
              c.id !== conceptId ? c : { ...c, ...patch }
            ),
          }
    ),
  };
  saveData(updated);
  return updated;
}

export function deleteSession(data: AppData, sessionId: string): AppData {
  const updated: AppData = {
    ...data,
    sessions: data.sessions.filter((s) => s.id !== sessionId),
  };
  saveData(updated);
  return updated;
}

export function recalcStats(data: AppData): AppData {
  const totalMastered = data.sessions.reduce(
    (sum, s) => sum + s.concepts.filter((c) => c.status === "mastered").length,
    0
  );

  const today = new Date().toISOString().slice(0, 10);
  const lastActive = data.stats.lastActiveDate;

  let currentStreak = data.stats.currentStreak;
  if (lastActive !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastActive === yesterdayStr) {
      currentStreak += 1;
    } else if (lastActive !== today) {
      currentStreak = 1;
    }
  }

  const updated: AppData = {
    ...data,
    stats: {
      totalMastered,
      currentStreak,
      lastActiveDate: today,
    },
  };
  saveData(updated);
  return updated;
}
