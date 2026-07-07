import { SignIn, useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { credNovaClerkAppearance } from "@/lib/credNovaClerkAppearance";
import { CredNovaMark } from "./CredNovaMark";

const SignInPage = () => {
  const { isSignedIn, userId } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<'user' | 'admin'>(() => {
    return (sessionStorage.getItem("loginRole") as 'user' | 'admin') || 'user';
  });

  const handleRoleChange = (newRole: 'user' | 'admin') => {
    setRole(newRole);
    sessionStorage.setItem("loginRole", newRole);
  };

  useEffect(() => {
    if (isSignedIn && userId) {
      navigate(`/redirector`);
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

        {/* User / Admin Toggle */}
        <div className="mb-6 flex justify-center">
          <div className="flex w-full max-w-[240px] rounded-full bg-slate-100 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => handleRoleChange('user')}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors duration-200 ${
                role === 'user' ? 'text-slate-900 shadow-sm bg-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              User
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('admin')}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors duration-200 ${
                role === 'admin' ? 'text-slate-900 shadow-sm bg-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Admin
            </button>
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