import { useRef, useEffect, useState } from "react";
import type { Concept, ChatMessage } from "../types";

interface LabViewProps {
  concept: Concept;
  onMarkMastered: () => void;
  onMarkReview: () => void;
  onRegenerateLab: () => void;
  onBack: () => void;
  onAskFollowUp: (question: string) => Promise<string>;
  isRegenerating: boolean;
}

export function LabView({
  concept,
  onMarkMastered,
  onMarkReview,
  onRegenerateLab,
  onBack,
  onAskFollowUp,
  isRegenerating,
}: LabViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [iframeHeight, setIframeHeight] = useState(500);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "resize" && typeof e.data.height === "number") {
        setIframeHeight(Math.min(Math.max(e.data.height, 300), 1200));
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function handleChatSubmit() {
    const question = chatInput.trim();
    if (!question || isChatLoading) return;

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setIsChatLoading(true);

    try {
      const answer = await onAskFollowUp(question);
      setChatMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Try again." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }

  function handleChatKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  }

  const labHtml = concept.labCode
    ? wrapWithResizeObserver(concept.labCode)
    : null;

  return (
    <div className="lab-screen">
      <div className="lab-header">
        <button className="btn btn-ghost" onClick={onBack}>
          &larr; Back to concepts
        </button>
      </div>

      <div className="lab-info">
        <h1>{concept.title}</h1>
        <p className="lab-summary">{concept.summary}</p>
      </div>

      <div className="lab-demo-container">
        {isRegenerating ? (
          <div className="lab-skeleton">
            <div className="lab-skeleton-bar" />
            <div className="lab-skeleton-bar short" />
            <div className="lab-skeleton-block" />
            <p className="lab-skeleton-text">Generating interactive lab...</p>
          </div>
        ) : labHtml ? (
          <iframe
            ref={iframeRef}
            className="lab-iframe"
            srcDoc={labHtml}
            sandbox="allow-scripts allow-same-origin"
            title={`Lab: ${concept.title}`}
            style={{ height: `${iframeHeight}px` }}
          />
        ) : (
          <div className="lab-empty">
            <p>No lab generated yet. Click "Regenerate Lab" to create one.</p>
          </div>
        )}
      </div>

      <div className="lab-actions">
        <div className="lab-actions-left">
          <button
            className="btn btn-success"
            onClick={onMarkMastered}
            disabled={concept.status === "mastered"}
          >
            {concept.status === "mastered" ? "Mastered" : "Got it"}
          </button>
          <button className="btn btn-warning" onClick={onMarkReview}>
            Review later
          </button>
        </div>
        <button
          className="btn btn-secondary"
          onClick={onRegenerateLab}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <>
              <span className="spinner spinner-dark" />
              Regenerating...
            </>
          ) : (
            "Regenerate Lab"
          )}
        </button>
      </div>

      {/* Follow-up Chat */}
      <div className="chat-section">
        <h2 className="chat-heading">Ask a follow-up</h2>

        {chatMessages.length > 0 && (
          <div className="chat-messages">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble chat-${msg.role}`}>
                <span className="chat-role">
                  {msg.role === "user" ? "You" : "Tutor"}
                </span>
                <p className="chat-text">{msg.content}</p>
              </div>
            ))}
            {isChatLoading && (
              <div className="chat-bubble chat-assistant">
                <span className="chat-role">Tutor</span>
                <p className="chat-text chat-typing">Thinking...</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        <div className="chat-input-row">
          <input
            type="text"
            className="chat-input"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder="Ask about this concept..."
            disabled={isChatLoading}
          />
          <button
            className="btn btn-primary chat-send"
            onClick={handleChatSubmit}
            disabled={!chatInput.trim() || isChatLoading}
          >
            {isChatLoading ? <span className="spinner" /> : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function wrapWithResizeObserver(html: string): string {
  const resizeScript = `
<script>
  const ro = new ResizeObserver(() => {
    const h = document.documentElement.scrollHeight;
    parent.postMessage({ type: 'resize', height: h }, '*');
  });
  ro.observe(document.body);
  window.addEventListener('load', () => {
    parent.postMessage({ type: 'resize', height: document.documentElement.scrollHeight }, '*');
  });
</script>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", resizeScript + "</body>");
  }
  return html + resizeScript;
}
