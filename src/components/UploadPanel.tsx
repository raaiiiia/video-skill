import { useState } from "react";
import { motion } from "framer-motion";
import { FileVideo, Globe2, Link2, UploadCloud } from "lucide-react";
import type { PipelineStage, UploadItem } from "../types";

interface UploadPanelProps {
  uploads: UploadItem[];
  stages: PipelineStage[];
  hasWorkspaceData: boolean;
  onStartDemo: (sourceUrl?: string) => void;
}

export function UploadPanel({ uploads, stages, hasWorkspaceData, onStartDemo }: UploadPanelProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkStatus, setLinkStatus] = useState("等待输入公开的视频页面链接");

  function handleLinkImport() {
    setLinkStatus(linkUrl.trim() ? "已创建链接解析任务，Demo 使用公开视频流模拟后端抓取。" : "请先粘贴一个公开视频链接。");
    if (linkUrl.trim()) onStartDemo(linkUrl.trim());
  }

  function handleLocalDemo() {
    setLinkStatus("已创建本地视频解析任务，Demo 将展示完整 Skill 同步流程。");
    onStartDemo();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[390px_1fr]">
      <div className="rounded-lg border border-dashed border-primary/45 bg-white p-4 shadow-command">
        <button onClick={handleLocalDemo} className="flex h-32 w-full flex-col items-center justify-center rounded-md bg-[#F2F8FD] text-center transition hover:bg-[#E8F3FC]">
          <UploadCloud className="mb-2 h-8 w-8 text-primary" />
          <p className="text-sm font-semibold text-ink">拖拽上传教学视频</p>
          <p className="mt-1 text-xs text-slate-500">支持 mp4 / mov / mkv / avi，批量解析为 Skill</p>
        </button>

        <div className="mt-3 rounded-md border border-line bg-[#FBFCFE] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink">
            <Globe2 className="h-4 w-4 text-primary" />
            从网站链接导入视频
          </div>
          <div className="flex gap-2">
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="粘贴 YouTube / B站 / Vimeo / 公开视频页链接"
              className="h-9 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button onClick={handleLinkImport} className="grid h-9 w-9 place-items-center rounded-md bg-primary text-white hover:bg-[#106EBE]" aria-label="解析链接">
              <Link2 className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">{linkStatus}</p>
        </div>

        <div className="mt-4 space-y-3">
          {uploads.length === 0 && (
            <div className="rounded-md border border-dashed border-line bg-white p-4 text-center text-xs text-slate-500">暂无上传任务，播放器会保持固定黑色底框。</div>
          )}
          {uploads.map((item) => (
            <div key={item.id} className="rounded-md border border-line bg-white p-3">
              <div className="flex items-center gap-3">
                <FileVideo className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.size} / {statusLabel[item.status]}
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
            <h2 className="text-sm font-semibold text-ink">AI 处理流水线</h2>
            <p className="text-xs text-slate-500">后台异步任务 + WebSocket 实时状态更新</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasWorkspaceData ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"}`}>
            {hasWorkspaceData ? "Live" : "Idle"}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {stages.map((stage, index) => {
            const progress = hasWorkspaceData ? stage.progress : 0;
            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-md border border-line bg-[#FBFCFE] p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">{stage.label}</span>
                  <span className="font-mono text-[11px] text-slate-500">{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                </div>
                <p className="mt-3 text-[11px] leading-4 text-slate-500">{hasWorkspaceData ? stage.detail : "等待上传或链接导入后启动。"}</p>
              </motion.div>
            );
          })}
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
  done: "已完成",
};
