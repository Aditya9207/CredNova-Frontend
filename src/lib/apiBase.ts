/** Same backend as BharatScore FastAPI (`app.py` + `/credit` router). */
const getApiBase = () => {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim();
  if (envUrl) {
    if (envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
      const currentHost = window.location.hostname;
      if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
        return envUrl.replace(/localhost|127\.0\.0\.1/, currentHost);
      }
    }
    return envUrl;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
      return "http://127.0.0.1:8000";
    }
  }
  return "https://crednova-backend.onrender.com";
};

export const API_BASE = getApiBase();
