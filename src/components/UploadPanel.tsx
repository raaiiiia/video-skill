import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileVideo, Globe2, Link2, UploadCloud } from "lucide-react";
import type { PipelineStage, UploadItem } from "../types";

interface VideoImportPayload {
  sourceUrl: string;
  name: string;
  size: string;
  mediaType?: string;
  temporary?: boolean;
}

interface UploadPanelProps {
  uploads: UploadItem[];
  stages: PipelineStage[];
  hasWorkspaceData: boolean;
  onImportVideo: (payload: VideoImportPayload) => void;
}

const directMediaPattern = /\.(mp4|m4v|webm|ogv|ogg|mov|m3u8)(\?.*)?$/i;
const knownPageHosts = ["youtube.com", "youtu.be", "bilibili.com", "vimeo.com", "douyin.com", "tiktok.com"];

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

function isKnownVideoPage(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return knownPageHosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function UploadPanel({ uploads, stages, hasWorkspaceData, onImportVideo }: UploadPanelProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkStatus, setLinkStatus] = useState("等待输入可直接播放的视频文件 URL，或选择本地视频文件。");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleLinkImport() {
    const sourceUrl = linkUrl.trim();
    if (!sourceUrl) {
      setLinkStatus("请先粘贴一个视频直链。");
      return;
    }

    if (isKnownVideoPage(sourceUrl) && !directMediaPattern.test(sourceUrl)) {
      setLinkStatus("这是视频网页链接，不是可直接播放的媒体文件地址。请上传本地文件，或使用以 .mp4 / .webm / .ogg / .m3u8 结尾的直链。");
      return;
    }

    setLinkStatus(directMediaPattern.test(sourceUrl) ? "已加载视频直链；不会下载或存储视频文件。" : "已尝试加载该链接；如果服务器返回的不是视频媒体，播放器会拒绝播放。");
    onImportVideo({
      sourceUrl,
      name: sourceUrl,
      size: "link only",
      mediaType: inferVideoType(sourceUrl),
      temporary: false,
    });
  }

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setLinkStatus("请选择浏览器可播放的视频文件。");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLinkStatus("已加载本地视频；文件只在当前浏览器会话中临时使用，不会写入本地存储。");
    onImportVideo({
      sourceUrl: objectUrl,
      name: file.name,
      size: formatFileSize(file.size),
      mediaType: file.type || inferVideoType(file.name),
      temporary: true,
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[390px_1fr]">
      <div className="rounded-lg border border-dashed border-primary/45 bg-white p-4 shadow-command">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => handleFileSelect(event.target.files?.[0])}
        />
        <button onClick={() => fileInputRef.current?.click()} className="flex h-32 w-full flex-col items-center justify-center rounded-md bg-[#F2F8FD] text-center transition hover:bg-[#E8F3FC]">
          <UploadCloud className="mb-2 h-8 w-8 text-primary" />
          <p className="text-sm font-semibold text-ink">选择本地教学视频</p>
          <p className="mt-1 text-xs text-slate-500">视频只临时加载到播放器，不保存文件本体</p>
        </button>

        <div className="mt-3 rounded-md border border-line bg-[#FBFCFE] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink">
            <Globe2 className="h-4 w-4 text-primary" />
            从媒体直链加载视频
          </div>
          <div className="flex gap-2">
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="粘贴 .mp4 / .webm / .ogg / .m3u8 视频直链"
              className="h-9 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button onClick={handleLinkImport} className="grid h-9 w-9 place-items-center rounded-md bg-primary text-white hover:bg-[#106EBE]" aria-label="加载视频链接">
              <Link2 className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">{linkStatus}</p>
        </div>

        <div className="mt-4 space-y-3">
          {uploads.length === 0 && (
            <div className="rounded-md border border-dashed border-line bg-white p-4 text-center text-xs text-slate-500">暂无视频记录；导入后只保存链接或文件名，不保存视频文件。</div>
          )}
          {uploads.map((item) => (
            <div key={item.id} className="rounded-md border border-line bg-white p-3">
              <div className="flex items-center gap-3">
                <FileVideo className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.size} / {item.temporary ? "临时加载" : statusLabel[item.status]}
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-600">{item.progress}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-4 shadow-command">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">处理流水线</h2>
            <p className="text-xs text-slate-500">当前前端只负责加载视频；Skill 生成需要真实后端结果写入</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasWorkspaceData ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"}`}>
            {hasWorkspaceData ? "Video loaded" : "Idle"}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {stages.map((stage, index) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-md border border-line bg-[#FBFCFE] p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">{stage.label}</span>
                <span className="font-mono text-[11px] text-slate-500">{stage.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${stage.progress}%` }} />
              </div>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">{stage.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const statusLabel: Record<UploadItem["status"], string> = {
  queued: "等待处理",
  extracting: "视频抽帧",
  asr: "语音识别",
  ocr: "OCR 提取",
  vision: "界面识别",
  graph: "知识图谱生成",
  done: "已记录",
};
