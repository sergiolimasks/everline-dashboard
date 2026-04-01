import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Panel from "./pages/Panel";
import Index from "./pages/Index";
import SistemaLeads from "./pages/SistemaLeads";
import Distribuicao from "./pages/Distribuicao";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/painel" element={<ProtectedRoute adminOnly><Panel /></ProtectedRoute>} />
            <Route path="/cliente/:slug/painel" element={<ProtectedRoute><Panel clientView /></ProtectedRoute>} />
            <Route path="/interno/uelicon/checkup-performance" element={<ProtectedRoute adminOnly><Index /></ProtectedRoute>} />
            <Route path="/interno/uelicon/formacao-consultor" element={<ProtectedRoute adminOnly><Index projectKey="formacao-consultor" /></ProtectedRoute>} />
            <Route path="/cliente/:slug/checkup-performance" element={<ProtectedRoute><Index clientView /></ProtectedRoute>} />
            <Route path="/cliente/:slug/formacao-consultor" element={<ProtectedRoute><Index clientView projectKey="formacao-consultor" /></ProtectedRoute>} />
            <Route path="/interno/uelicon/sistema-leads" element={<ProtectedRoute adminOnly><SistemaLeads /></ProtectedRoute>} />
            <Route path="/cliente/:slug/sistema-leads" element={<ProtectedRoute><SistemaLeads clientView /></ProtectedRoute>} />
            <Route path="/interno/uelicon/distribuicao" element={<ProtectedRoute adminOnly><Distribuicao /></ProtectedRoute>} />
            <Route path="/cliente/:slug/distribuicao" element={<ProtectedRoute><Distribuicao clientView /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
