import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Volume2, Play, ArrowRight, Loader2 } from "lucide-react";
import api from "@/lib/apiClient";
import CircularTimer from "@/components/CircularTimer";
import VoiceRecorder from "@/components/VoiceRecorder";
import TypingTest from "@/components/TypingTest";

import AIChat from "@/components/AIChat";
import { speak } from "@/components/useSpeech";

export default function TestRunner() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);



  useEffect(() => {

  const token = localStorage.getItem("hf_test_token");

  if (!token) {
    navigate("/");
    return;
  }

  api
    .get(`/test/verify-token/${token}`)
    .then((r) => {

    if (!r.data.valid) {

  toast.error(
    "Invalid or expired test link"
  );

  navigate("/");
  return;
}

      const cached = sessionStorage.getItem(
        `hf_session_${sessionId}`
      );

      if (cached) {
        setData(JSON.parse(cached));
        return;
      }

      navigate("/");
    })
   .catch((err) => {

  const msg =
    err?.response?.data?.detail ||
    "Access denied";

  toast.error(msg);

  navigate("/");
});

}, [sessionId, navigate]);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch (_) { }
    };
  }, [idx]);


  const sections = data?.sections || [];
  const total = sections.length;
  const current = sections[idx];

  const finishTest = async () => {
    setSubmitting(true);
    console.log("CALLING COMPLETE API");
    try {
      const res = await api.post("/test/complete", { sessionId });
      console.log("COMPLETE RESPONSE", res.data);
      sessionStorage.setItem(`hf_complete_${sessionId}`, JSON.stringify(res.data));
      navigate(`/complete/${sessionId}`);
    } catch (e) {
      toast.error("Failed to finalize test");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const advance = async (responsePayload) => {
  if (current) {
    try {
      await api.post("/test/response", {
        sessionId,
        questionId: current.questionId,
        sectionType: current.sectionType,
        transcript: "",
        typedText: "",
        selectedOption: "",
        ...responsePayload,
      });
    } catch (e) { }
  }
  // Stop all speech recognition before moving to next question
  try { window.speechSynthesis?.cancel(); } catch (_) {}
  try {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      // Small delay to let current recognition fully stop
      await new Promise((r) => setTimeout(r, 800));
    }
  } catch (_) {}

  if (idx + 1 >= total) {
    await finishTest();
  } else {
    setIdx((i) => i + 1);
  }
};

  /*
  // Skip handler: advances to next question without submitting
  const handleSkip = () => {
    if (idx + 1 >= total) {
      finishTest();
    } else {
      setIdx((i) => i + 1);
    }
  };
  */

  if (!data) return <FullPageLoader />;

  if (submitting) {
    return (
      <div className="min-h-screen bg-[#F9F9FB] flex flex-col items-center justify-center text-center p-6">
        <Loader2 className="animate-spin text-[#534AB7]" size={40} />
        <div className="font-display text-2xl font-semibold mt-5">Scoring your test…</div>
        <div className="text-[#4A4A5A] mt-2">Our AI is evaluating each response. This takes ~10 seconds.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9FB] text-[#1A1A24]">
      <header className="cand-glass sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#534AB7] flex items-center justify-center text-white font-display font-bold text-sm">H</div>
              <div className="font-display font-semibold">HireFast Test</div>
            </div>
            <div className="text-sm font-mono-stat text-[#4A4A5A]" data-testid="progress-text">
              {idx + 1} / {total}
            </div>
          </div>
          <div className="h-1.5 w-full bg-[#E5E5EB] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#534AB7]"
              initial={{ width: 0 }}
              animate={{ width: `${((idx + 1) / total) * 100}%` }}
              transition={{ duration: 0.4 }}
              data-testid="progress-bar"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={`${idx}-${current.questionId}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.35 }}
            >
              <SectionCard
                section={current}
                index={idx}
                total={total}
                onComplete={advance}
                /*onSkip={handleSkip}*/
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-[#534AB7]" size={32} />
    </div>
  );
}

function SectionShell({ section, children, onSkip }) {
  return (
    <div className="rounded-2xl bg-white border border-[#E5E5EB] shadow-sm p-7">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">

        {/* Left Side */}
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-md bg-[#534AB7]/10 text-[#534AB7] text-xs font-mono-stat font-semibold">
            S{section.sectionNum}
          </span>

          <h2
            className="font-display font-semibold text-lg"
            data-testid={`section-name-${section.sectionType}`}
          >
            {section.sectionName}
          </h2>
        </div>

        {/*
        <button
          onClick={onSkip}
          className="px-4 py-2 rounded-full border border-[#E5E5EB] text-[#4A4A5A] hover:bg-[#F4F4F8]"
        >
          Skip
        </button>
        */}
      </div>

      {children}
    </div>
  );
}

function NextButton({
  onClick,
  label = "Submit & Next",
  testId = "next-btn",
}) {
  return (
    <div className="mt-6 flex justify-end items-center">
      <button
        onClick={onClick}
        data-testid={testId}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#534AB7] text-white font-medium hover:bg-[#423A93]"
      >
        {label} <ArrowRight size={16} />
      </button>
    </div>
  );
}

function SectionCard({ section, onComplete, onSkip }) {
  const { uiType, sectionType } = section;
  let Renderer = RENDERERS[uiType] || RENDERERS.fallback;
  if (uiType === "voice" && (sectionType === "use_case" || sectionType === "opinion")) {
    Renderer = VoicePromptSection;
  }
  return (
    <SectionShell section={section} /*onSkip={onSkip}*/>
      <Renderer section={section} onComplete={onComplete} />
    </SectionShell>
  );
}

/* ------------ PREP TIMER COMPONENT -------------
   Shows a 10-second countdown before the answer phase starts.
   Used by all voice sections. */
function PrepTimer({ onDone }) {
  const [secs, setSecs] = useState(5);

  useEffect(() => {
    if (secs <= 0) {
      onDone();
      return;
    }
    const t = setInterval(() => setSecs((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [secs, onDone]);

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-3" data-testid="prep-timer">
      <div className="text-sm uppercase tracking-widest text-[#534AB7] font-medium">
        Preparation Time
      </div>
      <div className="font-mono-stat text-7xl font-bold text-[#534AB7] leading-none">
        {secs}
      </div>
      <div className="text-[#4A4A5A] text-sm">
        Recording starts automatically when countdown ends
      </div>
    </div>
  );
}

/* ------------ TIMER WRAPPER ------------- */
function useCountdown(seconds, onZero) {
  const [s, setS] = useState(seconds);
  const onZeroRef = useRef(onZero);
  onZeroRef.current = onZero;
  const armedRef = useRef(seconds > 0);

  useEffect(() => {
    if (seconds > 0) {
      armedRef.current = true;
      setS(seconds);
    } else {
      armedRef.current = false;
      setS(0);
    }
  }, [seconds]);

  useEffect(() => {
    if (s <= 0) return;
    const t = setInterval(() => setS((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [s]);

  useEffect(() => {
    if (s === 0 && armedRef.current) {
      armedRef.current = false;
      onZeroRef.current?.();
    }
  }, [s]);

  return s;
}

/* ------------ S1: SENTENCE REPETITION (voice) ------------- 
   Changes:
   - Added 10s prep timer before recording
   - Recording starts automatically after prep
   - Removed manual start/stop controls
   - Beep plays when recording starts (handled in VoiceRecorder)
*/
function VoiceWithTimer({ section, onComplete, instructionPrefix, content, ttsText, ttsRate }) {
  const [phase, setPhase] = useState("prep");
  /* const [autoStop, setAutoStop] = useState(false);*/

  const [played, setPlayed] = useState(!ttsText);
  const submittedRef = useRef(false);
  const transcriptRef = useRef("");
  const stopRecordingRef = useRef(false);

  const [shouldStop, setShouldStop] = useState(false);
  const remaining = useCountdown(
    phase === "record" && played ? section.timerSeconds : 0,
    () => {
      console.log("TIMER FINISHED");

      setShouldStop(true);
    }
  );
  // VoiceRecorder calls this AFTER it finishes (3.5s after autoStop)
  // Submit immediately with whatever transcript we got
  const handleTranscript = (final) => {
    const clean = (final || "").trim();

    console.log("VOICE FINAL:", clean);

    transcriptRef.current = clean;

    // THIS is now the ONLY submit path
    onComplete({
      transcript: clean,
    });
  };

  /*const submit = () => {
    onComplete({
      transcript: transcriptRef.current || "",
    });
  };*/

  // If there's TTS, play it first then start prep timer
  const handlePlayAndPrep = async () => {
    setPlayed(false);
    await speak(ttsText, { rate: ttsRate ?? 0.9 });
    setPlayed(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] mb-2 text-sm">{instructionPrefix}</p>
          {content}
          {ttsText && phase === "prep" && !played && (
            <button
              onClick={handlePlayAndPrep}
              data-testid="play-audio-btn"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#534AB7] text-[#534AB7] hover:bg-[#534AB7]/5"
            >
              <Volume2 size={16} /> Play audio
            </button>
          )}
        </div>
        {phase === "record" && played && (
          <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />
        )}
      </div>

      {/* Show prep timer if audio played (or no TTS) */}
      {phase === "prep" && played && (
        <PrepTimer onDone={() => setPhase("record")} />
      )}

      {/* Recording phase - fully automatic */}
      {phase === "record" && played && (
        <>
          <VoiceRecorder
            key={`recorder-${section.questionId}-${phase}`}
            autoStart={true}
            autoStop={shouldStop || stopRecordingRef.current}
            onTranscript={handleTranscript}
          />
          <NextButton
            onClick={async () => {
              if (remaining > 0) {
                stopRecordingRef.current = true;
              }
            }}
            /*onSkip={() => onComplete({})}*/
            testId="submit-voice-btn"
          />
        </>
      )}
    </div>
  );
}

const VoiceBasicSection = ({ section, onComplete }) => (
  <VoiceWithTimer
    section={section}
    onComplete={onComplete}
    instructionPrefix={section.data.prompt || section.sectionDesc}
    content={
      section.sectionType === "repetition"
        ? (
          <div className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-4 text-center text-[#8F8F9D] italic">
            🎧 Listen carefully and repeat what you hear...
          </div>
        )
        : section.data.sentence ? (
          <div className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-4 hf-noselect text-[#1A1A24] font-display text-lg">
            {section.data.sentence}
          </div>
        ) : section.data.passage ? (
          <div className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-4 hf-noselect text-[#1A1A24] leading-relaxed">
            {section.data.passage}
            {section.data.question && (
              <div className="mt-3 text-[#534AB7] font-medium">Q: {section.data.question}</div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-4 hf-noselect text-[#1A1A24] font-display text-lg">
            {section.data.prompt}
          </div>
        )
    }
    ttsText={section.sectionType === "repetition" ? section.data.sentence : null}
    ttsRate={0.9}
  />
);

/* MCQ Section */
const MCQSection = ({ section, onComplete }) => {
  const [selected, setSelected] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);
  const remaining = useCountdown(section.timerSeconds, () => setAutoSubmit(true));

  useEffect(() => {
    if (autoSubmit) onComplete({ selectedOption: selected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] mb-3 text-sm">Choose the correct word.</p>
          <div className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-4 font-display text-lg">
            {section.data.sentence}
          </div>
        </div>
        <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(section.data.options || []).map((opt) => (
          <label
            key={opt}
            data-testid={`mcq-option-${opt}`}
            className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${selected === opt ? "border-[#534AB7] bg-[#534AB7]/5" : "border-[#E5E5EB] hover:border-[#534AB7]/40"
              }`}
          >
            <input
              type="radio"
              name="mcq"
              value={opt}
              checked={selected === opt}
              onChange={() => setSelected(opt)}
              className="accent-[#534AB7]"
            />
            <span className="font-medium">{opt}</span>
          </label>
        ))}
      </div>
      <NextButton onClick={() => onComplete({ selectedOption: selected })} /*onSkip={() => onComplete({})}*/ testId="submit-mcq-btn" />
    </div>
  );
};

/* Typing Section */
const TypingSection = ({ section, onComplete }) => {
  const [autoStop, setAutoStop] = useState(false);
  const [resultRef] = useState({ current: null });
  const remaining = useCountdown(section.timerSeconds, () => setAutoStop(true));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <p className="text-[#4A4A5A] flex-1 text-sm">{section.data.prompt || "Type the paragraph below."}</p>
        <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />
      </div>
      <TypingTest
        paragraph={section.data.paragraph || section.data.sentence}
        autoStop={autoStop}
        onResult={(r) => {
          resultRef.current = r;
          onComplete({ typedText: r.typedText, wpm: r.wpm, accuracyPercentage: r.accuracy, errorCount: r.errors });
        }}
      />
      <NextButton onClick={() => setAutoStop(true)} /*onSkip={() => onComplete({})}*/ testId="submit-typing-btn" />
    </div>
  );
};

/* Story Retelling */
const StorySection = ({ section, onComplete }) => {

  const [phase, setPhase] = useState("idle"); // 'idle' | 'playing' | 'prep' | 'recording'
  const [autoStop, setAutoStop] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const playTokenRef = useRef(0);
  const remaining = useCountdown(phase === "recording" ? section.timerSeconds : 0, () => {
    setAutoStop(true);
  });

  const playStory = async () => {
    const myToken = ++playTokenRef.current;
    try { window.speechSynthesis?.cancel(); } catch (_) { }
    setAutoStop(false);
    setPhase("idle");
    await new Promise((r) => setTimeout(r, 300));
    if (myToken !== playTokenRef.current) return;
    setPhase("playing");
    await speak(section.data.storyText, { rate: 0.75 });
    if (myToken !== playTokenRef.current) return;
    await new Promise((r) => setTimeout(r, 800));
    if (myToken !== playTokenRef.current) return;
    setHasPlayed(true);
    setPhase("prep"); // show prep timer before recording
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] mb-2 text-sm">{section.data.prompt}</p>
          <button
            onClick={playStory}
            data-testid="play-story-btn"
            disabled={hasPlayed}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#534AB7] text-[#534AB7] hover:bg-[#534AB7]/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={16} /> {phase === "idle" ? "Play story" : phase === "playing" ? "Playing story…" : "Replay"}
          </button>
          {phase === "playing" && (
            <p className="mt-3 text-xs text-[#534AB7]" data-testid="story-playing-msg">
              Listen carefully. A prep countdown will start when the story ends.
            </p>
          )}
        </div>
        {phase === "recording" && <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />}
      </div>
      {phase === "prep" && <PrepTimer onDone={() => setPhase("recording")} />}
      {phase === "recording" && (
        <VoiceRecorder
          autoStart
          afterSpeech
          autoStop={autoStop}
          onTranscript={(t) => {
            const clean = (t || "").trim();
            if (!clean) {
              toast.error("Please answer before continuing");
              return;
            }
            onComplete({ transcript: clean, typedText: clean });
          }}
        />
      )}
      {phase === "recording" && <NextButton onClick={() => setAutoStop(true)} /*onSkip={() => onComplete({})}*/ testId="submit-story-btn" />}
    </div>
  );
};

/* JAM */
const JamSection = ({ section, onComplete }) => {
  const [phase, setPhase] = useState("prep");
  const [autoStop, setAutoStop] = useState(false);

  const prepRemaining = useCountdown(
    phase === "prep" ? 10 : 0,
    () => setPhase("speak"),
  );

  const speakRemaining = useCountdown(
    phase === "speak" ? section.timerSeconds : 0,
    () => setAutoStop(true),
  );

  useEffect(() => {
    if (phase !== "speak") return;
    try { window.speechSynthesis?.cancel(); } catch (_) { }
  }, [phase]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] mb-2 text-sm">Speak continuously on this topic for 60 seconds.</p>
          <div className="rounded-lg border-2 border-dashed border-[#534AB7]/40 bg-[#534AB7]/5 p-6 text-center">
            <div className="text-xs uppercase tracking-widest text-[#534AB7] mb-1">Topic</div>
            <div className="font-display text-2xl font-semibold text-[#1A1A24]">
              {section.data.topic}
            </div>
          </div>
        </div>
        {phase === "prep" ? (
          <div className="flex flex-col items-center justify-center min-w-[110px]" data-testid="jam-prep-timer">
            <div className="font-mono-stat text-5xl font-bold text-[#534AB7] leading-none">{prepRemaining}</div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-[#534AB7]">Preparation Time</div>
          </div>
        ) : (
          <CircularTimer seconds={speakRemaining} total={section.timerSeconds} label="seconds" />
        )}
      </div>
      {phase === "speak" && (
        <VoiceRecorder
          autoStart
          afterSpeech
          autoStop={autoStop}
          onTranscript={(t) => {
            const clean = (t || "").trim();
            if (!clean) {
              toast.error("Please answer before continuing");
              return;
            }
            onComplete({ transcript: clean, typedText: clean });
          }}
        />
      )}
      {phase === "prep" && (
        <p className="text-center text-[#534AB7] font-medium" data-testid="jam-prep-msg">
          Preparing… recording starts automatically in {prepRemaining}s.
        </p>
      )}
      {phase === "speak" && <NextButton onClick={() => setAutoStop(true)} /*onSkip={() => onComplete({})}*/ testId="submit-jam-btn" />}
    </div>
  );
};

/* AI Conversation */
const ConversationSection = ({ section, onComplete }) => {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-5">
      <p className="text-[#4A4A5A] text-sm">Have a 3-turn conversation with the AI. Speak your replies.</p>
      <AIChat
        sessionId={JSON.parse(sessionStorage.getItem(`hf_session_${getSessionIdFromUrl()}`) || "{}").sessionId || ""}
        questionId={section.questionId}
        sectionType={section.sectionType}
        scenario={{ ...section.data, scenarioId: section.questionId }}
        mode="scenario"
        onComplete={(payload) => {
          if (done) return;
          setDone(true);
          onComplete({ transcript: payload.transcript, extra: { history: payload.history } });
        }}
      />
    </div>
  );
};

/* AI Interview */
const InterviewSection = ({ section, onComplete }) => {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-5">
      <p className="text-[#4A4A5A] text-sm">Answer 3 standard interview questions verbally.</p>
      <AIChat
        sessionId={JSON.parse(sessionStorage.getItem(`hf_session_${getSessionIdFromUrl()}`) || "{}").sessionId || ""}
        questionId={section.questionId}
        sectionType={section.sectionType}
        scenario={{ title: "Interview Simulation", context: "Standard HR interview", role: "interviewer", questions: section.data.questions }}
        mode="interview"
        maxTurns={(section.data.questions || []).length}
        onComplete={(payload) => {
          if (done) return;
          setDone(true);
          onComplete({ transcript: payload.transcript, extra: { history: payload.history } });
        }}
      />
    </div>
  );
};

/* Sentence Building */
const SentenceBuildSection = ({ section, onComplete }) => {
  const [text, setText] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);
  const remaining = useCountdown(section.timerSeconds, () => setAutoSubmit(true));
  useEffect(() => { if (autoSubmit) onComplete({ typedText: text }); }, [autoSubmit]); // eslint-disable-line

  const isJumble = section.data.buildType === "jumble";
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] text-sm mb-3">
            {isJumble ? "Arrange the words into a correct sentence and type it." : "Build a sentence about this topic."}
          </p>
          {isJumble ? (
            <div className="flex flex-wrap gap-2">
              {section.data.wordsList.map((w) => (
                <span key={w} className="px-3 py-1.5 rounded-full bg-[#534AB7]/10 text-[#534AB7] font-medium text-sm">
                  {w}
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-[#534AB7]/40 bg-[#534AB7]/5 p-5 text-center font-display text-2xl font-semibold text-[#534AB7]">
              {section.data.topic}
            </div>
          )}
        </div>
        <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />
      </div>
      <textarea
        value={text}
        data-testid="sentence-build-input"
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full p-4 rounded-lg border-2 border-[#E5E5EB] focus:border-[#534AB7] outline-none"
        placeholder="Type your sentence here…"
      />
      <NextButton onClick={() => onComplete({ typedText: text })} /*onSkip={() => onComplete({})}*/ testId="submit-build-btn" />
    </div>
  );
};

/* Picture description */
const PictureSection = ({ section, onComplete }) => (
  <VoiceWithTimer
    section={section}
    onComplete={onComplete}
    instructionPrefix="Describe what you see in this image."
    content={
      <img
        src={section.data.imageUrl}
        alt="Workplace"
        className="rounded-lg max-h-72 object-cover w-full hf-noselect"
        draggable={false}
      />
    }
  />
);

/* Pronunciation */
const PronunciationSection = ({ section, onComplete }) => (
  <VoiceWithTimer
    section={section}
    onComplete={onComplete}
    instructionPrefix="Read each word aloud clearly."
    content={
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(section.data.wordsList || []).map((w) => (
          <div key={w} className="p-3 rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] text-center font-display font-semibold text-[#1A1A24]">
            {w}
          </div>
        ))}
      </div>
    }
  />
);

/* Email Writing */
const EmailSection = ({ section, onComplete }) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);
  const remaining = useCountdown(section.timerSeconds, () => setAutoSubmit(true));
  useEffect(() => { if (autoSubmit) submit(); }, [autoSubmit]); // eslint-disable-line
  const submit = () =>
    onComplete({
      typedText: `To: ${to}\nSubject: ${subject}\n\n${body}`,
      extra: { to, subject, body },
    });
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] text-sm mb-3">Compose a professional email.</p>
          <div className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-4 italic text-[#1A1A24]">
            {section.data.prompt}
          </div>
        </div>
        <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />
      </div>
      <div className="space-y-3">
        <input data-testid="email-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To: client@company.com" className="w-full px-4 py-2.5 rounded-lg border border-[#E5E5EB] focus:border-[#534AB7] outline-none" />
        <input data-testid="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full px-4 py-2.5 rounded-lg border border-[#E5E5EB] focus:border-[#534AB7] outline-none" />
        <textarea data-testid="email-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Body…" className="w-full px-4 py-3 rounded-lg border border-[#E5E5EB] focus:border-[#534AB7] outline-none" />
      </div>
      <NextButton onClick={submit} /*onSkip={() => onComplete({})}*/ testId="submit-email-btn" />
    </div>
  );
};

/* Grammar correction */
const GrammarSection = ({ section, onComplete }) => {
  const [text, setText] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);
  const remaining = useCountdown(section.timerSeconds, () => setAutoSubmit(true));
  useEffect(() => { if (autoSubmit) onComplete({ typedText: text }); }, [autoSubmit]); // eslint-disable-line
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] text-sm mb-2">Rewrite the sentence with correct grammar.</p>
          <div className="rounded-lg bg-[#FFF3F2] border border-red-200 p-4 hf-noselect text-[#1A1A24]">
            <span className="text-xs uppercase tracking-widest text-red-500 mr-2">Wrong</span>
            {section.data.sentence}
          </div>
        </div>
        <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />
      </div>
      <textarea data-testid="grammar-input" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Your corrected version…" className="w-full px-4 py-3 rounded-lg border-2 border-[#E5E5EB] focus:border-[#534AB7] outline-none" />
      <NextButton onClick={() => onComplete({ typedText: text })} /*onSkip={() => onComplete({})}*/ testId="submit-grammar-btn" />
    </div>
  );
};

/* Listening */
const ListeningSection = ({ section, onComplete }) => {
  const [played, setPlayed] = useState(false);
  const [autoStop, setAutoStop] = useState(false);
  const remaining = useCountdown(played ? section.timerSeconds : 0, () => setAutoStop(true));
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] text-sm mb-2">Listen, then answer both questions verbally.</p>
          <button onClick={async () => { await speak(section.data.audioText, { rate: 0.95 }); setPlayed(true); }} data-testid="play-listen-btn" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#534AB7] text-[#534AB7] hover:bg-[#534AB7]/5">
            <Volume2 size={16} /> Play audio
          </button>
          {played && (
            <div className="mt-4 space-y-2">
              {(section.data.questions || []).map((q, i) => (
                <div key={i} className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-3 text-sm">
                  <span className="text-[#534AB7] font-mono-stat mr-2">Q{i + 1}.</span>{q}
                </div>
              ))}
            </div>
          )}
        </div>
        {played && <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />}
      </div>
      {played && <VoiceRecorder autoStart autoStop={autoStop} onTranscript={(t) => {
        const clean = (t || "").trim();
        if (!clean) {
          toast.error("Please answer before continuing");
          return;
        }
        onComplete({ transcript: clean, typedText: clean });
      }} />}
      {played && <NextButton onClick={() => setAutoStop(true)} /*onSkip={() => onComplete({})}*/ testId="submit-listen-btn" />}
    </div>
  );
};

/* Dictation */
const DictationSection = ({ section, onComplete }) => {
  const [played, setPlayed] = useState(false);
  const [text, setText] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);
  const remaining = useCountdown(played ? section.timerSeconds : 0, () => setAutoSubmit(true));
  useEffect(() => { if (autoSubmit) onComplete({ typedText: text }); }, [autoSubmit]); // eslint-disable-line
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] text-sm mb-2">Listen carefully — there is no replay. Type exactly what you hear.</p>
          <button onClick={async () => { setPlayed(false); await speak(section.data.audioText, { rate: 1.0 }); setPlayed(true); }} data-testid="play-dictation-btn" disabled={played} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#534AB7] text-[#534AB7] hover:bg-[#534AB7]/5 disabled:opacity-40">
            <Volume2 size={16} /> {played ? "Played" : "Play once"}
          </button>
        </div>
        {played && <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />}
      </div>
      <textarea data-testid="dictation-input" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Type what you heard…" className="w-full px-4 py-3 rounded-lg border-2 border-[#E5E5EB] focus:border-[#534AB7] outline-none disabled:bg-gray-50" disabled={!played} />
      <NextButton onClick={() => onComplete({ typedText: text })} /*onSkip={() => onComplete({})}*/ testId="submit-dictation-btn" />
    </div>
  );
};

/* Word Association */
const WordAssocSection = ({ section, onComplete }) => (
  <VoiceWithTimer
    section={section}
    onComplete={onComplete}
    instructionPrefix="Speak as many related words as possible to the target word below."
    content={
      <div className="rounded-lg border-2 border-dashed border-[#534AB7]/40 bg-[#534AB7]/5 p-6 text-center font-display text-3xl font-bold text-[#534AB7]">
        {section.data.topic}
      </div>
    }
  />
);

/* Use case + opinion */
const VoicePromptSection = ({ section, onComplete }) => (
  <VoiceWithTimer
    section={section}
    onComplete={onComplete}
    instructionPrefix={section.sectionDesc}
    content={
      <div className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-4 hf-noselect text-[#1A1A24] font-display text-lg">
        {section.data.prompt}
      </div>
    }
  />
);

/* ------------ PARAPHRASING SECTION (Fix #6) -------------
   Changed from typing-only to voice-based with clear instructions
   that candidate should explain in their OWN words.
   Evaluation focuses on meaning, not exact match. */
const ParaphrasingSection = ({ section, onComplete }) => {
  const [phase, setPhase] = useState("prep");
  const [autoStop, setAutoStop] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  const stopRecordingRef = useRef(false);
  const transcriptRef = useRef("");

  const remaining = useCountdown(
    phase === "record" ? section.timerSeconds : 0,
    () => {
      setShouldStop(true);
    }
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[#4A4A5A] mb-2 text-sm">
            Read the sentence below and explain it <strong>in your own words</strong>. Focus on conveying the meaning clearly — do not repeat it word for word.
          </p>
          <div className="rounded-lg bg-[#F4F4F8] border border-[#E5E5EB] p-4 hf-noselect text-[#1A1A24] font-display text-lg">
            {section.data.sentence || section.data.paragraph}
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[#534AB7]/5 border border-[#534AB7]/20 text-xs text-[#534AB7]">
            💡 <strong>Tip:</strong> You will be evaluated on meaning retention, clarity, and communication — not on repeating exact words.
          </div>
        </div>
        {phase === "record" && (
          <CircularTimer seconds={remaining} total={section.timerSeconds} label="seconds" />
        )}
      </div>

      {phase === "prep" && (
        <PrepTimer onDone={() => setPhase("record")} />
      )}

      {phase === "record" && (
        <>
          <VoiceRecorder
            key={`recorder-paraphrase-${section.questionId}`}
            autoStart={true}
            autoStop={shouldStop || stopRecordingRef.current}
            onTranscript={(final) => {
              const clean = (final || "").trim();

              console.log("PARAPHRASE FINAL:", clean);

              transcriptRef.current = clean;

              onComplete({
                transcript: clean,
                typedText: clean,
              });
            }}
          />
          <div className="flex justify-end">
            <button
              onClick={() => {
                stopRecordingRef.current = true;
              }}
              data-testid="submit-paraphrase-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#534AB7] text-white font-medium hover:bg-[#423A93]"
            >
              Submit & Next <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const FallbackSection = ({ section, onComplete }) => (
  <div className="space-y-4">
    <p>Section type "{section.uiType}" not implemented.</p>
    <NextButton onClick={() => onComplete({})} /*onSkip={() => onComplete({})}*/ />
  </div>
);

const RENDERERS = {
  voice: VoiceBasicSection,
  voice_story: StorySection,
  voice_jam: JamSection,
  voice_image: PictureSection,
  voice_words: PronunciationSection,
  voice_listen: ListeningSection,
  voice_assoc: WordAssocSection,
  mcq: MCQSection,
  typing: TypingSection,
  typing_build: SentenceBuildSection,
  typing_email: EmailSection,
  typing_correct: GrammarSection,
  typing_dictation: DictationSection,
  ai_chat: ConversationSection,
  ai_interview: InterviewSection,
  fallback: FallbackSection,
  paraphrasing: ParaphrasingSection,
};

function getSessionIdFromUrl() {
  const m = window.location.pathname.match(/\/test\/([^/]+)/);
  return m ? m[1] : "";
}
