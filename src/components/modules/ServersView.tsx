import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { writeNote, listNotes, deleteFile } from "@/services/tauri";
import type { ServerInfo } from "@/types";
import { format } from "date-fns";

const SERVERS_DIR = ".lifeos/servers";

export default function ServersView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selected, setSelected] = useState<ServerInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formName, setFormName] = useState("");
  const [formHost, setFormHost] = useState("");
  const [formPort, setFormPort] = useState("22");
  const [formUsername, setFormUsername] = useState("");
  const [formAuthType, setFormAuthType] = useState<"password" | "key" | "both">("key");
  const [formPassword, setFormPassword] = useState("");
  const [formPrivateKey, setFormPrivateKey] = useState("~/.ssh/id_rsa");
  const [formPublicKey, setFormPublicKey] = useState("~/.ssh/id_rsa.pub");
  const [formNotes, setFormNotes] = useState("");
  const [formTags, setFormTags] = useState("");

  const loadServers = async () => {
    if (!vaultPath) return;
    setLoading(true);
    try {
      const dir = `${vaultPath}/${SERVERS_DIR}`;
      const notes = await listNotes(dir, false);
      const loaded: ServerInfo[] = [];

      for (const n of notes) {
        if (n.frontmatter.id) {
          loaded.push({
            id: n.frontmatter.id || "",
            name: n.frontmatter.name || "",
            host: n.frontmatter.host || "",
            port: parseInt(n.frontmatter.port) || 22,
            username: n.frontmatter.username || "",
            authType: (n.frontmatter.authType as "password" | "key" | "both") || "key",
            password: n.frontmatter.password,
            privateKeyPath: n.frontmatter.privateKeyPath,
            publicKeyPath: n.frontmatter.publicKeyPath,
            notes: n.frontmatter.notes || "",
            tags: n.frontmatter.tags ? n.frontmatter.tags.split(",").map((t: string) => t.trim()) : [],
            created: n.frontmatter.created || "",
            updated: n.frontmatter.updated || "",
          });
        }
      }

      setServers(loaded);
    } catch (e) {
      console.error("Failed to load servers:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, [vaultPath]);

  const resetForm = () => {
    setFormName("");
    setFormHost("");
    setFormPort("22");
    setFormUsername("");
    setFormAuthType("key");
    setFormPassword("");
    setFormPrivateKey("~/.ssh/id_rsa");
    setFormPublicKey("~/.ssh/id_rsa.pub");
    setFormNotes("");
    setFormTags("");
  };

  const handleCreateOrUpdate = async () => {
    if (!vaultPath || !formName.trim() || !formHost.trim()) return;

    const id = selected?.id || `srv-${Date.now()}`;
    const now = format(new Date(), "yyyy-MM-dd");
    const slug = formName.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
    const path = `${vaultPath}/${SERVERS_DIR}/${slug}.md`;

    const fm = {
      id,
      name: formName,
      host: formHost,
      port: formPort,
      username: formUsername,
      authType: formAuthType,
      password: formAuthType === "password" || formAuthType === "both" ? formPassword : undefined,
      privateKeyPath: formAuthType === "key" || formAuthType === "both" ? formPrivateKey : undefined,
      publicKeyPath: formAuthType === "key" || formAuthType === "both" ? formPublicKey : undefined,
      notes: formNotes,
      tags: formTags,
      created: selected?.created || now,
      updated: now,
    };

    const content = `# ${formName}

## 连接信息
- Host: ${formHost}
- Port: ${formPort}
- Username: ${formUsername}
- Auth: ${formAuthType}

## 备注
${formNotes}

## 标签
${formTags}
`;

    try {
      await writeNote(path, fm, content);
      await loadServers();
      setShowForm(false);
      resetForm();
      setSelected(null);
    } catch (e) {
      console.error("Failed to save server:", e);
      alert("保存失败: " + e);
    }
  };

  const handleDelete = async (srv: ServerInfo) => {
    if (!vaultPath) return;
    if (!confirm(`确定要删除服务器 "${srv.name}" 吗？`)) return;

    const slug = srv.name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
    const path = `${vaultPath}/${SERVERS_DIR}/${slug}.md`;

    try {
      await deleteFile(path);
      await loadServers();
      if (selected?.id === srv.id) {
        setSelected(null);
        setShowForm(false);
      }
    } catch (e) {
      console.error("Failed to delete server:", e);
      alert("删除失败: " + e);
    }
  };

  const editServer = (srv: ServerInfo) => {
    setSelected(srv);
    setFormName(srv.name);
    setFormHost(srv.host);
    setFormPort(String(srv.port));
    setFormUsername(srv.username);
    setFormAuthType(srv.authType);
    setFormPassword(srv.password || "");
    setFormPrivateKey(srv.privateKeyPath || "~/.ssh/id_rsa");
    setFormPublicKey(srv.publicKeyPath || "~/.ssh/id_rsa.pub");
    setFormNotes(srv.notes);
    setFormTags(srv.tags.join(", "));
    setShowForm(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex gap-5 h-[calc(100vh-120px)]">
      {/* Server List */}
      <div className="w-[300px] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="font-disp text-xl tracking-widest text-accent">
            服务器管理
          </div>
          <button className="btn btn-primary text-xs px-3 py-1.5" onClick={() => { resetForm(); setSelected(null); setShowForm(true); }}>
            + 添加
          </button>
        </div>

        <div className="flex-1 overflow-auto flex flex-col gap-1.5">
          {loading ? (
            <div className="text-text-dim text-center p-5">加载中...</div>
          ) : servers.length === 0 ? (
            <div className="text-text-dim text-center p-5">
              <div className="text-3xl mb-2">🖥</div>
              还没有添加服务器
            </div>
          ) : (
            servers.map((srv) => (
              <div
                key={srv.id}
                onClick={() => setSelected(srv)}
                className="p-3 rounded-sm cursor-pointer transition-all duration-150"
                style={{
                  background: selected?.id === srv.id ? "rgba(0,200,255,0.1)" : "var(--panel)",
                  border: `1px solid ${selected?.id === srv.id ? "rgba(0,200,255,0.3)" : "var(--border)"}`,
                }}
              >
                <div className="font-medium mb-1">{srv.name}</div>
                <div className="text-xs text-text-dim font-mono">
                  {srv.username}@{srv.host}:{srv.port}
                </div>
                {srv.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {srv.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-panel-2 text-text-dim">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail / Form */}
      <div className="flex-1 overflow-auto">
        {showForm ? (
          <div className="panel p-5 max-w-[600px]">
            <div className="text-base font-medium mb-4">
              {selected ? "编辑服务器" : "添加新服务器"}
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-text-mid block mb-1">服务器名称</label>
                <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My Server" />
              </div>
              <div className="grid grid-cols-[2fr_1fr] gap-3">
                <div>
                  <label className="text-xs text-text-mid block mb-1">主机地址</label>
                  <input className="input" value={formHost} onChange={(e) => setFormHost(e.target.value)} placeholder="192.168.1.100" />
                </div>
                <div>
                  <label className="text-xs text-text-mid block mb-1">端口</label>
                  <input className="input" value={formPort} onChange={(e) => setFormPort(e.target.value)} placeholder="22" />
                </div>
              </div>
              <div>
                <label className="text-xs text-text-mid block mb-1">用户名</label>
                <input className="input" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="root" />
              </div>
              <div>
                <label className="text-xs text-text-mid block mb-1">认证方式</label>
                <div className="flex gap-2">
                  {(["key", "password", "both"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFormAuthType(type)}
                      className="px-3 py-1.5 rounded-sm cursor-pointer text-xs transition-colors"
                      style={{
                        border: `1px solid ${formAuthType === type ? "var(--accent)" : "var(--border)"}`,
                        background: formAuthType === type ? "rgba(0,200,255,0.1)" : "transparent",
                        color: formAuthType === type ? "var(--accent)" : "var(--text-dim)",
                      }}
                    >
                      {type === "key" ? "密钥" : type === "password" ? "密码" : "两者"}
                    </button>
                  ))}
                </div>
              </div>
              {(formAuthType === "key" || formAuthType === "both") && (
                <>
                  <div>
                    <label className="text-xs text-text-mid block mb-1">私钥路径</label>
                    <input className="input" value={formPrivateKey} onChange={(e) => setFormPrivateKey(e.target.value)} placeholder="~/.ssh/id_rsa" />
                  </div>
                  <div>
                    <label className="text-xs text-text-mid block mb-1">公钥路径</label>
                    <input className="input" value={formPublicKey} onChange={(e) => setFormPublicKey(e.target.value)} placeholder="~/.ssh/id_rsa.pub" />
                  </div>
                </>
              )}
              {(formAuthType === "password" || formAuthType === "both") && (
                <div>
                  <label className="text-xs text-text-mid block mb-1">密码</label>
                  <input className="input" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" />
                </div>
              )}
              <div>
                <label className="text-xs text-text-mid block mb-1">标签（逗号分隔）</label>
                <input className="input" value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="生产, Web, 数据库" />
              </div>
              <div>
                <label className="text-xs text-text-mid block mb-1">备注</label>
                <textarea className="input" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} placeholder="其他备注信息..." />
              </div>
              <div className="flex gap-2 mt-2">
                <button className="btn btn-primary" onClick={handleCreateOrUpdate}>保存</button>
                <button className="btn btn-ghost" onClick={() => { setShowForm(false); resetForm(); setSelected(null); }}>取消</button>
                {selected && (
                  <button
                    className="btn btn-ghost ml-auto text-accent4"
                    onClick={() => handleDelete(selected)}
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="panel p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-xl font-semibold mb-1">{selected.name}</div>
                <div className="text-xs text-text-dim">
                  创建于 {selected.created} · 更新于 {selected.updated}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => editServer(selected)}>编辑</button>
                <button className="btn btn-ghost text-accent4" onClick={() => handleDelete(selected)}>删除</button>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="panel-inner p-4 rounded-sm border border-border">
                <div className="text-[10px] tracking-widest text-accent uppercase mb-3">连接信息</div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim w-[60px]">Host:</span>
                    <code className="flex-1 font-mono">{selected.host}</code>
                    <button className="btn btn-ghost text-[10px] px-2 py-0.5" onClick={() => copyToClipboard(selected.host)}>复制</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim w-[60px]">Port:</span>
                    <code className="flex-1 font-mono">{selected.port}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim w-[60px]">User:</span>
                    <code className="flex-1 font-mono">{selected.username}</code>
                    <button className="btn btn-ghost text-[10px] px-2 py-0.5" onClick={() => copyToClipboard(selected.username)}>复制</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim w-[60px]">Auth:</span>
                    <span>{selected.authType === "key" ? "密钥" : selected.authType === "password" ? "密码" : "密钥+密码"}</span>
                  </div>
                </div>
              </div>

              {selected.privateKeyPath && (
                <div className="panel-inner p-4 rounded-sm border border-border">
                  <div className="text-[10px] tracking-widest text-accent3 uppercase mb-2">密钥路径</div>
                  <div className="text-sm font-mono text-text-mid">
                    {selected.privateKeyPath}
                  </div>
                </div>
              )}

              {selected.notes && (
                <div className="panel-inner p-4 rounded-sm border border-border">
                  <div className="text-[10px] tracking-widest text-accent2 uppercase mb-2">备注</div>
                  <div className="text-sm text-text-mid whitespace-pre-wrap">{selected.notes}</div>
                </div>
              )}

              {selected.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {selected.tags.map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-panel-2 text-text-mid border border-border">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <div className="text-[10px] tracking-widest text-text-dim uppercase mb-2">快速连接命令</div>
                <code className="block p-3 bg-panel-2 rounded-sm font-mono text-xs text-accent">
                  ssh -i {selected.privateKeyPath || "~/.ssh/id_rsa"} -p {selected.port} {selected.username}@{selected.host}
                </code>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-dim">
            选择一个服务器查看详情，或点击"添加"创建新服务器
          </div>
        )}
      </div>
    </div>
  );
}
