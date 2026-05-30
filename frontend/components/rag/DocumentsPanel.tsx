// frontend/components/rag/DocumentsPanel.tsx

"use client";

import { useRef, useState } from "react";

import { IconClose, IconDoc, IconUpload } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { useRagDocuments } from "@/store/RagContext";

// Only plain-text documents are supported (mirrors backend parser). Checked
// client-side so picking an image gives an instant, localized message instead
// of a round-trip + backend error (PH13).
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md"];

export default function DocumentsPanel() {
  const { t } = useI18n();
  const { documents, loading, uploading, error, upload, remove } = useRagDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  // Client-side validation message, as an i18n key (same channel as `error`).
  const [pickErrorKey, setPickErrorKey] = useState<string | null>(null);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same filename
    if (!file) return;

    const name = file.name.toLowerCase();
    const supported = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!supported) {
      setPickErrorKey("rag.err.unsupportedType");
      return;
    }
    setPickErrorKey(null);
    void upload(file);
  }

  const errorKey = pickErrorKey ?? error;

  return (
    <div className="docs-panel">
      <div className="docs-head">
        <div className="docs-title">
          <IconDoc size={16} />
          <span>{t("rag.documents")}</span>
        </div>
        <button
          type="button"
          className="docs-upload"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <IconUpload size={15} />
          <span>{uploading ? t("rag.uploading") : t("rag.upload")}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="docs-file"
          onChange={onPick}
          aria-label={t("rag.upload")}
        />
      </div>

      <p className="docs-hint">{t("rag.acceptHint")}</p>
      <p className="docs-warn">{t("rag.persistWarn")}</p>

      {errorKey && (
        <div className="docs-error" role="alert">
          {t(errorKey)}
        </div>
      )}

      {loading && documents.length === 0 ? (
        <div className="docs-empty">{t("common.loading")}</div>
      ) : documents.length === 0 ? (
        <div className="docs-empty">{t("rag.empty")}</div>
      ) : (
        <ul className="docs-list">
          {documents.map((doc) => (
            <li key={doc.id} className="doc-chip">
              <IconDoc size={13} />
              <span className="doc-name" title={doc.filename}>
                {doc.filename}
              </span>
              <span className="doc-chunks">{doc.chunk_count}</span>
              <button
                type="button"
                className="doc-del"
                onClick={() => void remove(doc.id)}
                aria-label={t("rag.deleteDoc")}
                title={t("rag.deleteDoc")}
              >
                <IconClose size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
