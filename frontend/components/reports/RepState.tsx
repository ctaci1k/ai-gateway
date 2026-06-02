// frontend/components/reports/RepState.tsx
//
// Shared loading / empty / error placeholders for the Usage Reports tabs
// (PH27, E). Keeps every tab's state handling consistent and localized.

"use client";

import { useI18n } from "@/store/LanguageContext";

export function RepLoading() {
  const { t } = useI18n();
  return (
    <div className="rep-state" role="status" aria-live="polite">
      <span className="rep-spinner" aria-hidden="true" />
      {t("reports.state.loading")}
    </div>
  );
}

export function RepError() {
  const { t } = useI18n();
  return (
    <div className="rep-state rep-state--error" role="alert">
      {t("reports.state.error")}
    </div>
  );
}

export function RepEmpty() {
  const { t } = useI18n();
  return <div className="rep-state">{t("reports.state.empty")}</div>;
}
