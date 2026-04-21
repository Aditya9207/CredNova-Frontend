import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignedIn } from "@clerk/clerk-react";

import LandingPage from "./components/LandingPage";
import SignUpPage from "./components/SignUpPage";
import SignInPage from "./components/SignInPage";
import Redirector from "./components/Redirector";
import CreditAIApplyPage from "./components/creditai/CreditAIApplyPage";
import CredNovaMaterialLoader from "./components/creditai/CredNovaMaterialLoader";
import NotFound from "./components/NotFound";
import BankEmployeePage from "./components/bankEmployee/BankEmployeePage";

const CreditAIDashboardPage = lazy(() => import("./components/creditai/CreditAIDashboardPage"));

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster richColors position="top-center" />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/bank-employee" element={<BankEmployeePage />} />
        <Route path="/marketing" element={<Navigate to="/" replace />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/redirector" element={<Redirector />} />

        <Route
          path="/profile"
          element={
            <SignedIn>
              <CreditAIApplyPage />
            </SignedIn>
          }
        />
        <Route
          path="/credit-ai"
          element={
            <SignedIn>
              <CreditAIApplyPage />
            </SignedIn>
          }
        />
        <Route
          path="/credit-ai/dashboard"
          element={
            <SignedIn>
              <Suspense
                fallback={
                  <CredNovaMaterialLoader
                    title="CredNova"
                    messages={[
                      "Loading your portfolio…",
                      "Fetching charts and insights…",
                      "Almost ready…",
                    ]}
                  />
                }
              >
                <CreditAIDashboardPage />
              </Suspense>
            </SignedIn>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </QueryClientProvider>
  );
}
