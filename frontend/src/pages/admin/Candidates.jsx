import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/apiClient";

export default function Candidates() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/candidates").then((r) => setItems(r.data || [])); }, []);
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl tracking-tight">Candidates</h1>
        <p className="text-[#8F8F9D] text-sm mt-1">All test sessions.</p>
      </div>
      <div className="admin-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0D0D12]">
            <tr className="text-left text-xs uppercase tracking-widest text-[#8F8F9D]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">HR Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} data-testid={`cand-row-${c.id}`} className="border-t border-[#2D2D3B]">
                <td className="px-4 py-3 font-medium">{c.candidateName}</td>
                <td className="px-4 py-3 text-[#8F8F9D]">{c.candidateEmail}</td>
                <td className="px-4 py-3 text-[#8F8F9D] font-mono-stat text-xs">
                  {c.startedAt ? new Date(c.startedAt).toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3 font-mono-stat">{c.overallScore != null ? Math.round(c.overallScore) : "-"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    c.hrStatus === "reviewed" ? "bg-[#34C759]/15 text-[#34C759]" : "bg-[#FF9500]/15 text-[#FF9500]"
                  }`}>{c.hrStatus}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admin/candidates/${c.id}`} className="text-[#534AB7] text-xs hover:underline">View</Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-[#8F8F9D]">No candidates yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
