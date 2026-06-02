// frontend/components/keys/BaseUrlSelect.tsx
//
// Curated base-URL picker for BYOK (PH29, plan 027). The user no longer types an
// endpoint blind: a native <select> offers the verified catalogue
// (utils/byokEndpoints.BYOK_BASE_URLS) grouped into "built-in" / "compatible",
// plus an optional "use the provider default" option (default judge + responder
// slots → empty baseUrl, resolved server-side) and a "Custom…" option that
// reveals the free-text field (the previous behaviour, kept as the fallback).
//
// A native select gives keyboard + screen-reader support for free; the visible
// <label> is associated via htmlFor/id. Value is the base URL string ("" = use
// the built-in endpoint).

"use client";

import { useId, useState, type ReactNode } from "react";

import { BYOK_BASE_URLS, isKnownUrl } from "@/utils/byokEndpoints";
import { useI18n } from "@/store/LanguageContext";

const DEFAULT_OPTION = "__default__";
const CUSTOM_OPTION = "__custom__";

interface BaseUrlSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Visible field label (e.g. t("keys.baseUrlSelect")).
  label: string;
  // When set, renders a leading "use the provider default" option that maps to
  // an empty base URL (default judge / responder slots). Omit for custom slots,
  // which must point at a concrete endpoint.
  defaultOptionLabel?: string;
  // Optional info affordance (an <InfoTip>) rendered beside the label.
  info?: ReactNode;
}

export default function BaseUrlSelect({
  id,
  value,
  onChange,
  label,
  defaultOptionLabel,
  info,
}: BaseUrlSelectProps) {
  const { t } = useI18n();
  const customInputId = useId();

  // Sticky "custom mode" so picking "Custom…" keeps the text field open even
  // while it's still empty (which would otherwise read as the default option).
  const [customMode, setCustomMode] = useState(false);

  const known = isKnownUrl(value);
  const showCustom =
    customMode || (value !== "" && !known) || (value === "" && !defaultOptionLabel);

  const selectValue = showCustom ? CUSTOM_OPTION : value === "" ? DEFAULT_OPTION : value;

  const builtin = BYOK_BASE_URLS.filter((e) => e.group === "builtin");
  const compatible = BYOK_BASE_URLS.filter((e) => e.group === "compatible");

  const onSelect = (next: string) => {
    if (next === CUSTOM_OPTION) {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    onChange(next === DEFAULT_OPTION ? "" : next);
  };

  return (
    <div className="keys-baseurl">
      <span className="keys-field-label">
        <label htmlFor={id}>{label}</label>
        {info}
      </span>
      <select
        id={id}
        className="keys-select"
        value={selectValue}
        onChange={(e) => onSelect(e.target.value)}
      >
        {defaultOptionLabel && <option value={DEFAULT_OPTION}>{defaultOptionLabel}</option>}
        <optgroup label={t("keys.baseUrlBuiltin")}>
          {builtin.map((e) => (
            <option key={e.url} value={e.url}>
              {e.label}
            </option>
          ))}
        </optgroup>
        <optgroup label={t("keys.baseUrlCompatible")}>
          {compatible.map((e) => (
            <option key={e.url} value={e.url}>
              {e.label}
            </option>
          ))}
        </optgroup>
        <option value={CUSTOM_OPTION}>{t("keys.customEndpoint")}</option>
      </select>
      {showCustom && (
        <input
          id={customInputId}
          className="keys-input keys-input--url"
          value={value}
          placeholder={t("keys.baseUrl")}
          autoComplete="off"
          spellCheck={false}
          aria-label={t("keys.baseUrl")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
