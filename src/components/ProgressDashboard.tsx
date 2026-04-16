import type { AppData, Concept } from "../types";
import { isDueForReview } from "../spaced-repetition";

interface ProgressDashboardProps {
  data: AppData;
  onBack: () => void;
  onNavigateToConcept: (sessionId: string, conceptId: string) => void;
  onOpenAnkiExport: () => void;
}

export function ProgressDashboard({
  data,
  onBack,
  onNavigateToConcept,
  onOpenAnkiExport,
}: ProgressDashboardProps) {
  const allConcepts = data.sessions.flatMap((s) =>
    s.concepts.map((c) => ({ ...c, sessionId: s.id, sessionTitle: s.sourceTitle }))
  );

  const totalConcepts = allConcepts.length;
  const mastered = allConcepts.filter((c) => c.status === "mastered").length;
  const reviewing = allConcepts.filter((c) => c.status === "review").length;
  const newCount = allConcepts.filter((c) => c.status === "new").length;
  const dueForReview = allConcepts.filter((c) => isDueForReview(c));
  const reviewableConcepts = allConcepts.filter(
    (c): c is typeof c & Concept => c.status === "review"
  );

  const masteredPercent = totalConcepts > 0 ? (mastered / totalConcepts) * 100 : 0;

  function handlePracticeDue() {
    if (dueForReview.length === 0) return;
    const first = dueForReview[0];
    onNavigateToConcept(first.sessionId, first.id);
  }

  return (
    <div className="dashboard-screen">
      <div className="dashboard-header">
        <button className="btn btn-ghost" onClick={onBack}>
          &larr; Back
        </button>
        <h1>Progress Dashboard</h1>
      </div>

      <div className="dashboard-stats-grid">
        <div className="dash-stat-card">
          <span className="dash-stat-number">{totalConcepts}</span>
          <span className="dash-stat-label">Total Concepts</span>
        </div>
        <div className="dash-stat-card dash-stat-success">
          <span className="dash-stat-number">{mastered}</span>
          <span className="dash-stat-label">Mastered</span>
        </div>
        <div className="dash-stat-card dash-stat-warning">
          <span className="dash-stat-number">{reviewing}</span>
          <span className="dash-stat-label">Reviewing</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-number">{newCount}</span>
          <span className="dash-stat-label">New</span>
        </div>
      </div>

      <div className="dashboard-progress-section">
        <h2>Overall Progress</h2>
        <div className="dashboard-progress-bar">
          <div
            className="dashboard-progress-fill"
            style={{ width: `${masteredPercent}%` }}
          />
        </div>
        <p className="dashboard-progress-label">
          {Math.round(masteredPercent)}% mastered
        </p>
      </div>

      {data.stats.currentStreak > 0 && (
        <div className="dashboard-streak">
          <span className="streak-fire">*</span>
          <span>
            {data.stats.currentStreak} day{data.stats.currentStreak !== 1 ? "s" : ""} streak
          </span>
        </div>
      )}

      {dueForReview.length > 0 && (
        <div className="dashboard-review-section">
          <div className="dashboard-review-header">
            <h2>Due for Review ({dueForReview.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={handlePracticeDue}>
              Practice Next
            </button>
          </div>
          <ul className="review-list">
            {dueForReview.map((c) => (
              <li key={c.id} className="review-item">
                <button
                  className="review-item-body"
                  onClick={() => onNavigateToConcept(c.sessionId, c.id)}
                >
                  <span className="review-item-title">{c.title}</span>
                  <span className="review-item-session">{c.sessionTitle}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reviewableConcepts.length > 0 && (
        <div className="dashboard-anki-section">
          <button className="btn btn-secondary btn-full" onClick={onOpenAnkiExport}>
            Export {reviewableConcepts.length} concept{reviewableConcepts.length !== 1 ? "s" : ""} to Anki
          </button>
        </div>
      )}

      {totalConcepts === 0 && (
        <div className="dashboard-empty">
          <p>No concepts yet. Paste some content to get started.</p>
        </div>
      )}
    </div>
  );
}
