import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Download, ArrowLeft } from "lucide-react";
import jsPDF from "jspdf";
import api from "@/lib/apiClient";

export default function CandidateDetail() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/admin/candidates/${sessionId}`).then((r) => setData(r.data));
  }, [sessionId]);
  if (!data) return <div className="p-10 text-[#8F8F9D]">Loading…</div>;

  const { session, responses, conversations, sectionMeta } = data;
  const sectionScores = session.sectionScores || {};
  const sortedSections = Object.entries(sectionScores).sort(
  ([a], [b]) => {
    const aNum = sectionMeta[a]?.num || 999;
    const bNum = sectionMeta[b]?.num || 999;

    return aNum - bNum;
  }
);

  const exportPdf = () => {
    const doc = new jsPDF();
    let y = 14;
    doc.setFontSize(16); doc.text("HireFast — Candidate Report", 14, y); y += 8;
    doc.setFontSize(11);
    doc.text(`Name: ${session.candidateName}`, 14, y); y += 6;
    doc.text(`Email: ${session.candidateEmail}`, 14, y); y += 6;
    doc.text(`Date: ${session.startedAt}`, 14, y); y += 6;
    doc.text(`Overall Score: ${Math.round(session.overallScore || 0)}/100`, 14, y); y += 8;
    doc.setFontSize(12); doc.text("AI Feedback:", 14, y); y += 6;
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(session.aiFeedback || "", 180);
    doc.text(lines, 14, y); y += lines.length * 5 + 4;
    doc.setFontSize(12); doc.text("Section scores:", 14, y); y += 6;
    doc.setFontSize(10);
    Object.entries(sectionScores).forEach(([k, v]) => {
      const meta = sectionMeta[k] || {};
      doc.text(`${meta.name || k}: ${Math.round(v)}/100`, 14, y); y += 5;
      if (y > 280) { doc.addPage(); y = 14; }
    });
    doc.save(`${session.candidateName.replace(/\s+/g, "_")}_report.pdf`);
  };

  return (
    <div className="p-8">
      <Link to="/admin/candidates" className="inline-flex items-center gap-2 text-xs text-[#8F8F9D] hover:text-white mb-4">
        <ArrowLeft size={14} /> Back
      </Link>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">{session.candidateName}</h1>
          <p className="text-[#8F8F9D]">{session.candidateEmail}</p>
        </div>
        <button
          onClick={exportPdf}
          data-testid="export-pdf-btn"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#534AB7] text-white text-sm hover:bg-[#423A93]"
        >
          <Download size={14} /> Export PDF
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        <div className="admin-surface rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-[#8F8F9D]">Overall Score</div>
          <div className="font-mono-stat text-4xl font-bold mt-2">{Math.round(session.overallScore || 0)}<span className="text-lg text-[#8F8F9D]">/100</span></div>
        </div>
        <div className="admin-surface rounded-xl p-5 lg:col-span-2">
          <div className="text-xs uppercase tracking-widest text-[#8F8F9D]">AI Feedback</div>
          <div className="mt-2 leading-relaxed">{session.aiFeedback || "—"}</div>
        </div>
      </div>

      <div className="admin-surface rounded-xl p-6 mb-8">
        <h2 className="font-display font-semibold text-lg mb-4">Section breakdown</h2>
        <div className="space-y-3">
          {sortedSections.map(([k, v]) => {
            const meta = sectionMeta[k] || {};
            return (
              <div key={k} className="flex items-center gap-4">
                <div className="w-44 shrink-0">
                  <div className="text-xs text-[#8F8F9D] font-mono-stat">S{meta.num || "?"}</div>
                  <div className="font-medium">{meta.name || k}</div>
                </div>
                <div className="flex-1 h-2 rounded-full bg-[#2D2D3B] overflow-hidden">
                  <div className="h-full bg-[#534AB7]" style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
                </div>
                <div className="w-14 text-right font-mono-stat">{Math.round(v)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-surface rounded-xl p-6">
        <h2 className="font-display font-semibold text-lg mb-4">Responses</h2>
        <div className="space-y-3">
          {responses.map((r) => {
            const meta = sectionMeta[r.sectionType] || {};
            return (
              <div key={r.id} className="border border-[#2D2D3B] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-widest text-[#534AB7]">S{meta.num} · {meta.name}</div>
                  <div className="font-mono-stat text-sm text-[#34C759]">{r.aiScore != null ? `${r.aiScore}/20` : "—"}</div>
                </div>
                <div className="text-xs text-[#8F8F9D] mb-2 italic">
                  {r.question?.prompt || r.question?.sentence || r.question?.passage || r.question?.topic || r.question?.audioText || ""}
                </div>
                <div className="text-sm text-[#F8F8F8] whitespace-pre-wrap">
                  {r.transcript || r.typedText || (r.selectedOption && `Selected: ${r.selectedOption}`) || "—"}
                </div>
                {r.aiComment && (
                  <div className="mt-2 text-xs text-[#8F8F9D] border-t border-[#2D2D3B] pt-2">
                    <span className="text-[#534AB7] font-mono-stat">AI:</span> {r.aiComment}
                  </div>
                )}
              </div>
            );
          })}
          {conversations.map((c) => (
            <div key={c.id} className="border border-[#2D2D3B] rounded-lg p-4">
              <div className="text-xs uppercase tracking-widest text-[#534AB7] mb-2">Conversation · {c.sectionType}</div>
              <div className="space-y-1 text-sm">
                {(c.conversationHistory || []).map((m, i) => (
                  <div key={i} className={m.role === "ai" ? "text-[#8F8F9D]" : "text-[#F8F8F8]"}>
                    <span className="font-mono-stat text-xs mr-2 text-[#534AB7]">{m.role.toUpperCase()}:</span>
                    {m.message}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
