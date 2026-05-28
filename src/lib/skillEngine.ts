import type { SearchResult, Skill } from "../types";

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
  return skills.find((skill) => seconds >= skill.start && seconds <= skill.end) ?? skills[0] ?? null;
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

  const intentBoosts: Record<string, string[]> = {
    高光: ["高光", "Camera Raw", "动态范围"],
    压高光: ["高光", "Camera Raw", "动态范围"],
    曝光: ["曝光", "曲线", "蒙版"],
    抠图: ["抠图", "钢笔工具", "路径"],
    快捷键: ["Ctrl", "Alt", "B", "P"],
  };

  return skills
    .map((skill) => {
      const text = [skill.skill_name, skill.description, ...skill.tags, ...skill.shortcut, ...skill.steps].join(" ").toLowerCase();
      let score = text.includes(normalized) ? 88 : 48;
      Object.entries(intentBoosts).forEach(([intent, terms]) => {
        if (normalized.includes(intent.toLowerCase())) {
          score += terms.filter((term) => text.includes(term.toLowerCase())).length * 12;
        }
      });
      score += Math.round(skill.confidence * 8);
      return {
        skill,
        path: `${skill.software} > ${skill.tags[0] ?? "Skill"} > ${skill.skill_name}`,
        score: Math.min(99, score),
      };
    })
    .filter((result) => result.score > 58)
    .sort((a, b) => b.score - a.score);
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}
