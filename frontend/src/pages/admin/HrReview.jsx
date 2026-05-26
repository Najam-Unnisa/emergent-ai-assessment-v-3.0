import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import api from "@/lib/apiClient";

export default function HrReview() {
  const { sessionId } = useParams();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("pending");
  const navigate = useNavigate();

  useEffect(() => { api.get("/admin/candidates").then((r) => setList(r.data || [])); }, []);

  if (sessionId) return <ReviewPanel sessionId={sessionId} onSaved={() => navigate("/admin/hr-review")} />;

  const items = list.filter((c) => filter === "all" || c.hrStatus === filter);
  return (
    <div className="p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">HR Review</h1>
          <p className="text-[#8F8F9D] text-sm mt-1">Provide manual scoring and notes.</p>
        </div>
        <div className="flex gap-2 text-xs">
          {["pending","reviewed","all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full ${filter === f ? "bg-[#534AB7] text-white" : "bg-[#16161E] text-[#8F8F9D] border border-[#2D2D3B]"}`}
            >{f}</button>
          ))}
        </div>
      </div>
      <div className="admin-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0D0D12]">
            <tr className="text-left text-xs uppercase tracking-widest text-[#8F8F9D]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">AI Score</th>
              <th className="px-4 py-3">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-[#2D2D3B]" data-testid={`hr-row-${c.id}`}>
                <td className="px-4 py-3 font-medium">{c.candidateName}<div className="text-xs text-[#8F8F9D]">{c.candidateEmail}</div></td>
                <td className="px-4 py-3 text-[#8F8F9D] font-mono-stat text-xs">{c.startedAt ? new Date(c.startedAt).toLocaleString() : "-"}</td>
                <td className="px-4 py-3 font-mono-stat">{c.overallScore != null ? Math.round(c.overallScore) : "-"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.hrStatus === "reviewed" ? "bg-[#34C759]/15 text-[#34C759]" : "bg-[#FF9500]/15 text-[#FF9500]"}`}>{c.hrStatus}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admin/hr-review/${c.id}`} className="text-[#534AB7] text-xs hover:underline">Review</Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-[#8F8F9D]">No items.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewPanel({ sessionId, onSaved }) {
  const [data, setData] = useState(null);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [hrNotes, setHrNotes] = useState("");

  useEffect(() => {
    api.get(`/admin/candidates/${sessionId}`).then((r) => {
      setData(r.data);
      const sc = {}; const cm = {};
      (r.data.responses || []).forEach((rr) => { sc[rr.questionId] = rr.hrScore ?? ""; cm[rr.questionId] = rr.hrComment || ""; });
      setScores(sc); setComments(cm);
      setHrNotes(r.data.session?.hrNotes || "");
    });
  }, [sessionId]);

  if (!data) return <div className="p-10 text-[#8F8F9D]">Loading…</div>;
  const { session, responses, sectionMeta } = data;

  const submit = async () => {
    const perResponse = (responses || []).map((r) => ({
      questionId: r.questionId,
      hrScore: scores[r.questionId] === "" ? null : Number(scores[r.questionId]),
      hrComment: comments[r.questionId] || "",
    }));
    await api.put(`/admin/hr-review/${sessionId}`, { hrNotes, perResponse });
    toast.success("Review saved");
    onSaved();
  };

  return (
    <div className="p-8">
      <Link to="/admin/hr-review" className="inline-flex items-center gap-2 text-xs text-[#8F8F9D] hover:text-white mb-4">
        <ArrowLeft size={14} /> Back to list
      </Link>
      <h1 className="font-display font-bold text-3xl tracking-tight mb-6">Review · {session.candidateName}</h1>

      <div className="space-y-4 mb-6">
        {responses.map((r) => {
          const meta = sectionMeta[r.sectionType] || {};
          return (
            <div key={r.id} className="admin-surface rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-widest text-[#534AB7]">S{meta.num} · {meta.name}</div>
                <div className="text-xs text-[#8F8F9D]">AI: <span className="text-[#34C759] font-mono-stat">{r.aiScore ?? "—"}/20</span></div>
              </div>
              <div className="text-xs text-[#8F8F9D] italic mb-2">{r.question?.prompt || r.question?.sentence || r.question?.topic || ""}</div>
              <div className="text-sm whitespace-pre-wrap mb-3">{r.transcript || r.typedText || r.selectedOption || "—"}</div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-[#8F8F9D]">HR Score (0-20)</label>
                  <input
                    data-testid={`hr-score-${r.questionId}`}
                    type="number" min={0} max={20}
                    value={scores[r.questionId] ?? ""}
                    onChange={(e) => setScores({ ...scores, [r.questionId]: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs uppercase tracking-widest text-[#8F8F9D]">HR Comment</label>
                  <input
                    value={comments[r.questionId] ?? ""}
                    onChange={(e) => setComments({ ...comments, [r.questionId]: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-surface rounded-xl p-5">
        <label className="text-xs uppercase tracking-widest text-[#8F8F9D]">Overall HR Notes</label>
        <textarea
          data-testid="hr-notes"
          rows={4}
          value={hrNotes}
          onChange={(e) => setHrNotes(e.target.value)}
          className="mt-2 w-full px-3 py-2 rounded-lg bg-[#0D0D12] border border-[#2D2D3B] text-white outline-none"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={submit}
            data-testid="submit-hr-review"
            className="px-5 py-2.5 rounded-full bg-[#534AB7] text-white font-medium hover:bg-[#423A93]"
          >Submit Review</button>
        </div>
      </div>
    </div>
  );
}
