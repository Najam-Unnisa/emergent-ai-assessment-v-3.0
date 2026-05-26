import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight } from "lucide-react";
import api from "@/lib/apiClient";

const BG = "https://static.prod-images.emergentagent.com/jobs/e9072c74-fc26-471b-a77d-75c50e9c05f3/images/cdef9b5d2ce43dbed006c7831b1c62a63d7c1dc375304e9fbbdd61b028b4f93f.png";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post("/admin/login", { email, password });
      localStorage.setItem("hf_admin_token", res.data.token);
      localStorage.setItem("hf_admin_name", res.data.name);
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: `linear-gradient(180deg, rgba(13,13,18,0.85), rgba(13,13,18,0.95)), url(${BG}) center/cover`,
        color: "var(--hf-admin-text)",
      }}
    >
      <form
        onSubmit={submit}
        data-testid="admin-login-form"
        className="w-full max-w-md rounded-2xl admin-surface p-8 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 mb-7">
          <div className="w-9 h-9 rounded-md bg-[#534AB7] flex items-center justify-center text-white font-display font-bold">H</div>
          <div>
            <div className="font-display font-bold text-xl">HireFast Admin</div>
            <div className="text-xs text-[#8F8F9D]">Internal control panel</div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-[#8F8F9D]">Email</label>
            <input
              data-testid="admin-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] focus:border-[#534AB7] outline-none text-white"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-[#8F8F9D]">Password</label>
            <input
              data-testid="admin-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] focus:border-[#534AB7] outline-none text-white"
            />
          </div>
          <button
            type="submit"
            data-testid="admin-login-submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#534AB7] text-white font-semibold hover:bg-[#423A93] disabled:opacity-50 mt-3"
          >
            {busy ? "Signing in…" : <>Sign in <ArrowRight size={16} /></>}
          </button>
          <div className="flex items-center gap-2 text-xs text-[#8F8F9D] mt-3">
            <ShieldCheck size={14} className="text-[#534AB7]" /> Default: admin@test.com / admin123
          </div>
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm text-[#534AB7] hover:underline"
            >
              ← Return to Home
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
