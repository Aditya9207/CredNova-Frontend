import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AreaChart, Lightbulb, LayoutDashboard, FileText, Home } from "lucide-react";

export type DashboardSection = "analysis" | "insights" | "portfolio";

interface MobileBottomNavProps {
  activeSection?: DashboardSection;
  onSelectSection?: (section: DashboardSection) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeSection,
  onSelectSection,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isDashboard = location.pathname.startsWith("/credit-ai/dashboard");
  const isApply = location.pathname === "/credit-ai" || location.pathname === "/profile";
  const isHome = location.pathname === "/";

  // Read URL param fallback for dashboard section
  const searchParams = new URLSearchParams(location.search);
  const urlSection = searchParams.get("section") as DashboardSection | null;
  const currentSection = isDashboard
    ? activeSection || urlSection || "analysis"
    : null;

  const handleSectionClick = (section: DashboardSection) => {
    if (isDashboard) {
      if (onSelectSection) {
        onSelectSection(section);
      }
      navigate(`/credit-ai/dashboard?section=${section}`, { replace: true });
    } else {
      navigate(`/credit-ai/dashboard?section=${section}`);
    }
  };

  const navItems = [
    {
      id: "analysis",
      label: "Analysis",
      icon: AreaChart,
      isActive: isDashboard && currentSection === "analysis",
      onClick: () => handleSectionClick("analysis"),
    },
    {
      id: "insights",
      label: "Insights",
      icon: Lightbulb,
      isActive: isDashboard && currentSection === "insights",
      onClick: () => handleSectionClick("insights"),
    },
    {
      id: "portfolio",
      label: "My Portfolio",
      icon: LayoutDashboard,
      isActive: isDashboard && currentSection === "portfolio",
      onClick: () => handleSectionClick("portfolio"),
    },
    {
      id: "apply",
      label: "New Application",
      icon: FileText,
      isActive: isApply,
      onClick: () => navigate("/credit-ai"),
    },
    {
      id: "home",
      label: "Home",
      icon: Home,
      isActive: isHome,
      onClick: () => navigate("/"),
    },
  ];

  return (
    <nav className="wirely-bottom-nav" aria-label="Mobile Bottom Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`wirely-bottom-nav__item ${item.isActive ? "wirely-bottom-nav__item--active" : ""}`}
            onClick={item.onClick}
            aria-label={item.label}
          >
            <div className="wirely-bottom-nav__icon-wrapper">
              <Icon size={20} className="wirely-bottom-nav__icon" />
            </div>
            <span className="wirely-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
