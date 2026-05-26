import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/apiClient";

export default function Settings() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/admin/settings").then((r) => setItems(r.data || []));
  useEffect(() => { load(); }, []);

  const update = (i, patch) => {
    setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  };
  const save = async () => {
    const payload = items.map((x) => ({
      sectionType: x.sectionType,
      isEnabled: x.isEnabled,
      timerSeconds: Number(x.timerSeconds) || 0,
      questionsPerSession: Number(x.questionsPerSession) || 1,
    }));
    await api.put("/admin/settings", payload);
    toast.success("Settings saved");
  };
  const reset = async () => {
    await api.post("/admin/settings/reset");
    toast.success("Reset to defaults");
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">Settings</h1>
          <p className="text-[#8F8F9D] text-sm mt-1">Toggle sections, timers and question count per session.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} data-testid="reset-defaults-btn" className="px-4 py-2 rounded-full border border-[#2D2D3B] text-[#8F8F9D] hover:text-white text-sm">Reset to defaults</button>
          <button onClick={save} data-testid="save-settings-btn" className="px-4 py-2 rounded-full bg-[#534AB7] text-white hover:bg-[#423A93] text-sm">Save Settings</button>
        </div>
      </div>
      <div className="admin-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0D0D12]">
            <tr className="text-left text-xs uppercase tracking-widest text-[#8F8F9D]">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Timer (s)</th>
              <th className="px-4 py-3">Questions per session</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s, i) => (
              <tr key={s.sectionType} className="border-t border-[#2D2D3B]" data-testid={`settings-row-${s.sectionType}`}>
                <td className="px-4 py-3 font-mono-stat text-[#8F8F9D]">S{s.sectionNum}</td>
                <td className="px-4 py-3 font-medium">{s.sectionName}</td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={!!s.isEnabled} onChange={(e) => update(i, { isEnabled: e.target.checked })} className="accent-[#534AB7]" />
                  </label>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    value={s.timerSeconds}
                    onChange={(e) => update(i, { timerSeconds: e.target.value })}
                    className="w-24 px-2 py-1 rounded bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={1}
                    value={s.questionsPerSession}
                    onChange={(e) => update(i, { questionsPerSession: e.target.value })}
                    className="w-24 px-2 py-1 rounded bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
