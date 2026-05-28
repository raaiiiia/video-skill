import { ArrowUpRight, GitMerge, Network, ShieldCheck } from "lucide-react";
import type { Skill } from "../types";
import { confidenceProjection } from "../lib/skillEngine";

interface OptimizationPanelProps {
  skill: Skill | null;
}

export function OptimizationPanel({ skill }: OptimizationPanelProps) {
  if (!skill) {
    return (
      <section className="rounded-lg border border-line bg-white p-4 shadow-command">
        <h2 className="text-sm font-semibold text-ink">Skill 自我优化系统</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">当前没有真实 Skill 数据。为避免展示虚假结论，优化面板会在真实解析结果写入后再计算置信度、聚类和升级建议。</p>
      </section>
    );
  }

  const projection = confidenceProjection(skill);
  const rows = [
    ["初始值", projection.base],
    ["重复出现", projection.repeated],
    ["多视频验证", projection.multiVideo],
    ["高级操作引用", projection.advanced],
  ] as const;
  const skillOutline = {
    skill: skill.skill_name,
    software: skill.software,
    level: skill.level,
    tags: skill.tags,
    evidenceCount: skill.evidenceCount,
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="rounded-lg border border-line bg-white p-4 shadow-command">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Skill 自我优化系统</h2>
            <p className="text-xs text-slate-500">聚类、去重、变体识别、父子层级升级与质量评分</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Quality {skill.quality}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["相同技能合并", `基于 ${skill.evidenceCount} 条真实证据判断是否去重`, GitMerge],
            ["相近技能聚类", skill.tags.length ? skill.tags.join(" / ") : "等待更多标签证据", Network],
            ["高级变体升级", `${skill.level} 级别；仅按当前 skill 元数据评估`, ArrowUpRight],
            ["人工修正增益", `当前置信度 ${(skill.confidence * 100).toFixed(0)}%`, ShieldCheck],
          ].map(([title, desc, Icon]) => (
            <div key={title as string} className="rounded-md border border-line bg-[#FBFCFE] p-3">
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <p className="text-xs font-semibold text-ink">{title as string}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{desc as string}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-md border border-line bg-[#FBFCFE] p-4">
          <p className="text-xs font-semibold text-ink">当前 Skill 结构</p>
          <pre className="mt-3 overflow-auto rounded bg-[#0F172A] p-4 font-mono text-xs leading-6 text-slate-100">{JSON.stringify(skillOutline, null, 2)}</pre>
        </div>
      </div>
      <div className="rounded-lg border border-line bg-white p-4 shadow-command">
        <h2 className="text-sm font-semibold text-ink">当前 Skill 经验值模型</h2>
        <p className="mt-1 text-xs text-slate-500">{skill.skill_name}</p>
        <div className="mt-4 space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-md border border-line bg-[#FBFCFE] px-3 py-2">
              <span className="text-xs text-slate-600">{label}</span>
              <span className="font-mono text-xs font-semibold text-ink">+{value.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-md bg-primary p-4 text-white">
          <p className="text-xs opacity-85">Projected Confidence</p>
          <p className="mt-1 text-3xl font-semibold">{(projection.projected * 100).toFixed(0)}%</p>
          <p className="mt-2 text-xs leading-5 opacity-90">实际生产环境中会写入 ChromaDB 向量索引与 Neo4j 图谱关系，并触发增量重排。</p>
        </div>
      </div>
    </section>
  );
}
