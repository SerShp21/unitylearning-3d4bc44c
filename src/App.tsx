import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import FaceSetup from "@/pages/FaceSetup";
import Dashboard from "@/pages/Dashboard";
import Classes from "@/pages/Classes";
import Timetable from "@/pages/Timetable";
import UserManagement from "@/pages/UserManagement";
import Grades from "@/pages/Grades";
import Attendance from "@/pages/Attendance";
import Lectures from "@/pages/Lectures";
import Robot from "@/pages/Robot";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading, hasFaceId } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (!hasFaceId) return <Navigate to="/setup-face" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const FaceSetupRoute: React.FC = () => {
  const { session, loading, hasFaceId } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (hasFaceId) return <Navigate to="/" replace />;
  return <FaceSetup />;
};

const AuthRoute: React.FC = () => {
  const { session, loading, faceVerificationPending } = useAuth();
  if (loading) return null;
  // Don't redirect while face check is in progress (avoids flash + state loss)
  if (session && !faceVerificationPending) return <Navigate to="/" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/setup-face" element={<FaceSetupRoute />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
            <Route path="/timetable" element={<ProtectedRoute><Timetable /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/grades" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/lectures" element={<ProtectedRoute><Lectures /></ProtectedRoute>} />
            <Route path="/robot" element={<ProtectedRoute><Robot /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
