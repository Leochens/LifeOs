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
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 120px)" }}>
      {/* Server List */}
      <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-disp)", fontSize: 20, letterSpacing: 2, color: "var(--accent)" }}>
            服务器管理
          </div>
          <button className="btn btn-primary" onClick={() => { resetForm(); setSelected(null); setShowForm(true); }} style={{ fontSize: 12, padding: "6px 12px" }}>
            + 添加
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 20 }}>加载中...</div>
          ) : servers.length === 0 ? (
            <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🖥</div>
              还没有添加服务器
            </div>
          ) : (
            servers.map((srv) => (
              <div
                key={srv.id}
                onClick={() => setSelected(srv)}
                style={{
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  background: selected?.id === srv.id ? "rgba(0,200,255,0.1)" : "var(--panel)",
                  border: `1px solid ${selected?.id === srv.id ? "rgba(0,200,255,0.3)" : "var(--border)"}`,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{srv.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  {srv.username}@{srv.host}:{srv.port}
                </div>
                {srv.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {srv.tags.map((t) => (
                      <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "var(--panel2)", color: "var(--text-dim)" }}>
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
      <div style={{ flex: 1, overflow: "auto" }}>
        {showForm ? (
          <div className="panel" style={{ padding: 20, maxWidth: 600 }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
              {selected ? "编辑服务器" : "添加新服务器"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>服务器名称</label>
                <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My Server" style={{ width: "100%" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>主机地址</label>
                  <input className="input" value={formHost} onChange={(e) => setFormHost(e.target.value)} placeholder="192.168.1.100" style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>端口</label>
                  <input className="input" value={formPort} onChange={(e) => setFormPort(e.target.value)} placeholder="22" style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>用户名</label>
                <input className="input" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="root" style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>认证方式</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["key", "password", "both"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFormAuthType(type)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${formAuthType === type ? "var(--accent)" : "var(--border)"}`,
                        background: formAuthType === type ? "rgba(0,200,255,0.1)" : "transparent",
                        color: formAuthType === type ? "var(--accent)" : "var(--text-dim)",
                        cursor: "pointer",
                        fontSize: 12,
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
                    <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>私钥路径</label>
                    <input className="input" value={formPrivateKey} onChange={(e) => setFormPrivateKey(e.target.value)} placeholder="~/.ssh/id_rsa" style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>公钥路径</label>
                    <input className="input" value={formPublicKey} onChange={(e) => setFormPublicKey(e.target.value)} placeholder="~/.ssh/id_rsa.pub" style={{ width: "100%" }} />
                  </div>
                </>
              )}
              {(formAuthType === "password" || formAuthType === "both") && (
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>密码</label>
                  <input className="input" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%" }} />
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>标签（逗号分隔）</label>
                <input className="input" value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="生产, Web, 数据库" style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>备注</label>
                <textarea className="input" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} placeholder="其他备注信息..." style={{ width: "100%", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={handleCreateOrUpdate}>保存</button>
                <button className="btn btn-ghost" onClick={() => { setShowForm(false); resetForm(); setSelected(null); }}>取消</button>
                {selected && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleDelete(selected)}
                    style={{ marginLeft: "auto", color: "var(--accent4)" }}
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="panel" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  创建于 {selected.created} · 更新于 {selected.updated}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => editServer(selected)}>编辑</button>
                <button className="btn btn-ghost" onClick={() => handleDelete(selected)} style={{ color: "var(--accent4)" }}>删除</button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div className="panel2" style={{ padding: 16, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--accent)", marginBottom: 12, textTransform: "uppercase" }}>连接信息</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--text-dim)", width: 60 }}>Host:</span>
                    <code style={{ flex: 1, fontFamily: "var(--font-mono)" }}>{selected.host}</code>
                    <button className="btn btn-ghost" onClick={() => copyToClipboard(selected.host)} style={{ fontSize: 10, padding: "2px 8px" }}>复制</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--text-dim)", width: 60 }}>Port:</span>
                    <code style={{ flex: 1, fontFamily: "var(--font-mono)" }}>{selected.port}</code>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--text-dim)", width: 60 }}>User:</span>
                    <code style={{ flex: 1, fontFamily: "var(--font-mono)" }}>{selected.username}</code>
                    <button className="btn btn-ghost" onClick={() => copyToClipboard(selected.username)} style={{ fontSize: 10, padding: "2px 8px" }}>复制</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--text-dim)", width: 60 }}>Auth:</span>
                    <span>{selected.authType === "key" ? "密钥" : selected.authType === "password" ? "密码" : "密钥+密码"}</span>
                  </div>
                </div>
              </div>

              {selected.privateKeyPath && (
                <div className="panel2" style={{ padding: 16, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--accent3)", marginBottom: 8, textTransform: "uppercase" }}>密钥路径</div>
                  <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-mid)" }}>
                    {selected.privateKeyPath}
                  </div>
                </div>
              )}

              {selected.notes && (
                <div className="panel2" style={{ padding: 16, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--accent2)", marginBottom: 8, textTransform: "uppercase" }}>备注</div>
                  <div style={{ fontSize: 13, color: "var(--text-mid)", whiteSpace: "pre-wrap" }}>{selected.notes}</div>
                </div>
              )}

              {selected.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {selected.tags.map((t) => (
                    <span key={t} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "var(--panel2)", color: "var(--text-mid)", border: "1px solid var(--border)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase" }}>快速连接命令</div>
                <code style={{
                  display: "block",
                  padding: 12,
                  background: "var(--panel2)",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--accent)",
                }}>
                  ssh -i {selected.privateKeyPath || "~/.ssh/id_rsa"} -p {selected.port} {selected.username}@{selected.host}
                </code>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
            选择一个服务器查看详情，或点击"添加"创建新服务器
          </div>
        )}
      </div>
    </div>
  );
}
