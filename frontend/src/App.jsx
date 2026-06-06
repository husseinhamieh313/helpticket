
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage          from "./pages/LoginPage";
import RegisterPage       from "./pages/RegisterPage";
import DashboardPage      from "./pages/DashboardPage";
import TicketListPage     from "./pages/TicketListPage";
import CreateTicketPage   from "./pages/CreateTicketPage";
import TicketDetailPage   from "./pages/TicketDetailPage";
import ManagerDashboard   from "./pages/ManagerDashboard";

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"          element={<Navigate to="/login" replace />} />
          <Route path="/login"     element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register"  element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/tickets"   element={<PrivateRoute><TicketListPage /></PrivateRoute>} />
          <Route path="/tickets/new" element={
            <PrivateRoute roles={["Employee","IT Support Agent","Admin"]}>
              <CreateTicketPage />
            </PrivateRoute>
          } />
          <Route path="/tickets/:id" element={<PrivateRoute><TicketDetailPage /></PrivateRoute>} />
          <Route path="/manager"   element={
            <PrivateRoute roles={["Manager","Admin"]}>
              <ManagerDashboard />
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}