# AI 处理流程

1. 上传与任务创建：校验 mp4 / mov / mkv / avi，写入视频表并创建后台任务。
2. 视频抽帧：OpenCV 按固定 fps 与 UI 变化点抽帧。
3. ASR：Whisper 生成带时间戳转写，提取软件术语、快捷键口述和操作意图。
4. OCR：PaddleOCR 提取菜单、工具栏、图层面板、参数窗口、弹窗文字。
5. 界面识别：YOLO 识别 Photoshop 菜单、工具栏、图层面板、参数窗口与光标轨迹。
6. 操作行为分析：将帧、语音、OCR、UI 标签按时间轴对齐为 operation segment。
7. Skill 生成：GPT 多模态归纳为专业 SOP，不输出口语摘要，输出结构化 JSON。
8. 图谱更新：ChromaDB 做语义聚类，Neo4j 建立父子、变体、证据关系，Elasticsearch 建立检索索引。
