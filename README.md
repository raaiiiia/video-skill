# AI 视频技能提取与知识树构建平台

产品原型级 Demo，面向设计师、数字媒体从业者，以及 Photoshop / Illustrator / Lightroom 学习者。

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

## Demo 覆盖能力

- 拖拽上传区、批量上传进度、视频处理流水线
- Video.js 播放器与 Skill 时间轴同步
- Windows Explorer 风格知识树：展开、折叠、右键菜单、节点统计、拖拽占位
- 自然语言搜索、标签/快捷键/意图检索
- Skill JSON 结构、质量评分、置信度成长模型
- FastAPI API、WebSocket 任务推送、AI 处理流程、数据库结构文档
