import { SignIn, useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { credNovaClerkAppearance } from "@/lib/credNovaClerkAppearance";
import { CredNovaMark } from "./CredNovaMark";

const SignInPage = () => {
  const { isSignedIn, userId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn && userId) {
      navigate("/redirector");
    }
  }, [isSignedIn, userId, navigate]);

  return (
    <div className="wirely-root wirely-auth-layout">
      <div className="w-full max-w-md">
        <div className="wirely-auth-brand">
          <CredNovaMark className="wirely-auth-brand__mark" />
          <div>
            <div className="wirely-auth-brand__title">CredNova</div>
            <div className="wirely-auth-brand__subtitle">Sign in to continue</div>
          </div>
        </div>
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          afterSignInUrl="/redirector"
          appearance={credNovaClerkAppearance}
        />
      </div>
    </div>
  );
};

export default SignInPage;