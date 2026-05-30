// frontend/features/compare/useCompare.ts

"use client";

import { useCallback, useState } from "react";

import { compareChat } from "@/services/compareApi";
import { useRagDocuments } from "@/store/RagContext";
import type { CompareRow, FailedProvider, SavedInteraction, SelectorMetadata } from "@/types/api";

import { toCompareRows } from "./rows";

export interface RunCompareOptions {
  chatId?: number | null;
}

export interface UseCompareResult {
  responses: CompareRow[];
  failedProviders: FailedProvider[];
  loading: boolean;
  selectedModel: string | null;
  setSelectedModel: (model: string | null) => void;
  selectorMetadata: SelectorMetadata | null;
  error: string | null;
  runCompare: (message: string, options?: RunCompareOptions) => Promise<void>;
  hydrate: (interaction: SavedInteraction | null) => void;
}

const COMPARE_PROVIDERS = ["groq", "cerebras", "sambanova"];

export function useCompare(): UseCompareResult {
  // RAG is applied automatically whenever the user has any documents.
  const { documents } = useRagDocuments();
  const ragEnabled = documents.length > 0;
  const [responses, setResponses] = useState<CompareRow[]>([]);
  const [failedProviders, setFailedProviders] = useState<FailedProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectorMetadata, setSelectorMetadata] = useState<SelectorMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Populate the view from a persisted turn (opening a saved chat), or clear it.
  const hydrate = useCallback((interaction: SavedInteraction | null) => {
    setError(null);
    if (!interaction) {
      setResponses([]);
      setFailedProviders([]);
      setSelectedModel(null);
      setSelectorMetadata(null);
      return;
    }
    setResponses(
      toCompareRows(
        interaction.all_responses,
        interaction.selector_scores,
        interaction.selector_metadata?.selector_confidence || 0,
      ),
    );
    setFailedProviders(interaction.failed_providers || []);
    setSelectedModel(interaction.manually_selected_model || interaction.selected_model || null);
    setSelectorMetadata(interaction.selector_metadata || null);
  }, []);

  const runCompare = useCallback(
    async (message: string, options: RunCompareOptions = {}) => {
      if (!message?.trim()) {
        return;
      }

      setError(null);
      setLoading(true);

      try {
        const data = await compareChat({
          message,
          providers: COMPARE_PROVIDERS,
          selectorEnabled: true,
          chatId: options.chatId ?? null,
          ragEnabled,
        });

        setResponses(
          toCompareRows(
            data.all_responses || {},
            data.selector_scores,
            data.selector_metadata?.selector_confidence || 0,
          ),
        );
        setFailedProviders(data.failed_providers || []);
        setSelectedModel(data.selected_model || null);
        setSelectorMetadata(data.selector_metadata || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [ragEnabled],
  );

  return {
    responses,
    failedProviders,
    loading,
    selectedModel,
    setSelectedModel,
    selectorMetadata,
    error,
    runCompare,
    hydrate,
  };
}
