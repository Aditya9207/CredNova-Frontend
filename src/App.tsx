import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignedIn, SignedOut, RedirectToSignIn, useUser } from "@clerk/clerk-react";

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

/**
 * ProtectedRoute — renders children only when signed in.
 * Redirects to /sign-in (via Clerk's RedirectToSignIn) when not authenticated.
 * Replaces the bare <SignedIn> wrapper which silently renders nothing when logged out.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl={window.location.pathname} />
      </SignedOut>
    </>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

  return (
    <>
      <SignedIn>
        {isAdmin ? children : <Navigate to="/credit-ai" replace />}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl={window.location.pathname} />
      </SignedOut>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster richColors position="top-center" />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/bank-employee"
          element={
            <AdminRoute>
              <BankEmployeePage />
            </AdminRoute>
          }
        />
        <Route path="/marketing" element={<Navigate to="/" replace />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/redirector" element={<Redirector />} />

        {/* FE-3: /profile is a backward-compat alias for /credit-ai (the apply page).
            ProfileForm.tsx is a stub kept for potential future profile management UI. */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <CreditAIApplyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/credit-ai"
          element={
            <ProtectedRoute>
              <CreditAIApplyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/credit-ai/dashboard"
          element={
            <ProtectedRoute>
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
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </QueryClientProvider>
  );
}

