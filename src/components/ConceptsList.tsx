import type { Session, ConceptStatus } from "../types";

interface ConceptsListProps {
  session: Session;
  onGenerateLab: (conceptId: string) => void;
  onBack: () => void;
  generatingLabId: string | null;
}

const STATUS_LABEL: Record<ConceptStatus, string> = {
  new: "New",
  mastered: "Mastered",
  review: "Review",
};

const STATUS_CLASS: Record<ConceptStatus, string> = {
  new: "badge-new",
  mastered: "badge-mastered",
  review: "badge-review",
};

export function ConceptsList({
  session,
  onGenerateLab,
  onBack,
  generatingLabId,
}: ConceptsListProps) {
  const mastered = session.concepts.filter((c) => c.status === "mastered").length;
  const total = session.concepts.length;

  return (
    <div className="concepts-screen">
      <div className="concepts-header">
        <button className="btn btn-ghost" onClick={onBack}>
          &larr; Back
        </button>
        <div className="concepts-header-info">
          <h1>{session.sourceTitle}</h1>
          <p className="concepts-progress-text">
            {mastered} of {total} concepts mastered
          </p>
        </div>
      </div>

      <div className="concepts-progress-bar">
        <div
          className="concepts-progress-fill"
          style={{ width: total > 0 ? `${(mastered / total) * 100}%` : "0%" }}
        />
      </div>

      <ul className="concepts-grid">
        {session.concepts.map((concept) => {
          const isGenerating = generatingLabId === concept.id;
          const hasLab = concept.labCode !== null;

          return (
            <li key={concept.id} className="concept-card">
              <div className="concept-card-top">
                <span className={`badge ${STATUS_CLASS[concept.status]}`}>
                  {STATUS_LABEL[concept.status]}
                </span>
              </div>
              <h3 className="concept-title">{concept.title}</h3>
              <p className="concept-summary">{concept.summary}</p>
              <p className="concept-demo-idea">
                <span className="demo-label">Lab idea:</span> {concept.demoIdea}
              </p>
              <button
                className={`btn ${hasLab ? "btn-secondary" : "btn-primary"} concept-btn`}
                onClick={() => onGenerateLab(concept.id)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="spinner spinner-dark" />
                    Generating...
                  </>
                ) : hasLab ? (
                  "Open Lab"
                ) : (
                  "Generate Lab"
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
