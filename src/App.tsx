import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ArchitecturePanel } from "./components/ArchitecturePanel";
import { Header } from "./components/Header";
import { OptimizationPanel } from "./components/OptimizationPanel";
import { SearchResults } from "./components/SearchResults";
import { SkillTree } from "./components/SkillTree";
import { UploadPanel } from "./components/UploadPanel";
import { VideoSkillSync } from "./components/VideoSkillSync";
import { pipelineStages, skills, skillTree } from "./data/mockData";
import { activeSkillAtTime, searchSkills } from "./lib/skillEngine";
import type { Skill, UploadItem } from "./types";

const demoVideoSource = "https://vjs.zencdn.net/v/oceans.mp4";
const savedSkillsKey = "ps-skill.savedSkills";
const savedVideosKey = "ps-skill.savedVideoLinks";

function readSavedJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function buildVideoNote(sourceUrl: string, recordedSkills: Skill[]) {
  const primary = recordedSkills
    .slice(0, 2)
    .map((skill) => skill.skill_name)
    .join(" / ");
  return `${sourceUrl} (${primary || "Skill analyzed"})`;
}

export function App() {
  const [query, setQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [savedSkills, setSavedSkills] = useState<Skill[]>(() => readSavedJson<Skill[]>(savedSkillsKey, []));
  const [savedVideos, setSavedVideos] = useState<UploadItem[]>(() => readSavedJson<UploadItem[]>(savedVideosKey, []));
  const [videoSource, setVideoSource] = useState<string | null>(null);
  const [systemOpen, setSystemOpen] = useState(false);

  const hasWorkspaceData = savedSkills.length > 0 || savedVideos.length > 0;
  const visibleSkills = savedSkills;
  const visibleTree = hasWorkspaceData ? skillTree : [];
  const visibleUploads = savedVideos;
  const timeSkill = activeSkillAtTime(visibleSkills, currentTime);
  const activeSkill = visibleSkills.find((skill) => skill.id === selectedSkillId) ?? timeSkill;
  const results = useMemo(() => searchSkills(visibleSkills, query), [query, visibleSkills]);
  const drawerSkill = activeSkill ?? skills[0];

  useEffect(() => {
    window.localStorage.setItem(savedSkillsKey, JSON.stringify(savedSkills));
  }, [savedSkills]);

  useEffect(() => {
    window.localStorage.setItem(savedVideosKey, JSON.stringify(savedVideos));
  }, [savedVideos]);

  function startDemo(sourceUrl?: string) {
    const source = sourceUrl?.trim() || demoVideoSource;
    const recordedSkills = skills;
    const note = buildVideoNote(source, recordedSkills);
    const nextVideo: UploadItem = {
      id: `link_${Date.now()}`,
      name: note,
      size: sourceUrl ? "link only" : "demo stream",
      progress: 100,
      status: "done",
      sourceUrl: source,
      note,
      importedAt: new Date().toISOString(),
    };

    setSavedSkills(recordedSkills);
    setSavedVideos((previous) => [nextVideo, ...previous.filter((item) => item.sourceUrl !== source)]);
    setVideoSource(null);
    window.setTimeout(() => setVideoSource(source), 0);
    setSelectedSkillId(recordedSkills[0]?.id ?? null);
    setCurrentTime(recordedSkills[0]?.start ?? 0);
  }

  function selectSkill(skillId: string) {
    const next = visibleSkills.find((skill) => skill.id === skillId);
    if (!next) return;
    setSelectedSkillId(skillId);
    setCurrentTime(next.start);
  }

  return (
    <div className="min-h-dvh bg-canvas font-ui text-ink">
      <Header query={query} onQueryChange={setQuery} onOpenSystem={() => setSystemOpen(true)} />
      <main className="mx-auto flex max-w-[1800px] flex-col gap-4 p-4">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-line bg-white p-4 shadow-command">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">AI Skill Knowledge OS</p>
              <h1 className="mt-2 text-2xl font-semibold text-ink">从创意软件教学视频中提取专业 Skill，并持续构建知识树</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                上传本地视频或粘贴公开视频链接后，系统会联合分析画面、语音、OCR、界面结构、工具路径与操作行为，生成接近专业教程 SOP 和知识图谱节点的 Skill 库。
              </p>
            </div>
            <div className="grid min-w-[320px] grid-cols-3 gap-2">
              {[
                ["视频", visibleUploads.length.toString()],
                ["Skill", visibleSkills.length.toString()],
                ["任务", hasWorkspaceData ? "运行中" : "待输入"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-line bg-[#FBFCFE] p-3 text-center">
                  <p className="font-mono text-xl font-semibold text-ink">{value}</p>
                  <p className="text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <UploadPanel uploads={visibleUploads} stages={pipelineStages} hasWorkspaceData={hasWorkspaceData} onStartDemo={startDemo} />

        <div className="grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
          <div className="min-h-[650px]">
            <SkillTree nodes={visibleTree} selectedSkillId={activeSkill?.id} onSelectSkill={selectSkill} />
          </div>
          <VideoSkillSync
            skills={visibleSkills}
            activeSkill={activeSkill}
            currentTime={currentTime}
            videoSource={videoSource}
            onTimeChange={(seconds) => {
              setCurrentTime(seconds);
              const matched = activeSkillAtTime(visibleSkills, seconds);
              if (matched && matched.id !== selectedSkillId) setSelectedSkillId(matched.id);
            }}
            onSelectSkill={(skill) => selectSkill(skill.id)}
          />
        </div>

        {(query || hasWorkspaceData) && <SearchResults query={query} results={results} onSelectSkill={selectSkill} />}
      </main>

      <AnimatePresence>
        {systemOpen && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button aria-label="关闭系统面板" className="absolute inset-0 bg-slate-950/35" onClick={() => setSystemOpen(false)} />
            <motion.aside
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 48, opacity: 0 }}
              className="absolute right-0 top-0 h-full w-[min(1120px,calc(100vw-24px))] overflow-auto border-l border-line bg-canvas shadow-fluent"
            >
              <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur-xl">
                <div>
                  <h2 className="text-sm font-semibold text-ink">系统面板</h2>
                  <p className="text-xs text-slate-500">自我优化、后端架构与数据流在这里查看，不占用主工作台。</p>
                </div>
                <button aria-label="关闭" onClick={() => setSystemOpen(false)} className="grid h-9 w-9 place-items-center rounded-md border border-line bg-white hover:bg-slate-50">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <OptimizationPanel skill={drawerSkill} />
                <ArchitecturePanel />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
