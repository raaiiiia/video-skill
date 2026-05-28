import { Bell, CloudUpload, Search, Settings2, UserRound } from "lucide-react";

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  onOpenSystem: () => void;
}

export function Header({ query, onQueryChange, onOpenSystem }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-white/88 px-5 shadow-command backdrop-blur-xl">
      <div className="flex min-w-[250px] items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-semibold text-white shadow-command">SK</div>
        <div>
          <h1 className="text-[15px] font-semibold text-ink">AI Video Skill Tree</h1>
          <p className="text-xs text-slate-500">创意软件技能提取平台</p>
        </div>
      </div>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          aria-label="搜索 Skill"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索：如何快速压高光、Ctrl+M、蒙版、Blend If..."
          className="h-10 w-full rounded-md border border-line bg-[#F8FAFC] pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
        />
      </div>
      <button className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white shadow-command transition hover:bg-[#106EBE]">
        <CloudUpload className="h-4 w-4" />
        上传
      </button>
      <button onClick={onOpenSystem} className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        <Settings2 className="h-4 w-4" />
        系统
      </button>
      <button aria-label="通知" className="grid h-10 w-10 place-items-center rounded-md border border-line bg-white text-slate-600 hover:bg-slate-50">
        <Bell className="h-4 w-4" />
      </button>
      <button aria-label="用户" className="grid h-10 w-10 place-items-center rounded-md border border-line bg-white text-slate-600 hover:bg-slate-50">
        <UserRound className="h-4 w-4" />
      </button>
    </header>
  );
}
