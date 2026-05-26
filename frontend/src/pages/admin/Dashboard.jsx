import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Users, CalendarCheck, TrendingUp, ClipboardCheck } from "lucide-react";
import api from "@/lib/apiClient";

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then((r) => setData(r.data)); }, []);
  if (!data) return <div className="p-10 text-[#8F8F9D]">Loading…</div>;

  const stats = [
    { label: "Total Candidates", value: data.totalCandidates, Icon: Users, testId: "stat-total" },
    { label: "Tests Today", value: data.testsToday, Icon: CalendarCheck, testId: "stat-today" },
    { label: "Avg Score", value: data.avgScore, Icon: TrendingUp, testId: "stat-avg" },
    { label: "Pending HR", value: data.pendingHrReviews, Icon: ClipboardCheck, testId: "stat-hr" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl tracking-tight">Dashboard</h1>
        <p className="text-[#8F8F9D] text-sm mt-1">Overview of candidate performance and pending reviews.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map(({ label, value, Icon, testId }) => (
          <div key={label} data-testid={testId} className="admin-surface rounded-xl p-5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-[#8F8F9D]">{label}</span>
              <Icon size={16} className="text-[#534AB7]" />
            </div>
            <div className="font-mono-stat text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="admin-surface rounded-xl p-6 mb-8">
        <h2 className="font-display font-semibold text-lg mb-4">Average score per section</h2>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={data.avgBySection} margin={{ top: 10, right: 10, left: -20, bottom: 50 }}>
              <CartesianGrid stroke="#2D2D3B" vertical={false} />
              <XAxis dataKey="sectionName" stroke="#8F8F9D" fontSize={11} interval={0} angle={-30} textAnchor="end" />
              <YAxis stroke="#8F8F9D" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#16161E", border: "1px solid #2D2D3B", borderRadius: 8, color: "#F8F8F8" }}
                cursor={{ fill: "rgba(83,74,183,0.1)" }}
              />
              <Bar dataKey="avgScore" fill="#534AB7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="admin-surface rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">Recent candidates</h2>
          <Link to="/admin/candidates" className="text-xs text-[#534AB7] hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-[#8F8F9D]">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.recentCandidates.map((c) => (
                <tr key={c.id} className="border-t border-[#2D2D3B]" data-testid={`recent-row-${c.id}`}>
                  <td className="py-3 pr-4 font-medium">{c.candidateName}</td>
                  <td className="py-3 pr-4 text-[#8F8F9D]">{c.candidateEmail}</td>
                  <td className="py-3 pr-4 text-[#8F8F9D] font-mono-stat text-xs">
                    {c.startedAt ? new Date(c.startedAt).toLocaleString() : "-"}
                  </td>
                  <td className="py-3 pr-4 font-mono-stat">{c.overallScore != null ? Math.round(c.overallScore) : "-"}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === "completed" ? "bg-[#34C759]/15 text-[#34C759]" : "bg-[#FF9500]/15 text-[#FF9500]"
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <Link to={`/admin/candidates/${c.id}`} className="text-[#534AB7] text-xs hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
