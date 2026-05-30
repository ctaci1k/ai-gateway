// frontend/components/chat/PromptInput.tsx

"use client";

import type { ReactNode } from "react";

import { IconSend } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

interface PromptInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  loading?: boolean;
  placeholderKey?: string;
  // Optional composer-side controls (RAG toggle, docs manager) rendered to the
  // left of the send button. Kept as a slot so PromptInput stays presentational.
  tools?: ReactNode;
}

export default function PromptInput({
  value = "",
  onChange = () => {},
  onSubmit = () => {},
  loading = false,
  placeholderKey = "chat.placeholder",
  tools = null,
}: PromptInputProps) {
  const { t } = useI18n();
  const placeholder = t(placeholderKey);

  return (
    <div className="composer">
      {tools}
      <input
        className="composer-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) {
            onSubmit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button
        className="composer-send"
        onClick={onSubmit}
        disabled={loading}
        aria-label={t("chat.send")}
      >
        <IconSend size={19} />
      </button>
    </div>
  );
}
