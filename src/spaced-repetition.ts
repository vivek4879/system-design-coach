import type { Concept } from "./types";

const INTERVALS_DAYS = [1, 3, 7, 14, 30];

function getNextReviewDate(correctStreak: number): string | null {
  if (correctStreak >= INTERVALS_DAYS.length) {
    return null; // mastered — no more reviews
  }

  const daysUntilReview = INTERVALS_DAYS[correctStreak];
  const next = new Date();
  next.setDate(next.getDate() + daysUntilReview);
  return next.toISOString();
}

export function markCorrect(concept: Concept): Partial<Concept> {
  const newStreak = concept.correctStreak + 1;
  const mastered = newStreak >= INTERVALS_DAYS.length;

  return {
    correctStreak: newStreak,
    lastPracticed: new Date().toISOString(),
    status: mastered ? "mastered" : "review",
    nextReviewDate: mastered ? null : getNextReviewDate(newStreak),
  };
}

export function markIncorrect(_concept: Concept): Partial<Concept> {
  return {
    correctStreak: 0,
    lastPracticed: new Date().toISOString(),
    status: "review",
    nextReviewDate: getNextReviewDate(0),
  };
}

export function isDueForReview(concept: Concept): boolean {
  if (concept.status === "mastered") return false;
  if (!concept.nextReviewDate) return false;
  return new Date(concept.nextReviewDate) <= new Date();
}
