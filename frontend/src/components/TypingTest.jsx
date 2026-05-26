import { useEffect, useMemo, useRef, useState } from "react";

/* TypingTest: shows reference paragraph with green correct chars + red wrong chars,
   live WPM/Accuracy/Errors. Reports final stats via onComplete on unmount or auto-stop. */
export default function TypingTest({ paragraph, autoStop, onResult }) {
  const [text, setText] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const taRef = useRef(null);

  const stats = useMemo(() => {
    const total = text.length;
    let correct = 0;
    let errors = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === paragraph[i]) correct++;
      else errors++;
    }
    const acc = total ? Math.round((correct / total) * 100) : 100;
    const elapsedMin = startedAt ? (Date.now() - startedAt) / 60000 : 0;
    const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
    const wpm = elapsedMin > 0 ? Math.round(words / elapsedMin) : 0;
    return { wpm, accuracy: acc, errors };
  }, [text, paragraph, startedAt]);

  useEffect(() => {
    if (autoStop) {
      onResult?.({ typedText: text, wpm: stats.wpm, accuracy: stats.accuracy, errors: stats.errors });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStop]);

  return (
    <div className="space-y-4" data-testid="typing-test">
      <div className="p-5 rounded-lg border border-[#E5E5EB] bg-[#F4F4F8] hf-noselect leading-relaxed">
        {paragraph.split("").map((ch, i) => {
          const typed = text[i];
          let cls = "text-[#4A4A5A]";
          if (typed != null) cls = typed === ch ? "text-[#34C759]" : "text-[#FF3B30] underline decoration-wavy";
          return <span key={i} className={cls}>{ch}</span>;
        })}
      </div>
      <textarea
        ref={taRef}
        data-testid="typing-input"
        className="w-full p-4 rounded-lg border-2 border-[#E5E5EB] focus:border-[#534AB7] outline-none font-mono-stat text-sm bg-white"
        rows={4}
        value={text}
        onChange={(e) => {
          if (!startedAt) setStartedAt(Date.now());
          setText(e.target.value);
        }}
        placeholder="Start typing here…"
      />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="WPM" value={stats.wpm} testId="typing-wpm" />
        <Stat label="Accuracy" value={`${stats.accuracy}%`} testId="typing-accuracy" />
        <Stat label="Errors" value={stats.errors} testId="typing-errors" />
      </div>
    </div>
  );
}

function Stat({ label, value, testId }) {
  return (
    <div className="rounded-lg border border-[#E5E5EB] bg-white p-3 text-center">
      <div className="text-[11px] tracking-widest uppercase text-[#8F8F9D]">{label}</div>
      <div className="font-mono-stat text-2xl text-[#1A1A24] mt-1" data-testid={testId}>{value}</div>
    </div>
  );
}
