import type { SearchResult, Skill } from "../types";
import { expandSearchTerms, rankKnowledgeTopics } from "./skillKnowledge";

export function confidenceProjection(skill: Skill) {
  const base = 0.6;
  const repeated = Math.min(skill.evidenceCount, 6) * 0.05;
  const multiVideo = skill.evidenceCount >= 3 ? 0.1 : 0;
  const advanced = skill.level === "Advanced" || skill.level === "Expert" ? 0.2 : 0;
  const projected = Math.min(0.99, base + repeated + multiVideo + advanced);
  return {
    base,
    repeated,
    multiVideo,
    advanced,
    projected,
  };
}

export function activeSkillAtTime(skills: Skill[], seconds: number) {
  return skills.find((skill) => seconds >= skill.start && seconds <= skill.end) ?? null;
}

export function searchSkills(skills: Skill[], query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return skills.map((skill, index) => ({
      skill,
      path: `${skill.software} > ${skill.tags[0] ?? "Skill"}`,
      score: 96 - index * 4,
    }));
  }

  const queryTerms = expandSearchTerms(query);
  const queryTopics = rankKnowledgeTopics(query);

  return skills
    .map((skill) => {
      const text = [skill.software, skill.level, skill.skill_name, skill.description, ...skill.tags, ...skill.shortcut, ...skill.steps].join(" ").toLowerCase();
      let score = text.includes(normalized) ? 72 : 0;

      queryTerms.forEach((term) => {
        if (text.includes(term)) score += term.length > 2 ? 12 : 7;
      });

      skill.tags.forEach((tag) => {
        const term = tag.toLowerCase();
        if (term && (normalized.includes(term) || term.includes(normalized))) score += 14;
      });

      skill.shortcut.forEach((shortcut) => {
        const term = shortcut.toLowerCase();
        if (term && normalized.includes(term)) score += 18;
      });

      const skillTopics = rankKnowledgeTopics(text);
      queryTopics.forEach((queryTopic) => {
        const matched = skillTopics.find((item) => item.topic.id === queryTopic.topic.id);
        if (matched) score += Math.min(28, Math.round((queryTopic.score + matched.score) / 6));
      });

      if (score > 0) score += Math.round(skill.confidence * 8);
      return {
        skill,
        path: `${skill.software} > ${skill.tags[0] ?? "Skill"} > ${skill.skill_name}`,
        score: Math.min(99, score),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}
