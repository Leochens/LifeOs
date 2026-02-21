import { useState } from "react";
import { useStore } from "@/stores/app";
import { scanGitRepos, pickVaultFolder, openInFinder } from "@/services/fs";

export default function GitScannerView() {
  const gitRepos = useStore((s) => s.gitRepos);
  const setGitRepos = useStore((s) => s.setGitRepos);

  const [scanRoot, setScanRoot] = useState("");
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<"all" | "clean" | "dirty">("all");
  const [maxDepth, setMaxDepth] = useState(5);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function handlePickFolder() {
    const folder = await pickVaultFolder();
    if (folder) setScanRoot(folder);
  }

  async function handleScan() {
    if (!scanRoot) return;
    setScanning(true);
    setError("");
    try {
      const repos = await scanGitRepos(scanRoot, maxDepth);
      setGitRepos(repos);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }

  function copyPath(path: string) {
    navigator.clipboard.writeText(path);
    setCopied(path);
    setTimeout(() => setCopied(null), 1500);
  }

  const filtered = gitRepos.filter((r) => {
    if (filter === "clean") return !r.has_uncommitted;
    if (filter === "dirty") return r.has_uncommitted;
    return true;
  });

  const dirtyCount = gitRepos.filter((r) => r.has_uncommitted).length;
  const cleanCount = gitRepos.length - dirtyCount;

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "clean", label: "干净" },
    { key: "dirty", label: "有改动" },
  ];

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div>
        <div className="text-accent tracking-[3px]" style={{ fontFamily: "var(--font-disp)", fontSize: 28 }}>
          GIT 仓库扫描器
        </div>
        <div className="text-sm text-text-dim mt-1">
          扫描本地目录，发现所有 Git 仓库及其状态。
        </div>
      </div>

      {/* Scan bar */}
      <div
        className="panel p-4 flex items-center gap-2.5"
      >
        <input
          className="input flex-1"
          placeholder="输入扫描路径，如 /Users/..."
          value={scanRoot}
          onChange={(e) => setScanRoot(e.target.value)}
        />
        <button className="btn btn-ghost" onClick={handlePickFolder}>
          选择文件夹
        </button>
        <select
          className="input w-[100px]"
          value={maxDepth}
          onChange={(e) => setMaxDepth(Number(e.target.value))}
        >
          <option value={3}>深度 3</option>
          <option value={5}>深度 5</option>
          <option value={8}>深度 8</option>
        </select>
        <button
          className="btn btn-primary"
          onClick={handleScan}
          disabled={scanning || !scanRoot}
        >
          {scanning ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full inline-block"
              />
              扫描中...
            </span>
          ) : (
            "开始扫描"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/12 border border-accent4 text-accent4 p-2.5 py-[10px] rounded-sm text-sm">
          {error}
        </div>
      )}

      {/* Stats bar */}
      {gitRepos.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="tag text-xs px-3 py-1">
            共 {gitRepos.length} 个仓库
          </span>
          <span className="tag orange text-xs px-3 py-1">
            {dirtyCount} 个有未提交改动
          </span>
          <span className="tag green text-xs px-3 py-1">
            {cleanCount} 个干净
          </span>
        </div>
      )}

      {/* Filter tabs */}
      {gitRepos.length > 0 && (
        <div className="flex gap-1.5">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              className={filter === t.key ? "btn btn-primary px-4 py-1.5" : "btn btn-ghost px-4 py-1.5"}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Repo grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((repo) => (
            <div
              key={repo.path}
              className="panel-inner p-4 flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {repo.name}
                </span>
                <span className="tag text-accent" style={{ background: "rgba(0,200,255,0.1)" }}>
                  {repo.branch}
                </span>
              </div>

              {repo.has_uncommitted && (
                <span className="tag orange self-start inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent5 inline-block" />
                  有改动
                </span>
              )}

              {repo.last_commit && (
                <div className="text-xs text-text-mid overflow-hidden text-ellipsis whitespace-nowrap">
                  {repo.last_commit.length > 40
                    ? repo.last_commit.slice(0, 40) + "..."
                    : repo.last_commit}
                </div>
              )}

              {repo.remote_url && (
                <div className="text-[11px] text-text-dim font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                  {repo.remote_url.length > 50
                    ? repo.remote_url.slice(0, 50) + "..."
                    : repo.remote_url}
                </div>
              )}

              <div className="flex gap-2 mt-auto pt-1">
                <button
                  className="btn btn-ghost flex-1 justify-center px-2.5 py-1.5 text-xs"
                  onClick={() => openInFinder(repo.path)}
                >
                  在 Finder 打开
                </button>
                <button
                  className="btn btn-ghost flex-1 justify-center px-2.5 py-1.5 text-xs"
                  onClick={() => copyPath(repo.path)}
                >
                  {copied === repo.path ? "已复制" : "复制路径"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!scanning && gitRepos.length === 0 && (
        <div className="text-center p-[60px] text-text-dim text-sm">
          输入路径并点击"开始扫描"来发现 Git 仓库
        </div>
      )}
    </div>
  );
}
