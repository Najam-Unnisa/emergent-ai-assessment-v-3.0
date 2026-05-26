import { useEffect, useRef, useState, useCallback } from "react";

export function useSpeechRecognition() {
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const isRecordingRef = useRef(false);
  const callIdRef = useRef(0);

  // FINAL transcript storage
  const finalRef = useRef("");
  const interimRef = useRef("");

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const _teardown = useCallback(() => {
    isRecordingRef.current = false;
    setListening(false);

    try {
      window.speechSynthesis?.cancel();
    } catch (_) {}

    const rec = recRef.current;

    if (rec) {
      try {
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
      } catch (_) {}

      try {
        rec.abort();
      } catch (_) {}

      try {
        rec.stop();
      } catch (_) {}

      recRef.current = null;
    }

    const stream = streamRef.current;

    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}

      streamRef.current = null;
    }
  }, []);

  const _buildAndStart = useCallback((myCallId) => {
    if (myCallId !== callIdRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      setSupported(false);
      return;
    }

    const rec = new SR();

    recRef.current = rec;

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      if (recRef.current !== rec) return;

      let interim = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];

        if (r.isFinal) {
          finalRef.current += r[0].transcript + " ";
        } else {
          interim += r[0].transcript;
        }
      }

      interimRef.current = interim;

      const full = (finalRef.current + interim).trim();

      console.log("LIVE TRANSCRIPT:", full);

      setTranscript(full);
    };

    rec.onerror = (e) => {
      const err = e?.error || "";

      console.error("Speech recognition error:", err);

      if (err === "not-allowed" || err === "service-not-allowed") {
        try {
          window.alert(
            "Please allow microphone access to record your answer."
          );
        } catch (_) {}

        isRecordingRef.current = false;
        setListening(false);
        return;
      }

      if (["no-speech", "aborted", "network"].includes(err)) {
        if (isRecordingRef.current && recRef.current === rec) {
          setTimeout(() => {
            if (isRecordingRef.current && recRef.current === rec) {
              try {
                rec.start();
              } catch (_) {}
            }
          }, 300);
        }
      }
    };

    rec.onend = () => {
      // Auto-restart while recording
      if (isRecordingRef.current && recRef.current === rec) {
        try {
          rec.start();
        } catch (_) {}
      } else {
        setListening(false);
      }
    };

    isRecordingRef.current = true;

    try {
      rec.start();
      setListening(true);
    } catch (_) {
      setListening(true);
    }
  }, []);

  // START NORMAL RECORDING
  const start = useCallback(async () => {
    const myCallId = ++callIdRef.current;

    // RESET ONLY ON NEW QUESTION
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");

    _teardown();

    await new Promise((r) => setTimeout(r, 500));

    if (myCallId !== callIdRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      if (myCallId !== callIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
    } catch (e) {
      if (e.name === "NotAllowedError") {
        try {
          window.alert(
            "Please allow microphone access to record your answer."
          );
        } catch (_) {}
      }

      return;
    }

    _buildAndStart(myCallId);
  }, [_teardown, _buildAndStart]);

  // START AFTER TTS
  const startRecordingAfterSpeech = useCallback(async () => {
    const myCallId = ++callIdRef.current;

    // RESET ONLY ON NEW QUESTION
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");

    try {
      window.speechSynthesis?.cancel();
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 800));

    if (myCallId !== callIdRef.current) return;

    _teardown();

    await new Promise((r) => setTimeout(r, 500));

    if (myCallId !== callIdRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      if (myCallId !== callIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
    } catch (e) {
      try {
        window.alert(
          "Please allow microphone access to record your answer."
        );
      } catch (_) {}

      return;
    }

    _buildAndStart(myCallId);
  }, [_teardown, _buildAndStart]);

  // STOP RECORDING
 const stop = useCallback(() => {
  return new Promise((resolve) => {
    isRecordingRef.current = false;

    const rec = recRef.current;

    if (!rec) {
      resolve((finalRef.current + " " + interimRef.current).trim());
      return;
    }

    // IMPORTANT:
    // Wait for browser final result AFTER stop()
    rec.onend = () => {
      const final = (
        finalRef.current + " " + interimRef.current
      ).trim();

      console.log("STOP FINAL:", final);

      if (streamRef.current) {
        try {
          streamRef.current
            .getTracks()
            .forEach((t) => t.stop());
        } catch (_) {}

        streamRef.current = null;
      }

      recRef.current = null;

      setListening(false);

      resolve(final);
    };

    try {
      rec.stop();
    } catch (_) {
      resolve((finalRef.current + " " + interimRef.current).trim());
    }
  });
}, []);

  const cleanup = useCallback(async () => {
    callIdRef.current++;

    _teardown();

    finalRef.current = "";
    interimRef.current = "";

    setTranscript("");

    await new Promise((r) => setTimeout(r, 500));
  }, [_teardown]);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;

      callIdRef.current++;

      const rec = recRef.current;

      if (rec) {
        try {
          rec.onend = null;
          rec.onerror = null;
          rec.onresult = null;
        } catch (_) {}

        try {
          rec.abort();
        } catch (_) {}

        try {
          rec.stop();
        } catch (_) {}

        recRef.current = null;
      }

      const stream = streamRef.current;

      if (stream) {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}
      }

      try {
        window.speechSynthesis?.cancel();
      } catch (_) {}
    };
  }, []);

  return {
    supported,
    listening,
    transcript,
    start,
    stop,
    cleanup,
    startRecordingAfterSpeech,
  };
}

/* SPEAK FUNCTION */
export function speak(text, opts = {}) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();

    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    const u = new SpeechSynthesisUtterance(text);

    u.rate = opts.rate ?? 1.0;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = 1;

    u.onend = () => resolve();
    u.onerror = () => resolve();

    window.speechSynthesis.speak(u);
  });
}