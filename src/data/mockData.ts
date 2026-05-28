import type { PipelineStage, Skill, SkillNode, UploadItem } from "../types";

export const pipelineStages: PipelineStage[] = [
  { id: "frames", label: "视频抽帧", detail: "2 fps 关键帧采样，保留 UI 状态变化", progress: 100 },
  { id: "asr", label: "Whisper ASR", detail: "分离旁白、快捷键口述与术语片段", progress: 86 },
  { id: "ocr", label: "PaddleOCR", detail: "读取菜单、图层名、参数窗口与提示文字", progress: 72 },
  { id: "vision", label: "YOLO + OpenCV", detail: "识别工具栏、面板区域、光标轨迹和弹窗", progress: 64 },
  { id: "graph", label: "GPT 多模态归纳", detail: "生成 SOP 节点、父子层级与相似技能聚类", progress: 48 },
];

export const uploads: UploadItem[] = [
  { id: "u1", name: "portrait-retouch-curve-mask.mp4", size: "842 MB", progress: 100, status: "done" },
  { id: "u2", name: "camera-raw-highlight-recovery.mov", size: "516 MB", progress: 78, status: "vision" },
  { id: "u3", name: "blend-if-luminosity-control.mkv", size: "1.1 GB", progress: 46, status: "ocr" },
];

export const skills: Skill[] = [
  {
    id: "skill_001",
    software: "Photoshop",
    skill_name: "利用曲线与蒙版实现局部曝光控制",
    level: "Intermediate",
    tags: ["曲线", "蒙版", "曝光调整"],
    description: "使用曲线调整层结合黑色蒙版，通过画笔限定亮度提升区域，避免全局曝光漂移。",
    steps: ["创建曲线调整层", "提升高光与中间调曲线", "反相为黑色蒙版", "使用低流量白色画笔恢复目标区域"],
    shortcut: ["Ctrl+M", "Ctrl+I", "B"],
    timestamp: "03:12-04:25",
    start: 192,
    end: 265,
    confidence: 0.92,
    quality: 94,
    evidenceCount: 7,
    parentId: "exposure-local",
  },
  {
    id: "skill_002",
    software: "Photoshop",
    skill_name: "Camera Raw 高光恢复与阴影细节平衡",
    level: "Intermediate",
    tags: ["Camera Raw", "高光", "阴影", "动态范围"],
    description: "通过 Camera Raw 压低高光并提升阴影细节，同时控制白色色阶以保留画面动态范围。",
    steps: ["打开 Camera Raw 滤镜", "降低高光滑块", "提升阴影滑块", "微调白色与黑色色阶", "使用纹理与清晰度恢复局部质感"],
    shortcut: ["Ctrl+Shift+A"],
    timestamp: "04:28-05:36",
    start: 268,
    end: 336,
    confidence: 0.89,
    quality: 91,
    evidenceCount: 6,
    parentId: "exposure-raw",
  },
  {
    id: "skill_003",
    software: "Photoshop",
    skill_name: "Blend If 控制亮部作用范围",
    level: "Advanced",
    tags: ["Blend If", "图层样式", "亮度蒙版"],
    description: "在图层样式中拆分 Blend If 滑块，让曲线调整只作用于亮部过渡区域，减少硬边和光晕。",
    steps: ["打开调整层图层样式", "定位 Blend If 本图层亮度滑块", "按 Alt 拆分滑块", "限定亮部响应区间", "检查边缘过渡是否自然"],
    shortcut: ["Alt + 拖动"],
    timestamp: "06:10-07:42",
    start: 370,
    end: 462,
    confidence: 0.84,
    quality: 88,
    evidenceCount: 4,
    parentId: "exposure-blendif",
    variantOf: "skill_001",
  },
  {
    id: "skill_004",
    software: "Photoshop",
    skill_name: "钢笔工具精确抠图路径建立",
    level: "Beginner",
    tags: ["钢笔工具", "路径", "抠图"],
    description: "通过少量锚点和手柄控制建立干净路径，再转换为选区生成高质量主体蒙版。",
    steps: ["选择钢笔工具", "沿主体边缘创建锚点", "调整贝塞尔手柄", "闭合路径", "载入选区并创建蒙版"],
    shortcut: ["P", "Ctrl+Enter"],
    timestamp: "01:06-02:22",
    start: 66,
    end: 142,
    confidence: 0.81,
    quality: 86,
    evidenceCount: 5,
  },
];

export const skillTree: SkillNode[] = [
  {
    id: "ps",
    name: "Photoshop",
    count: 8462,
    confidence: 0.88,
    children: [
      {
        id: "retouch",
        name: "修图",
        count: 3720,
        confidence: 0.9,
        children: [
          {
            id: "color",
            name: "色彩",
            count: 1280,
            confidence: 0.91,
            children: [
              { id: "curve", name: "曲线", count: 438, confidence: 0.93, skillId: "skill_001" },
              { id: "levels", name: "色阶", count: 216, confidence: 0.85 },
              { id: "acr", name: "Camera Raw", count: 331, confidence: 0.9, skillId: "skill_002" },
            ],
          },
          {
            id: "cutout",
            name: "抠图",
            count: 902,
            confidence: 0.84,
            children: [
              { id: "pen", name: "钢笔工具", count: 264, confidence: 0.81, skillId: "skill_004" },
              { id: "channel", name: "通道抠图", count: 188, confidence: 0.78 },
            ],
          },
        ],
      },
      {
        id: "layers",
        name: "图层",
        count: 2140,
        confidence: 0.86,
        children: [
          { id: "adjustment", name: "调整图层", count: 724, confidence: 0.9 },
          { id: "mask", name: "蒙版", count: 658, confidence: 0.89, skillId: "skill_001" },
          {
            id: "exposure",
            name: "曝光控制",
            count: 592,
            confidence: 0.92,
            children: [
              { id: "exposure-global", name: "全局曝光", count: 126, confidence: 0.79 },
              { id: "exposure-local", name: "局部曝光", count: 288, confidence: 0.92, skillId: "skill_001" },
              { id: "exposure-blendif", name: "Blend If 高级控制", count: 74, confidence: 0.84, skillId: "skill_003" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "ai",
    name: "Illustrator",
    count: 1240,
    confidence: 0.77,
    children: [
      { id: "ai-path", name: "路径", count: 420, confidence: 0.8, children: [{ id: "ai-pen", name: "钢笔工具", count: 182, confidence: 0.78 }] },
      { id: "ai-shape", name: "图形", count: 516, confidence: 0.76, children: [{ id: "shape-builder", name: "形状生成器", count: 148, confidence: 0.8 }] },
    ],
  },
  {
    id: "lr",
    name: "Lightroom",
    count: 1736,
    confidence: 0.82,
    children: [
      { id: "lr-light", name: "光线", count: 642, confidence: 0.84 },
      { id: "lr-color", name: "颜色分级", count: 388, confidence: 0.81 },
    ],
  },
];
