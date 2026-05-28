export type Software = "Photoshop" | "Illustrator" | "Lightroom";
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
  parentId?: string;
  variantOf?: string;
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
  status: "queued" | "extracting" | "asr" | "ocr" | "vision" | "graph" | "done";
  sourceUrl?: string;
  mediaType?: string;
  note?: string;
  importedAt?: string;
  temporary?: boolean;
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
