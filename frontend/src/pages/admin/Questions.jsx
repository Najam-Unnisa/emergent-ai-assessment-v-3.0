import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import api from "@/lib/apiClient";

const SECTIONS = [
  { key: "repetition", num: 1, name: "Sentence Repetition", fields: ["prompt","sentence"] },
  { key: "reading", num: 2, name: "Reading Aloud", fields: ["prompt","passage"] },
  { key: "vocabulary", num: 3, name: "Vocabulary", fields: ["sentence","options","correctAnswer"] },
  { key: "comprehension", num: 4, name: "Comprehension", fields: ["passage","question"] },
  { key: "typing", num: 5, name: "Typing", fields: ["prompt","paragraph"] },
  { key: "story", num: 6, name: "Story Retelling", fields: ["prompt","storyText"] },
  { key: "jam", num: 7, name: "JAM", fields: ["topic"] },
  { key: "conversation", num: 8, name: "Conversation", fields: ["title","context","opening","role"] },
  { key: "use_case", num: 9, name: "Use Case", fields: ["prompt"] },
  { key: "sentence_building", num: 10, name: "Sentence Build", fields: ["buildType","topic","wordsList","correctAnswer"] },
  { key: "picture", num: 11, name: "Picture", fields: ["prompt","imageUrl"] },
  { key: "opinion", num: 12, name: "Opinion", fields: ["prompt"] },
  { key: "role_play", num: 13, name: "Role Play", fields: ["title","context","opening","role"] },
  { key: "pronunciation", num: 14, name: "Pronunciation", fields: ["wordsList"] },
  { key: "interview", num: 15, name: "Interview", fields: ["questions"] },
  { key: "email", num: 16, name: "Email", fields: ["prompt"] },
  { key: "grammar", num: 17, name: "Grammar", fields: ["sentence","correctAnswer"] },
  { key: "listening", num: 18, name: "Listening", fields: ["audioText","questions"] },
  { key: "dictation", num: 19, name: "Dictation", fields: ["audioText"] },
  { key: "word_assoc", num: 20, name: "Word Assoc", fields: ["topic"] },
  { key: "paraphrasing", num: 21, name: "Paraphrasing", fields: ["sentence"] },
];

export default function Questions() {
  const [active, setActive] = useState("repetition");
  const [items, setItems] = useState([]);
  const [diffFilter, setDiffFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  const load = async (key) => {
    const r = await api.get("/admin/questions", { params: { sectionType: key } });
    setItems(r.data || []);
  };

  useEffect(() => { load(active); }, [active]);

  const filtered = items.filter((q) => diffFilter === "all" || q.difficulty === diffFilter);
  const meta = SECTIONS.find((s) => s.key === active);

  const remove = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    await api.delete(`/admin/questions/${id}`);
    toast.success("Deleted");
    load(active);
  };

  const toggleActive = async (q) => {
    await api.put(`/admin/questions/${q.id}`, { ...q, isActive: !q.isActive });
    load(active);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl tracking-tight">Questions</h1>
        <p className="text-[#8F8F9D] text-sm mt-1">Manage the question pool used in candidate sessions.</p>
      </div>

      <div className="hf-scroll overflow-x-auto pb-2 mb-5">
        <div className="flex gap-2 min-w-max">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              data-testid={`tab-${s.key}`}
              onClick={() => setActive(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                active === s.key ? "bg-[#534AB7] text-white" : "bg-[#16161E] text-[#8F8F9D] border border-[#2D2D3B] hover:text-white"
              }`}
            >
              S{s.num} · {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#8F8F9D] uppercase tracking-widest">Filter:</span>
          {["all","easy","medium","hard"].map((d) => (
            <button
              key={d}
              onClick={() => setDiffFilter(d)}
              className={`px-2.5 py-1 rounded-full ${diffFilter === d ? "bg-[#534AB7] text-white" : "bg-[#16161E] text-[#8F8F9D] border border-[#2D2D3B]"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditing({ sectionType: active, difficulty: "medium", isActive: true, orderIndex: items.length, data: {} })}
          data-testid="add-question-btn"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#534AB7] text-white text-sm font-medium hover:bg-[#423A93]"
        >
          <Plus size={14} /> Add Question
        </button>
      </div>

      <div className="admin-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0D0D12]">
            <tr className="text-left text-xs uppercase tracking-widest text-[#8F8F9D]">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Difficulty</th>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q, i) => (
              <tr key={q.id} className="border-t border-[#2D2D3B]" data-testid={`q-row-${q.id}`}>
                <td className="px-4 py-3 font-mono-stat text-[#8F8F9D]">{i + 1}</td>
                <td className="px-4 py-3 capitalize">{q.difficulty}</td>
                <td className="px-4 py-3 text-[#F8F8F8] max-w-md truncate">{previewOf(q)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(q)}
                    className={`px-2.5 py-1 rounded-full text-xs ${q.isActive ? "bg-[#34C759]/15 text-[#34C759]" : "bg-[#2D2D3B] text-[#8F8F9D]"}`}
                  >{q.isActive ? "ON" : "OFF"}</button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(q)} className="text-[#534AB7] hover:text-white mr-3"><Pencil size={14} /></button>
                  <button onClick={() => remove(q.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-[#8F8F9D]">No questions.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <QuestionModal
          meta={meta}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(active); }}
        />
      )}
    </div>
  );
}

function previewOf(q) {
  const d = q.data || {};
  return d.sentence || d.passage || d.prompt || d.topic || d.title || d.audioText || d.storyText || (d.wordsList ? d.wordsList.join(", ") : "—");
}

function QuestionModal({ meta, item, onClose, onSaved }) {
  const [data, setData] = useState(item.data || {});
  const [difficulty, setDifficulty] = useState(item.difficulty || "medium");
  const [isActive, setIsActive] = useState(item.isActive ?? true);

  const save = async () => {
    const payload = { sectionType: meta.key, difficulty, isActive, orderIndex: item.orderIndex || 0, data };
    try {
      if (item.id) await api.put(`/admin/questions/${item.id}`, payload);
      else await api.post("/admin/questions", payload);
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error("Save failed");
    }
  };

  const setField = (k, v) => setData((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#16161E] border border-[#2D2D3B] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto hf-scroll">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D2D3B]">
          <div className="font-display font-semibold">{item.id ? "Edit" : "New"} Question — {meta.name}</div>
          <button onClick={onClose}><X size={18} className="text-[#8F8F9D]" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="flex gap-3">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <label className="inline-flex items-center gap-2 text-[#8F8F9D]">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[#534AB7]" /> Active
            </label>
          </div>
          {meta.fields.map((f) => (
            <div key={f}>
              <label className="text-xs uppercase tracking-widest text-[#8F8F9D]">{f}</label>
              {f === "options" ? (
                <textarea
                  rows={3}
                  value={(data.options || []).join("\n")}
                  onChange={(e) => setField("options", e.target.value.split("\n").filter(Boolean))}
                  placeholder="One option per line"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
                />
              ) : f === "wordsList" || f === "questions" ? (
                <textarea
                  rows={3}
                  value={(data[f] || []).join("\n")}
                  onChange={(e) => setField(f, e.target.value.split("\n").filter(Boolean))}
                  placeholder="One per line"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
                />
              ) : f === "buildType" ? (
                <select
                  value={data[f] || "jumble"}
                  onChange={(e) => setField(f, e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white"
                >
                  <option value="jumble">jumble</option>
                  <option value="topic">topic</option>
                </select>
              ) : (f === "passage" || f === "paragraph" || f === "audioText" || f === "storyText" || f === "context") ? (
                <textarea
                  rows={3}
                  value={data[f] || ""}
                  onChange={(e) => setField(f, e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
                />
              ) : (
                <input
                  value={data[f] || ""}
                  onChange={(e) => setField(f, e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#2D2D3B]">
          <button onClick={onClose} className="px-4 py-2 rounded-full border border-[#2D2D3B] text-[#8F8F9D] hover:text-white">Cancel</button>
          <button data-testid="save-question-btn" onClick={save} className="px-4 py-2 rounded-full bg-[#534AB7] text-white hover:bg-[#423A93]">Save</button>
        </div>
      </div>
    </div>
  );
}
