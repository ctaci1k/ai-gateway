// frontend/components/chat/ComposerTools.tsx
//
// Composer-side document control shared by Single and Compare (PH13/C1–C2):
// a single "Documents" button opens a popover with the document manager
// (upload / list / delete). RAG is applied automatically while any document
// exists — no manual toggle — so the button just surfaces the document count
// and the panel states that answers use those documents.

"use client";

import { useState } from "react";

import DocumentsPanel from "@/components/rag/DocumentsPanel";
import { IconDoc } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { useRagDocuments } from "@/store/RagContext";

export default function ComposerTools() {
  const { t } = useI18n();
  const { documents } = useRagDocuments();
  const [open, setOpen] = useState(false);

  const count = documents.length;
  const active = count > 0; // RAG is on whenever documents exist
  const buttonClass = active || open ? "composer-tool composer-tool--on" : "composer-tool";

  return (
    <div className="composer-tools">
      {open && (
        <div className="composer-popover" role="dialog" aria-label={t("composer.docs")}>
          {active && <p className="composer-rag-note">{t("composer.autoRagNote")}</p>}
          <DocumentsPanel />
        </div>
      )}

      <button
        type="button"
        className={buttonClass}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title={active ? t("composer.docsActive") : t("composer.docs")}
        aria-label={active ? t("composer.docsActive") : t("composer.docs")}
      >
        <IconDoc size={18} />
        {active && <span className="composer-tool-badge">{count}</span>}
      </button>
    </div>
  );
}
