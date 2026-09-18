import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { applyTheme, getPreferredTheme, persistTheme } from "./lib/theme";
import { DocumentsPage } from "./pages/DocumentsPage";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { InvestigationsPage } from "./pages/InvestigationsPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemStatusPage } from "./pages/SystemStatusPage";
import { TestEvidencePage } from "./pages/TestEvidencePage";

applyTheme(getPreferredTheme());

export default function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 5000,
          },
        },
      }),
    [],
  );
  const [theme, setTheme] = useState(() => getPreferredTheme());

  function handleThemeChange(next) {
    persistTheme(next);
    setTheme(next);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell theme={theme} onThemeChange={handleThemeChange} />}>
            <Route path="/" element={<Navigate to="/investigations" replace />} />
            <Route path="/investigations" element={<InvestigationsPage />} />
            <Route path="/investigations/:investigationId" element={<InvestigationsPage />} />
            <Route path="/knowledge" element={<KnowledgeBasePage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
            <Route path="/evidence" element={<TestEvidencePage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
            <Route path="/status" element={<SystemStatusPage />} />
            <Route
              path="/settings"
              element={<SettingsPage theme={theme} onThemeChange={handleThemeChange} />}
            />
            <Route path="*" element={<Navigate to="/investigations" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
