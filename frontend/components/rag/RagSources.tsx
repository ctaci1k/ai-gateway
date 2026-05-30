// frontend/components/rag/RagSources.tsx

"use client";

import { useI18n } from "@/store/LanguageContext";
import type { RagSource } from "@/types/api";

export default function RagSources({ sources }: { sources: RagSource[] }) {
  const { t } = useI18n();
  if (sources.length === 0) return null;

  return (
    <div className="rag-sources">
      <div className="rag-sources-cap">{t("rag.sources")}</div>
      <ol className="rag-sources-list">
        {sources.map((source, index) => (
          <li key={`${source.document_id}-${source.chunk_index}-${index}`} className="rag-source">
            <div className="rag-source-head">
              <span className="rag-source-file">{source.filename}</span>
              {source.score != null && (
                <span className="rag-source-score">{Math.round(source.score * 100)}%</span>
              )}
            </div>
            {source.snippet && <p className="rag-source-snippet">{source.snippet}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
