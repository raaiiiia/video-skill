import type { EvidenceItem, OperationCandidate, Skill, UploadItem } from "../types";

export interface AccountProfile {
  name: string;
  email: string;
}

export interface AnalyzeVideoLinkInput {
  sourceUrl: string;
  embedUrl?: string;
  sourceKind?: UploadItem["sourceKind"];
  evidenceText?: string;
  transcriptText?: string;
  ocrText?: string;
  visualNotes?: string;
  userNote?: string;
  software?: string;
  targetLevel?: string;
}

export interface UploadMediaFileInput extends Omit<AnalyzeVideoLinkInput, "sourceUrl"> {
  sourceUrl?: string;
  file: File;
}

export interface AnalyzeVideoLinkResponse {
  job_id: string;
  status: string;
  message: string;
  skills: Skill[];
  evidence: EvidenceItem[];
  operations: OperationCandidate[];
  evidence_score: number;
  needs_review: boolean;
  suggestions: string[];
  resolved_media_url?: string | null;
  provider?: string | null;
}

export interface BackendHealth {
  status: string;
  database?: string;
  jobs?: number;
  skills?: number;
  evidence?: number;
}

export interface AuthResponse {
  token: string;
  user: AccountProfile;
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  (import.meta.env.DEV ? "http://localhost:8000/api" : "/api");
const authTokenKey = "ps-skill.authToken";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(authTokenKey);
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(authTokenKey);
}

function saveAuthToken(token: string) {
  window.localStorage.setItem(authTokenKey, token);
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function authJsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders() };
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ? `: ${payload.detail}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`${label} failed with ${response.status}${detail}`);
  }
  return response.json() as Promise<T>;
}

export async function sendAuthCode(email: string): Promise<{ code?: string; cooldown_seconds: number; message: string }> {
  const response = await fetch(`${apiBaseUrl}/auth/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseJsonResponse(response, "Auth code request");
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  emailCode: string;
  captcha?: string;
}): Promise<AccountProfile> {
  const response = await fetch(`${apiBaseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
      email_code: input.emailCode,
      captcha: input.captcha,
    }),
  });
  const payload = await parseJsonResponse<AuthResponse>(response, "Auth register request");
  saveAuthToken(payload.token);
  return payload.user;
}

export async function loginAccount(email: string, password: string): Promise<AccountProfile> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseJsonResponse<AuthResponse>(response, "Auth login request");
  saveAuthToken(payload.token);
  return payload.user;
}

export async function fetchCurrentAccount(): Promise<AccountProfile | null> {
  if (!getAuthToken()) return null;
  const response = await fetch(`${apiBaseUrl}/auth/me`, { headers: authHeaders() });
  if (response.status === 401) {
    clearAuthSession();
    return null;
  }
  return parseJsonResponse<AccountProfile>(response, "Auth profile request");
}

export async function analyzeVideoLink(input: AnalyzeVideoLinkInput): Promise<AnalyzeVideoLinkResponse> {
  const response = await fetch(`${apiBaseUrl}/videos/analyze-link`, {
    method: "POST",
    headers: authJsonHeaders(),
    body: JSON.stringify({
      source_url: input.sourceUrl,
      embed_url: input.embedUrl,
      source_kind: input.sourceKind ?? "direct",
      evidence_text: input.evidenceText,
      transcript_text: input.transcriptText,
      ocr_text: input.ocrText,
      visual_notes: input.visualNotes,
      user_note: input.userNote,
      software: input.software ?? "通用技能",
      target_level: input.targetLevel ?? "Intermediate",
    }),
  });

  return parseJsonResponse<AnalyzeVideoLinkResponse>(response, "Backend analysis request");
}

export async function uploadMediaFile(input: UploadMediaFileInput): Promise<AnalyzeVideoLinkResponse> {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.sourceUrl) formData.append("source_url", input.sourceUrl);
  if (input.embedUrl) formData.append("embed_url", input.embedUrl);
  if (input.sourceKind) formData.append("source_kind", input.sourceKind);
  if (input.evidenceText) formData.append("evidence_text", input.evidenceText);
  if (input.transcriptText) formData.append("transcript_text", input.transcriptText);
  if (input.ocrText) formData.append("ocr_text", input.ocrText);
  if (input.visualNotes) formData.append("visual_notes", input.visualNotes);
  if (input.userNote) formData.append("user_note", input.userNote);
  if (input.software) formData.append("software", input.software);
  if (input.targetLevel) formData.append("target_level", input.targetLevel);

  const response = await fetch(`${apiBaseUrl}/videos/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  return parseJsonResponse<AnalyzeVideoLinkResponse>(response, "Backend media upload");
}

export async function fetchSkills(): Promise<Skill[]> {
  const response = await fetch(`${apiBaseUrl}/skills`);
  return parseJsonResponse<Skill[]>(response, "Backend skills request");
}

export async function updateSkill(skill: Skill): Promise<Skill> {
  const response = await fetch(`${apiBaseUrl}/skills/${encodeURIComponent(skill.id)}`, {
    method: "PUT",
    headers: authJsonHeaders(),
    body: JSON.stringify(skill),
  });
  return parseJsonResponse<Skill>(response, "Backend skill update");
}

export async function deleteSkill(skillId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/skills/${encodeURIComponent(skillId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await parseJsonResponse<{ ok: boolean }>(response, "Backend skill delete");
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  const response = await fetch(`${apiBaseUrl}/health`);
  return parseJsonResponse<BackendHealth>(response, "Backend health request");
}
