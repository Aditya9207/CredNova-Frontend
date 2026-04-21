import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/lib/apiBase";
export default function Redirector() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirection = async () => {
      // If not signed in, redirect to sign-in
      if (!isSignedIn || !user) {
        navigate("/sign-in");
        return;
      }

      try {
        console.log("Checking user profile for:", user.id);

        const response = await fetch(`${API_BASE}/profile?clerk_user_id=${user.id}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Backend response:", data);

        // Backend returns { has_profile, profile } — not a `users` array
        const hasProfile = Boolean(data?.has_profile);
        
        if (hasProfile) {
          console.log("User has profile, redirecting to credit-ai apply flow");
          navigate("/credit-ai", { replace: true });
        } else {
          console.log("User has no profile, redirecting to profile form");
          navigate("/profile");
        }
      } catch (error) {
        console.error("Error checking user profile:", error);
        setError("Failed to check user profile");
        navigate("/profile");
      } finally {
        setLoading(false);
      }
    };

    handleRedirection();
  }, [isSignedIn, user, navigate]);

  if (loading) {
    return (
      <div className="wirely-root wirely-loading-screen !flex-col gap-6">
        <div className="wirely-spinner" />
        <p className="text-[15px] font-medium text-[#6b7a90]">Setting up your account…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wirely-root wirely-loading-screen !flex-col gap-6 px-6">
        <div className="wirely-card max-w-md text-center">
          <p className="text-[15px] font-medium text-red-600 mb-4">{error}</p>
          <button type="button" onClick={() => navigate("/profile")} className="wirely-btn">
            Continue to profile
          </button>
        </div>
      </div>
    );
  }

  return null;
}