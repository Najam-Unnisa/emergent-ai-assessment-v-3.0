import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ListChecks, Users, ClipboardCheck, Settings as SettingsIcon, LogOut } from "lucide-react";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/admin/questions", label: "Questions", Icon: ListChecks, testId: "nav-questions" },
  { to: "/admin/candidates", label: "Candidates", Icon: Users, testId: "nav-candidates" },
  { to: "/admin/hr-review", label: "HR Review", Icon: ClipboardCheck, testId: "nav-hr-review" },
  { to: "/admin/settings", label: "Settings", Icon: SettingsIcon, testId: "nav-settings" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const adminName = localStorage.getItem("hf_admin_name") || "Admin";
  const logout = () => {
    localStorage.removeItem("hf_admin_token");
    localStorage.removeItem("hf_admin_name");
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--hf-admin-bg)", color: "var(--hf-admin-text)" }}>
      <aside className="w-60 shrink-0 border-r border-[#2D2D3B] bg-[#0D0D12] sticky top-0 h-screen flex flex-col">
        <Link to="/admin/dashboard" className="flex items-center gap-2 px-5 py-5 border-b border-[#2D2D3B]">
          <div className="w-8 h-8 rounded-md bg-[#534AB7] flex items-center justify-center text-white font-display font-bold">H</div>
          <div>
            <div className="font-display font-bold tracking-tight">HireFast</div>
            <div className="text-[10px] uppercase tracking-widest text-[#8F8F9D]">Admin</div>
          </div>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, Icon, testId }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-[#534AB7] text-white"
                    : "text-[#8F8F9D] hover:bg-[#16161E] hover:text-white"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[#2D2D3B]">
          <div className="px-2 py-2 text-xs text-[#8F8F9D] truncate">{adminName}</div>
          <button
            onClick={logout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#8F8F9D] hover:bg-[#16161E] hover:text-red-400"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
