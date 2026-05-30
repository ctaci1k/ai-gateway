// frontend/utils/judge.ts
//
// Friendly display name for the AI judge model. The judge runs on Groq with a
// neutral model (qwen/qwen3-32b — D-9), so the UI must derive its label from
// selector_metadata.selector_model instead of hardcoding a vendor name.

// The judge model id, mirroring backend `config/selector_config.py:SELECTOR_MODEL`
// (D-9). Used for descriptive copy (e.g. the Compare mode explanation) where no
// live selector_metadata is available yet. Keep in sync with the backend.
export const JUDGE_MODEL = "qwen/qwen3-32b";

const JUDGE_NAMES: ReadonlyArray<readonly [RegExp, string]> = [
  [/qwen/i, "Qwen"],
  [/llama/i, "Llama"],
  [/gpt[\s-]?oss/i, "GPT-OSS"],
  [/gemini/i, "Gemini"],
];

export function judgeModelName(model?: string | null): string | null {
  if (!model) return null;
  for (const [pattern, name] of JUDGE_NAMES) {
    if (pattern.test(model)) return name;
  }
  // Unknown model: strip any "vendor/" prefix and show the bare id.
  return model.split("/").pop() || model;
}
