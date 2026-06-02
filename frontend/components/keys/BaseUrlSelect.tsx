// frontend/components/keys/BaseUrlSelect.tsx
//
// Base-URL picker for BYOK slots (PH29; reworked in PH29.1). A plain native
// <select> over the curated catalogue (utils/byokEndpoints.BYOK_BASE_URLS) — no
// groups, no built-in providers and no free-text "Custom…": the user picks one
// verified OpenAI-compatible endpoint, period.
//
// The empty value ("") renders a disabled+hidden placeholder, so it shows as the
// resting state but can't be re-picked from the list:
//  - built-in slots (judge + AI 1/2/3): "" means the built-in endpoint and the
//    way back to it is the "Clear" button (the catalogue lists only override
//    targets, never the built-in providers);
//  - custom slots (AI 4/5): "" means "choose an endpoint" (required).
// The caller controls the placeholder text. A non-empty value not in the
// catalogue (e.g. legacy storage) is shown as an extra option so it stays visible.

"use client";

import { type ReactNode } from "react";

import { BYOK_BASE_URLS, isKnownUrl } from "@/utils/byokEndpoints";

interface BaseUrlSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Visible field label (e.g. t("keys.baseUrlSelect")).
  label: string;
  // Text for the empty-value placeholder option (e.g. "Default endpoint" for
  // built-in slots, "Choose an endpoint…" for custom slots).
  placeholder: string;
  // Optional info affordance (an <InfoTip>) rendered beside the label.
  info?: ReactNode;
}

export default function BaseUrlSelect({
  id,
  value,
  onChange,
  label,
  placeholder,
  info,
}: BaseUrlSelectProps) {
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
          {placeholder}
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
