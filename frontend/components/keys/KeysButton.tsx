// frontend/components/keys/KeysButton.tsx
//
// Opens the BYOK settings dialog (PH17). One of two entry points (the other is
// the "+" in the Single model switcher). Shown to every account type.

"use client";

import { IconSparkle } from "@/components/icons/Icons";
import { useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";

export default function KeysButton() {
  const { open } = useKeys();
  const { t } = useI18n();

  return (
    <button type="button" className="keys-trigger" onClick={open}>
      <IconSparkle size={15} />
      {t("keys.trigger")}
    </button>
  );
}
