// frontend/components/chat/ModelSwitcher.tsx
//
// Single-mode responder picker (PH13/B1): choose which model streams the answer
// (groq / cerebras / sambanova). Selection is held in ComposerContext.

"use client";

import { SINGLE_PROVIDERS, useComposer } from "@/store/ComposerContext";
import { useI18n } from "@/store/LanguageContext";

export default function ModelSwitcher() {
  const { t } = useI18n();
  const { singleProvider, setSingleProvider } = useComposer();

  return (
    <div className="model-switch" role="group" aria-label={t("single.model")}>
      <span className="model-switch-cap">{t("single.model")}</span>
      {SINGLE_PROVIDERS.map((provider) => {
        const active = provider === singleProvider;
        return (
          <button
            key={provider}
            type="button"
            className={active ? "model-chip model-chip--active" : "model-chip"}
            aria-pressed={active}
            onClick={() => setSingleProvider(provider)}
          >
            {provider}
          </button>
        );
      })}
    </div>
  );
}
