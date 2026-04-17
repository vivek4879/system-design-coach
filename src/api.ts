import type { Concept, Settings, ClaudeResponse } from "./types";

// ── Prompt Templates ──

export function extractPrompt(sourceText: string): string {
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

export function labPrompt(concept: Concept): string {
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

export function followUpPrompt(concept: Concept, userQuestion: string): string {
  return `You are explaining the concept "${concept.title}" to a software engineer studying for system design interviews.

Context: ${concept.summary}

${concept.labCode ? `The user is interacting with this demo:\n${concept.labCode.slice(0, 2000)}` : ""}

Their question: ${userQuestion}

Answer concisely. If relevant, suggest a modification to the demo they could try.`;
}

export function ankiPrompt(concept: Concept): string {
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

export async function callClaude(
  prompt: string,
  settings: Settings
): Promise<ClaudeResponse> {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      model: settings.model,
      effort: settings.effort,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error || `Proxy error ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.text,
    usage: data.usage,
  };
}
