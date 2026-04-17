import { useState } from "react";
import type { Session, Settings } from "../types";

const PLACEHOLDER = `Paste system design content here...

Example:
We need some entropy (randomness) to try to ensure that our codes are unique. We could try a random number generator or a hash function!

Using a random number generator to create short codes involves generating a random number each time a new URL is shortened. This random number serves as the unique identifier for the URL...`;

interface InputScreenProps {
  recentSessions: Session[];
  dueForReviewCount: number;
  onAnalyze: (text: string) => void;
  onResumeSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  isLoading: boolean;
  settings: Settings;
}

export function InputScreen({
  recentSessions,
  dueForReviewCount,
  onAnalyze,
  onResumeSession,
  onDeleteSession,
  onOpenDashboard,
  onOpenSettings,
  isLoading,
  settings,
}: InputScreenProps) {
  const [text, setText] = useState("");

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAnalyze(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && e.metaKey) {
      handleSubmit();
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function statusCounts(session: Session) {
    const mastered = session.concepts.filter((c) => c.status === "mastered").length;
    const review = session.concepts.filter((c) => c.status === "review").length;
    const total = session.concepts.length;
    return { mastered, review, total };
  }

  return (
    <div className="input-screen">
      <div className="input-top-bar">
        <span className="nav-model-label">
          {settings.model} | {settings.effort}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
          Settings
        </button>
      </div>

      <div className="input-hero">
        <h1>System Design Micro-Lab</h1>
        <p className="subtitle">
          Paste system design content, get interactive labs. Learn by doing.
        </p>
      </div>

      {dueForReviewCount > 0 && (
        <button className="due-nudge" onClick={onOpenDashboard}>
          <span className="due-nudge-count">{dueForReviewCount}</span>
          concept{dueForReviewCount !== 1 ? "s" : ""} due for review
          <span className="due-nudge-arrow">&rarr;</span>
        </button>
      )}

      <div className="input-area">
        <textarea
          className="content-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER}
          rows={10}
          disabled={isLoading}
        />
        <div className="input-actions">
          <span className="hint">
            {text.length > 0
              ? `${text.split(/\s+/).filter(Boolean).length} words`
              : ""}
          </span>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!text.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                Analyzing...
              </>
            ) : (
              "Analyze Content"
            )}
          </button>
        </div>
        {isLoading && (
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
        )}
      </div>

      {recentSessions.length > 0 && (
        <div className="recent-sessions">
          <h2>Recent Sessions</h2>
          <ul className="session-list">
            {recentSessions.map((session) => {
              const { mastered, review, total } = statusCounts(session);
              return (
                <li key={session.id} className="session-card">
                  <button
                    className="session-card-body"
                    onClick={() => onResumeSession(session.id)}
                  >
                    <div className="session-card-header">
                      <span className="session-title">
                        {session.sourceTitle}
                      </span>
                      <span className="session-date">
                        {formatDate(session.createdAt)}
                      </span>
                    </div>
                    <div className="session-card-stats">
                      <span className="stat-chip">{total} concepts</span>
                      {mastered > 0 && (
                        <span className="stat-chip stat-mastered">
                          {mastered} mastered
                        </span>
                      )}
                      {review > 0 && (
                        <span className="stat-chip stat-review">
                          {review} review
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    className="btn-icon btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    &times;
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
