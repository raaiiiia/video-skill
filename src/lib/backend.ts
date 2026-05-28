import type { Skill, UploadItem } from "../types";

interface AnalyzeVideoLinkInput {
  sourceUrl: string;
  embedUrl?: string;
  sourceKind?: UploadItem["sourceKind"];
}

interface AnalyzeVideoLinkResponse {
  job_id: string;
  status: string;
  message: string;
  skills: Skill[];
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  (import.meta.env.DEV ? "http://localhost:8000/api" : "/_/backend/api");

export async function analyzeVideoLink(input: AnalyzeVideoLinkInput): Promise<AnalyzeVideoLinkResponse> {
  const response = await fetch(`${apiBaseUrl}/videos/analyze-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_url: input.sourceUrl,
      embed_url: input.embedUrl,
      source_kind: input.sourceKind ?? "direct",
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend analysis request failed with ${response.status}`);
  }

  return response.json() as Promise<AnalyzeVideoLinkResponse>;
}
