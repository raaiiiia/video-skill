export type Software = string;
export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface Skill {
  id: string;
  software: Software;
  skill_name: string;
  level: SkillLevel;
  tags: string[];
  description: string;
  steps: string[];
  shortcut: string[];
  timestamp: string;
  start: number;
  end: number;
  confidence: number;
  quality: number;
  evidenceCount: number;
  evidenceIds?: string[];
  operationId?: string;
  parentId?: string;
  variantOf?: string;
}

export interface EvidenceItem {
  id: string;
  job_id?: string | null;
  type: string;
  source: string;
  text: string;
  timestamp?: number | null;
  confidence: number;
  weight: number;
}

export interface OperationCandidate {
  id: string;
  operation: string;
  label: string;
  software: Software | string;
  category: string;
  matched_keywords: string[];
  evidence_ids: string[];
  timestamps: number[];
  confidence: number;
  quality: number;
}

export interface SkillNode {
  id: string;
  name: string;
  count: number;
  confidence: number;
  children?: SkillNode[];
  skillId?: string;
}

export interface UploadItem {
  id: string;
  name: string;
  size: string;
  progress: number;
  status:
    | "queued"
    | "extracting"
    | "asr"
    | "ocr"
    | "vision"
    | "graph"
    | "done"
    | "needs_provider_data"
    | "needs_media_access"
    | "needs_skill_evidence"
    | "provider_error"
    | "backend_error";
  sourceUrl?: string;
  embedUrl?: string;
  mediaType?: string;
  sourceKind?: "file" | "direct" | "webpage";
  note?: string;
  importedAt?: string;
  temporary?: boolean;
  backendJobId?: string;
  analysisMessage?: string;
  evidenceScore?: number;
  evidenceCount?: number;
  operationCount?: number;
  suggestions?: string[];
  resolvedMediaUrl?: string;
  provider?: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  detail: string;
  progress: number;
}

export interface SearchResult {
  skill: Skill;
  path: string;
  score: number;
}
