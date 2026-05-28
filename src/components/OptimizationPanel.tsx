import { ArrowUpRight, GitMerge, Network, ShieldCheck } from "lucide-react";
import type { Skill } from "../types";
import { confidenceProjection } from "../lib/skillEngine";

interface OptimizationPanelProps {
  skill: Skill;
}

export function OptimizationPanel({ skill }: OptimizationPanelProps) {
  const projection = confidenceProjection(skill);
  const rows = [
    ["初始值", projection.base],
    ["重复出现", projection.repeated],
    ["多视频验证", projection.multiVideo],
    ["高级操作引用", projection.advanced],
  ] as const;

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
            ["相同技能合并", "曲线调亮 → 曲线曝光控制", GitMerge],
            ["相近技能聚类", "蒙版 / Blend If / 亮度蒙版", Network],
            ["高级变体升级", "局部曝光 → Blend If 高级控制", ArrowUpRight],
            ["人工修正增益", "专家修正后 +0.3 Confidence", ShieldCheck],
          ].map(([title, desc, Icon]) => (
            <div key={title as string} className="rounded-md border border-line bg-[#FBFCFE] p-3">
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <p className="text-xs font-semibold text-ink">{title as string}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{desc as string}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-md border border-line bg-[#FBFCFE] p-4">
          <p className="text-xs font-semibold text-ink">自动升级示例</p>
          <pre className="mt-3 overflow-auto rounded bg-[#0F172A] p-4 font-mono text-xs leading-6 text-slate-100">{`曝光控制
  ├── 曲线调整
  │   ├── 全局曝光
  │   ├── 局部曝光
  │   └── Blend If 高级控制
  └── Camera Raw
      ├── 高光恢复
      └── 阴影细节平衡`}</pre>
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
