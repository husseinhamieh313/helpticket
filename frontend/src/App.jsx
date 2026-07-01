import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import LoginPage          from "./pages/LoginPage";
import RegisterPage       from "./pages/RegisterPage";
import DashboardPage      from "./pages/DashboardPage";
import TicketListPage     from "./pages/TicketListPage";
import CreateTicketPage   from "./pages/CreateTicketPage";
import TicketDetailPage   from "./pages/TicketDetailPage";
import ManagerDashboard   from "./pages/ManagerDashboard";
import TicketHistoryPage  from "./pages/TicketHistoryPage";
import ActivityLogsPage   from "./pages/ActivityLogsPage";
import KnowledgeBasePage  from "./pages/KnowledgeBasePage";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import AIChatWidget       from "./components/AIChatWidget";

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0f0f1a", display:"flex",
      alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#3b82f6", fontSize:14, fontFamily:"sans-serif" }}>Loading...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function GlobalWidgets() {
  const { user } = useAuth();
  if (!user) return null;
  return <AIChatWidget />;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"          element={<Navigate to="/login" replace />} />
            <Route path="/login"     element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register"  element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/tickets"   element={<PrivateRoute><TicketListPage /></PrivateRoute>} />
            <Route path="/tickets/new" element={
              <PrivateRoute roles={["Employee","Admin"]}>
                <CreateTicketPage />
              </PrivateRoute>
            } />
            <Route path="/tickets/:id" element={<PrivateRoute><TicketDetailPage /></PrivateRoute>} />
            <Route path="/manager"   element={
              <PrivateRoute roles={["Manager","Admin"]}>
                <ManagerDashboard />
              </PrivateRoute>
            } />
            <Route path="/history"   element={
              <PrivateRoute roles={["Admin","Manager"]}>
                <TicketHistoryPage />
              </PrivateRoute>
            } />
            <Route path="/activity"  element={
              <PrivateRoute roles={["IT Support Agent","Admin","Manager"]}>
                <ActivityLogsPage />
              </PrivateRoute>
            } />
            <Route path="/kb" element={<PrivateRoute><KnowledgeBasePage /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><AnalyticsDashboard /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <GlobalWidgets />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}