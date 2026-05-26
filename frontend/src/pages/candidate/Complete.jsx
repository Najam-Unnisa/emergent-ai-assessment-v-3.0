import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ArrowRight,
  Award,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "@/lib/apiClient";

const SECTION_ORDER = [
  "repetition",
  "reading",
  "vocabulary",
  "comprehension",
  "typing",
  "story",
  "jam",
  "conversation",
  "use_case",
  "sentence_building",
  "picture",
  "opinion",
  "role_play",
  "pronunciation",
  "interview",
  "email",
  "grammar",
  "listening",
  "dictation",
  "word_assoc",
  "paraphrasing",
];

export default function Complete() {
  const { sessionId } = useParams();

  const [data, setData] = useState(null);
  const [sections, setSections] = useState([]);
  const [expandedQ, setExpandedQ] = useState(null);

  useEffect(() => {
    const cached = sessionStorage.getItem(`hf_complete_${sessionId}`);
    if (cached) {
      setData(JSON.parse(cached));
    } else {

      // Fall back to re-running complete if cache is missing
      api.post("/test/complete", { sessionId })
        .then((r) => {
          sessionStorage.setItem(`hf_complete_${sessionId}`, JSON.stringify(r.data));
          setData(r.data);
        })
        .catch((err) => {
          console.error("Failed to fetch test results:", err);
        });
    }
    api.get("/meta/sections").then((r) => setSections(r.data || []));
  }, [sessionId]);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-[#F9F9FB]">
        <Loader2 className="animate-spin text-[#534AB7]" size={36} />
        <div className="mt-4 font-display text-xl">
          Preparing your results…
        </div>
      </div>
    );
  }

  const {
    overallScore = 0,
    sectionScores = {},
    overallFeedback = "",
    scores = [],
  } = data;

  // FRONTEND SHOULD DIRECTLY USE SCORES
  const merged = scores.filter(
    (r) =>
      r.questionId &&
      (
        r.transcript ||
        r.typedText ||
        r.selectedOption
      )
  );


  const sortedSectionScores = Object.entries(sectionScores).sort(
    ([a], [b]) => {
      const ai = SECTION_ORDER.indexOf(a);
      const bi = SECTION_ORDER.indexOf(b);

      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;

      return ai - bi;
    }
  );

  const grade =
    overallScore >= 85
      ? { label: "Exceptional", color: "#34C759" }
      : overallScore >= 70
        ? { label: "Strong", color: "#534AB7" }
        : overallScore >= 55
          ? { label: "Developing", color: "#FF9500" }
          : { label: "Needs work", color: "#FF3B30" };

  return (
    <div className="min-h-screen bg-[#F9F9FB] text-[#1A1A24]">
      <header className="cand-glass sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#534AB7] flex items-center justify-center text-white font-display font-bold text-sm">
              H
            </div>
            <div className="font-display font-semibold">HireFast</div>
          </div>

          <Link
            to="/"
            className="text-sm text-[#534AB7] font-medium"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">

        {/* OVERALL SCORE */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl bg-white border border-[#E5E5EB] shadow-md p-10 text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#534AB7]/10 text-[#534AB7] text-xs font-medium mb-4">
            <CheckCircle2 size={14} />
            Test Complete
          </div>

          <h1 className="font-display font-bold text-4xl tracking-tight mb-2">
            Your AI score
          </h1>

          {/* <p className="text-[#4A4A5A]">
            Evaluated by Claude AI across all sections
          </p>*/}

          <div className="mt-8 flex items-center justify-center gap-8">
            <div className="relative w-44 h-44">
              <svg width="176" height="176" className="-rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="78"
                  stroke="#E5E5EB"
                  strokeWidth="14"
                  fill="none"
                />

                <motion.circle
                  cx="88"
                  cy="88"
                  r="78"
                  stroke={grade.color}
                  strokeWidth="14"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 78}
                  initial={{
                    strokeDashoffset: 2 * Math.PI * 78,
                  }}
                  animate={{
                    strokeDashoffset:
                      2 *
                      Math.PI *
                      78 *
                      (1 - overallScore / 100),
                  }}
                  transition={{
                    duration: 1.2,
                    ease: "easeOut",
                  }}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-mono-stat text-5xl font-bold">
                  {Math.round(overallScore)}
                </div>

                <div className="text-xs text-[#4A4A5A] uppercase tracking-widest">
                  / 100
                </div>
              </div>
            </div>

            <div className="text-left">
              <div className="flex items-center gap-2 mb-2">
                <Award
                  size={20}
                  style={{ color: grade.color }}
                />

                <span
                  className="font-display font-semibold text-xl"
                  style={{ color: grade.color }}
                >
                  {grade.label}
                </span>
              </div>

              <p className="text-[#1A1A24] max-w-md leading-relaxed">
                {overallFeedback}
              </p>
            </div>
          </div>
        </motion.div>

        {/* SECTION BREAKDOWN */}
        <div className="rounded-2xl bg-white border border-[#E5E5EB] p-8 shadow-sm">
          <h2 className="font-display font-semibold text-2xl mb-6">
            Section breakdown
          </h2>

          <div className="space-y-3">
            {sortedSectionScores.map(([key, value]) => {
              const meta =
                sections.find((s) => s.key === key) || {};

              return (
                <div
                  key={key}
                  className="flex items-center gap-4"
                >
                  <div className="w-44 shrink-0">
                    <div className="text-xs text-[#8F8F9D] font-mono-stat">
                      S{meta?.num || "?"}
                    </div>

                    <div className="font-medium">
                      {meta?.name || key}
                    </div>
                  </div>

                  <div className="flex-1 h-2 rounded-full bg-[#E5E5EB] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          100,
                          Math.max(0, value)
                        )}%`,
                      }}
                      transition={{ duration: 0.8 }}
                      className="h-full bg-[#534AB7]"
                    />
                  </div>

                  <div className="w-14 text-right font-mono-stat font-semibold">
                    {Math.round(value)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* QUESTION FEEDBACK */}
        {merged.length > 0 && (
          <div className="rounded-2xl bg-white border border-[#E5E5EB] p-8 shadow-sm">
            <h2 className="font-display font-semibold text-2xl mb-2">
              Question-wise feedback
            </h2>

            <p className="text-[#4A4A5A] text-sm mb-6">
              Detailed AI feedback for each question you answered.
            </p>

            <div className="space-y-4">
              {merged.map((r, i) => {
                const meta =
                  sections.find(
                    (s) => s.key === r.sectionType
                  ) || {};

                const isExpanded =
                  expandedQ === r.questionId;

                const questionText =
                  r.question?.sentence ||
                  r.question?.prompt ||
                  r.question?.topic ||
                  r.question?.audioText?.slice(0, 60) ||
                  r.question?.storyText?.slice(0, 60) ||
                  r.question?.question ||
                  "Question";

                const answerText =
                  r.transcript ||
                  r.typedText ||
                  r.selectedOption ||
                  "—";

                return (
                  <div
                    key={r.questionId}
                    className="rounded-xl border border-[#E5E5EB] overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedQ(
                          isExpanded
                            ? null
                            : r.questionId
                        )
                      }
                      className="w-full flex items-center justify-between p-5 hover:bg-[#F9F9FB] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-[#534AB7]/10 text-[#534AB7] text-xs font-mono-stat font-semibold shrink-0">
                          {meta?.name || r.sectionType}
                        </span>

                        <span className="text-sm font-medium text-[#1A1A24] line-clamp-1">
                          {questionText}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono-stat font-bold px-3 py-1 rounded-full bg-[#534AB7]/10 text-[#534AB7]">
                          {r.score}/20
                        </span>

                        {isExpanded ? (
                          <ChevronUp
                            size={16}
                            className="text-[#8F8F9D]"
                          />
                        ) : (
                          <ChevronDown
                            size={16}
                            className="text-[#8F8F9D]"
                          />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#E5E5EB] p-5 space-y-4 bg-[#F9F9FB]">

                        {/* QUESTION */}
                        <div>
                          <div className="text-xs uppercase tracking-widest text-[#8F8F9D] mb-1">
                            Question
                          </div>

                          <div className="text-sm text-[#1A1A24] bg-white rounded-lg border border-[#E5E5EB] p-3">
                            {questionText}
                          </div>
                        </div>

                        {/* ANSWER */}
                        <div>
                          <div className="text-xs uppercase tracking-widest text-[#8F8F9D] mb-1">
                            Your Answer
                          </div>

                          <div className="text-sm text-[#1A1A24] bg-white rounded-lg border border-[#E5E5EB] p-3">
                            {answerText}
                          </div>
                        </div>

                        {/* FEEDBACK */}

                        <div>
                          <div className="text-xs uppercase tracking-widest text-[#8F8F9D] mb-2">
                            AI Feedback
                          </div>
                          <div className="bg-white rounded-lg border border-[#534AB7]/20 p-4 space-y-2">
                            {r.strengths?.length > 0 && r.strengths.map((s, i) => (
                              <div key={i} className="flex gap-2 text-sm text-green-700">
                                <span>✓</span>
                                <span><strong>Strengths:</strong> {s}</span>
                              </div>
                            ))}
                            {r.weaknesses?.length > 0 && r.weaknesses.map((w, i) => (
                              <div key={i} className="flex gap-2 text-sm text-orange-600">
                                <span>△</span>
                                <span><strong>Areas to improve:</strong> {w}</span>
                              </div>
                            ))}
                            {r.improvements?.length > 0 && r.improvements.map((imp, i) => (
                              <div key={i} className="flex gap-2 text-sm text-[#1A1A24]">
                                <span>•</span>
                                <span><strong>Suggestion:</strong> {imp}</span>
                              </div>
                            ))}
                            {(!r.strengths?.length && !r.weaknesses?.length && !r.improvements?.length) && (
                              <p className="text-sm text-[#1A1A24] leading-relaxed">{r.comment}</p>
                            )}
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#1A1A24] text-white font-medium hover:bg-black"
          >
            Take another test
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    </div>
  );
}