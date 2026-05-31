// frontend/components/sidebar/SidebarToggle.tsx
//
// Sidebar header controls (PH23/C2–C3):
//   - desktop: a collapse/expand button that toggles the rail (hidden on phones).
//   - mobile: a close button for the off-canvas drawer (hidden on desktop).
// Both are icon buttons with localized aria-labels; CSS decides which is visible
// at the current breakpoint.

"use client";

import { IconChevron, IconClose } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { useSidebar } from "@/store/SidebarContext";

export default function SidebarToggle() {
  const { t } = useI18n();
  const { collapsed, toggleCollapsed, closeMobile } = useSidebar();

  return (
    <div className="sidebar-head">
      <button
        type="button"
        className="sidebar-collapse-btn"
        onClick={toggleCollapsed}
        aria-pressed={collapsed}
        aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
      >
        {/* Chevron rotates via CSS to point the way the panel will move. */}
        <IconChevron size={18} className="sidebar-collapse-ic" />
      </button>
      <button
        type="button"
        className="sidebar-close-btn"
        onClick={closeMobile}
        aria-label={t("sidebar.closeMenu")}
        title={t("sidebar.closeMenu")}
      >
        <IconClose size={18} />
      </button>
    </div>
  );
}
