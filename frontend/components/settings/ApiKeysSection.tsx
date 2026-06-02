// frontend/components/settings/ApiKeysSection.tsx
//
// Settings → API Keys (PH24, E3). Renders the existing BYOK form (KeysForm) —
// the entry point moved here from the sidebar; logic is reused, not duplicated.
// Truthful BYOK names (PH23/A) and key clearing on logout (PH23/B) are preserved
// because they live in KeysContext / KeysForm.

"use client";

import KeysForm from "@/components/keys/KeysForm";
import { useI18n } from "@/store/LanguageContext";

export default function ApiKeysSection() {
  const { t } = useI18n();

  return (
    <div className="settings-section-body">
      <h3 className="settings-h">{t("keys.title")}</h3>
      <KeysForm />
    </div>
  );
}
