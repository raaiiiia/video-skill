export interface SkillKnowledgeTopic {
  id: string;
  software: string;
  category: string;
  names: string[];
  intents: string[];
  tools: string[];
  shortcuts: string[];
  parameters: string[];
  tags: string[];
}

export const skillKnowledgeTopics: SkillKnowledgeTopic[] = [
  {
    id: "sky_replacement",
    software: "Photoshop",
    category: "合成",
    names: ["快速抠图换天空", "天空替换", "换天空", "背景替换", "风景合成"],
    intents: ["替换天空", "抠出天空", "统一光色", "让天空更自然", "合成风景照片"],
    tools: ["天空替换", "选择主体", "对象选择工具", "快速选择工具", "图层蒙版", "选择并遮住", "Camera Raw", "曲线"],
    shortcuts: ["W", "Q", "B", "Ctrl+T", "Ctrl+M"],
    parameters: ["Shift Edge", "Fade Edge", "Brightness", "Temperature", "Scale", "Foreground Lighting"],
    tags: ["抠图", "换天空", "合成", "蒙版", "调色"],
  },
  {
    id: "select_subject",
    software: "Photoshop",
    category: "选择",
    names: ["主体选择与精修边缘", "选择主体", "对象选择", "智能抠图", "发丝抠图"],
    intents: ["自动选主体", "抠人物", "抠产品", "处理发丝边缘", "精修选区"],
    tools: ["选择主体", "对象选择工具", "快速选择工具", "选择并遮住", "调整边缘画笔", "魔棒工具"],
    shortcuts: ["W", "Ctrl+D", "Shift+Ctrl+I"],
    parameters: ["添加到选区", "从选区减去", "平滑", "羽化", "对比度", "净化颜色"],
    tags: ["抠图", "选区", "主体", "边缘"],
  },
  {
    id: "mask_compositing",
    software: "Photoshop",
    category: "合成",
    names: ["蒙版与局部合成控制", "图层蒙版", "选择区合成", "局部调整"],
    intents: ["隐藏局部", "显示局部", "无损合成", "边缘过渡", "只调整一部分"],
    tools: ["图层蒙版", "画笔工具", "选择工具", "快速蒙版", "Alpha 通道", "调整图层"],
    shortcuts: ["B", "Q", "X", "Ctrl+D", "Shift+Ctrl+I"],
    parameters: ["不透明度", "羽化", "密度", "流量", "黑白灰蒙版"],
    tags: ["蒙版", "合成", "局部调整", "选择区"],
  },
  {
    id: "content_aware_fill",
    software: "Photoshop",
    category: "修复",
    names: ["内容识别填充去除物体", "内容感知填充", "删除并填充", "去除杂物"],
    intents: ["删除物体", "补背景", "清理画面", "去路人", "去瑕疵", "移除干扰元素"],
    tools: ["内容识别填充", "套索工具", "对象选择工具", "修复画笔", "污点修复画笔", "仿制图章"],
    shortcuts: ["L", "J", "S", "Shift+F5"],
    parameters: ["取样区域", "扩展选区", "收缩选区", "输出到新图层", "颜色适应", "旋转适应", "缩放"],
    tags: ["修复", "去除", "填充", "清理"],
  },
  {
    id: "color_grading",
    software: "Photoshop",
    category: "调色",
    names: ["曲线与 Camera Raw 调色", "整体调色", "肤色校正", "光色统一"],
    intents: ["压高光", "提亮阴影", "统一色调", "调整曝光", "增强质感", "匹配前景和背景"],
    tools: ["Camera Raw", "曲线", "色相饱和度", "色彩平衡", "可选颜色", "调整图层"],
    shortcuts: ["Ctrl+M", "Ctrl+U", "Ctrl+L"],
    parameters: ["曝光", "高光", "阴影", "白平衡", "HSL", "色温", "对比度"],
    tags: ["调色", "曲线", "Camera Raw", "曝光"],
  },
  {
    id: "portrait_retouch",
    software: "Photoshop",
    category: "人像",
    names: ["人像皮肤质感修饰", "磨皮修图", "瑕疵清理", "高低频修图"],
    intents: ["去痘印", "保留皮肤纹理", "修皮肤", "统一肤色", "人像精修"],
    tools: ["污点修复画笔", "修复画笔", "仿制图章", "高低频", "蒙版", "混合选项"],
    shortcuts: ["J", "S", "B", "Ctrl+J"],
    parameters: ["取样当前和下方", "画笔硬度", "不透明度", "高频纹理", "低频颜色"],
    tags: ["人像", "修图", "磨皮", "皮肤"],
  },
  {
    id: "liquify_shape",
    software: "Photoshop",
    category: "塑形",
    names: ["液化与形体微调", "脸部液化", "局部塑形"],
    intents: ["调整轮廓", "修正比例", "微调五官", "推拉局部", "保持自然形体"],
    tools: ["液化", "向前变形工具", "冻结蒙版工具", "脸部识别液化"],
    shortcuts: ["Shift+Ctrl+X", "B"],
    parameters: ["画笔大小", "压力", "密度", "冻结区域", "重建"],
    tags: ["液化", "塑形", "人像", "局部调整"],
  },
  {
    id: "blend_if",
    software: "Photoshop",
    category: "混合",
    names: ["Blend If 图层混合控制", "混合颜色带", "高光阴影混合"],
    intents: ["按亮度融合", "隐藏高光", "保留阴影", "纹理叠加", "自然混合"],
    tools: ["图层样式", "混合选项", "Blend If", "曲线", "蒙版"],
    shortcuts: ["Alt", "Ctrl+J"],
    parameters: ["本图层", "下一图层", "高光滑块", "阴影滑块", "拆分滑块"],
    tags: ["混合", "图层样式", "高光", "阴影"],
  },
  {
    id: "detail_sharpen",
    software: "Photoshop",
    category: "输出",
    names: ["细节锐化与导出", "高反差保留锐化", "网页导出"],
    intents: ["增强细节", "导出清晰图片", "压缩前锐化", "保持边缘清楚"],
    tools: ["高反差保留", "智能锐化", "USM 锐化", "导出为", "存储为 Web 所用格式"],
    shortcuts: ["Ctrl+Alt+Shift+S", "Ctrl+J"],
    parameters: ["半径", "数量", "阈值", "混合模式", "导出尺寸", "质量"],
    tags: ["锐化", "导出", "细节", "输出"],
  },
  {
    id: "binary_search",
    software: "算法",
    category: "查找",
    names: ["二分查找边界判断", "二分查找", "折半查找", "有序数组查找"],
    intents: ["缩小搜索区间", "查找目标值", "处理左右边界", "定位第一个或最后一个位置"],
    tools: ["left", "right", "mid", "while 循环", "有序数组", "边界条件"],
    shortcuts: [],
    parameters: ["闭区间", "左闭右开", "mid 计算", "循环不变量", "返回条件"],
    tags: ["算法", "查找", "边界", "数组"],
  },
  {
    id: "dynamic_programming",
    software: "算法",
    category: "动态规划",
    names: ["动态规划状态转移设计", "DP", "状态转移", "背包问题", "最长子序列"],
    intents: ["定义状态", "写状态转移方程", "初始化边界", "压缩空间复杂度"],
    tools: ["dp 数组", "状态方程", "递推", "记忆化搜索", "二维表"],
    shortcuts: [],
    parameters: ["状态定义", "转移方程", "初始值", "遍历顺序", "复杂度"],
    tags: ["算法", "动态规划", "递推", "复杂度"],
  },
  {
    id: "python_debugging",
    software: "Python",
    category: "开发调试",
    names: ["Python 脚本运行与调试", "断点调试", "异常排查", "虚拟环境运行"],
    intents: ["运行脚本", "定位报错", "查看变量", "安装依赖", "复现问题"],
    tools: ["VS Code", "终端", "debugger", "breakpoint", "pip", "venv", "pytest"],
    shortcuts: ["F5", "F9", "Ctrl+`"],
    parameters: ["解释器路径", "环境变量", "断点", "调用栈", "依赖版本"],
    tags: ["Python", "调试", "脚本", "测试"],
  },
  {
    id: "spreadsheet_analysis",
    software: "Excel",
    category: "数据分析",
    names: ["Excel 数据透视与公式分析", "数据透视表", "公式清洗", "图表分析"],
    intents: ["汇总数据", "筛选分类", "计算指标", "制作图表", "清洗表格"],
    tools: ["数据透视表", "筛选", "排序", "VLOOKUP", "XLOOKUP", "SUMIFS", "图表"],
    shortcuts: ["Ctrl+T", "Alt+D", "Ctrl+Shift+L"],
    parameters: ["行字段", "列字段", "值字段", "筛选器", "公式引用", "聚合方式"],
    tags: ["Excel", "表格", "公式", "数据分析"],
  },
  {
    id: "sql_querying",
    software: "SQL",
    category: "查询分析",
    names: ["SQL 查询与聚合分析", "多表 Join", "分组统计", "窗口函数"],
    intents: ["筛选数据", "关联表", "分组聚合", "计算排名", "写分析查询"],
    tools: ["SELECT", "WHERE", "JOIN", "GROUP BY", "ORDER BY", "窗口函数", "CTE"],
    shortcuts: [],
    parameters: ["连接键", "过滤条件", "聚合函数", "分区字段", "排序字段"],
    tags: ["SQL", "数据库", "聚合", "分析"],
  },
  {
    id: "git_workflow",
    software: "Git",
    category: "版本控制",
    names: ["Git 分支提交与冲突处理", "提交代码", "合并分支", "解决冲突"],
    intents: ["创建分支", "提交修改", "查看差异", "合并代码", "处理冲突"],
    tools: ["git status", "git diff", "git add", "git commit", "git merge", "git rebase"],
    shortcuts: [],
    parameters: ["分支名", "提交信息", "冲突文件", "远程仓库", "变更范围"],
    tags: ["Git", "版本控制", "分支", "冲突"],
  },
];

const normalize = (value: string) => value.trim().toLowerCase();
const splitTerms = (value: string) => normalize(value).split(/[\s,，、。；;:：/|]+/).filter(Boolean);

export function expandSearchTerms(query: string) {
  const normalized = normalize(query);
  if (!normalized) return [];

  const rawTerms = splitTerms(query);
  const expanded = new Set([normalized, ...rawTerms]);

  skillKnowledgeTopics.forEach((topic) => {
    const fields = [
      topic.software,
      topic.category,
      ...topic.names,
      ...topic.intents,
      ...topic.tools,
      ...topic.shortcuts,
      ...topic.parameters,
      ...topic.tags,
    ];
    const matches = fields.some((term) => {
      const lower = normalize(term);
      return lower.includes(normalized) || normalized.includes(lower) || rawTerms.some((raw) => lower.includes(raw) || raw.includes(lower));
    });
    if (matches) fields.forEach((term) => expanded.add(normalize(term)));
  });

  return [...expanded].filter(Boolean);
}

export function rankKnowledgeTopics(text: string) {
  const normalized = normalize(text);
  if (!normalized) return [];

  return skillKnowledgeTopics
    .map((topic) => {
      let score = 0;
      const groups = [
        { values: topic.names, weight: 18 },
        { values: topic.intents, weight: 14 },
        { values: topic.tools, weight: 12 },
        { values: topic.tags, weight: 10 },
        { values: topic.parameters, weight: 8 },
        { values: topic.shortcuts, weight: 6 },
      ];

      groups.forEach((group) => {
        group.values.forEach((value) => {
          const lower = normalize(value);
          if (lower && normalized.includes(lower)) score += group.weight;
        });
      });

      return { topic, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}
