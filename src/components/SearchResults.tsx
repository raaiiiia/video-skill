import { Filter, SearchCheck } from "lucide-react";
import type { SearchResult } from "../types";

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  onSelectSkill: (skillId: string) => void;
}

export function SearchResults({ query, results, onSelectSkill }: SearchResultsProps) {
  const hasQuery = query.trim().length > 0;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-line bg-white shadow-command">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">检索系统</h2>
          <p className="text-xs text-slate-500">实时 / 模糊 / 标签 / 快捷键 / 自然语言意图搜索</p>
        </div>
        <button className="flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs text-slate-600 hover:bg-slate-50">
          <Filter className="h-3.5 w-3.5" />
          软件 / 难度 / 标签 / 日期 / 质量
        </button>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-hidden p-4 lg:grid-cols-3">
        {results.map((result) => (
          <button
            key={result.skill.id}
            onClick={() => onSelectSkill(result.skill.id)}
            className="rounded-md border border-line bg-[#FBFCFE] p-3 text-left transition hover:border-primary/50 hover:bg-white hover:shadow-command"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-ink">{result.skill.skill_name}</p>
              <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-line">{result.skill.software}</span>
            </div>
            {hasQuery && (
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                <SearchCheck className="h-3.5 w-3.5" />
                <span>相关度 {result.score}%</span>
              </div>
            )}
            <p className="mt-1 text-xs leading-5 text-slate-600">{result.path}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {result.skill.tags.map((tag) => (
                <span key={tag} className="rounded bg-primary/8 px-2 py-1 text-[11px] text-primary">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
        {results.length === 0 && (
          <div className="col-span-full grid min-h-[320px] place-items-center rounded-md border border-line bg-[#FBFCFE] p-8 text-center">
            <div>
              <p className="text-sm font-semibold text-ink">未找到匹配 Skill</p>
              <p className="mt-1 text-xs text-slate-500">{query ? `当前查询“${query}”没有命中。` : "输入软件名、快捷键或操作意图开始检索。"}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
