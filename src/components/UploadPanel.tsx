import { type ReactNode, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Captions,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  FileVideo,
  Globe2,
  Link2,
  ListChecks,
  ScanText,
  UploadCloud,
} from "lucide-react";
import type { PipelineStage, UploadItem } from "../types";

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

interface UploadPanelProps {
  uploads: UploadItem[];
  stages: PipelineStage[];
  hasWorkspaceData: boolean;
  onImportVideo: (payload: VideoImportPayload) => void;
}

const directMediaPattern = /\.(mp4|m4v|webm|ogv|ogg|mov|m3u8)(\?.*)?$/i;

const skillTargets = [
  "通用技能",
  "Photoshop",
  "Illustrator",
  "Lightroom",
  "Figma",
  "Premiere Pro",
  "Final Cut Pro",
  "Excel",
  "PowerPoint",
  "Python",
  "JavaScript",
  "SQL",
  "数据结构与算法",
  "机器学习",
  "Git",
  "Linux Shell",
];

const stageTone: Record<string, string> = {
  frames: "bg-sky-500",
  asr: "bg-emerald-500",
  ocr: "bg-amber-500",
  vision: "bg-fuchsia-500",
  graph: "bg-indigo-500",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function inferVideoType(url: string) {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".ogv") || lower.endsWith(".ogg")) return "video/ogg";
  if (lower.endsWith(".m3u8")) return "application/x-mpegURL";
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v") || lower.endsWith(".mov")) return "video/mp4";
  return undefined;
}

function getYouTubeVideoId(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0];
  if (!host.endsWith("youtube.com")) return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const parts = url.pathname.split("/").filter(Boolean);
  if (["shorts", "embed", "live"].includes(parts[0])) return parts[1];
  return null;
}

function parseVideoPage(url: string): { platform: string; embedUrl?: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const youtubeId = getYouTubeVideoId(parsed);
    if (youtubeId) return { platform: "YouTube", embedUrl: `https://www.youtube.com/embed/${youtubeId}` };

    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      const videoId = parsed.pathname.split("/").find((part) => /^\d+$/.test(part));
      if (videoId) return { platform: "Vimeo", embedUrl: `https://player.vimeo.com/video/${videoId}` };
      return { platform: "Vimeo" };
    }

    if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
      const bvid = parsed.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1] ?? parsed.searchParams.get("bvid");
      const aid = parsed.pathname.match(/\/video\/av(\d+)/i)?.[1] ?? parsed.searchParams.get("aid");
      if (bvid) return { platform: "Bilibili", embedUrl: `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0` };
      if (aid) return { platform: "Bilibili", embedUrl: `https://player.bilibili.com/player.html?aid=${aid}&autoplay=0` };
      return { platform: "Bilibili" };
    }

    if (host === "douyin.com" || host.endsWith(".douyin.com")) return { platform: "Douyin" };
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return { platform: "TikTok" };
    if (host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com") || host === "xhslink.com" || host.endsWith(".xhslink.com") || host === "xhs.cn" || host.endsWith(".xhs.cn")) {
      return { platform: "小红书" };
    }
    return null;
  } catch {
    return null;
  }
}

export function UploadPanel({ uploads, stages, hasWorkspaceData, onImportVideo }: UploadPanelProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [userNote, setUserNote] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [visualNotes, setVisualNotes] = useState("");
  const [software, setSoftware] = useState("通用技能");
  const [targetLevel, setTargetLevel] = useState("Intermediate");
  const [linkStatus, setLinkStatus] = useState("粘贴视频链接，并补充至少一种技能证据。没有证据时，系统只会记录链接，不会生成 Skill。");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const evidenceCount = useMemo(
    () => [userNote, transcriptText, ocrText, visualNotes].filter((value) => value.trim()).length,
    [userNote, transcriptText, ocrText, visualNotes],
  );
  const averageProgress = stages.length ? Math.round(stages.reduce((total, stage) => total + stage.progress, 0) / stages.length) : 0;
  const latestUpload = uploads[0];

  function handleLinkImport() {
    const sourceUrl = linkUrl.trim();
    if (!sourceUrl) {
      setLinkStatus("请先粘贴一个视频链接。");
      return;
    }

    const webpageVideo = directMediaPattern.test(sourceUrl) ? null : parseVideoPage(sourceUrl);
    const sourceKind: UploadItem["sourceKind"] = webpageVideo ? "webpage" : "direct";
    const hasEvidence = evidenceCount > 0;

    if (webpageVideo?.embedUrl) {
      setLinkStatus(`已识别 ${webpageVideo.platform} 页面；后端会结合 iiiLab 元数据和你填写的证据生成 Skill。`);
    } else if (webpageVideo) {
      setLinkStatus(`已记录 ${webpageVideo.platform} 页面；如果 iiiLab 无法解析，请补充转写、OCR 或画面证据。`);
    } else if (directMediaPattern.test(sourceUrl)) {
      setLinkStatus(hasEvidence ? "已提交视频直链和证据。" : "已提交视频直链，但缺少技能证据，可能会进入待补充状态。");
    } else {
      setLinkStatus("已提交链接；若不是可解析网页或媒体直链，需要人工证据支持。");
    }

    onImportVideo({
      sourceUrl,
      name: sourceUrl,
      size: "link only",
      embedUrl: webpageVideo?.embedUrl,
      mediaType: sourceKind === "direct" ? inferVideoType(sourceUrl) : undefined,
      sourceKind,
      temporary: false,
      userNote,
      transcriptText,
      ocrText,
      visualNotes,
      software,
      targetLevel,
    });
  }

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      setLinkStatus("请选择视频或图片文件。");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLinkStatus("已加载本地视频。文件只在当前浏览器会话中临时使用，不会上传或保存。");
    onImportVideo({
      sourceUrl: objectUrl,
      name: file.name,
      size: formatFileSize(file.size),
      file,
      mediaType: file.type || inferVideoType(file.name),
      sourceKind: "file",
      temporary: true,
    });
  }

  return (
    <section className="grid h-full min-h-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-white shadow-command">
        <div className="shrink-0 border-b border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">导入教程和技能证据</h2>
              <p className="mt-1 text-xs text-slate-500">链接、文件和证据统一从这里进入生成流程</p>
            </div>
            <span className="rounded-md bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">{evidenceCount}/4 evidence</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <input ref={fileInputRef} type="file" accept="video/*,image/*" className="hidden" onChange={(event) => handleFileSelect(event.target.files?.[0])} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-full items-center gap-4 rounded-md border border-dashed border-primary/45 bg-[#F2F8FD] px-4 text-left transition hover:bg-[#E8F3FC]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-primary shadow-sm">
              <UploadCloud className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">选择本地视频或图片</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">仅加载到播放器，不会保存文件</span>
            </span>
          </button>

          <div className="mt-3 rounded-md border border-line bg-[#FBFCFE] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink">
              <Globe2 className="h-4 w-4 text-primary" />
              链接与生成参数
            </div>
            <div className="flex gap-2">
              <input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="粘贴小红书 / B 站 / YouTube / 抖音页面，或 .mp4 / .webm 直链"
                className="h-9 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <button onClick={handleLinkImport} className="grid h-9 w-9 place-items-center rounded-md bg-primary text-white hover:bg-[#106EBE]" aria-label="分析视频链接">
                <Link2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select value={software} onChange={(event) => setSoftware(event.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-primary">
                {skillTargets.map((target) => (
                  <option key={target}>{target}</option>
                ))}
              </select>
              <select value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-primary">
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
                <option>Expert</option>
              </select>
            </div>
            <p className="mt-2 rounded-md bg-white px-2 py-1.5 text-[11px] leading-4 text-slate-500">{linkStatus}</p>
          </div>

          <div className="mt-3 grid gap-2">
            <EvidenceTextarea icon={<ClipboardList className="h-4 w-4" />} label="人工备注" value={userNote} onChange={setUserNote} placeholder="例：00:12 讲二分查找边界；00:40 在 VS Code 调试；或用蒙版/曲线处理照片" />
            <EvidenceTextarea icon={<Captions className="h-4 w-4" />} label="字幕 / 转写" value={transcriptText} onChange={setTranscriptText} placeholder="粘贴讲解字幕、ASR 文本或时间轴转写" />
            <EvidenceTextarea icon={<ScanText className="h-4 w-4" />} label="界面 OCR" value={ocrText} onChange={setOcrText} placeholder="例：VS Code、Excel 数据透视表、Camera Raw、Terminal、公式、参数面板" />
            <EvidenceTextarea icon={<Eye className="h-4 w-4" />} label="画面变化" value={visualNotes} onChange={setVisualNotes} placeholder="例：代码运行结果正确，表格完成分组汇总，图片色彩统一" />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="rounded-lg border border-line bg-white p-4 shadow-command">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-ink">证据驱动处理流水线</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">链接解析只解决“视频在哪里”；Skill 生成需要转写、OCR、画面变化和人工备注共同提供证据。</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${hasWorkspaceData ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"}`}>
              {hasWorkspaceData ? "Evidence active" : "Idle"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)]">
            <div className="rounded-md border border-line bg-[#08111F] p-4 text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/65">整体进度</span>
                <Activity className="h-4 w-4 text-sky-300" />
              </div>
              <p className="mt-4 font-mono text-4xl font-semibold">{averageProgress}%</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full bg-sky-400" initial={{ width: 0 }} animate={{ width: `${averageProgress}%` }} />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-5">
              {stages.map((stage, index) => (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex min-h-[112px] flex-col rounded-md border border-line bg-[#FBFCFE] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink">{stage.label}</span>
                    <span className="font-mono text-[11px] text-slate-500">{stage.progress}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div className={`h-full rounded-full ${stageTone[stage.id] ?? "bg-primary"}`} initial={{ width: 0 }} animate={{ width: `${stage.progress}%` }} />
                  </div>
                  <p className="mt-3 line-clamp-3 text-[11px] leading-4 text-slate-500">{stage.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-white shadow-command">
            <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-ink">最近处理任务</h3>
              </div>
              <span className="font-mono text-xs text-slate-500">{uploads.length} videos</span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3">
              {uploads.length === 0 && (
                <div className="grid h-full min-h-[180px] place-items-center rounded-md border border-dashed border-line bg-[#FBFCFE] p-6 text-center">
                  <div>
                    <FileVideo className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-ink">暂无视频记录</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">导入后会保存链接、证据状态和生成结果。</p>
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                {uploads.map((item) => (
                  <UploadTaskCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <MetricCard label="当前视频" value={latestUpload ? statusLabel[latestUpload.status] : "待输入"} detail={latestUpload?.name ?? "还没有进入处理队列"} />
            <MetricCard label="证据完整度" value={`${evidenceCount}/4`} detail="备注、转写、OCR 和画面变化" />
            <MetricCard label="生成策略" value={software} detail={`${targetLevel} 难度，优先生成可复用 Skill`} />
          </div>
        </div>
      </div>
    </section>
  );
}

function EvidenceTextarea({ icon, label, value, onChange, placeholder }: { icon: ReactNode; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block rounded-md border border-line bg-white p-2">
      <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-ink">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full resize-none rounded-md border border-line bg-[#FBFCFE] px-2 py-2 text-xs leading-5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function UploadTaskCard({ item }: { item: UploadItem }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-line bg-white p-3">
      <div className="flex min-w-0 max-w-full items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <FileVideo className="h-4 w-4" />
        </div>
        <div className="min-w-0 max-w-full flex-1 overflow-hidden">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 flex-1 break-all text-xs font-semibold leading-5 text-ink [overflow-wrap:anywhere]">{item.name}</p>
            <span className="shrink-0 font-mono text-xs text-slate-600">{item.progress}%</span>
          </div>
          <p className="mt-1 min-w-0 break-words text-[11px] text-slate-500 [overflow-wrap:anywhere]">
            {item.size} / {item.temporary ? "临时加载" : statusLabel[item.status]}
          </p>
          {item.analysisMessage && <p className="mt-1 line-clamp-2 min-w-0 break-words text-[11px] leading-4 text-slate-500 [overflow-wrap:anywhere]">{item.analysisMessage}</p>}
          {typeof item.evidenceScore === "number" && (
            <p className="mt-1 min-w-0 break-words text-[11px] text-slate-500 [overflow-wrap:anywhere]">
              证据 {item.evidenceScore}% / {item.evidenceCount ?? 0} 条 / 候选操作 {item.operationCount ?? 0} 个
            </p>
          )}
          {item.suggestions?.slice(0, 2).map((suggestion) => (
            <p key={suggestion} className="mt-1 min-w-0 break-words text-[11px] leading-4 text-amber-700 [overflow-wrap:anywhere]">
              {suggestion}
            </p>
          ))}
          <div className="mt-3 h-1.5 max-w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-command">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <CheckCircle2 className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 truncate text-lg font-semibold text-ink">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{detail}</p>
      <ChevronRight className="mt-3 h-4 w-4 text-slate-300" />
    </div>
  );
}

const statusLabel: Record<UploadItem["status"], string> = {
  queued: "等待处理",
  extracting: "视频抽帧",
  asr: "语音识别",
  ocr: "OCR 提取",
  vision: "界面识别",
  graph: "知识图谱生成",
  done: "已生成",
  needs_provider_data: "等待平台数据",
  needs_media_access: "等待媒体证据",
  needs_skill_evidence: "等待技能证据",
  provider_error: "解析接口失败",
  backend_error: "后端未连接",
};
