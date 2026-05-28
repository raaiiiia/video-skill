import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, MousePointerClick, Play, Sparkles, VideoOff } from "lucide-react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import type { Skill, UploadItem } from "../types";
import { formatTime } from "../lib/skillEngine";

interface VideoSkillSyncProps {
  skills: Skill[];
  activeSkill: Skill | null;
  currentTime: number;
  videoSource: string | null;
  videoEmbedUrl?: string;
  sourceKind?: UploadItem["sourceKind"];
  videoType?: string;
  onTimeChange: (seconds: number) => void;
  onSelectSkill: (skill: Skill) => void;
}

export function VideoSkillSync({ skills, activeSkill, currentTime, videoSource, videoEmbedUrl, sourceKind, videoType, onTimeChange, onSelectSkill }: VideoSkillSyncProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const isWebpageVideo = sourceKind === "webpage";
  const hasVideo = Boolean(videoSource);
  const hasEmbeddedVideo = Boolean(isWebpageVideo && videoEmbedUrl);

  const handleTimeUpdate = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    onTimeChange(player.currentTime() ?? 0);
  }, [onTimeChange]);

  useEffect(() => {
    if (isWebpageVideo) {
      playerRef.current?.pause();
      playerRef.current?.reset();
      setMediaError(null);
      return;
    }

    if (!videoRef.current || !videoSource) return;

    const player =
      playerRef.current ??
      videojs(videoRef.current, {
        controls: true,
        fluid: false,
        fill: true,
        preload: "metadata",
      });

    function handlePlayerError() {
      setMediaError("视频没有加载成功。常见原因是链接不是视频文件直链、站点禁止跨域播放、需要登录授权，或当前浏览器不支持该编码格式。");
    }

    playerRef.current = player;
    setMediaError(null);
    player.pause();
    player.reset();
    player.error(undefined);
    player.src(videoType ? { src: videoSource, type: videoType } : { src: videoSource });
    player.on("timeupdate", handleTimeUpdate);
    player.on("error", handlePlayerError);

    return () => {
      player.off("timeupdate", handleTimeUpdate);
      player.off("error", handlePlayerError);
      player.pause();
      player.reset();
    };
  }, [handleTimeUpdate, isWebpageVideo, videoSource, videoType]);

  useEffect(() => {
    return () => {
      playerRef.current?.pause();
      playerRef.current?.reset();
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  function jumpTo(skill: Skill) {
    onSelectSkill(skill);
    if (!playerRef.current || isWebpageVideo) return;
    playerRef.current.currentTime(skill.start);
    void playerRef.current.play();
  }

  return (
    <section className="grid min-h-[650px] gap-4 xl:grid-cols-[minmax(0,1.35fr)_420px]">
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-command">
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">视频播放与操作识别</h2>
            <p className="text-[11px] text-slate-500">播放器只加载当前视频源；切换视频时会清理临时对象 URL</p>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(currentTime)}
          </div>
        </div>

        <div className="bg-[#05070B] p-4">
          <div className="relative grid aspect-video min-h-[360px] overflow-hidden rounded-md bg-black ring-1 ring-white/10">
            {hasEmbeddedVideo ? (
              <iframe
                src={videoEmbedUrl}
                title="Embedded video"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : hasVideo && isWebpageVideo ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-white/8 ring-1 ring-white/12">
                  <VideoOff className="h-6 w-6 text-white/65" />
                </div>
                <p className="mt-4 text-sm font-semibold text-white">网页链接已记录</p>
                <p className="mt-1 max-w-md text-xs leading-5 text-white/52">该平台暂不能只靠前端嵌入播放或解析。系统不会下载视频，也不会伪造 skill；需要真实后端、平台 API、字幕或视觉分析结果写入。</p>
              </div>
            ) : hasVideo ? (
              <video ref={videoRef} className="video-js vjs-big-play-centered h-full w-full" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-white/8 ring-1 ring-white/12">
                  <VideoOff className="h-6 w-6 text-white/65" />
                </div>
                <p className="mt-4 text-sm font-semibold text-white">等待视频输入</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-white/52">选择本地视频、粘贴媒体直链或支持嵌入的视频网页链接后，播放器会在这里加载视频。</p>
              </div>
            )}
          </div>
          {mediaError && <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{mediaError}</p>}
          {hasEmbeddedVideo && <p className="mt-3 rounded-md border border-line bg-white/5 px-3 py-2 text-xs leading-5 text-white/70">网页播放器由原平台加载，本站只保存链接和嵌入地址。跨域 iframe 不能直接读取逐帧画面或播放时间，Skill 生成仍需要真实后端/API 结果。</p>}
        </div>

        <div className="grid gap-3 border-t border-line p-4 md:grid-cols-3">
          {recognitionCards.map((card) => (
            <div key={card.title} className="min-h-[86px] rounded-md border border-line bg-[#FBFCFE] p-3">
              <p className="text-xs font-semibold text-ink">{card.title}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{hasVideo ? card.ready : "暂无视频，等待真实识别结果。"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white shadow-command">
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <h2 className="text-sm font-semibold text-ink">Skill 实时显示面板</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">Live</span>
        </div>
        <div className="space-y-3 p-4">
          {skills.length === 0 && (
            <div className="grid min-h-[470px] place-items-center rounded-md border border-dashed border-line bg-[#FBFCFE] p-6 text-center">
              <div>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10">
                  <Play className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-ink">还没有真实 Skill</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">当前版本不会自动填充演示 skill。只有真实解析结果写入后，这里才会显示对应片段。</p>
              </div>
            </div>
          )}

          {skills.map((skill, index) => {
            const active = skill.id === activeSkill?.id;
            return (
              <motion.button
                key={skill.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => jumpTo(skill)}
                className={`w-full rounded-md border p-3 text-left transition ${
                  active ? "border-primary bg-primary/5 shadow-command" : "border-line bg-white hover:border-primary/50 hover:bg-slate-50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-primary">{skill.timestamp}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{skill.level}</span>
                </div>
                <p className="text-sm font-semibold text-ink">{skill.skill_name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{skill.description}</p>
                {active && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-md bg-white p-3 ring-1 ring-primary/15">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink">
                      <MousePointerClick className="h-3.5 w-3.5 text-primary" />
                      当前操作步骤
                    </p>
                    <ol className="space-y-1">
                      {skill.steps.map((step) => (
                        <li key={step} className="text-xs text-slate-600">
                          - {step}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      置信度 {(skill.confidence * 100).toFixed(0)}% / 质量 {skill.quality}
                    </div>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const recognitionCards = [
  {
    title: "界面识别",
    ready: "视频已加载；等待真实视觉识别结果。",
  },
  {
    title: "操作行为",
    ready: "视频已加载；尚未写入真实操作片段。",
  },
  {
    title: "快捷键与参数",
    ready: "视频已加载；尚未写入真实参数证据。",
  },
];
