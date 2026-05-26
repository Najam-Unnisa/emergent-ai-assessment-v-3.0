import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import api from "@/lib/apiClient";
import { useSpeechRecognition } from "@/components/useSpeech";

/* AIChat: 3-turn conversation with Claude. Voice-only by default (S8/S13).
   Changes:
   - Added 3-second delay after final AI reply before transitioning to next question
   - Candidate can read the last AI reply comfortably before moving on */
export default function AIChat({
  sessionId,
  questionId,
  sectionType,
  scenario,
  mode = "scenario",
  onComplete,
  maxTurns = 3,
}) {
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(null); // countdown before moving on
  const {
    listening,
    transcript,
    stop,
    start,
    startRecordingAfterSpeech,
    cleanup,
    supported,
  } = useSpeechRecognition();

  const scrollRef = useRef(null);
  const speakingRef = useRef(false);
  const turnCount = history.filter((h) => h.role === "candidate").length;
  const interviewQs = scenario?.questions || [];
  const [interviewIdx, setInterviewIdx] = useState(0);

  useEffect(() => {
    if (mode === "scenario") {
      setHistory([{ role: "ai", message: scenario.opening }]);
    } else if (mode === "interview") {
      setHistory([{ role: "ai", message: interviewQs[0] }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history, busy]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const handleSpeakToggle = async () => {
    if (busy) return;
    if (listening) {
      stop();
      speakingRef.current = false;
      return;
    }
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      stop();
      await new Promise((r) => setTimeout(r, 50));
      await startRecordingAfterSpeech();
    } catch (e) {
      console.error("Speak error:", e);
    } finally {
      speakingRef.current = false;
    }
  };

  // Finish with a 10-second countdown so candidate can read the last reply
  const finish = (finalHistory) => {
    setDone(true);
    cleanup();
    const transcriptText = finalHistory
      .map((h) => `${h.role === "ai" ? "AI" : "Me"}: ${h.message}`)
      .join("\n");

    // Start 10-second countdown before calling onComplete
    let secs = 10;
    setCountdown(secs);
    const interval = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(interval);
        onComplete?.({ transcript: transcriptText, history: finalHistory });
      }
    }, 1000);
  };

  const sendCandidate = async () => {
  if (busy) return;

  const finalTranscript = listening ? await stop() : transcript || "";
  const text = String(finalTranscript || "").trim();

  if (!text) return;
  
    const newHistory = [...history, { role: "candidate", message: text }];
    setHistory(newHistory);
    setBusy(true);

    if (mode === "interview") {
      const nextIdx = interviewIdx + 1;
      if (nextIdx < interviewQs.length) {
        setInterviewIdx(nextIdx);
        setHistory([
          ...newHistory,
          { role: "ai", message: interviewQs[nextIdx] },
        ]);
        setBusy(false);
      } else {
        setBusy(false);
        finish(newHistory);
      }
      return;
    }

    try {
      const res = await api.post("/test/conversation", {
        sessionId,
        questionId,
        scenarioId: scenario.scenarioId || sectionType,
        sectionType,
        candidateMessage: text,
        history: newHistory,
        title: scenario.title,
        context: scenario.context,
        role: scenario.role,
      });
      const reply = res.data?.reply || "Thanks. Could you elaborate?";
      const updated = [...newHistory, { role: "ai", message: reply }];
      setHistory(updated);
      const candidateTurns = updated.filter((h) => h.role === "candidate").length;
      if (candidateTurns >= maxTurns) {
        // Wait 10s before finishing so candidate can read the last reply
        setTimeout(() => finish(updated), 10000);
      }
    } catch (e) {
      setHistory([
        ...newHistory,
        { role: "ai", message: "Sorry, please continue." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-[#E5E5EB] bg-white overflow-hidden"
      data-testid="ai-chat"
    >
      <div className="px-5 py-3 border-b border-[#E5E5EB] bg-[#F4F4F8] flex items-center justify-between">
        <div>
          <div className="font-display font-semibold text-[#1A1A24]">
            {scenario.title || "Conversation"}
          </div>
          <div className="text-xs text-[#4A4A5A]">{scenario.context}</div>
        </div>
        <div className="text-xs font-mono-stat text-[#534AB7]">
          Turn {Math.min(turnCount + (done ? 0 : 1), maxTurns)}/{maxTurns}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="hf-scroll p-5 h-72 overflow-y-auto space-y-3 bg-white"
      >
        {history.map((h, i) => (
          <div
            key={i}
            className={`flex ${h.role === "ai" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`px-4 py-2.5 rounded-2xl max-w-[78%] text-sm leading-relaxed ${
                h.role === "ai"
                  ? "bg-[#F4F4F8] text-[#1A1A24] rounded-tl-sm"
                  : "bg-[#534AB7] text-white rounded-tr-sm"
              }`}
              data-testid={`chat-msg-${h.role}`}
            >
              {h.message}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div
              className="px-4 py-3 rounded-2xl bg-[#F4F4F8] flex gap-1.5"
              data-testid="typing-indicator"
            >
              <span className="hf-dot w-1.5 h-1.5 bg-[#534AB7] rounded-full" />
              <span className="hf-dot w-1.5 h-1.5 bg-[#534AB7] rounded-full" />
              <span className="hf-dot w-1.5 h-1.5 bg-[#534AB7] rounded-full" />
            </div>
          </div>
        )}
      </div>

      {!done && (
        <div className="border-t border-[#E5E5EB] p-4 bg-[#F9F9FB] space-y-3">
          <div className="hf-scroll p-3 rounded-lg border border-[#E5E5EB] bg-white text-sm font-mono-stat min-h-[60px] max-h-[100px] overflow-y-auto">
            {transcript || (
              <span className="text-[#8F8F9D]">
                Tap the mic and speak your reply…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSpeakToggle}
              disabled={busy}
              data-testid={listening ? "chat-stop-recording" : "chat-start-recording"}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                listening
                  ? "bg-red-500 text-white"
                  : "bg-[#534AB7] text-white hover:bg-[#423A93]"
              } disabled:opacity-40`}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
              {listening ? "Stop" : "Speak"}
            </button>
            <button
              onClick={sendCandidate}
              disabled={busy || (!transcript && !listening)}
              data-testid="chat-send-btn"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium bg-[#1A1A24] text-white hover:bg-black disabled:opacity-40"
            >
              <Send size={16} /> Send
            </button>
            {!supported && (
              <span className="text-xs text-red-500">
                Speech not supported.
              </span>
            )}
          </div>
        </div>
      )}

      {done && (
        <div
          className="border-t border-[#E5E5EB] p-4 bg-[#F4F4F8] text-center text-sm text-[#4A4A5A]"
          data-testid="chat-completed"
        >
          {countdown !== null && countdown > 0 ? (
            <span>Conversation complete. Moving on in <strong>{countdown}s</strong>…</span>
          ) : (
            <span>Conversation complete.</span>
          )}
        </div>
      )}
    </div>
  );
}
