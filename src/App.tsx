import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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

// Wrap each route in its own ErrorBoundary so an exception in one page doesn't
// blank out the whole app — the user stays logged in, the header still renders
// (once we have one), and only the broken page shows the fallback UI.
const Page = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary>{children}</ErrorBoundary>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Page><Home /></Page>} />
            <Route path="/login" element={<Page><Login /></Page>} />
            <Route path="/painel" element={<Page><ProtectedRoute adminOnly><Panel /></ProtectedRoute></Page>} />
            <Route path="/cliente/:slug/painel" element={<Page><ProtectedRoute><Panel clientView /></ProtectedRoute></Page>} />
            <Route path="/interno/uelicon/checkup-performance" element={<Page><ProtectedRoute adminOnly><Index /></ProtectedRoute></Page>} />
            <Route path="/interno/uelicon/formacao-consultor" element={<Page><ProtectedRoute adminOnly><Index projectKey="formacao-consultor" /></ProtectedRoute></Page>} />
            <Route path="/cliente/:slug/checkup-performance" element={<Page><ProtectedRoute><Index clientView /></ProtectedRoute></Page>} />
            <Route path="/cliente/:slug/formacao-consultor" element={<Page><ProtectedRoute><Index clientView projectKey="formacao-consultor" /></ProtectedRoute></Page>} />
            <Route path="/interno/uelicon/sistema-leads" element={<Page><ProtectedRoute adminOnly><SistemaLeads /></ProtectedRoute></Page>} />
            <Route path="/cliente/:slug/sistema-leads" element={<Page><ProtectedRoute><SistemaLeads clientView /></ProtectedRoute></Page>} />
            <Route path="/interno/uelicon/distribuicao" element={<Page><ProtectedRoute adminOnly><Distribuicao /></ProtectedRoute></Page>} />
            <Route path="/cliente/:slug/distribuicao" element={<Page><ProtectedRoute><Distribuicao clientView /></ProtectedRoute></Page>} />
            <Route path="*" element={<Page><NotFound /></Page>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
