import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Welcome from "@/pages/candidate/Welcome";
import TestRunner from "@/pages/candidate/TestRunner";
import Complete from "@/pages/candidate/Complete";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Questions from "@/pages/admin/Questions";
import Candidates from "@/pages/admin/Candidates";
import CandidateDetail from "@/pages/admin/CandidateDetail";
import HrReview from "@/pages/admin/HrReview";
import Settings from "@/pages/admin/Settings";

function AdminRoute({ children }) {
  const token = localStorage.getItem("hf_admin_token");
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/test/:sessionId" element={<TestRunner />} />
          <Route path="/complete/:sessionId" element={<Complete />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="questions" element={<Questions />} />
            <Route path="candidates" element={<Candidates />} />
            <Route path="candidates/:sessionId" element={<CandidateDetail />} />
            <Route path="hr-review" element={<HrReview />} />
            <Route path="hr-review/:sessionId" element={<HrReview />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </>
  );
}

export default App;
