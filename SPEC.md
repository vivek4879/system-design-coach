# System Design Micro-Lab — Build Spec

## Overview
A Claude-powered learning tool that turns system design content into interactive micro-labs. Users paste content (Hello Interview, blog posts, etc.), the agent extracts demonstrable concepts, generates runnable demos, tracks progress, and exports weak areas to Anki.

## Target User
Software engineers studying for system design interviews who want to *see* concepts working, not just read about them.

## Core Differentiators
1. **Auto-generated interactive labs** — Not just explanations, but runnable code demos
2. **Learning progress tracking** — Mastered vs needs review, persistent across sessions
3. **Spaced repetition + Anki export** — Science-backed retention

---

## User Flow

```
[Paste content] 
    → [Claude extracts 3-5 concepts as clickable chips]
    → [Click chip → generates interactive lab in real-time]
    → [Play with lab, ask follow-up questions]
    → [Mark as "Got it" or "Review later"]
    → [Dashboard shows progress over time]
    → [Export weak areas to Anki deck]
```

---

## Screens & Components

### 1. Landing / Input Screen
- Large textarea: "Paste system design content here"
- Placeholder text showing example (Hello Interview snippet)
- "Analyze Content" button
- Below: Recent sessions list (from localStorage)

### 2. Concepts View
- Header: Source content title (auto-extracted or "Untitled Session")
- Chips/cards for each extracted concept (3-5 typically)
  - Title (e.g., "SHA-256 Hashing")
  - 2-line summary
  - Status badge: New / Mastered / Review
  - "Generate Lab" button
- Sidebar: Progress stats

### 3. Lab View
- Concept title + summary at top
- Interactive demo area (iframe or inline HTML/JS)
- Chat input: "Ask a follow-up about this concept"
- Action buttons:
  - "Got it" → marks mastered
  - "Review later" → adds to spaced repetition queue
  - "Regenerate lab" → different demo angle
  - "Back to concepts"

### 4. Progress Dashboard
- Visual progress: topics mastered vs total
- "Due for review" section (spaced repetition)
- Learning streak (days in a row)
- Export to Anki button

### 5. Anki Export Modal
- Shows cards to be exported (from "Review later" items)
- Format: Question on front, Answer on back
- Download as .txt (tab-separated, Anki-importable)

---

## Technical Architecture

### Stack
- **Single React artifact** (runs in Claude.ai)
- **Claude API** (claude-sonnet-4-20250514) for:
  - Concept extraction
  - Lab generation
  - Follow-up Q&A
  - Anki card generation
- **localStorage** for persistence
- **No backend** — everything client-side

### Data Model

```javascript
// localStorage key: "microlab_data"
{
  sessions: [
    {
      id: "uuid",
      createdAt: "ISO timestamp",
      sourceText: "The pasted content...",
      sourceTitle: "URL Shortener Design", // extracted or user-provided
      concepts: [
        {
          id: "uuid",
          title: "SHA-256 + Base62 Encoding",
          summary: "Hash functions provide deterministic, high-entropy output...",
          demoIdea: "Interactive hash generator with collision probability calculator",
          labCode: "<div>...generated HTML/JS...</div>", // null until generated
          status: "new" | "mastered" | "review",
          lastPracticed: "ISO timestamp" | null,
          nextReviewDate: "ISO timestamp" | null,
          correctStreak: 0 // for spaced repetition
        }
      ]
    }
  ],
  settings: {
    learningStyle: "code-first" | "theory-first", // future use
    dailyGoal: 3 // concepts per day, future use
  },
  stats: {
    totalMastered: 0,
    currentStreak: 0, // days
    lastActiveDate: "ISO date"
  }
}
```

---

## Claude API Integration

### API Setup
```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }]
  })
});
```

### Prompt 1: Extract Concepts
```
You are a system design tutor. Analyze this content and extract 3-5 concepts that can be demonstrated with interactive code.

For each concept, provide:
- title: Short name (e.g., "Consistent Hashing")
- summary: 2-3 sentence explanation
- demoIdea: What interactive demo would help someone understand this?

Return ONLY valid JSON array, no markdown:
[{"title": "...", "summary": "...", "demoIdea": "..."}]

Content to analyze:
---
{sourceText}
---
```

### Prompt 2: Generate Lab
```
Create an interactive HTML/JS demo for this system design concept.

Concept: {title}
Summary: {summary}
Demo idea: {demoIdea}

Requirements:
- Single HTML string (will be rendered in iframe)
- Include inline CSS and JS (no external files)
- External CDN libs allowed: cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com
- Must be interactive (sliders, inputs, buttons, visualizations)
- Show intermediate steps so user can SEE how it works
- Clean, minimal UI with good contrast
- Add comments explaining key parts of the code

Return ONLY the HTML string, no markdown code blocks, no explanation before/after.
```

### Prompt 3: Follow-up Q&A
```
You are explaining the concept "{title}" to a software engineer studying for system design interviews.

Context: {summary}

The user is interacting with this demo:
{labCode}

Their question: {userQuestion}

Answer concisely. If relevant, suggest a modification to the demo they could try.
```

### Prompt 4: Generate Anki Cards
```
Create flashcards for studying this system design concept.

Concept: {title}
Summary: {summary}

Generate 3-5 cards. Each card should:
- Have a specific, answerable question (not "What is X?")
- Have a concise answer (2-3 sentences max)
- Cover different aspects: definition, tradeoffs, when to use, edge cases

Return tab-separated format, one card per line:
Question\tAnswer
Question\tAnswer
```

---

## Spaced Repetition Algorithm

```javascript
function getNextReviewDate(concept) {
  const intervals = [1, 3, 7, 14, 30]; // days
  const streak = concept.correctStreak;
  
  if (streak >= intervals.length) {
    return null; // mastered, no more reviews
  }
  
  const daysUntilReview = intervals[streak];
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysUntilReview);
  return nextDate.toISOString();
}

function markCorrect(concept) {
  concept.correctStreak++;
  concept.lastPracticed = new Date().toISOString();
  
  if (concept.correctStreak >= 5) {
    concept.status = "mastered";
    concept.nextReviewDate = null;
  } else {
    concept.status = "review";
    concept.nextReviewDate = getNextReviewDate(concept);
  }
}

function markIncorrect(concept) {
  concept.correctStreak = 0;
  concept.status = "review";
  concept.lastPracticed = new Date().toISOString();
  concept.nextReviewDate = getNextReviewDate(concept);
}
```

---

## UI/UX Guidelines

### Design Tokens (match Claude.ai)
- Font: System sans-serif
- Primary action: `#6366f1` (indigo)
- Success: `#10b981` (green)
- Warning/Review: `#f59e0b` (amber)
- Background: `#ffffff` / `#f9fafb`
- Border: `#e5e7eb`
- Border radius: `8px` (cards), `6px` (buttons), `4px` (inputs)

### States
- **Loading**: Skeleton placeholders while Claude generates
- **Empty**: Friendly prompt to paste first content
- **Error**: Retry button + clear error message

### Responsive
- Single column on mobile
- Sidebar collapses to bottom sheet on mobile

---

## MVP Scope (Weekend Build)

### Must Have
- [ ] Paste content → extract concepts
- [ ] Click concept → generate lab
- [ ] Labs render and are interactive
- [ ] Mark as mastered/review
- [ ] Progress persists in localStorage
- [ ] Basic progress stats

### Nice to Have (v1.1)
- [ ] Follow-up chat within lab view
- [ ] Anki export
- [ ] Spaced repetition with due dates
- [ ] Learning streak tracking

### Future (v2)
- [ ] Multiple learning styles
- [ ] Share sessions via URL
- [ ] Import from Hello Interview API (if available)
- [ ] Collaborative studying

---

## File Structure

Since this is a single React artifact, everything lives in one file. But organize it mentally as:

```
// 1. Constants & Types
// 2. localStorage helpers
// 3. Claude API helpers
// 4. Spaced repetition logic
// 5. Components:
//    - App (router/state)
//    - InputScreen
//    - ConceptsList
//    - LabView
//    - ProgressSidebar
//    - AnkiExportModal
// 6. Main render
```

---

## Getting Started

1. Open Claude Code
2. Create new React artifact
3. Start with the data model and localStorage helpers
4. Build InputScreen + concept extraction
5. Build ConceptsList UI
6. Build LabView with lab generation
7. Add progress tracking
8. Polish and test

Estimated build time: 4-6 hours for MVP

---

## Example Test Content

Use this to test concept extraction:

```
We need some entropy (randomness) to try to ensure that our codes are unique. We could try a random number generator or a hash function!

Using a random number generator to create short codes involves generating a random number each time a new URL is shortened. This random number serves as the unique identifier for the URL. We can use common random number generation functions like JavaScript's Math.random() or more robust cryptographic random number generators for increased unpredictability.

So instead, we could use a hash function like SHA-256 to generate a fixed-size hash code. Hash functions take an input and return a deterministic, fixed-size string of characters. Pure hash functions are deterministic: the same long URL always maps to the same short code without needing to query the database.

We can then take the output and encode it using a base62 encoding scheme and take just the first N characters as our short code. N is determined based on the number of characters needed to minimize collisions (e.g., 8 characters gives 62^8 ≈ 218 trillion possible codes).
```

Expected extracted concepts:
1. Random vs Deterministic ID Generation
2. SHA-256 Hash Functions
3. Base62 Encoding
4. Collision Probability & Code Length

---

## Success Metrics

For yourself:
- Can you study a Hello Interview topic in 30 min and feel like you *get it*?
- Do the labs help more than just reading?
- Are you retaining concepts a week later?

For publishing:
- Do 3 friends find it useful?
- Would someone pay $5/mo for this?

---

Good luck, Vivek. Ship it. 🚀
