import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Folder, FolderOpen, MoreHorizontal, Pencil, Plus, SplitSquareHorizontal } from "lucide-react";
import type { SkillNode } from "../types";

interface SkillTreeProps {
  nodes: SkillNode[];
  selectedSkillId?: string;
  onSelectSkill: (skillId: string) => void;
}

export function SkillTree({ nodes, selectedSkillId, onSelectSkill }: SkillTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["ps", "retouch", "color", "layers", "exposure"]));
  const [menuNode, setMenuNode] = useState<string | null>(null);

  const rendered = useMemo(
    () =>
      nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          selectedSkillId={selectedSkillId}
          menuNode={menuNode}
          onToggle={(id) =>
            setExpanded((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })
          }
          onSelectSkill={onSelectSkill}
          onMenu={setMenuNode}
        />
      )),
    [expanded, menuNode, nodes, onSelectSkill, selectedSkillId],
  );

  return (
    <aside className="h-full overflow-hidden rounded-lg border border-line bg-white shadow-command">
      <div className="flex h-11 items-center justify-between border-b border-line px-2.5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Skill 导航树</h2>
          <p className="text-[10px] text-slate-500">Explorer 层级 / 可拖拽归类</p>
        </div>
        <button aria-label="新增节点" className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100">
          <Plus className="h-4 w-4 text-slate-500" />
        </button>
      </div>
      <div className="h-[calc(100%-44px)] overflow-hidden p-1.5">
        {nodes.length === 0 ? (
          <div className="grid h-full min-h-0 place-items-center rounded-md border border-dashed border-line bg-[#FBFCFE] p-6 text-center">
            <div>
              <Folder className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-ink">暂无知识树</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">上传视频或导入链接后，Skill 会自动聚类到软件、任务、工具和高级变体层级中。</p>
            </div>
          </div>
        ) : (
          rendered
        )}
      </div>
    </aside>
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  selectedSkillId,
  menuNode,
  onToggle,
  onSelectSkill,
  onMenu,
}: {
  node: SkillNode;
  depth: number;
  expanded: Set<string>;
  selectedSkillId?: string;
  menuNode: string | null;
  onToggle: (id: string) => void;
  onSelectSkill: (skillId: string) => void;
  onMenu: (id: string | null) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expanded.has(node.id);
  const selected = node.skillId === selectedSkillId;

  return (
    <div>
      <div
        draggable
        onDoubleClick={() => node.skillId && onSelectSkill(node.skillId)}
        onClick={() => (hasChildren ? onToggle(node.id) : node.skillId && onSelectSkill(node.skillId))}
        onContextMenu={(event) => {
          event.preventDefault();
          onMenu(menuNode === node.id ? null : node.id);
        }}
        className={`group relative flex h-7 cursor-default select-none items-center gap-1 rounded px-1 text-xs transition ${
          selected ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-100"
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <ChevronRight className={`h-3 w-3 transition ${hasChildren && isExpanded ? "rotate-90" : ""} ${hasChildren ? "opacity-100" : "opacity-0"}`} />
        {hasChildren && isExpanded ? <FolderOpen className="h-3.5 w-3.5 text-[#C8972C]" /> : <Folder className="h-3.5 w-3.5 text-[#C8972C]" />}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{node.count}</span>
        <button aria-label={`打开 ${node.name} 菜单`} className="grid h-5 w-5 place-items-center rounded opacity-0 hover:bg-white group-hover:opacity-100">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {menuNode === node.id && (
          <div className="absolute right-2 top-7 z-20 w-40 rounded-md border border-line bg-white p-1 shadow-fluent">
            <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100">
              <Pencil className="h-3.5 w-3.5" /> 重命名
            </button>
            <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100">
              <SplitSquareHorizontal className="h-3.5 w-3.5" /> 合并相似节点
            </button>
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }}>
            {node.children!.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                selectedSkillId={selectedSkillId}
                menuNode={menuNode}
                onToggle={onToggle}
                onSelectSkill={onSelectSkill}
                onMenu={onMenu}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
