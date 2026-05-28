# Skill 自优化算法

## 聚类与合并

- 使用 Skill 标题、步骤、标签、视觉证据、ASR 片段生成 embedding。
- cosine similarity >= 0.88 视为相同技能候选。
- 0.74 - 0.88 视为相近技能，进入人工或 GPT 判别。
- 高级操作包含 Blend If、亮度蒙版、通道混合、频率分离等时，标记为变体升级候选。

## Confidence 模型

```text
confidence = min(
  0.99,
  0.6
  + repeated_count * 0.05
  + multi_video_verified * 0.1
  + advanced_operation_reference * 0.2
  + expert_correction * 0.3
)
```

## Quality 模型

- 术语专业度：0-25
- 步骤完整度：0-25
- 多源证据一致性：0-20
- 时间戳准确性：0-15
- 图谱层级稳定性：0-15

## 增量更新

- 新视频只处理新增片段。
- 受影响 Skill 重新计算 embedding 与 graph rank。
- 搜索索引只更新 changed skill ids。
- WebSocket 推送任务状态，前端局部刷新。
