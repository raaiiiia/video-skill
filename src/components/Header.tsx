import { CloudUpload, LogIn, Search, Settings2, UserRound } from "lucide-react";

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onOpenSystem: () => void;
  accountName?: string;
  onOpenAuth: () => void;
}

export function Header({ query, onQueryChange, onSearch, onOpenSystem, accountName, onOpenAuth }: HeaderProps) {
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
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
          placeholder="搜索：如何快速压高光、Ctrl+M、蒙版、Blend If..."
          className="h-10 w-full rounded-md border border-line bg-[#F8FAFC] pl-10 pr-24 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="button"
          aria-label="执行搜索"
          onClick={onSearch}
          className="absolute right-1.5 top-1/2 flex h-7 -translate-y-1/2 items-center gap-1.5 rounded bg-primary px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#106EBE]"
        >
          <Search className="h-3.5 w-3.5" />
          搜索
        </button>
      </div>
      <button className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white shadow-command transition hover:bg-[#106EBE]">
        <CloudUpload className="h-4 w-4" />
        上传
      </button>
      <button onClick={onOpenSystem} className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        <Settings2 className="h-4 w-4" />
        系统
      </button>
      <button
        type="button"
        onClick={onOpenAuth}
        className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <LogIn className="h-4 w-4" />
        注册/登录
      </button>
      <button
        type="button"
        aria-label="个人账号"
        onClick={onOpenAuth}
        className="flex h-10 min-w-[132px] items-center gap-2 rounded-md border border-line bg-white px-3 text-left text-slate-700 hover:bg-slate-50"
      >
        <UserRound className="h-4 w-4" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-ink">{accountName ?? "个人账号"}</span>
          <span className="block text-[10px] leading-3 text-slate-500">{accountName ? "已登录" : "未登录"}</span>
        </span>
      </button>
    </header>
  );
}
