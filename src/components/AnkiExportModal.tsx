import { useState } from "react";
import type { Concept } from "../types";

interface AnkiExportModalProps {
  concepts: Array<Concept & { sessionTitle: string }>;
  onGenerateCards: (concept: Concept) => Promise<string>;
  onClose: () => void;
}

interface AnkiCard {
  question: string;
  answer: string;
}

export function AnkiExportModal({
  concepts,
  onGenerateCards,
  onClose,
}: AnkiExportModalProps) {
  const [cards, setCards] = useState<AnkiCard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    setCards([]);

    try {
      const allCards: AnkiCard[] = [];

      for (const concept of concepts) {
        const raw = await onGenerateCards(concept);
        const lines = raw
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.includes("\t"));

        for (const line of lines) {
          const [question, ...rest] = line.split("\t");
          const answer = rest.join("\t");
          if (question && answer) {
            allCards.push({ question: question.trim(), answer: answer.trim() });
          }
        }
      }

      setCards(allCards);
      setGenerated(true);
    } catch {
      setCards([]);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    const content = cards.map((c) => `${c.question}\t${c.answer}`).join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "system-design-anki-cards.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export to Anki</h2>
          <button className="btn-icon" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Generate flashcards from {concepts.length} concept
            {concepts.length !== 1 ? "s" : ""} marked for review.
          </p>

          {!generated && (
            <div className="modal-concepts-list">
              {concepts.map((c) => (
                <div key={c.id} className="modal-concept-item">
                  <span className="modal-concept-title">{c.title}</span>
                  <span className="modal-concept-session">{c.sessionTitle}</span>
                </div>
              ))}
            </div>
          )}

          {generated && cards.length > 0 && (
            <div className="anki-cards-preview">
              <p className="anki-cards-count">
                {cards.length} cards generated
              </p>
              <ul className="anki-cards-list">
                {cards.map((card, i) => (
                  <li key={i} className="anki-card-item">
                    <div className="anki-card-q">
                      <span className="anki-label">Q:</span> {card.question}
                    </div>
                    <div className="anki-card-a">
                      <span className="anki-label">A:</span> {card.answer}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {generated && cards.length === 0 && !isGenerating && (
            <p className="modal-empty">
              No cards generated. Try again.
            </p>
          )}
        </div>

        <div className="modal-footer">
          {!generated ? (
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="spinner" />
                  Generating cards...
                </>
              ) : (
                "Generate Cards"
              )}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={cards.length === 0}
            >
              Download .txt for Anki
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
