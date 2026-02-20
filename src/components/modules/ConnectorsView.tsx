import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { readFile, writeFile, createDirAll } from "@/services/tauri";
import { format, parseISO } from "date-fns";

interface GithubUser {
  login: string;
  name: string;
  avatar_url: string;
  public_repos: number;
  bio: string;
}

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  stargazers_count: number;
  language: string;
  pushed_at: string;
  private: boolean;
  html_url: string;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Rust: "#dea584",
  Python: "#3572A5",
  Go: "#00ADD8",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Vue: "#41b883",
};

const OTHER_CONNECTORS = [
  { id: "gmail",    name: "Gmail",          icon: "📧", desc: "未读邮件计数" },
  { id: "calendar", name: "Google Calendar",icon: "📅", desc: "日程同步到每日面板" },
  { id: "slack",    name: "Slack",          icon: "💬", desc: "未读消息和提醒" },
  { id: "notion",   name: "Notion",         icon: "📚", desc: "双向同步数据库" },
  { id: "twitter",  name: "Twitter / X",    icon: "🐦", desc: "发布日志和思考" },
  { id: "finance",  name: "财务追踪",       icon: "💰", desc: "收支记录同步" },
  { id: "weixin",   name: "微信读书",       icon: "📖", desc: "阅读进度和划线同步" },
];

export default function ConnectorsView() {
  const vaultPath = useStore((s) => s.vaultPath);

  const [githubToken, setGithubToken] = useState("");
  const [githubUser, setGithubUser] = useState<GithubUser | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [notifications, setNotifications] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load token on mount
  useEffect(() => {
    if (!vaultPath) return;
    const tokenPath = `${vaultPath}/.life-os/connectors.yaml`;
    readFile(tokenPath).then(content => {
      const match = content.match(/github_token:\s*["']?([^"'\n]+)["']?/);
      if (match) setGithubToken(match[1].trim());
    }).catch(() => {});
  }, [vaultPath]);

  // Auto-sync when token is available
  useEffect(() => {
    if (githubToken) syncGitHub();
  }, [githubToken]);

  const saveToken = async (token: string) => {
    if (!vaultPath) return;
    await createDirAll(`${vaultPath}/.life-os`);
    const content = `github_token: "${token}"\n`;
    await writeFile(`${vaultPath}/.life-os/connectors.yaml`, content);
    setGithubToken(token);
    setShowTokenInput(false);
    setTokenInput("");
  };

  const disconnectGitHub = async () => {
    setGithubToken("");
    setGithubUser(null);
    setRepos([]);
    setNotifications(0);
    if (vaultPath) {
      await writeFile(`${vaultPath}/.life-os/connectors.yaml`, "# connectors config\n");
    }
  };

  const syncGitHub = async () => {
    if (!githubToken) return;
    setSyncing(true);
    setSyncError(null);
    const headers = { Authorization: `token ${githubToken}`, Accept: "application/vnd.github.v3+json" };

    try {
      const [userRes, reposRes, notifRes] = await Promise.all([
        fetch("https://api.github.com/user", { headers }),
        fetch("https://api.github.com/user/repos?sort=pushed&per_page=20", { headers }),
        fetch("https://api.github.com/notifications?all=false", { headers }),
      ]);

      if (!userRes.ok) throw new Error("Token 无效或无权限");

      const user = await userRes.json();
      const repoList = await reposRes.json();
      const notifs = await notifRes.json();

      setGithubUser(user);
      setRepos(Array.isArray(repoList) ? repoList : []);
      setNotifications(Array.isArray(notifs) ? notifs.length : 0);

      if (vaultPath) {
        await createDirAll(`${vaultPath}/connectors/github`);
        await writeFile(`${vaultPath}/connectors/github/user.json`, JSON.stringify(user, null, 2));
        await writeFile(`${vaultPath}/connectors/github/repos.json`, JSON.stringify(repoList, null, 2));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = !!githubToken && !!githubUser;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
      <div>
        <div style={{ fontFamily: "var(--font-disp)", fontSize: 28, letterSpacing: 3, color: "var(--accent)" }}>
          应用连接器
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
          将外部服务的数据同步到你的 Vault，保持一切在一个地方。
        </div>
      </div>

      {/* GitHub Connector */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>{isConnected ? "已连接" : "连接服务"}</div>
        <div className="panel" style={{ padding: 20 }}>
          {!githubToken ? (
            /* Disconnected state */
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>🐙</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>连接 GitHub</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                    输入你的 Personal Access Token（需要 repo, notifications 权限）
                  </div>
                </div>
              </div>
              {!showTokenInput ? (
                <button className="btn btn-primary" onClick={() => setShowTokenInput(true)}>
                  设置 Token
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    type="password"
                    autoFocus
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tokenInput.trim()) saveToken(tokenInput.trim());
                      if (e.key === "Escape") { setShowTokenInput(false); setTokenInput(""); }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={() => { if (tokenInput.trim()) saveToken(tokenInput.trim()); }}>
                    连接
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setShowTokenInput(false); setTokenInput(""); }}>
                    取消
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Connected state */
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                {githubUser?.avatar_url ? (
                  <img
                    src={githubUser.avatar_url}
                    alt={githubUser.login}
                    style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid var(--border)" }}
                  />
                ) : (
                  <span style={{ fontSize: 32 }}>🐙</span>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>@{githubUser?.login}</span>
                    {githubUser?.name && (
                      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{githubUser.name}</span>
                    )}
                  </div>
                  {githubUser?.bio && (
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{githubUser.bio}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={syncGitHub}
                    style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <span className={syncing ? "spin" : ""} style={{ display: "inline-block" }}>
                      {syncing ? "⟳" : "↻"}
                    </span>
                    {syncing ? "同步中" : "同步"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={disconnectGitHub}
                    style={{ fontSize: 11, padding: "4px 10px", color: "var(--accent4)" }}
                  >
                    断开
                  </button>
                </div>
              </div>

              {syncError && (
                <div style={{ fontSize: 11, color: "var(--accent4)", marginBottom: 12, padding: "6px 10px", background: "rgba(255,107,107,0.08)", borderRadius: "var(--radius-sm)" }}>
                  {syncError}
                </div>
              )}

              {/* Stats */}
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "var(--text-mid)" }}>
                  公开仓库: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{githubUser?.public_repos ?? 0}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-mid)" }}>
                  未读通知: <span style={{ color: notifications > 0 ? "var(--accent5)" : "var(--text-dim)", fontWeight: 600 }}>{notifications}</span>
                </div>
              </div>

              {/* Repos */}
              {repos.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 10, letterSpacing: 2, color: "var(--text-dim)",
                    textTransform: "uppercase", marginBottom: 10,
                    borderTop: "1px solid var(--border)", paddingTop: 12,
                  }}>
                    最近仓库
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {repos.slice(0, 10).map((repo) => (
                      <a
                        key={repo.id}
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px",
                          background: "var(--panel2)", border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          textDecoration: "none", color: "inherit",
                          transition: "border-color 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,255,0.25)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {repo.name}
                            </span>
                            {repo.private && (
                              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "var(--border)", color: "var(--text-dim)" }}>
                                private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {repo.description}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          {repo.language && (
                            <span style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 8,
                              background: `${LANG_COLORS[repo.language] ?? "#888"}20`,
                              color: LANG_COLORS[repo.language] ?? "#888",
                              border: `1px solid ${LANG_COLORS[repo.language] ?? "#888"}40`,
                            }}>
                              {repo.language}
                            </span>
                          )}
                          {repo.stargazers_count > 0 && (
                            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                              ★ {repo.stargazers_count}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                            {format(parseISO(repo.pushed_at), "MM-dd HH:mm")}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Other connectors - Coming Soon */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>即将支持</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {OTHER_CONNECTORS.map((c) => (
            <div
              key={c.id}
              className="panel"
              style={{
                padding: 16, display: "flex", alignItems: "center", gap: 14,
                opacity: 0.6,
              }}
            >
              <span style={{ fontSize: 28 }}>{c.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{c.desc}</div>
              </div>
              <span style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 8,
                background: "var(--border)", color: "var(--text-dim)",
                letterSpacing: 1, textTransform: "uppercase",
              }}>
                Soon
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: 2, marginBottom: 10 }}>
          配置文件
        </div>
        <div style={{ fontSize: 13, color: "var(--text-mid)", lineHeight: 1.8 }}>
          连接器的 API Token 存储在 Vault 的{" "}
          <code style={{ color: "var(--accent)", fontSize: 11, background: "rgba(0,200,255,0.1)", padding: "1px 6px", borderRadius: 4 }}>
            .life-os/connectors.yaml
          </code>{" "}
          中。该文件已加入 .gitignore，不会被同步到云端。
        </div>
      </div>
    </div>
  );
}
