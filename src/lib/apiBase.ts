/** Same backend as BharatScore FastAPI (`app.py` + `/credit` router). */
const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL || "";
  if (envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
    const currentHost = window.location.hostname;
    if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
      return envUrl.replace(/localhost|127\.0\.0\.1/, currentHost);
    }
  }
  return envUrl || "https://crednova-backend.onrender.com";
};

export const API_BASE = getApiBase();
