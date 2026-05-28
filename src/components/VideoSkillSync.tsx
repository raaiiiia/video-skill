import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Clock, MousePointerClick, Play, Sparkles, VideoOff } from "lucide-react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import type { Skill } from "../types";
import { formatTime } from "../lib/skillEngine";

interface VideoSkillSyncProps {
  skills: Skill[];
  activeSkill: Skill | null;
  currentTime: number;
  videoSource: string | null;
  onTimeChange: (seconds: number) => void;
  onSelectSkill: (skill: Skill) => void;
}

export function VideoSkillSync({ skills, activeSkill, currentTime, videoSource, onTimeChange, onSelectSkill }: VideoSkillSyncProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const hasVideo = Boolean(videoSource);

  const handleTimeUpdate = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    onTimeChange(player.currentTime() ?? 0);
  }, [onTimeChange]);

  useEffect(() => {
    if (!videoRef.current || !videoSource) return;

    const player =
      playerRef.current ??
      videojs(videoRef.current, {
        controls: true,
        fluid: false,
        fill: true,
        preload: "metadata",
      });

    playerRef.current = player;
    player.pause();
    player.reset();
    player.src({ src: videoSource, type: "video/mp4" });
    player.on("timeupdate", handleTimeUpdate);

    return () => {
      player.off("timeupdate", handleTimeUpdate);
      player.pause();
      player.reset();
    };
  }, [handleTimeUpdate, videoSource]);

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
    if (!playerRef.current) return;
    playerRef.current.currentTime(skill.start);
    void playerRef.current.play();
  }

  return (
    <section className="grid min-h-[650px] gap-4 xl:grid-cols-[minmax(0,1.35fr)_420px]">
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-command">
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">视频播放与操作识别</h2>
            <p className="text-[11px] text-slate-500">固定播放器画布，上传或链接导入后同步 Skill 时间轴</p>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(currentTime)}
          </div>
        </div>

        <div className="bg-[#05070B] p-4">
          <div className="relative grid aspect-video min-h-[360px] overflow-hidden rounded-md bg-black ring-1 ring-white/10">
            {hasVideo ? (
              <video ref={videoRef} className="video-js vjs-big-play-centered h-full w-full" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-white/8 ring-1 ring-white/12">
                  <VideoOff className="h-6 w-6 text-white/65" />
                </div>
                <p className="mt-4 text-sm font-semibold text-white">等待视频输入</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-white/52">上传本地视频或粘贴公开视频链接后，这里会在同一黑色底座内加载播放器，不再挤压下方识别菜单。</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 border-t border-line p-4 md:grid-cols-3">
          {recognitionCards.map((card) => (
            <div key={card.title} className="min-h-[86px] rounded-md border border-line bg-[#FBFCFE] p-3">
              <p className="text-xs font-semibold text-ink">{card.title}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{hasVideo ? card.ready : "暂无视频，等待识别结果"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white shadow-command">
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <h2 className="text-sm font-semibold text-ink">Skill 实时显示面板</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">Auto-scroll</span>
        </div>
        <div className="space-y-3 p-4">
          {skills.length === 0 && (
            <div className="grid min-h-[470px] place-items-center rounded-md border border-dashed border-line bg-[#FBFCFE] p-6 text-center">
              <div>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10">
                  <Play className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-ink">还没有生成 Skill</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">视频解析完成后，操作片段会按时间自动出现在这里，并与播放器时间同步。</p>
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
    ready: "Photoshop 菜单 / 工具栏 / 图层面板",
  },
  {
    title: "操作行为",
    ready: "曲线调整层 / 蒙版 / 画笔擦除",
  },
  {
    title: "快捷键与参数",
    ready: "Ctrl+M / B / Alt 拖动 / Blend If",
  },
];
