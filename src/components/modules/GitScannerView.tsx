import { useState } from "react";
import { useStore } from "@/stores/app";
import { scanGitRepos, pickVaultFolder, openInFinder } from "@/services/tauri";

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 1100,
      }}
    >
      {/* Header */}
      <div>
        <div
          style={{
            fontFamily: "var(--font-disp)",
            fontSize: 28,
            letterSpacing: 3,
            color: "var(--accent)",
          }}
        >
          GIT 仓库扫描器
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
          扫描本地目录，发现所有 Git 仓库及其状态。
        </div>
      </div>

      {/* Scan bar */}
      <div
        className="panel"
        style={{
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <input
          className="input"
          placeholder="输入扫描路径，如 /Users/..."
          value={scanRoot}
          onChange={(e) => setScanRoot(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-ghost" onClick={handlePickFolder}>
          选择文件夹
        </button>
        <select
          className="input"
          style={{ width: 100 }}
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                className="spin"
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  display: "inline-block",
                }}
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
        <div
          style={{
            background: "rgba(255,107,107,0.12)",
            border: "1px solid var(--accent4)",
            color: "var(--accent4)",
            padding: "10px 16px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Stats bar */}
      {gitRepos.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            className="tag"
            style={{ fontSize: 12, padding: "4px 12px" }}
          >
            共 {gitRepos.length} 个仓库
          </span>
          <span
            className="tag orange"
            style={{ fontSize: 12, padding: "4px 12px" }}
          >
            {dirtyCount} 个有未提交改动
          </span>
          <span
            className="tag green"
            style={{ fontSize: 12, padding: "4px 12px" }}
          >
            {cleanCount} 个干净
          </span>
        </div>
      )}

      {/* Filter tabs */}
      {gitRepos.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          {filterTabs.map((t) => (
            <button
              key={t.key}
              className={filter === t.key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "6px 16px" }}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Repo grid */}
      {filtered.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          {filtered.map((repo) => (
            <div
              key={repo.path}
              className="panel-inner"
              style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {repo.name}
                </span>
                <span
                  className="tag"
                  style={{
                    background: "rgba(0,200,255,0.1)",
                    color: "var(--accent)",
                  }}
                >
                  {repo.branch}
                </span>
              </div>

              {repo.has_uncommitted && (
                <span
                  className="tag orange"
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent5)",
                      display: "inline-block",
                    }}
                  />
                  有改动
                </span>
              )}

              {repo.last_commit && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-mid)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {repo.last_commit.length > 40
                    ? repo.last_commit.slice(0, 40) + "..."
                    : repo.last_commit}
                </div>
              )}

              {repo.remote_url && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    fontFamily: "var(--font-mono)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {repo.remote_url.length > 50
                    ? repo.remote_url.slice(0, 50) + "..."
                    : repo.remote_url}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: "auto",
                  paddingTop: 4,
                }}
              >
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, justifyContent: "center", padding: "6px 10px", fontSize: 12 }}
                  onClick={() => openInFinder(repo.path)}
                >
                  在 Finder 打开
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, justifyContent: "center", padding: "6px 10px", fontSize: 12 }}
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
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--text-dim)",
            fontSize: 14,
          }}
        >
          输入路径并点击"开始扫描"来发现 Git 仓库
        </div>
      )}
    </div>
  );
}
