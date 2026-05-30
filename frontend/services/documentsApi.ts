// frontend/services/documentsApi.ts
//
// Typed RAG document management (PH10). Upload uses multipart/form-data;
// the shared apiClient handles cookies + CSRF.

import { apiFetch, parseJsonResponse } from "@/services/apiClient";
import type { DocumentSummary } from "@/types/api";

interface DocumentListResponse {
  documents: DocumentSummary[];
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const response = await apiFetch("/documents");
  const data = await parseJsonResponse<DocumentListResponse>(response);
  return data.documents;
}

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiFetch("/documents", { method: "POST", body: form });
  return parseJsonResponse<DocumentSummary>(response);
}

export async function deleteDocument(documentId: number): Promise<void> {
  const response = await apiFetch(`/documents/${documentId}`, { method: "DELETE" });
  await parseJsonResponse<{ message: string }>(response);
}
