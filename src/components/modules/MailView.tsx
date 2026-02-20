import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/stores/app";
import { writeNote, listNotes, imapSync, getCachedEmails } from "@/services/tauri";
import type { EmailMessage } from "@/services/tauri";
import type { EmailAccount } from "@/types";
import { HelpCircle } from "lucide-react";

const EMAILS_DIR = ".lifeos/emails";

// 常见邮箱配置帮助
const EMAIL_PROVIDERS = {
  "163": {
    name: "163邮箱",
    imapHost: "imap.163.com",
    imapPort: "993",
    usernameTip: "your_email@163.com",
    steps: [
      "登录 163 邮箱网页版",
      "设置 → POP3/SMTP/IMAP → 开启 IMAP/SMTP 服务",
      "设置 → 账户安全 → 开启客户端授权密码",
      "使用授权密码作为登录密码",
    ],
  },
  "126": {
    name: "126邮箱",
    imapHost: "imap.126.com",
    imapPort: "993",
    usernameTip: "your_email@126.com",
    steps: [
      "登录 126 邮箱网页版",
      "设置 → POP3/SMTP/IMAP → 开启 IMAP/SMTP 服务",
      "设置 → 账户安全 → 开启客户端授权密码",
      "使用授权密码作为登录密码",
    ],
  },
  "qq": {
    name: "QQ邮箱",
    imapHost: "imap.qq.com",
    imapPort: "993",
    usernameTip: "your_email@qq.com",
    steps: [
      "登录 QQ 邮箱网页版",
      "设置 → 账户 → 开启 IMAP/SMTP 服务",
      "生成授权码（需要手机验证）",
      "使用授权码作为登录密码",
    ],
  },
  "gmail": {
    name: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: "993",
    usernameTip: "your_email@gmail.com",
    steps: [
      "登录 Gmail 网页版",
      "Google 账户 → 安全 → 开启两步验证",
      "Google 账户 → 安全 → 应用专用密码",
      "生成专用密码并使用",
    ],
  },
  "outlook": {
    name: "Outlook/Hotmail",
    imapHost: "outlook.office365.com",
    imapPort: "993",
    usernameTip: "your_email@outlook.com",
    steps: [
      "登录 Outlook 网页版",
      "设置 → POP 和 IMAP → 开启 IMAP",
      "如需 App Password，使用 Microsoft 账户安全生成",
    ],
  },
  "aliyun": {
    name: "阿里云邮箱",
    imapHost: "imap.aliyun.com",
    imapPort: "993",
    usernameTip: "your_email@aliyun.com",
    steps: [
      "登录阿里云邮箱网页版",
      "设置 → IMAP/SMTP → 开启 IMAP 服务",
      "设置 → 客户端专用密码 → 生成密码",
    ],
  },
};

export default function MailView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const emailAccounts = useStore((s) => s.emailAccounts);
  const setEmailAccounts = useStore((s) => s.setEmailAccounts);

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; account: EmailAccount } | null>(null);

  // Close context menu on click outside or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = () => setCtxMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [ctxMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, account: EmailAccount) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, account });
  }, []);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formProtocol, setFormProtocol] = useState<"imap" | "pop3">("imap");
  const [formImapHost, setFormImapHost] = useState("");
  const [formImapPort, setFormImapPort] = useState("993");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFolders, setFormFolders] = useState("INBOX,Sent,Draft,Trash,Archive");

  // Load accounts from vault
  const loadAccounts = async () => {
    if (!vaultPath) return;
    setLoading(true);
    try {
      const dir = `${vaultPath}/${EMAILS_DIR}`;
      const notes = await listNotes(dir, false);
      const accounts: EmailAccount[] = [];

      for (const n of notes) {
        console.log("Loaded note frontmatter:", n.frontmatter);
        if (n.frontmatter.id && n.frontmatter.imapHost) {
          accounts.push({
            id: n.frontmatter.id,
            name: n.frontmatter.name || "",
            email: n.frontmatter.email || "",
            imapHost: n.frontmatter.imapHost || "",
            imapPort: parseInt(n.frontmatter.imapPort) || 993,
            protocol: (n.frontmatter.protocol as "imap" | "pop3") || "imap",
            username: n.frontmatter.username || "",
            password: n.frontmatter.password || "",
            authType: (n.frontmatter.authType as "password" | "oauth2") || "password",
            folders: n.frontmatter.folders ? n.frontmatter.folders.split(",") : [],
            lastSync: n.frontmatter.lastSync,
            enabled: n.frontmatter.enabled !== "false",
          });
        }
      }
      setEmailAccounts(accounts);
    } catch (e) {
      console.error("Failed to load accounts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [vaultPath]);

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormImapHost("");
    setFormImapPort("993");
    setFormUsername("");
    setFormPassword("");
    setFormFolders("INBOX,Sent,Draft,Trash,Archive");
  };

  // 根据邮箱地址自动填充配置
  const autoFillProvider = (email: string, protocol: "imap" | "pop3" = "imap") => {
    const domain = email.split("@")[1]?.toLowerCase() || "";
    const prefix = protocol === "pop3" ? "pop" : "imap";
    if (domain.includes("163.com")) {
      setFormImapHost(`${prefix}.163.com`);
      setFormImapPort(protocol === "pop3" ? "995" : "993");
    } else if (domain.includes("126.com")) {
      setFormImapHost(`${prefix}.126.com`);
      setFormImapPort(protocol === "pop3" ? "995" : "993");
    } else if (domain.includes("qq.com") || domain.includes("foxmail.com")) {
      setFormImapHost(`${prefix}.qq.com`);
      setFormImapPort(protocol === "pop3" ? "995" : "993");
    } else if (domain.includes("gmail.com") || domain.includes("googlemail.com")) {
      setFormImapHost("imap.gmail.com");
      setFormImapPort("993");
    } else if (domain.includes("outlook.com") || domain.includes("hotmail.com") || domain.includes("office365.com")) {
      setFormImapHost("outlook.office365.com");
      setFormImapPort("993");
    } else if (domain.includes("aliyun.com")) {
      setFormImapHost(`${prefix}.aliyun.com`);
      setFormImapPort(protocol === "pop3" ? "995" : "993");
    }
    // Set username to email if empty
    if (!formUsername && email) {
      setFormUsername(email);
    }
  };

  const handleSaveAccount = async () => {
    if (!vaultPath || !formName.trim() || !formEmail.trim()) return;

    const id = `email-${Date.now()}`;
    const slug = formName.toLowerCase().replace(/\s+/g, "-");
    const path = `${vaultPath}/${EMAILS_DIR}/${slug}.md`;

    console.log("Saving account - formPassword:", formPassword);

    const fm: Record<string, string> = {
      id,
      name: formName,
      email: formEmail,
      imapHost: formImapHost,
      imapPort: formImapPort,
      protocol: formProtocol,
      username: formUsername,
      password: formPassword || "",
      authType: "password",
      folders: formFolders,
      enabled: "true",
    };
    console.log("Saving fm:", fm);

    const content = `# ${formName}

## 账户信息
- 邮箱: ${formEmail}
- IMAP: ${formImapHost}:${formImapPort}
- 用户名: ${formUsername}

## 说明
在此添加账户备注信息
`;

    try {
      await writeNote(path, fm, content);
      await loadAccounts();
      setShowAccountForm(false);
      resetForm();
    } catch (e) {
      console.error("Failed to save account:", e);
      alert("保存失败: " + e);
    }
  };

  const handleDeleteAccount = async (account: EmailAccount) => {
    if (!vaultPath) return;
    if (!confirm(`确定要删除账户 "${account.name}" 吗？`)) return;

    try {
      // Use delete file command (need to add this to tauri)
      // For now just reload
      await loadAccounts();
      if (selectedAccount?.id === account.id) {
        setSelectedAccount(null);
      }
    } catch (e) {
      console.error("Failed to delete account:", e);
    }
  };

  const handleSync = async (account: EmailAccount) => {
    if (!account.enabled || !vaultPath) return;
    setSyncing(true);
    console.log("Starting IMAP sync for:", account.email);

    try {
      // Get IMAP settings from account
      const imapHost = account.imapHost || "imap.example.com";
      const imapPort = account.imapPort || 993;
      const password = account.password || "";

      console.log("IMAP settings:", { email: account.email, imapHost, imapPort, hasPassword: !!password });

      if (!password) {
        alert("请先在账户设置中填写密码");
        setSyncing(false);
        return;
      }

      // Sync emails
      const emails = await imapSync(
        {
          email: account.email,
          password: password,
          imapHost,
          imapPort,
          protocol: account.protocol || "imap",
        },
        vaultPath,
        "INBOX",
        50
      );

      console.log("Sync complete, received emails:", emails.length);
      // Load emails from cache
      const cached = await getCachedEmails(vaultPath, "INBOX");
      setEmails(cached);
      alert(`同步完成！获取 ${cached.length} 封邮件`);
    } catch (e) {
      console.error("IMAP sync error:", e);
      const errorMsg = String(e);
      if (errorMsg.includes("Connection refused") || errorMsg.includes("os error 35") || errorMsg.includes("Connection timed out")) {
        alert("连接失败：请检查 IMAP 服务器地址和端口是否正确。\n\n支持的端口：\n- 993 (Gmail, Outlook)\n- 995 (POP3 SSL)\n- 143 (非加密)");
      } else if (errorMsg.includes("TLS") || errorMsg.includes("SSL") || errorMsg.includes("握手")) {
        alert("TLS 连接失败：" + errorMsg);
      } else {
        alert("同步失败: " + errorMsg);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleEnabled = async (account: EmailAccount) => {
    if (!vaultPath) return;
    const slug = account.name.toLowerCase().replace(/\s+/g, "-");
    const path = `${vaultPath}/${EMAILS_DIR}/${slug}.md`;
    const fm: Record<string, string> = {
      id: account.id,
      name: account.name,
      email: account.email,
      imapHost: account.imapHost,
      imapPort: String(account.imapPort),
      protocol: account.protocol || "imap",
      username: account.username,
      authType: account.authType,
      folders: account.folders.join(","),
      enabled: String(!account.enabled),
      lastSync: account.lastSync || "",
    };
    // Preserve password if it exists
    if (account.password) {
      fm.password = account.password;
    }
    const content = `# ${account.name}\n\n## 账户信息\n- 邮箱: ${account.email}\n- IMAP: ${account.imapHost}:${account.imapPort}\n- 用户名: ${account.username}\n`;
    try {
      await writeNote(path, fm, content);
      await loadAccounts();
    } catch (e) {
      console.error("Failed to toggle account:", e);
    }
  };

  const handleStartEdit = (account: EmailAccount) => {
    setEditingAccount(account);
    setFormName(account.name);
    setFormEmail(account.email);
    setFormImapHost(account.imapHost);
    setFormImapPort(String(account.imapPort));
    setFormUsername(account.username);
    setFormPassword("");
    setFormFolders(account.folders.join(","));
    setShowAccountForm(true);
  };

  const handleSaveEdit = async () => {
    if (!vaultPath || !editingAccount || !formName.trim() || !formEmail.trim()) return;
    const slug = formName.toLowerCase().replace(/\s+/g, "-");
    const path = `${vaultPath}/${EMAILS_DIR}/${slug}.md`;
    // Only update password if provided
    const password = formPassword || (editingAccount as any).password || "";
    const fm: Record<string, string> = {
      id: editingAccount.id,
      name: formName,
      email: formEmail,
      imapHost: formImapHost,
      imapPort: formImapPort,
      username: formUsername,
      authType: "password",
      folders: formFolders,
      enabled: String(editingAccount.enabled),
    };
    if (password) {
      fm.password = password;
    }
    const content = `# ${formName}\n\n## 账户信息\n- 邮箱: ${formEmail}\n- IMAP: ${formImapHost}:${formImapPort}\n- 用户名: ${formUsername}\n`;
    try {
      await writeNote(path, fm, content);
      await loadAccounts();
      setShowAccountForm(false);
      setEditingAccount(null);
      resetForm();
    } catch (e) {
      console.error("Failed to save account:", e);
      alert("保存失败: " + e);
    }
  };

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 120px)" }}>
      {/* Account List */}
      <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-disp)", fontSize: 20, letterSpacing: 2, color: "var(--accent)" }}>
            邮箱
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { resetForm(); setShowAccountForm(true); }}
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            + 添加账户
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 20 }}>加载中...</div>
          ) : emailAccounts.length === 0 ? (
            <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📧</div>
              还没有添加邮箱账户
              <div style={{ fontSize: 11, marginTop: 8 }}>
                点击"添加账户"配置 IMAP 邮箱
              </div>
            </div>
          ) : (
            emailAccounts.map((account) => (
              <div
                key={account.id}
                onClick={() => setSelectedAccount(account)}
                onContextMenu={(e) => handleContextMenu(e, account)}
                style={{
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  background: selectedAccount?.id === account.id ? "rgba(0,200,255,0.1)" : "var(--panel)",
                  border: `1px solid ${selectedAccount?.id === account.id ? "rgba(0,200,255,0.3)" : "var(--border)"}`,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📧</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{account.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{account.email}</div>
                  </div>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: account.enabled ? "var(--accent3)" : "var(--text-dim)",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {showAccountForm ? (
          <div className="panel" style={{ padding: 24, maxWidth: 500 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{editingAccount ? "编辑邮箱账户" : "添加邮箱账户"}</div>
              <button
                className="btn btn-ghost"
                onClick={() => setShowHelp(!showHelp)}
                style={{ padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
              >
                <HelpCircle size={14} />
                配置帮助
              </button>
            </div>
            {showHelp && (
              <div style={{ marginBottom: 16, padding: 12, background: "var(--panel2)", borderRadius: "var(--radius-sm)", fontSize: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>常见邮箱配置</div>
                {Object.entries(EMAIL_PROVIDERS).map(([key, provider]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 500, color: "var(--accent)" }}>{provider.name}</div>
                    <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>IMAP: {provider.imapHost} | 端口: {provider.imapPort}</div>
                    <ol style={{ margin: 0, paddingLeft: 16, color: "var(--text-dim)", lineHeight: 1.6 }}>
                      {provider.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>账户名称</label>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="工作邮箱"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>邮箱地址</label>
                <input
                  className="input"
                  value={formEmail}
                  onChange={(e) => { setFormEmail(e.target.value); autoFillProvider(e.target.value, formProtocol); }}
                  placeholder="you@example.com"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>协议</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={`btn ${formProtocol === "imap" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => { setFormProtocol("imap"); autoFillProvider(formEmail, "imap"); }}
                    style={{ flex: 1, fontSize: 12 }}
                  >
                    IMAP
                  </button>
                  <button
                    type="button"
                    className={`btn ${formProtocol === "pop3" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => { setFormProtocol("pop3"); autoFillProvider(formEmail, "pop3"); }}
                    style={{ flex: 1, fontSize: 12 }}
                  >
                    POP3
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>{formProtocol === "imap" ? "IMAP" : "POP3"} 服务器</label>
                  <input
                    className="input"
                    value={formImapHost}
                    onChange={(e) => setFormImapHost(e.target.value)}
                    placeholder={formProtocol === "imap" ? "imap.example.com" : "pop.example.com"}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>端口</label>
                  <input
                    className="input"
                    value={formImapPort}
                    onChange={(e) => setFormImapPort(e.target.value)}
                    placeholder="993"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>用户名</label>
                <input
                  className="input"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="your@email.com"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>密码/应用专用密码</label>
                <input
                  className="input"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>文件夹（逗号分隔）</label>
                <input
                  className="input"
                  value={formFolders}
                  onChange={(e) => setFormFolders(e.target.value)}
                  placeholder="INBOX,Sent,Draft,Trash,Archive"
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={editingAccount ? handleSaveEdit : handleSaveAccount}>保存</button>
                <button className="btn btn-ghost" onClick={() => { setShowAccountForm(false); setEditingAccount(null); resetForm(); }}>取消</button>
              </div>
            </div>
          </div>
        ) : selectedAccount ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Account Header */}
            <div className="panel" style={{ padding: 16, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedAccount.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{selectedAccount.email}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSync(selectedAccount)}
                  disabled={syncing}
                  style={{ fontSize: 12 }}
                >
                  {syncing ? "同步中..." : "⟳ 同步"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => handleDeleteAccount(selectedAccount)}
                  style={{ fontSize: 12, color: "var(--accent4)" }}
                >
                  删除
                </button>
              </div>
            </div>

            {/* Folder List */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {selectedAccount.folders.map((folder) => (
                <button
                  key={folder}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "4px 12px" }}
                >
                  {folder}
                </button>
              ))}
            </div>

            {/* Email List */}
            <div style={{ flex: 1, overflow: "auto", display: "flex", gap: 12 }}>
              {/* Email List */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {emails.length === 0 ? (
                  <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
                    <div>点击"同步"收取邮件</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {emails.map((email, i) => (
                      <div
                        key={email.id || i}
                        onClick={() => setSelectedEmail(email)}
                        style={{
                          padding: "10px 12px",
                          background: selectedEmail?.id === email.id ? "rgba(0,200,255,0.1)" : "var(--panel)",
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {email.subject || "(无主题)"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 8 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                            {email.from}
                          </span>
                          <span>{email.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Email Detail */}
              {selectedEmail && (
                <div style={{ width: 320, borderLeft: "1px solid var(--border)", padding: 16, overflow: "auto" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{selectedEmail.subject}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
                    <div>From: {selectedEmail.from}</div>
                    <div>To: {selectedEmail.to}</div>
                    <div>Date: {selectedEmail.date}</div>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {selectedEmail.bodyText || "（邮件内容需要进一步解析）"}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
              <div>选择一个邮箱账户</div>
              <div style={{ fontSize: 11, marginTop: 8 }}>或点击"添加账户"创建新账户</div>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div
          style={{
            position: "fixed",
            top: ctxMenu.y,
            left: ctxMenu.x,
            zIndex: 9999,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 0",
            minWidth: 160,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: "编辑信息", action: () => handleStartEdit(ctxMenu.account) },
            { label: "同步邮件", action: () => handleSync(ctxMenu.account) },
            { label: ctxMenu.account.enabled ? "禁用账户" : "启用账户", action: () => handleToggleEnabled(ctxMenu.account) },
            { label: "删除账户", action: () => handleDeleteAccount(ctxMenu.account), danger: true },
          ].map((item, i) => (
            <div
              key={i}
              onClick={() => { item.action(); setCtxMenu(null); }}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                cursor: "pointer",
                color: (item as any).danger ? "var(--accent4)" : "var(--text)",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--panel2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
