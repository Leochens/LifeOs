import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { readFile, writeFile, createDirAll } from "@/services/fs";
import { format, parseISO } from "date-fns";

interface GithubUser {
  login: string; name: string; avatar_url: string; public_repos: number; bio: string;
}
interface GithubRepo {
  id: number; name: string; full_name: string; description: string;
  stargazers_count: number; language: string; pushed_at: string; private: boolean; html_url: string;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Rust: "#dea584",
  Python: "#3572A5", Go: "#00ADD8", Vue: "#41b883",
};

const MCP_CONNECTORS = [
  {
    id: "xiaohongshu",
    name: "小红书",
    icon: "📕",
    desc: "搜索笔记、查看详情、评论、发布内容",
    mcpName: "RedNote-MCP",
    mcpRepo: "https://github.com/iFurySt/RedNote-MCP",
    stars: "932+",
    install: "npm install -g rednote-mcp && rednote-mcp init",
    config: {
      command: "rednote-mcp",
      args: ["serve"],
    },
    notes: "安装后运行 rednote-mcp init 进行浏览器登录认证",
  },
  {
    id: "jike",
    name: "即刻",
    icon: "⚡",
    desc: "浏览动态、发布内容、评论、搜索",
    mcpName: "jike-skill",
    mcpRepo: "https://github.com/imHw/jike-skill",
    stars: "新项目",
    install: "pip install jike-skill[qr]",
    config: null, // It's a Claude Code skill, not a standard MCP
    notes: "Claude Code Skill，安装后通过 QR 码扫码登录",
    isSkill: true,
  },
];

const FUTURE_CONNECTORS = [
  { id: "gmail",    name: "Gmail",          icon: "📧", desc: "未读邮件计数" },
  { id: "calendar", name: "Google Calendar",icon: "📅", desc: "日程同步到每日面板" },
  { id: "slack",    name: "Slack",          icon: "💬", desc: "未读消息和提醒" },
  { id: "notion",   name: "Notion",         icon: "📚", desc: "双向同步数据库" },
  { id: "twitter",  name: "Twitter / X",    icon: "🐦", desc: "发布日志和思考" },
  { id: "weixin",   name: "微信读书",       icon: "📖", desc: "阅读进度和划线同步" },
];

export default function ConnectorsView() {
  const vaultPath = useStore((s) => s.vaultPath);

  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <div>
        <div className="font-disp text-2xl tracking-widest text-accent">
          应用连接器
        </div>
        <div className="text-sm text-text-dim mt-1">
          将外部服务的数据同步到你的 Vault，保持一切在一个地方。
        </div>
      </div>

      {/* GitHub - full connector */}
      <GitHubConnector vaultPath={vaultPath} />

      {/* MCP-based connectors */}
      <div>
        <div className="label mb-3">MCP 连接器</div>
        <div className="flex flex-col gap-3">
          {MCP_CONNECTORS.map((c) => (
            <MCPConnectorCard key={c.id} connector={c} />
          ))}
        </div>
      </div>

      {/* Future connectors */}
      <div>
        <div className="label mb-3">即将支持</div>
        <div className="grid grid-cols-2 gap-3">
          {FUTURE_CONNECTORS.map((c) => (
            <div key={c.id} className="panel p-4 flex items-center gap-3.5 opacity-60">
              <span className="text-2xl">{c.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium mb-0.75">{c.name}</div>
                <div className="text-xs text-text-dim">{c.desc}</div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-lg bg-border text-text-dim tracking-widest uppercase">
                Soon
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <div className="font-mono text-xs text-accent tracking-widest mb-2.5">
          配置说明
        </div>
        <div className="text-sm text-text-mid leading-relaxed">
          GitHub Token 存储在 Vault 的{" "}
          <code className="text-accent text-xs bg-[rgba(0,200,255,0.1)] px-1.5 py-0.25 rounded">
            .life-os/connectors.yaml
          </code>{" "}
          中。MCP 连接器的配置在{" "}
          <code className="text-accent text-xs bg-[rgba(0,200,255,0.1)] px-1.5 py-0.25 rounded">
            ~/.claude/settings.json
          </code>{" "}
          中。
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP Connector Card
// ─────────────────────────────────────────────────────────────────────────────

function MCPConnectorCard({ connector }: { connector: typeof MCP_CONNECTORS[number] }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const configJson = connector.config
    ? JSON.stringify({ mcpServers: { [connector.id]: connector.config } }, null, 2)
    : null;

  const copyConfig = () => {
    if (configJson) {
      navigator.clipboard.writeText(configJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="panel p-5">
      <div className="flex items-center gap-3.5">
        <span className="text-3xl">{connector.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{connector.name}</span>
            <span className="text-[9px] px-2 py-0.5 rounded-lg bg-[rgba(200,100,255,0.12)] text-accent2 border border-[rgba(200,100,255,0.25)] tracking-widest">
              {connector.isSkill ? "SKILL" : "MCP"}
            </span>
          </div>
          <div className="text-xs text-text-dim mt-0.5">{connector.desc}</div>
        </div>
        <button
          className="btn btn-ghost text-xs px-3 py-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "收起" : "配置指南"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-3">
          {/* Install */}
          <div>
            <div className="text-xs text-accent2 font-medium tracking-widest mb-1.5">
              1. 安装
            </div>
            <code className="block p-[10px_14px] bg-[rgba(0,0,0,0.2)] rounded-sm text-xs text-accent font-mono leading-[1.6] select-all">
              {connector.install}
            </code>
          </div>

          {/* MCP Config */}
          {configJson && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-accent2 font-medium tracking-widest">
                  2. 添加到 Claude 配置
                </div>
                <button
                  className="btn btn-ghost text-[10px] px-2 py-0.5"
                  onClick={copyConfig}
                >
                  {copied ? "已复制!" : "复制"}
                </button>
              </div>
              <div className="text-xs text-text-dim mb-1.5">
                添加到 <code className="text-accent text-[10px]">~/.claude/settings.json</code> 的 mcpServers 中：
              </div>
              <pre className="p-[10px_14px] m-0 bg-[rgba(0,0,0,0.2)] rounded-sm text-xs text-accent3 font-mono leading-[1.6] overflow-auto">
                {configJson}
              </pre>
            </div>
          )}

          {/* Skill-specific instructions */}
          {connector.isSkill && (
            <div>
              <div className="text-xs text-accent2 font-medium tracking-widest mb-1.5">
                2. 使用方式
              </div>
              <div className="text-xs text-text-mid leading-[1.7]">
                作为 Claude Code Skill 使用，安装后直接在 Claude Code 中调用即刻相关功能。
                也可以手动 clone 到{" "}
                <code className="text-accent text-xs">~/.claude/skills/jike</code>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="p-2.5 bg-[rgba(255,200,0,0.06)] border border-[rgba(255,200,0,0.15)] rounded-sm text-xs text-accent5 leading-[1.6]">
            {connector.notes}
          </div>

          {/* Repo link */}
          <div className="text-xs">
            <a href={connector.mcpRepo} target="_blank" rel="noopener noreferrer"
              className="text-accent no-underline">
              {connector.mcpName} ({connector.stars} stars) →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub Connector (keeps existing functionality)
// ─────────────────────────────────────────────────────────────────────────────

function GitHubConnector({ vaultPath }: { vaultPath: string | null }) {
  const [githubToken, setGithubToken] = useState("");
  const [githubUser, setGithubUser] = useState<GithubUser | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [notifications, setNotifications] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!vaultPath) return;
    readFile(`${vaultPath}/.life-os/connectors.yaml`).then(content => {
      const match = content.match(/github_token:\s*["']?([^"'\n]+)["']?/);
      if (match) setGithubToken(match[1].trim());
    }).catch(() => {});
  }, [vaultPath]);

  useEffect(() => { if (githubToken) syncGitHub(); }, [githubToken]);

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
    setGithubToken(""); setGithubUser(null); setRepos([]); setNotifications(0);
    if (vaultPath) await writeFile(`${vaultPath}/.life-os/connectors.yaml`, "# connectors config\n");
  };

  const syncGitHub = async () => {
    if (!githubToken) return;
    setSyncing(true); setSyncError(null);
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
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally { setSyncing(false); }
  };

  return (
    <div>
      <div className="label mb-3">
        已连接
      </div>
      <div className="panel p-5">
        {!githubToken ? (
          <div>
            <div className="flex items-center gap-3.5 mb-4">
              <span className="text-3xl">🐙</span>
              <div>
                <div className="text-base font-semibold">连接 GitHub</div>
                <div className="text-xs text-text-dim mt-0.5">
                  输入你的 Personal Access Token（需要 repo, notifications 权限）
                </div>
              </div>
            </div>
            {!showTokenInput ? (
              <button className="btn btn-primary" onClick={() => setShowTokenInput(true)}>设置 Token</button>
            ) : (
              <div className="flex gap-2">
                <input className="input flex-1" type="password" autoFocus placeholder="ghp_xxxxxxxxxxxx"
                  value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tokenInput.trim()) saveToken(tokenInput.trim());
                    if (e.key === "Escape") { setShowTokenInput(false); setTokenInput(""); }
                  }} />
                <button className="btn btn-primary" onClick={() => { if (tokenInput.trim()) saveToken(tokenInput.trim()); }}>连接</button>
                <button className="btn btn-ghost" onClick={() => { setShowTokenInput(false); setTokenInput(""); }}>取消</button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3.5 mb-4">
              {githubUser?.avatar_url ? (
                <img src={githubUser.avatar_url} alt={githubUser.login}
                  className="w-10 h-10 rounded-full border-2 border-border" />
              ) : <span className="text-3xl">🐙</span>}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">@{githubUser?.login}</span>
                  {githubUser?.name && <span className="text-xs text-text-dim">{githubUser.name}</span>}
                </div>
                {githubUser?.bio && <div className="text-xs text-text-dim mt-0.5">{githubUser.bio}</div>}
              </div>
              <div className="flex gap-1.5">
                <button className="btn btn-ghost text-xs px-2.5 py-1 flex items-center gap-1" onClick={syncGitHub}>
                  <span className={syncing ? "spin" : ""}>{syncing ? "⟳" : "↻"}</span>
                  {syncing ? "同步中" : "同步"}
                </button>
                <button className="btn btn-ghost text-xs px-2.5 py-1 text-accent4" onClick={disconnectGitHub}>断开</button>
              </div>
            </div>
            {syncError && (
              <div className="text-xs text-accent4 mb-3 p-1.5 px-2.5 bg-[rgba(255,107,107,0.08)] rounded-sm">
                {syncError}
              </div>
            )}
            <div className="flex gap-4 mb-4">
              <div className="text-xs text-text-mid">
                公开仓库: <span className="text-accent font-semibold">{githubUser?.public_repos ?? 0}</span>
              </div>
              <div className="text-xs text-text-mid">
                未读通知: <span className={notifications > 0 ? "text-accent5 font-semibold" : "text-text-dim font-semibold"}>{notifications}</span>
              </div>
            </div>
            {repos.length > 0 && (
              <div>
                <div className="text-[10px] tracking-widest text-text-dim uppercase mb-2.5 border-t border-border pt-3">
                  最近仓库
                </div>
                <div className="flex flex-col gap-1.5">
                  {repos.slice(0, 8).map((repo) => (
                    <a key={repo.id} href={repo.html_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-2 bg-panel-2 border border-border rounded-sm no-underline text-inherit transition-colors duration-150"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,255,0.25)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap">{repo.name}</span>
                          {repo.private && <span className="text-[9px] px-1 py-0.25 rounded-lg bg-border text-text-dim">private</span>}
                        </div>
                        {repo.description && <div className="text-xs text-text-dim mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{repo.description}</div>}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {repo.language && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg"
                            style={{
                              background: `${LANG_COLORS[repo.language] ?? "#888"}20`,
                              color: LANG_COLORS[repo.language] ?? "#888",
                            }}>
                            {repo.language}
                          </span>
                        )}
                        {repo.stargazers_count > 0 && <span className="text-xs text-text-dim">★ {repo.stargazers_count}</span>}
                        <span className="text-[10px] text-text-dim font-mono">
                          {format(parseISO(repo.pushed_at), "MM-dd")}
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
  );
}
