// frontend/components/sidebar/Sidebar.tsx

"use client";

import { useEffect, useRef } from "react";

import LimitBanner from "@/components/account/LimitBanner";
import { IconGrid } from "@/components/icons/Icons";
import KeysButton from "@/components/keys/KeysButton";
import KeysModal from "@/components/keys/KeysModal";
import KeysStatusBanner from "@/components/keys/KeysStatusBanner";
import { useAdminView } from "@/store/AdminViewContext";
import { useAuth } from "@/store/AuthContext";
import { useChatMode } from "@/store/ChatModeContext";
import { useChats } from "@/store/ChatsContext";
import { useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";
import { useSidebar } from "@/store/SidebarContext";

import AuthorCard from "./AuthorCard";
import ChatList from "./ChatList";
import ChatModeSelector from "./ChatModeSelector";
import LanguageSwitcher from "./LanguageSwitcher";
import NewChatButton from "./NewChatButton";
import ProfileCard from "./ProfileCard";
import SidebarSquare from "./SidebarSquare";
import SidebarToggle from "./SidebarToggle";
import StatusSquares from "./StatusSquares";

// Focusable elements inside the drawer, for the mobile focus trap.
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Sidebar() {
  const { mode } = useChatMode();
  const { user } = useAuth();
  const { open: openAdmin, isOpen: adminOpen } = useAdminView();
  const { open: openKeys, isOpen: keysOpen } = useKeys();
  const { activeChatId } = useChats();
  const { collapsed, mobileOpen, closeMobile } = useSidebar();
  const { t } = useI18n();
  // Saved chats are Compare-only (B5): Single has no saved-chats section.
  const showSavedChats = mode === "compare";

  const asideRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Mobile drawer a11y (PH23/C3): trap Tab focus while open, Esc closes, and
  // focus returns to the trigger on close. Only runs when the drawer is open
  // (mobileOpen is set exclusively by the mobile burger).
  useEffect(() => {
    if (!mobileOpen) return undefined;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const aside = asideRef.current;
    // Only currently-visible controls (skip the desktop-only collapse button,
    // which is display:none in the mobile drawer) — getClientRects() is empty
    // for display:none, regardless of the fixed-positioned drawer.
    const focusables = () =>
      aside
        ? Array.from(aside.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
    focusables()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [mobileOpen, closeMobile]);

  // Close the drawer after the user navigates (picks a mode / chat / admin) or
  // opens the BYOK modal — ChatGPT-style. Closing on keys-open also avoids two
  // competing focus traps (drawer + modal). Skips the initial mount so opening
  // the drawer doesn't immediately close it.
  const firstNav = useRef(true);
  useEffect(() => {
    if (firstNav.current) {
      firstNav.current = false;
      return;
    }
    closeMobile();
  }, [mode, activeChatId, adminOpen, keysOpen, closeMobile]);

  const className = [
    "sidebar",
    collapsed ? "sidebar--collapsed" : "",
    mobileOpen ? "sidebar--mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside ref={asideRef} className={className} aria-label={t("sidebar.label")}>
      <SidebarToggle />
      <ProfileCard />
      <ChatModeSelector />
      {showSavedChats && (
        <>
          <NewChatButton />
          <ChatList />
        </>
      )}
      <LanguageSwitcher />
      {user?.is_admin && (
        <button className="sidebar-admin" type="button" onClick={openAdmin}>
          <IconGrid size={16} />
          <span className="sb-label">{t("admin.nav")}</span>
        </button>
      )}

      {/* Status: full banners (expanded) + compact squares (collapsed rail) —
          both from the single source useSidebarStatus (D1). */}
      <KeysStatusBanner />
      <LimitBanner />
      <StatusSquares />

      <KeysButton />
      <div className="rail-only">
        <SidebarSquare tone="neutral" label={t("keys.trigger")} onClick={openKeys}>
          {t("keys.shortLabel")}
        </SidebarSquare>
      </div>

      <AuthorCard />
      <div className="rail-only">
        <SidebarSquare tone="neutral" label={t("author.name")}>
          {t("author.initials")}
        </SidebarSquare>
      </div>

      <KeysModal />
    </aside>
  );
}
