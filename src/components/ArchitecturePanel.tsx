export function ArchitecturePanel() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-line bg-white p-4 shadow-command">
        <h2 className="text-sm font-semibold text-ink">后端 API 与数据库结构</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-[#0F172A] p-4 font-mono text-xs leading-6 text-slate-100">{`POST   /api/videos/upload
GET    /api/jobs/{job_id}
WS     /ws/jobs/{job_id}
GET    /api/skills?software=&level=&tag=
PATCH  /api/skills/{skill_id}
POST   /api/skills/{skill_id}/expert-review
GET    /api/search?q=如何快速压高光

PostgreSQL:
videos(id, filename, duration, status, created_at)
frames(id, video_id, ts, image_uri, ui_labels)
transcripts(id, video_id, start, end, text)
skills(id, software, name, level, description, confidence)
skill_steps(id, skill_id, index, text, shortcut, start, end)
skill_evidence(id, skill_id, video_id, source, weight)

Neo4j:
(Skill)-[:CHILD_OF]->(Category)
(Skill)-[:VARIANT_OF]->(Skill)
(Skill)-[:EVIDENCED_BY]->(Video)

ChromaDB:
collection: skill_embeddings
metadata: software, tags, level, quality, updated_at`}</pre>
      </div>
      <div className="rounded-lg border border-line bg-white p-4 shadow-command">
        <h2 className="text-sm font-semibold text-ink">AI 处理流程</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-[#0F172A] p-4 font-mono text-xs leading-6 text-slate-100">{`1. Ingest
   - 校验格式、生成 video_id、写入异步任务队列

2. Extract
   - OpenCV 抽帧
   - Whisper 生成时间戳转写
   - PaddleOCR 提取菜单/面板文字
   - YOLO 识别工具栏、图层面板、参数窗口

3. Align
   - 按时间轴对齐 frame + ASR + OCR + UI action
   - 归并为 operation segments

4. Generate Skill
   - GPT 将操作片段转为专业 SOP
   - 输出 JSON schema 并做术语规范化

5. Optimize Graph
   - embedding 相似度聚类
   - 合并重复节点
   - 识别高级变体
   - 更新 confidence / quality / tags

6. Serve
   - Elasticsearch 全文搜索
   - ChromaDB 语义搜索
   - Neo4j 知识树查询
   - WebSocket 推送任务状态`}</pre>
      </div>
    </section>
  );
}
