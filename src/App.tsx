import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers3, PlaySquare, SearchCheck, UploadCloud, X } from "lucide-react";
import { ArchitecturePanel } from "./components/ArchitecturePanel";
import { AuthPage, type AccountProfile } from "./components/AuthPage";
import { Header } from "./components/Header";
import { OptimizationPanel } from "./components/OptimizationPanel";
import { SearchResults } from "./components/SearchResults";
import { SkillTree } from "./components/SkillTree";
import { UploadPanel } from "./components/UploadPanel";
import { VideoSkillSync } from "./components/VideoSkillSync";
import { analyzeVideoLink, clearAuthSession, fetchCurrentAccount, fetchSkills, uploadMediaFile } from "./lib/backend";
import { activeSkillAtTime, searchSkills } from "./lib/skillEngine";
import type { PipelineStage, Skill, SkillNode, UploadItem } from "./types";

const savedSkillsKey = "ps-skill.savedSkills";
const savedVideosKey = "ps-skill.savedVideoLinks";
const legacyDemoVideoSource = "https://vjs.zencdn.net/v/oceans.mp4";
const legacyMockSkillIds = new Set(["skill_001", "skill_002", "skill_003", "skill_004"]);

type WorkspaceSection = "ingest" | "review" | "search";

const workspaceSections = [
  {
    id: "ingest",
    title: "上传视频和视频处理",
    detail: "导入视频、提交证据、查看处理进度",
    icon: UploadCloud,
  },
  {
    id: "review",
    title: "视频播放和 Skill 导航",
    detail: "同步播放、定位片段、浏览技能树",
    icon: PlaySquare,
  },
  {
    id: "search",
    title: "检索系统",
    detail: "按关键词、标签、软件和步骤查找",
    icon: SearchCheck,
  },
] satisfies Array<{
  id: WorkspaceSection;
  title: string;
  detail: string;
  icon: typeof UploadCloud;
}>;

function inferResolvedVideoType(sourceUrl: string) {
  const clean = sourceUrl.split("?")[0].toLowerCase();
  if (clean.endsWith(".m3u8")) return "application/x-mpegURL";
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

const pipelineStages: PipelineStage[] = [
  { id: "frames", label: "视频抽帧", detail: "等待真实后端任务返回抽帧进度", progress: 0 },
  { id: "asr", label: "语音识别", detail: "等待真实后端任务返回语音识别进度", progress: 0 },
  { id: "ocr", label: "OCR 提取", detail: "等待真实后端任务返回文字识别进度", progress: 0 },
  { id: "vision", label: "界面识别", detail: "等待真实后端任务返回视觉识别进度", progress: 0 },
  { id: "graph", label: "Skill 生成", detail: "等待真实后端任务返回 Skill 结果", progress: 0 },
];

function readSavedJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeSavedSkills(items: Skill[]) {
  return items.filter((skill) => !legacyMockSkillIds.has(skill.id));
}

function sanitizeSavedVideos(items: UploadItem[]) {
  return items
    .filter((item) => item.sourceUrl && item.sourceUrl !== legacyDemoVideoSource)
    .map((item) => ({
      ...item,
      name: item.sourceUrl ?? item.name,
      note: item.sourceUrl ?? item.note,
      temporary: false,
      progress: 100,
      status: item.status ?? "done",
      sourceKind: item.sourceKind ?? (item.embedUrl ? "webpage" : "direct"),
    }));
}

function buildVideoNote(sourceUrl: string, recordedSkills: Skill[]) {
  const primary = recordedSkills
    .slice(0, 2)
    .map((skill) => skill.skill_name)
    .join(" / ");
  return primary ? `${sourceUrl} (${primary})` : sourceUrl;
}

function mergeSkills(previous: Skill[], incoming: Skill[]) {
  const byId = new Map(previous.map((skill) => [skill.id, skill]));
  incoming.forEach((skill) => byId.set(skill.id, skill));
  return Array.from(byId.values());
}

function buildSkillTreeFromSkills(recordedSkills: Skill[]): SkillNode[] {
  const softwareMap = new Map<string, SkillNode>();

  for (const skill of recordedSkills) {
    const softwareNode =
      softwareMap.get(skill.software) ??
      ({
        id: `software_${skill.software}`,
        name: skill.software,
        count: 0,
        confidence: 0,
        children: [],
      } satisfies SkillNode);

    softwareNode.count += 1;
    softwareNode.confidence += skill.confidence;

    const tagName = skill.tags[0] ?? "未分类";
    let tagNode = softwareNode.children?.find((node) => node.name === tagName);
    if (!tagNode) {
      tagNode = {
        id: `tag_${skill.software}_${tagName}`,
        name: tagName,
        count: 0,
        confidence: 0,
        children: [],
      };
      softwareNode.children?.push(tagNode);
    }

    tagNode.count += 1;
    tagNode.confidence += skill.confidence;
    tagNode.children?.push({
      id: `skill_node_${skill.id}`,
      name: skill.skill_name,
      count: 1,
      confidence: skill.confidence,
      skillId: skill.id,
    });

    softwareMap.set(skill.software, softwareNode);
  }

  return Array.from(softwareMap.values()).map((softwareNode) => ({
    ...softwareNode,
    confidence: softwareNode.count ? softwareNode.confidence / softwareNode.count : 0,
    children: softwareNode.children?.map((tagNode) => ({
      ...tagNode,
      confidence: tagNode.count ? tagNode.confidence / tagNode.count : 0,
    })),
  }));
}

interface VideoImportPayload {
  sourceUrl: string;
  name: string;
  size: string;
  file?: File;
  embedUrl?: string;
  mediaType?: string;
  sourceKind?: UploadItem["sourceKind"];
  temporary?: boolean;
  evidenceText?: string;
  transcriptText?: string;
  ocrText?: string;
  visualNotes?: string;
  userNote?: string;
  software?: string;
  targetLevel?: string;
}

export function App() {
  const [query, setQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("ingest");
  const [savedSkills, setSavedSkills] = useState<Skill[]>(() => sanitizeSavedSkills(readSavedJson<Skill[]>(savedSkillsKey, [])));
  const [savedVideos, setSavedVideos] = useState<UploadItem[]>(() => sanitizeSavedVideos(readSavedJson<UploadItem[]>(savedVideosKey, [])));
  const [videoSource, setVideoSource] = useState<string | null>(null);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState<string | undefined>(undefined);
  const [videoSourceKind, setVideoSourceKind] = useState<UploadItem["sourceKind"] | undefined>(undefined);
  const [videoType, setVideoType] = useState<string | undefined>(undefined);
  const [systemOpen, setSystemOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const temporaryVideoUrl = useRef<string | null>(null);

  const hasWorkspaceData = savedSkills.length > 0 || savedVideos.length > 0;
  const visibleSkills = savedSkills;
  const visibleTree = useMemo(() => buildSkillTreeFromSkills(visibleSkills), [visibleSkills]);
  const visibleUploads = savedVideos;
  const timeSkill = activeSkillAtTime(visibleSkills, currentTime);
  const activeSkill = visibleSkills.find((skill) => skill.id === selectedSkillId) ?? timeSkill;
  const results = useMemo(() => searchSkills(visibleSkills, query), [query, visibleSkills]);

  useEffect(() => {
    if (query.trim()) setActiveSection("search");
  }, [query]);

  useEffect(() => {
    let active = true;
    void fetchCurrentAccount()
      .then((profile) => {
        if (active) setAccount(profile);
      })
      .catch(() => {
        clearAuthSession();
        if (active) setAccount(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchSkills()
      .then((remoteSkills) => {
        if (active && remoteSkills.length > 0) {
          setSavedSkills((previous) => mergeSkills(previous, remoteSkills));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(savedSkillsKey, JSON.stringify(savedSkills));
  }, [savedSkills]);

  useEffect(() => {
    const persistentVideos = savedVideos
      .filter((item) => !item.temporary && item.sourceUrl)
      .map((item) => ({
        ...item,
        name: item.sourceUrl ?? item.name,
        note: item.sourceUrl ?? item.note,
      }));
    window.localStorage.setItem(savedVideosKey, JSON.stringify(persistentVideos));
  }, [savedVideos]);

  useEffect(() => {
    return () => {
      if (temporaryVideoUrl.current) URL.revokeObjectURL(temporaryVideoUrl.current);
    };
  }, []);

  function importVideo({
    sourceUrl,
    name,
    size,
    file,
    embedUrl,
    mediaType,
    sourceKind,
    temporary,
    evidenceText,
    transcriptText,
    ocrText,
    visualNotes,
    userNote,
    software,
    targetLevel,
  }: VideoImportPayload) {
    const source = sourceUrl.trim();
    if (!source) return;
    if (!account) {
      setAuthOpen(true);
      return;
    }
    const nextSourceKind = sourceKind ?? (temporary ? "file" : "direct");

    if (temporaryVideoUrl.current && temporaryVideoUrl.current !== source) {
      URL.revokeObjectURL(temporaryVideoUrl.current);
      temporaryVideoUrl.current = null;
    }
    if (temporary) temporaryVideoUrl.current = source;

    const videoId = `link_${Date.now()}`;
    const note = name || source;
    const nextVideo: UploadItem = {
      id: videoId,
      name: note,
      size,
      progress: 5,
      status: "queued",
      sourceUrl: temporary ? undefined : source,
      embedUrl,
      mediaType,
      sourceKind: nextSourceKind,
      note,
      importedAt: new Date().toISOString(),
      temporary,
    };

    setSavedVideos((previous) => [nextVideo, ...previous.filter((item) => item.sourceUrl !== source || temporary)]);
    setVideoSource(null);
    setVideoEmbedUrl(embedUrl);
    setVideoSourceKind(nextSourceKind);
    setVideoType(mediaType);
    window.setTimeout(() => setVideoSource(source), 0);
    setSelectedSkillId(null);
    setCurrentTime(0);
    setActiveSection("review");

    const analysisRequest = file
      ? uploadMediaFile({
          file,
          sourceUrl: sourceKind === "direct" ? source : undefined,
          embedUrl,
          sourceKind: nextSourceKind,
          evidenceText: evidenceText || (temporary ? name : undefined),
          transcriptText,
          ocrText,
          visualNotes,
          userNote,
          software,
          targetLevel,
        })
      : analyzeVideoLink({
          sourceUrl: source,
          embedUrl,
          sourceKind: nextSourceKind,
          evidenceText: evidenceText || (temporary ? name : undefined),
          transcriptText,
          ocrText,
          visualNotes,
          userNote,
          software,
          targetLevel,
        });

    void analysisRequest
      .then((result) => {
        if (result.skills.length > 0) {
          setSavedSkills((previous) => mergeSkills(previous, result.skills));
        }
        if (result.resolved_media_url) {
          setVideoSource(null);
          setVideoEmbedUrl(undefined);
          setVideoSourceKind("direct");
          setVideoType(inferResolvedVideoType(result.resolved_media_url));
          window.setTimeout(() => setVideoSource(result.resolved_media_url ?? source), 0);
        }
        setSavedVideos((previous) =>
          previous.map((item) => {
            if (item.id !== videoId) return item;
            const nextNote = result.skills.length > 0 ? buildVideoNote(source, result.skills) : source;
            const hasResolvedMedia = Boolean(result.resolved_media_url);
            return {
              ...item,
              name: nextNote,
              note: nextNote,
              progress: result.skills.length > 0 ? 100 : hasResolvedMedia ? 35 : 0,
              status: result.skills.length > 0 ? "done" : (result.status as UploadItem["status"]),
              backendJobId: result.job_id,
              analysisMessage: result.message,
              evidenceScore: result.evidence_score,
              evidenceCount: result.evidence.length,
              operationCount: result.operations.length,
              suggestions: result.suggestions,
              resolvedMediaUrl: result.resolved_media_url ?? undefined,
              provider: result.provider ?? undefined,
            };
          }),
        );
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Backend analysis request failed";
        if (message.includes("401")) {
          clearAuthSession();
          setAccount(null);
          setAuthOpen(true);
        }
        setSavedVideos((previous) =>
          previous.map((item) =>
            item.id === videoId
              ? {
                  ...item,
                  progress: 0,
                  status: "backend_error",
                  analysisMessage: message,
                }
              : item,
          ),
        );
      });
  }

  function selectSkill(skillId: string) {
    const next = visibleSkills.find((skill) => skill.id === skillId);
    if (!next) return;
    setSelectedSkillId(skillId);
    setCurrentTime(next.start);
    setActiveSection("review");
  }

  function runSearch() {
    void fetchSkills()
      .then((remoteSkills) => {
        if (remoteSkills.length > 0) {
          setSavedSkills((previous) => mergeSkills(previous, remoteSkills));
        }
      })
      .catch(() => undefined);
    setActiveSection("search");
  }

  if (authOpen) {
    return (
      <AuthPage
        onBack={() => setAuthOpen(false)}
        onAuthenticated={(profile) => {
          setAccount(profile);
          setAuthOpen(false);
        }}
      />
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas font-ui text-ink">
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          query={query}
          onQueryChange={setQuery}
          onSearch={runSearch}
          onOpenSystem={() => setSystemOpen(true)}
          accountName={account?.name}
          onOpenAuth={() => setAuthOpen(true)}
        />
        <main className="grid min-h-0 flex-1 grid-cols-[212px_minmax(0,1fr)] overflow-hidden">
          <aside className="flex min-h-0 flex-col border-r border-line bg-white">
            <div className="border-b border-line p-3">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <Layers3 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">功能目录</p>
                  <p className="text-[11px] text-slate-500">一屏完成主要操作</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {[
                  ["视频", visibleUploads.length.toString()],
                  ["Skill", visibleSkills.length.toString()],
                  ["状态", hasWorkspaceData ? "运行" : "待输入"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-line bg-[#FBFCFE] p-1.5 text-center">
                    <p className="truncate font-mono text-sm font-semibold text-ink">{value}</p>
                    <p className="text-[10px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <nav className="min-h-0 flex-1 space-y-2 overflow-hidden p-2.5">
              {workspaceSections.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                const meta =
                  item.id === "ingest"
                    ? `${visibleUploads.length} 个视频`
                    : item.id === "review"
                      ? `${visibleSkills.length} 个 Skill`
                      : query.trim()
                        ? `检索：${query.trim()}`
                        : "关键词检索";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full rounded-md border p-2.5 text-left transition ${
                      active ? "border-primary bg-primary/6 shadow-command" : "border-transparent bg-white hover:border-line hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${active ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-5 text-ink">{item.title}</span>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.detail}</span>
                        <span className="mt-1.5 block truncate font-mono text-[11px] text-primary">{meta}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-h-0 min-w-0 overflow-hidden p-3">
            <AnimatePresence mode="wait">
              {activeSection === "ingest" && (
                <motion.section
                  key="ingest"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="h-full min-h-0 overflow-hidden"
                >
                  <UploadPanel uploads={visibleUploads} stages={pipelineStages} hasWorkspaceData={hasWorkspaceData} onImportVideo={importVideo} />
                </motion.section>
              )}

              {activeSection === "review" && (
                <motion.section
                  key="review"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="grid h-full min-h-0 grid-cols-[236px_minmax(0,1fr)] gap-3"
                >
                  <div className="min-h-0">
                    <SkillTree nodes={visibleTree} selectedSkillId={activeSkill?.id} onSelectSkill={selectSkill} />
                  </div>
                  <VideoSkillSync
                    skills={visibleSkills}
                    activeSkill={activeSkill}
                    currentTime={currentTime}
                    videoSource={videoSource}
                    videoEmbedUrl={videoEmbedUrl}
                    sourceKind={videoSourceKind}
                    videoType={videoType}
                    onTimeChange={(seconds) => {
                      setCurrentTime(seconds);
                      const matched = activeSkillAtTime(visibleSkills, seconds);
                      if (matched && matched.id !== selectedSkillId) setSelectedSkillId(matched.id);
                    }}
                    onSelectSkill={(skill) => selectSkill(skill.id)}
                  />
                </motion.section>
              )}

              {activeSection === "search" && (
                <motion.section
                  key="search"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="h-full min-h-0 overflow-hidden"
                >
                  <SearchResults query={query} results={results} onSelectSkill={selectSkill} />
                </motion.section>
              )}
            </AnimatePresence>
          </section>
        </main>
      </div>

      <AnimatePresence>
        {systemOpen && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button aria-label="关闭系统面板" className="absolute inset-0 bg-slate-950/35" onClick={() => setSystemOpen(false)} />
            <motion.aside
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 48, opacity: 0 }}
              className="absolute right-0 top-0 h-full w-[min(1120px,calc(100vw-24px))] overflow-hidden border-l border-line bg-canvas shadow-fluent"
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
                <OptimizationPanel skill={activeSkill} />
                <ArchitecturePanel />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
