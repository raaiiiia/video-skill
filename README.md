# AI 视频技能提取与知识树构建平台

产品原型级 Demo，面向设计师、数字媒体从业者、算法学习者，以及各类软件操作学习者。平台可从视频链接、转写、OCR、画面描述和人工备注中抽取可复核证据，再生成 Skill。

线上访问：https://video-skill.vercel.app

## 项目结构

```text
.
├── src/                         # React + TypeScript 前端
│   ├── components/              # 上传、知识树、视频同步、搜索、优化、架构面板
│   ├── data/mockData.ts         # Demo 数据：视频、Skill、知识树、AI 流水线
│   ├── lib/skillEngine.ts       # 搜索、时间同步、自优化评分逻辑
│   ├── App.tsx
│   └── styles.css
├── backend/                     # FastAPI 后端骨架
│   ├── app/
│   │   ├── api.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── services/
│   └── requirements.txt
├── docs/
│   ├── ai-pipeline.md
│   ├── database-schema.sql
│   └── knowledge-optimization.md
└── package.json
```

## 运行前端

```bash
npm install
npm run dev
```

## 运行后端骨架

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 在线视频解析与技能证据

后端不会直接下载整段视频来“猜”技能。它会先收集可审计证据，再从证据中抽取修图、算法、代码调试、表格分析、SQL、Git 等操作候选项，最后生成 Skill。证据来源包括：

- iiiLab 返回的标题、描述、可播放地址
- 小红书、B 站、YouTube 等网页链接的公开来源信息
- 人工备注
- 字幕或转写文本
- 界面 OCR 文本
- 画面变化描述
- 其他手动补充的技能证据

小红书链接会被前端识别为“网页视频”，后端也会把 `xiaohongshu.com`、`xhslink.com`、`xhs.cn` 域名纳入公开来源证据。原有 iiiLab 接入可以继续使用；只要你配置的 `IIILAB_API_ENDPOINT` 支持小红书解析，后端会把它返回的标题、描述和可播放地址写入证据链。如果 iiiLab 暂时解析失败，系统仍会保留链接元数据，并提示补充转写、OCR、画面描述或人工技能证据。

如果证据里没有明确的操作词，例如“二分查找”“动态规划”“运行调试”“数据透视表”“SQL 聚合”“蒙版”“曲线”，后端会返回 `needs_skill_evidence`，前端会显示需要补充的证据建议。

### Vercel 环境变量

在 Vercel Project Settings -> Environment Variables 里配置 Production 环境变量：

```bash
IIILAB_API_ENDPOINT=https://your-iiilab-api-endpoint
IIILAB_CLIENT_ID=your-client-id
IIILAB_CLIENT_SECRET=your-client-secret
# 可选：
IIILAB_API_TOKEN=optional-token
IIILAB_API_KEY=optional-key
```

本地运行 FastAPI 前也需要设置同名环境变量。公开视频解析网页不会被前端直接抓取；所有解析请求都从后端发起，避免把密钥暴露到浏览器。

### 新增 API

```text
POST /api/videos/analyze-link
GET  /api/jobs/{job_id}
GET  /api/jobs/{job_id}/evidence
GET  /api/jobs/{job_id}/operations
GET  /api/skills
```

`POST /api/videos/analyze-link` 支持 `source_url`、`source_kind`、`transcript_text`、`ocr_text`、`visual_notes`、`user_note`、`evidence_text`、`software`、`target_level`。响应会返回 `evidence_score`、`evidence`、`operations`、`skills` 和 `suggestions`。

## Demo 覆盖能力

- 拖拽上传区、批量上传进度、视频处理流水线
- Video.js 播放器与 Skill 时间轴同步
- Windows Explorer 风格知识树：展开、折叠、右键菜单、节点统计、拖拽占位
- 自然语言搜索、标签/快捷键/意图检索
- Skill JSON 结构、质量评分、置信度成长模型
- FastAPI API、WebSocket 任务推送、AI 处理流程、数据库结构文档
