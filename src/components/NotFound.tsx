import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { CredNovaMark } from "./CredNovaMark";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="wirely-root wirely-loading-screen !flex-col px-6">
      <div className="wirely-card max-w-md text-center">
        <div className="flex justify-center mb-4">
          <CredNovaMark className="h-14 w-14 object-contain" alt="" />
        </div>
        <h1 className="text-4xl font-light text-[#1a2236] mb-2 tracking-tight">404</h1>
        <p className="text-[15px] text-[#6b7a90] mb-6">This page does not exist.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="/" className="wirely-btn inline-flex no-underline">
            Home
          </a>
          <a
            href="/bank-employee"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-medium text-[#475569] no-underline hover:bg-slate-50"
          >
            Bank portal
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;