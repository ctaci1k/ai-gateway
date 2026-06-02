// frontend/components/keys/BaseUrlSelect.tsx
//
// Base-URL picker for custom BYOK slots (PH29; simplified in PH29.1). A plain
// native <select> over the curated catalogue (utils/byokEndpoints.BYOK_BASE_URLS)
// — no groups, no "use the default endpoint" option and no free-text "Custom…":
// the user picks one verified OpenAI-compatible endpoint, period. Built-in slots
// (judge + AI 1/2/3) have no base-URL field at all, so this is rendered only for
// custom AI 4/5 rows.
//
// A native select gives keyboard + screen-reader support for free; the visible
// <label> is associated via htmlFor/id. The empty value renders a disabled
// placeholder so an endpoint must be chosen. A non-empty value that isn't in the
// catalogue (e.g. legacy storage) is shown as an extra option so it stays visible.

"use client";

import { type ReactNode } from "react";

import { BYOK_BASE_URLS, isKnownUrl } from "@/utils/byokEndpoints";
import { useI18n } from "@/store/LanguageContext";

interface BaseUrlSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Visible field label (e.g. t("keys.baseUrlSelect")).
  label: string;
  // Optional info affordance (an <InfoTip>) rendered beside the label.
  info?: ReactNode;
}

export default function BaseUrlSelect({ id, value, onChange, label, info }: BaseUrlSelectProps) {
  const { t } = useI18n();
  const legacy = value !== "" && !isKnownUrl(value);

  return (
    <div className="keys-baseurl">
      <span className="keys-field-label">
        <label htmlFor={id}>{label}</label>
        {info}
      </span>
      <select
        id={id}
        className="keys-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled hidden>
          {t("keys.baseUrlChoose")}
        </option>
        {BYOK_BASE_URLS.map((e) => (
          <option key={e.url} value={e.url}>
            {e.label}
          </option>
        ))}
        {legacy && <option value={value}>{value}</option>}
      </select>
    </div>
  );
}
