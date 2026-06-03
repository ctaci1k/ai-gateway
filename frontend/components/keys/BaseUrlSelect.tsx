// frontend/components/keys/BaseUrlSelect.tsx
//
// Base-URL picker for a BYOK slot (PH29; reworked PH29.1; PH30 fix). A plain
// native <select> over the endpoints offered for this slot — no free text.
//
// The empty value ("") is the slot's DEFAULT endpoint, rendered as a named
// placeholder so a regular user can tell what they're getting:
//  - built-in slots (judge + AI 1/2/3): "" = the slot's own built-in provider
//    (e.g. "Groq · default endpoint"); the OTHER built-ins + all compatibles are
//    listed as override options;
//  - custom slots (AI 4/5): "" = "choose an endpoint" (required), every provider
//    is listed.
// The caller passes the option list (`options`) and the placeholder text. A
// non-empty value not in the list (legacy / explicit own-provider) is shown as an
// extra option so it stays visible.

"use client";

import { type ReactNode } from "react";

import { presetForUrl, type ByokEndpoint } from "@/utils/byokEndpoints";

interface BaseUrlSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Visible field label (e.g. t("keys.baseUrlSelect")).
  label: string;
  // Endpoints offered for this slot (selectableEndpointsForSlot).
  options: readonly ByokEndpoint[];
  // Text for the empty-value default option (e.g. "Groq · default endpoint" for a
  // built-in slot, "Choose an endpoint…" for a custom slot).
  placeholder: string;
  // Optional info affordance (an <InfoTip>) rendered beside the label.
  info?: ReactNode;
}

export default function BaseUrlSelect({
  id,
  value,
  onChange,
  label,
  options,
  placeholder,
  info,
}: BaseUrlSelectProps) {
  // A non-empty value not already in the option list (a known provider excluded
  // from this slot, or a legacy stored URL) gets an extra option so it shows.
  const inList = value === "" || options.some((e) => e.url === value);
  const extraLabel = presetForUrl(value)?.label ?? value;

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
        <option value="">{placeholder}</option>
        {options.map((e) => (
          <option key={e.url} value={e.url}>
            {e.label}
          </option>
        ))}
        {!inList && <option value={value}>{extraLabel}</option>}
      </select>
    </div>
  );
}
