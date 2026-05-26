import { MicOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useSpeechRecognition } from "@/components/useSpeech";

export default function VoiceRecorder({
  autoStart,
  autoStop,
  onTranscript,
  height = 160,
  afterSpeech = false,
}) {
  const {
    supported,
    listening,
    transcript,
    start,
    stop,
    startRecordingAfterSpeech,
  } = useSpeechRecognition();

  const stoppingRef = useRef(false);
  const transcriptRef = useRef("");

  // Always keep transcriptRef in sync
  useEffect(() => {
    if (transcript && transcript.trim()) {
      transcriptRef.current = transcript.trim();
    }
  }, [transcript]);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (_) { }
  };

  // Auto-start: runs once on mount
  useEffect(() => {
    if (!autoStart) return;

    let cancelled = false;

    const run = async () => {
      // Small delay to ensure component is fully mounted
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      playBeep();

      try {
        if (afterSpeech) {
          await startRecordingAfterSpeech();
        } else {
          await start();
        }
      } catch (err) {
        console.error("Mic start failed:", err);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-stop when timer hits 0
 useEffect(() => {
  if (!autoStop) return;
  if (stoppingRef.current) return;

  stoppingRef.current = true;

  const run = async () => {
    console.log("AUTO STOP TRIGGERED");

    const final = await stop();

    console.log("FINAL TRANSCRIPT:", final);

    // IMPORTANT
    // force callback even if empty
    setTimeout(() => {
      onTranscript?.((final || "").trim());
    }, 100);
  };

  run();

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [autoStop]);
  return (
    <div className="space-y-3" data-testid="voice-recorder">
      <div className="flex items-center gap-3">
        {listening ? (
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white inline-block" />
              🎙 Recorder is ON
            </div>
            <div className="flex items-end gap-1 h-6">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="hf-bar w-1 h-full bg-[#534AB7] rounded-full"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F4F4F8] text-[#8F8F9D] font-medium">
            <MicOff size={16} />
            {stoppingRef.current ? "Saving response…" : "Starting recorder…"}
          </div>
        )}
        {!supported && (
          <span className="text-sm text-red-500">
            Speech recognition not supported in this browser.
          </span>
        )}
      </div>
      <div
        className="hf-scroll w-full p-4 rounded-lg border border-[#E5E5EB] bg-white text-[#1A1A24] font-mono-stat text-sm overflow-y-auto"
        style={{ height, lineHeight: 1.6 }}
        data-testid="live-transcript"
      >
        {transcript || (
          <span className="text-[#8F8F9D]">Live transcript will appear here…</span>
        )}
      </div>
    </div>
  );
}
