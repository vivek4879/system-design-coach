import { useState, useCallback } from "react";
import type { AppData, Screen, Concept } from "./types";
import {
  loadData,
  createSession,
  deleteSession,
  updateConceptInSession,
  recalcStats,
} from "./storage";
import { markCorrect, markIncorrect, isDueForReview } from "./spaced-repetition";
import { InputScreen } from "./components/InputScreen";
import { ConceptsList } from "./components/ConceptsList";
import { LabView } from "./components/LabView";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { AnkiExportModal } from "./components/AnkiExportModal";

// ── Prompt Templates ──

function extractPrompt(sourceText: string): string {
  return `You are a system design tutor. Analyze this content and extract 3-5 concepts that can be demonstrated with interactive code.

For each concept, provide:
- title: Short name (e.g., "Consistent Hashing")
- summary: 2-3 sentence explanation
- demoIdea: What interactive demo would help someone understand this?

Return ONLY valid JSON array, no markdown:
[{"title": "...", "summary": "...", "demoIdea": "..."}]

Content to analyze:
---
${sourceText}
---`;
}

function labPrompt(concept: Concept): string {
  return `Create an interactive HTML/JS demo for this system design concept.

Concept: ${concept.title}
Summary: ${concept.summary}
Demo idea: ${concept.demoIdea}

Requirements:
- Single HTML string (will be rendered in iframe)
- Include inline CSS and JS (no external files)
- External CDN libs allowed: cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com
- Must be interactive (sliders, inputs, buttons, visualizations)
- Show intermediate steps so user can SEE how it works
- Clean, minimal UI with good contrast
- Add comments explaining key parts of the code

Return ONLY the HTML string, no markdown code blocks, no explanation before/after.`;
}

function followUpPrompt(
  concept: Concept,
  userQuestion: string
): string {
  return `You are explaining the concept "${concept.title}" to a software engineer studying for system design interviews.

Context: ${concept.summary}

${concept.labCode ? `The user is interacting with this demo:\n${concept.labCode.slice(0, 2000)}` : ""}

Their question: ${userQuestion}

Answer concisely. If relevant, suggest a modification to the demo they could try.`;
}

function ankiPrompt(concept: Concept): string {
  return `Create flashcards for studying this system design concept.

Concept: ${concept.title}
Summary: ${concept.summary}

Generate 3-5 cards. Each card should:
- Have a specific, answerable question (not "What is X?")
- Have a concise answer (2-3 sentences max)
- Cover different aspects: definition, tradeoffs, when to use, edge cases

Return tab-separated format, one card per line:
Question\tAnswer
Question\tAnswer`;
}

// ── API Call ──

async function callClaude(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API key required");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  const result = await response.json();
  return result.content?.[0]?.text ?? "";
}

// ── Helpers ──

function getApiKey(): string | null {
  const stored = localStorage.getItem("microlab_api_key");
  if (stored) return stored;

  const key = window.prompt(
    "Enter your Anthropic API key to power concept extraction.\n\nThis is stored only in your browser's localStorage."
  );
  if (!key) return null;

  localStorage.setItem("microlab_api_key", key);
  return key;
}

function extractTitle(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  const cleaned = firstLine.replace(/^#+\s*/, "").trim();
  if (cleaned.length > 60) return cleaned.slice(0, 57) + "...";
  if (cleaned.length < 3) return "Untitled Session";
  return cleaned;
}

function findSession(data: AppData, sessionId: string) {
  return data.sessions.find((s) => s.id === sessionId);
}

function findConcept(data: AppData, sessionId: string, conceptId: string) {
  return findSession(data, sessionId)?.concepts.find((c) => c.id === conceptId);
}

// ── App ──

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [screen, setScreen] = useState<Screen>({ name: "input" });
  const [isLoading, setIsLoading] = useState(false);
  const [generatingLabId, setGeneratingLabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnkiModal, setShowAnkiModal] = useState(false);

  // Derived: due-for-review count
  const dueForReviewCount = data.sessions
    .flatMap((s) => s.concepts)
    .filter((c) => isDueForReview(c)).length;

  // Reviewable concepts for Anki export
  const reviewableConcepts = data.sessions.flatMap((s) =>
    s.concepts
      .filter((c) => c.status === "review")
      .map((c) => ({ ...c, sessionTitle: s.sourceTitle }))
  );

  // ── Concept Extraction ──

  const handleAnalyze = useCallback(
    async (text: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const content = await callClaude(extractPrompt(text));
        const concepts = JSON.parse(content);

        if (!Array.isArray(concepts) || concepts.length === 0) {
          throw new Error("No concepts extracted. Try pasting more content.");
        }

        const title = extractTitle(text);
        const updated = recalcStats(createSession(data, text, title, concepts));
        setData(updated);
        setScreen({ name: "concepts", sessionId: updated.sessions[0].id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [data]
  );

  // ── Lab Generation ──

  const handleGenerateLab = useCallback(
    async (sessionId: string, conceptId: string) => {
      const concept = findConcept(data, sessionId, conceptId);
      if (!concept) return;

      if (concept.labCode) {
        setScreen({ name: "lab", sessionId, conceptId });
        return;
      }

      setGeneratingLabId(conceptId);
      setError(null);

      try {
        const html = await callClaude(labPrompt(concept));
        if (!html.trim()) {
          throw new Error("Empty lab generated. Try again.");
        }

        const updated = updateConceptInSession(data, sessionId, conceptId, {
          labCode: html,
        });
        setData(updated);
        setScreen({ name: "lab", sessionId, conceptId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lab generation failed");
      } finally {
        setGeneratingLabId(null);
      }
    },
    [data]
  );

  // ── Lab Regeneration ──

  const handleRegenerateLab = useCallback(
    async (sessionId: string, conceptId: string) => {
      const concept = findConcept(data, sessionId, conceptId);
      if (!concept) return;

      setGeneratingLabId(conceptId);
      setError(null);

      try {
        const html = await callClaude(labPrompt(concept));
        const updated = updateConceptInSession(data, sessionId, conceptId, {
          labCode: html,
        });
        setData(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Regeneration failed");
      } finally {
        setGeneratingLabId(null);
      }
    },
    [data]
  );

  // ── Follow-up Chat ──

  const handleAskFollowUp = useCallback(
    async (sessionId: string, conceptId: string, question: string): Promise<string> => {
      const concept = findConcept(data, sessionId, conceptId);
      if (!concept) throw new Error("Concept not found");
      return callClaude(followUpPrompt(concept, question));
    },
    [data]
  );

  // ── Anki Card Generation ──

  const handleGenerateAnkiCards = useCallback(
    async (concept: Concept): Promise<string> => {
      return callClaude(ankiPrompt(concept));
    },
    []
  );

  // ── Status Updates ──

  const handleMarkMastered = useCallback(
    (sessionId: string, conceptId: string) => {
      const concept = findConcept(data, sessionId, conceptId);
      if (!concept) return;
      const patch = markCorrect(concept);
      const updated = recalcStats(
        updateConceptInSession(data, sessionId, conceptId, patch)
      );
      setData(updated);
    },
    [data]
  );

  const handleMarkReview = useCallback(
    (sessionId: string, conceptId: string) => {
      const concept = findConcept(data, sessionId, conceptId);
      if (!concept) return;
      const patch = markIncorrect(concept);
      const updated = recalcStats(
        updateConceptInSession(data, sessionId, conceptId, patch)
      );
      setData(updated);
    },
    [data]
  );

  // ── Navigation ──

  const handleResumeSession = useCallback((sessionId: string) => {
    setScreen({ name: "concepts", sessionId });
  }, []);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setData(deleteSession(data, sessionId));
    },
    [data]
  );

  // ── Render ──

  const currentSession =
    screen.name === "concepts" || screen.name === "lab"
      ? findSession(data, screen.sessionId)
      : null;

  const currentConcept =
    screen.name === "lab"
      ? findConcept(data, screen.sessionId, screen.conceptId)
      : null;

  return (
    <div className="app">
      {screen.name !== "input" && (
        <div className="nav-bar">
          <button
            className="btn btn-ghost"
            onClick={() => setScreen({ name: "dashboard" })}
          >
            Dashboard
            {dueForReviewCount > 0 && (
              <span className="nav-badge">{dueForReviewCount}</span>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="btn-icon" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      {screen.name === "input" && (
        <InputScreen
          recentSessions={data.sessions}
          dueForReviewCount={dueForReviewCount}
          onAnalyze={handleAnalyze}
          onResumeSession={handleResumeSession}
          onDeleteSession={handleDeleteSession}
          onOpenDashboard={() => setScreen({ name: "dashboard" })}
          isLoading={isLoading}
        />
      )}

      {screen.name === "concepts" && currentSession && (
        <ConceptsList
          session={currentSession}
          onGenerateLab={(conceptId) =>
            handleGenerateLab(currentSession.id, conceptId)
          }
          onBack={() => setScreen({ name: "input" })}
          generatingLabId={generatingLabId}
        />
      )}

      {screen.name === "lab" && currentSession && currentConcept && (
        <LabView
          concept={currentConcept}
          onMarkMastered={() =>
            handleMarkMastered(currentSession.id, currentConcept.id)
          }
          onMarkReview={() =>
            handleMarkReview(currentSession.id, currentConcept.id)
          }
          onRegenerateLab={() =>
            handleRegenerateLab(currentSession.id, currentConcept.id)
          }
          onBack={() =>
            setScreen({ name: "concepts", sessionId: currentSession.id })
          }
          onAskFollowUp={(question) =>
            handleAskFollowUp(currentSession.id, currentConcept.id, question)
          }
          isRegenerating={generatingLabId === currentConcept.id}
        />
      )}

      {screen.name === "dashboard" && (
        <ProgressDashboard
          data={data}
          onBack={() => setScreen({ name: "input" })}
          onNavigateToConcept={(sessionId, conceptId) =>
            setScreen({ name: "lab", sessionId, conceptId })
          }
          onOpenAnkiExport={() => setShowAnkiModal(true)}
        />
      )}

      {showAnkiModal && (
        <AnkiExportModal
          concepts={reviewableConcepts}
          onGenerateCards={handleGenerateAnkiCards}
          onClose={() => setShowAnkiModal(false)}
        />
      )}
    </div>
  );
}
