// frontend/store/RagContext.tsx
//
// RAG document state (PH10): the user's uploaded documents and upload/delete
// actions. Components act through this context instead of calling services.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "@/services/apiClient";
import { deleteDocument, listDocuments, uploadDocument } from "@/services/documentsApi";
import { useAuth } from "@/store/AuthContext";
import type { DocumentSummary } from "@/types/api";

// Map backend error codes → i18n keys so messages are localized (PH13) instead
// of showing the raw English message. `error` therefore holds a translation
// key; components render it via t(error).
const RAG_ERROR_KEYS: Record<string, string> = {
  empty_file: "rag.err.empty",
  unreadable_pdf: "rag.err.unreadablePdf",
  unsupported_type: "rag.err.unsupportedType",
  no_text: "rag.err.noText",
  file_too_large: "rag.err.tooLarge",
  conflict: "rag.err.limit",
};

function ragErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    return RAG_ERROR_KEYS[err.code] ?? "errors.generic";
  }
  return "errors.generic";
}

interface RagValue {
  documents: DocumentSummary[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  upload: (file: File) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

const RagContext = createContext<RagValue | null>(null);

export function RagProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  // Starts true so the panel shows loading until the first fetch resolves;
  // flipped only from async callbacks (effects stay side-effect-only).
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (status === "authenticated") {
      listDocuments()
        .then((docs) => {
          if (active) setDocuments(docs);
        })
        .catch((err) => {
          if (active) setError(ragErrorKey(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else if (status === "anonymous") {
      Promise.resolve().then(() => {
        if (!active) return;
        setDocuments([]);
        setLoading(false);
      });
    }
    return () => {
      active = false;
    };
  }, [status]);

  const upload = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const doc = await uploadDocument(file);
      setDocuments((prev) => [doc, ...prev]);
    } catch (err) {
      setError(ragErrorKey(err));
    } finally {
      setUploading(false);
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    setError(null);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(ragErrorKey(err));
    }
  }, []);

  const value = useMemo<RagValue>(
    () => ({ documents, loading, uploading, error, upload, remove }),
    [documents, loading, uploading, error, upload, remove],
  );

  return <RagContext.Provider value={value}>{children}</RagContext.Provider>;
}

export function useRagDocuments(): RagValue {
  const context = useContext(RagContext);
  if (!context) {
    throw new Error("useRagDocuments must be used inside RagProvider");
  }
  return context;
}
