import { useState, useCallback } from "react";
import type { AppData, Screen, Concept, ClaudeUsage, SessionUsageTotals } from "./types";
import {
  loadData,
  saveData,
  createSession,
  deleteSession,
  updateConceptInSession,
  recalcStats,
} from "./storage";
import { markCorrect, markIncorrect, isDueForReview } from "./spaced-repetition";
import { callClaude, extractPrompt, labPrompt, followUpPrompt, ankiPrompt } from "./api";
import { InputScreen } from "./components/InputScreen";
import { ConceptsList } from "./components/ConceptsList";
import { LabView } from "./components/LabView";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { AnkiExportModal } from "./components/AnkiExportModal";
import { SettingsModal } from "./components/SettingsModal";

// ── Helpers ──

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

const EMPTY_USAGE: SessionUsageTotals = {
  totalCostUsd: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  requestCount: 0,
};

// ── App ──

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [screen, setScreen] = useState<Screen>({ name: "input" });
  const [isLoading, setIsLoading] = useState(false);
  const [generatingLabId, setGeneratingLabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnkiModal, setShowAnkiModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Usage tracking (ephemeral — resets on refresh)
  const [sessionUsage, setSessionUsage] = useState<SessionUsageTotals>(EMPTY_USAGE);
  const [lastUsage, setLastUsage] = useState<ClaudeUsage | null>(null);

  const accumulateUsage = useCallback((usage: ClaudeUsage) => {
    setLastUsage(usage);
    setSessionUsage((prev) => ({
      totalCostUsd: prev.totalCostUsd + usage.costUsd,
      totalInputTokens: prev.totalInputTokens + usage.inputTokens,
      totalOutputTokens: prev.totalOutputTokens + usage.outputTokens,
      requestCount: prev.requestCount + 1,
    }));
  }, []);

  // Derived
  const dueForReviewCount = data.sessions
    .flatMap((s) => s.concepts)
    .filter((c) => isDueForReview(c)).length;

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
      setLastUsage(null);

      try {
        const { text: content, usage } = await callClaude(
          extractPrompt(text),
          data.settings
        );
        accumulateUsage(usage);

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
    [data, accumulateUsage]
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
      setLastUsage(null);

      try {
        const { text: html, usage } = await callClaude(
          labPrompt(concept),
          data.settings
        );
        accumulateUsage(usage);

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
    [data, accumulateUsage]
  );

  // ── Lab Regeneration ──

  const handleRegenerateLab = useCallback(
    async (sessionId: string, conceptId: string) => {
      const concept = findConcept(data, sessionId, conceptId);
      if (!concept) return;

      setGeneratingLabId(conceptId);
      setError(null);
      setLastUsage(null);

      try {
        const { text: html, usage } = await callClaude(
          labPrompt(concept),
          data.settings
        );
        accumulateUsage(usage);

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
    [data, accumulateUsage]
  );

  // ── Follow-up Chat ──

  const handleAskFollowUp = useCallback(
    async (sessionId: string, conceptId: string, question: string): Promise<string> => {
      const concept = findConcept(data, sessionId, conceptId);
      if (!concept) throw new Error("Concept not found");
      const { text, usage } = await callClaude(
        followUpPrompt(concept, question),
        data.settings
      );
      accumulateUsage(usage);
      return text;
    },
    [data, accumulateUsage]
  );

  // ── Anki Card Generation ──

  const handleGenerateAnkiCards = useCallback(
    async (concept: Concept): Promise<string> => {
      const { text, usage } = await callClaude(
        ankiPrompt(concept),
        data.settings
      );
      accumulateUsage(usage);
      return text;
    },
    [data, accumulateUsage]
  );

  // ── Settings ──

  const handleSaveSettings = useCallback(
    (newSettings: AppData["settings"]) => {
      const updated = { ...data, settings: newSettings };
      saveData(updated);
      setData(updated);
    },
    [data]
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
          <div className="nav-left">
            {sessionUsage.requestCount > 0 && (
              <span className="nav-usage">
                ${sessionUsage.totalCostUsd.toFixed(4)} |{" "}
                {sessionUsage.totalInputTokens + sessionUsage.totalOutputTokens} tokens
              </span>
            )}
          </div>
          <div className="nav-actions">
            <span className="nav-model-label">
              {data.settings.model} | {data.settings.effort}
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>
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

      {lastUsage && !isLoading && !generatingLabId && (
        <div className="usage-inline">
          {lastUsage.inputTokens + lastUsage.outputTokens} tokens |
          ${lastUsage.costUsd.toFixed(4)} |
          {(lastUsage.durationMs / 1000).toFixed(1)}s
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
          onOpenSettings={() => setShowSettings(true)}
          isLoading={isLoading}
          settings={data.settings}
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

      {showSettings && (
        <SettingsModal
          settings={data.settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
