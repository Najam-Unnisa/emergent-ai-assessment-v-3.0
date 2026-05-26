import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/apiClient";
import {
  Sparkles,
  ShieldCheck,
  Mic,
  KeyboardIcon,
  Brain,
  ArrowRight,
} from "lucide-react";

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/e9072c74-fc26-471b-a77d-75c50e9c05f3/images/cf2ce7fb49b80e3aec87a114c11e99aefc062e3a008efc6ac4e330ad51444edf.png";

const ICON_BY_TYPE = {
  voice: Mic,
  voice_story: Mic,
  voice_jam: Mic,
  voice_image: Mic,
  voice_words: Mic,
  voice_listen: Mic,
  voice_assoc: Mic,
  ai_chat: Brain,
  ai_interview: Brain,
  mcq: ShieldCheck,
  typing: KeyboardIcon,
  typing_build: KeyboardIcon,
  typing_email: KeyboardIcon,
  typing_correct: KeyboardIcon,
  typing_dictation: KeyboardIcon,
};

export default function Welcome() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/meta/sections")
      .then((r) => setSections(r.data || []))
      .catch(() => {});
  }, []);

  const startTest = async () => {
    // Name validation
    if (!name.trim() || name.trim().length < 3) {
      toast.error("Please enter your full name");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Block disposable emails
    const blockedDomains = [
      "tempmail.com",
      "10minutemail.com",
      "mailinator.com",
    ];

    const domain = email.split("@")[1]?.toLowerCase();

    if (blockedDomains.includes(domain)) {
      toast.error("Disposable email addresses are not allowed");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/test/start", {
        name: name.trim(),
        email: email.trim(),
      });

      localStorage.setItem(
        "hf_test_token",
        res.data.testToken
      );

      sessionStorage.setItem(
        `hf_session_${res.data.sessionId}`,
        JSON.stringify(res.data)
      );

      navigate(`/test/${res.data.sessionId}`);

    } catch (e) {

      console.log("START TEST ERROR:", e);

      toast.error(
        e?.response?.data?.detail ||
        "Failed to start test"
      );

    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9FB] text-[#1A1A24]">
      <div
        className="absolute inset-x-0 top-0 h-[420px] -z-0 opacity-60"
        style={{
          background:
            `linear-gradient(180deg, rgba(83,74,183,0.08) 0%, rgba(255,255,255,0) 100%)`,
        }}
      />

      <header className="cand-glass sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#534AB7] flex items-center justify-center text-white font-display font-bold">
              H
            </div>

            <div className="font-display font-bold text-xl tracking-tight">
              HireFast
            </div>
          </div>

          <a
            href="/admin/login"
            data-testid="admin-link"
            className="text-sm text-[#4A4A5A] hover:text-[#534AB7] font-medium"
          >
            Admin
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 pb-20 relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 mb-14">

          <div className="lg:col-span-7">

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#534AB7]/10 text-[#534AB7] text-xs font-medium mb-5">
              <Sparkles size={14} />
              21-section AI proficiency test
            </div>

            <h1 className="font-display font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl text-[#1A1A24] leading-[1.05]">
              Prove your English.
              <br />
              <span className="text-[#534AB7]">
                Land the job, faster.
              </span>
            </h1>

            <p className="mt-5 text-[#4A4A5A] text-lg max-w-xl leading-relaxed">
              Take a comprehensive workplace English assessment scored by AI
              across speaking, listening, reading, writing, and reasoning —
              in under 30 minutes.
            </p>

            <div className="mt-8 rounded-2xl bg-white border border-[#E5E5EB] p-6 max-w-lg shadow-sm">

              <h3 className="font-display font-semibold text-lg mb-4">
                Begin your assessment
              </h3>

              <div className="space-y-3">

                <div>
                  <label className="text-xs uppercase tracking-wider text-[#4A4A5A]">
                    Full name
                  </label>

                  <input
                    data-testid="welcome-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Riya Sharma"
                    className="mt-1 w-full rounded-lg border border-[#E5E5EB] focus:border-[#534AB7] px-4 py-2.5 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-[#4A4A5A]">
                    Email
                  </label>

                  <input
                    data-testid="welcome-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="riya@example.com"
                    className="mt-1 w-full rounded-lg border border-[#E5E5EB] focus:border-[#534AB7] px-4 py-2.5 outline-none"
                  />
                </div>

                <button
                  data-testid="start-test-btn"
                  onClick={startTest}
                  disabled={loading}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#534AB7] text-white font-semibold hover:bg-[#423A93] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    "Starting…"
                  ) : (
                    <>
                      Start Test
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <p className="text-xs text-[#8F8F9D] text-center">
                  Use Chrome or Edge on desktop for the best experience.
                </p>

              </div>
            </div>
          </div>

          <div className="lg:col-span-5 hidden lg:flex items-center justify-center">
            <div
              className="w-full aspect-square rounded-3xl border border-[#E5E5EB] bg-cover bg-center shadow-xl"
              style={{ backgroundImage: `url(${HERO_BG})` }}
            />
          </div>
        </div>

        <div>

          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display font-bold text-2xl tracking-tight">
              21 Sections you'll be tested on
            </h2>

            <div className="text-sm text-[#4A4A5A]">
              ~ 25–35 mins total
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {sections.map((s) => {

              const Icon = ICON_BY_TYPE[s.type] || Sparkles;

              return (
                <div
                  key={s.key}
                  data-testid={`section-card-${s.key}`}
                  className="rounded-xl border border-[#E5E5EB] bg-white p-5 hover:border-[#534AB7] hover:shadow-md transition-all"
                >

                  <div className="flex items-start justify-between mb-3">

                    <div className="w-9 h-9 rounded-lg bg-[#534AB7]/10 flex items-center justify-center text-[#534AB7]">
                      <Icon size={18} />
                    </div>

                    <span className="font-mono-stat text-xs text-[#8F8F9D]">
                      S{s.num}
                    </span>
                  </div>

                  <div className="font-display font-semibold text-[#1A1A24]">
                    {s.name}
                  </div>

                  <div className="text-sm text-[#4A4A5A] mt-1.5 leading-snug">
                    {s.desc}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[#8F8F9D] font-mono-stat uppercase tracking-wider">

                    <span>
                      {s.type.replace("_", " ")}
                    </span>

                    {s.timerSeconds > 0 && (
                      <span>· {s.timerSeconds}s</span>
                    )}

                    <span>
                      · {s.questionsPerSession} q
                    </span>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#E5E5EB] py-6 text-center text-xs text-[#8F8F9D]">
        © 2026 HireFast — AI-powered English proficiency testing.
      </footer>
    </div>
  );
}