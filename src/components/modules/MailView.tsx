import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { writeNote, listNotes, imapSync, getCachedEmails, deleteFile, sendEmail } from "@/services/tauri";
import type { EmailMessage, SendEmailRequest } from "@/services/tauri";
import type { EmailAccount } from "@/types";
import { HelpCircle, Send, ChevronDown, ChevronRight, Inbox, Mail, Star, Trash2, Archive, RefreshCw } from "lucide-react";

const EMAILS_DIR = ".lifeos/emails";
const PAGE_SIZE = 20;

// 常见邮箱配置帮助
const EMAIL_PROVIDERS = {
  "163": { name: "163邮箱", imapHost: "imap.163.com", imapPort: "993", steps: ["登录 163 邮箱网页版", "设置 → POP3/SMTP/IMAP → 开启 IMAP/SMTP 服务", "设置 → 账户安全 → 开启客户端授权密码", "使用授权密码作为登录密码"] },
  "qq": { name: "QQ邮箱", imapHost: "imap.qq.com", imapPort: "993", steps: ["登录 QQ 邮箱网页版", "设置 → 账户 → 开启 IMAP/SMTP 服务", "生成授权码（需要手机验证）", "使用授权码作为登录密码"] },
  "gmail": { name: "Gmail", imapHost: "imap.gmail.com", imapPort: "993", steps: ["登录 Gmail 网页版", "Google 账户 → 安全 → 开启两步验证", "Google 账户 → 安全 → 应用专用密码", "生成专用密码并使用"] },
  "outlook": { name: "Outlook/Hotmail", imapHost: "outlook.office365.com", imapPort: "993", steps: ["登录 Outlook 网页版", "设置 → POP 和 IMAP → 开启 IMAP", "如需 App Password，使用 Microsoft 账户安全生成"] },
};

// 文件夹图标映射
const FOLDER_ICONS: Record<string, React.ReactNode> = {
  INBOX: <Inbox size={14} />,
  Sent: <Mail size={14} />,
  Draft: <Mail size={14} />,
  Trash: <Trash2 size={14} />,
  Archive: <Archive size={14} />,
  Starred: <Star size={14} />,
};

export default function MailView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const emailAccounts = useStore((s) => s.emailAccounts);
  const setEmailAccounts = useStore((s) => s.setEmailAccounts);

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("INBOX");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; account: EmailAccount } | null>(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = () => setCtxMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("click", handleClick); window.removeEventListener("keydown", handleKey); };
  }, [ctxMenu]);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formProtocol, setFormProtocol] = useState<"imap" | "pop3">("imap");
  const [formImapHost, setFormImapHost] = useState("");
  const [formImapPort, setFormImapPort] = useState("993");
  const [formSmtpHost, setFormSmtpHost] = useState("");
  const [formSmtpPort, setFormSmtpPort] = useState("587");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFolders, setFormFolders] = useState("INBOX,Sent,Draft,Trash,Archive");

  // Pagination state
  const [emailPage, setEmailPage] = useState(0);
  const [hasMoreEmails, setHasMoreEmails] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reply state
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  // Load accounts from vault
  const loadAccounts = async () => {
    if (!vaultPath) return;
    setLoading(true);
    try {
      const dir = `${vaultPath}/${EMAILS_DIR}`;
      const notes = await listNotes(dir, false);
      const accounts: EmailAccount[] = [];
      for (const n of notes) {
        if (n.frontmatter.id && n.frontmatter.imapHost) {
          accounts.push({
            id: n.frontmatter.id,
            name: n.frontmatter.name || "",
            email: n.frontmatter.email || "",
            imapHost: n.frontmatter.imapHost || "",
            imapPort: parseInt(n.frontmatter.imapPort) || 993,
            smtpHost: n.frontmatter.smtpHost || "",
            smtpPort: parseInt(n.frontmatter.smtpPort) || 587,
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

  useEffect(() => { loadAccounts(); }, [vaultPath]);

  // 加载邮件 - 当选择账户或文件夹变化时
  useEffect(() => {
    if (!selectedAccount || !vaultPath) {
      setEmails([]);
      return;
    }
    const loadEmails = async () => {
      try {
        const cached = await getCachedEmails(vaultPath, selectedFolder, 0, PAGE_SIZE);
        console.log("Loaded emails:", cached.length, "folder:", selectedFolder);
        console.log("First email sample:", cached[0]);
        setEmails(cached);
        setHasMoreEmails(cached.length === PAGE_SIZE);
        setEmailPage(0);
        setSelectedEmail(null);
      } catch (e) {
        console.error("Failed to load cached emails:", e);
        setEmails([]);
      }
    };
    loadEmails();
  }, [selectedAccount?.id, selectedFolder, vaultPath]);

  const toggleAccountExpand = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const handleSelectAccountAndFolder = (account: EmailAccount, folder: string) => {
    setSelectedAccount(account);
    setSelectedFolder(folder);
    if (!expandedAccounts.has(account.id)) {
      setExpandedAccounts(prev => new Set(prev).add(account.id));
    }
  };

  const resetForm = () => {
    setFormName(""); setFormEmail(""); setFormImapHost("");
    setFormImapPort("993"); setFormSmtpHost(""); setFormSmtpPort("587");
    setFormUsername(""); setFormPassword(""); setFormFolders("INBOX,Sent,Draft,Trash,Archive");
  };

  const autoFillProvider = (email: string, protocol: "imap" | "pop3" = "imap") => {
    const domain = email.split("@")[1]?.toLowerCase() || "";
    const prefix = protocol === "pop3" ? "pop" : "imap";
    if (domain.includes("163.com")) { setFormImapHost(`${prefix}.163.com`); setFormImapPort(protocol === "pop3" ? "995" : "993"); setFormSmtpHost("smtp.163.com"); setFormSmtpPort("465"); }
    else if (domain.includes("qq.com") || domain.includes("foxmail.com")) { setFormImapHost(`${prefix}.qq.com`); setFormImapPort(protocol === "pop3" ? "995" : "993"); setFormSmtpHost("smtp.qq.com"); setFormSmtpPort("465"); }
    else if (domain.includes("gmail.com")) { setFormImapHost("imap.gmail.com"); setFormImapPort("993"); setFormSmtpHost("smtp.gmail.com"); setFormSmtpPort("587"); }
    else if (domain.includes("outlook.com") || domain.includes("hotmail.com")) { setFormImapHost("outlook.office365.com"); setFormImapPort("993"); setFormSmtpHost("smtp.office365.com"); setFormSmtpPort("587"); }
    if (!formUsername && email) setFormUsername(email);
  };

  const handleSaveAccount = async () => {
    if (!vaultPath || !formName.trim() || !formEmail.trim()) return;
    const id = `email-${Date.now()}`;
    const slug = formName.toLowerCase().replace(/\s+/g, "-");
    const path = `${vaultPath}/${EMAILS_DIR}/${slug}.md`;
    const fm: Record<string, string> = { id, name: formName, email: formEmail, imapHost: formImapHost, imapPort: formImapPort, smtpHost: formSmtpHost, smtpPort: formSmtpPort, protocol: formProtocol, username: formUsername, password: formPassword || "", authType: "password", folders: formFolders, enabled: "true" };
    const content = `# ${formName}\n\n## 账户信息\n- 邮箱: ${formEmail}\n- IMAP: ${formImapHost}:${formImapPort}\n- SMTP: ${formSmtpHost}:${formSmtpPort}\n\n## 说明\n在此添加账户备注信息\n`;
    try {
      await writeNote(path, fm, content);
      await loadAccounts();
      setShowAccountForm(false);
      resetForm();
    } catch (e) { alert("保存失败: " + e); }
  };

  const handleDeleteAccount = async (account: EmailAccount) => {
    if (!vaultPath) return;
    if (!confirm(`确定要删除账户 "${account.name}" 吗？`)) return;
    try {
      const slug = account.name.toLowerCase().replace(/\s+/g, "-");
      const path = `${vaultPath}/${EMAILS_DIR}/${slug}.md`;
      await deleteFile(path);
      await loadAccounts();
      if (selectedAccount?.id === account.id) { setSelectedAccount(null); setEmails([]); }
    } catch (e) { alert("删除失败: " + e); }
  };

  const handleSync = async (account: EmailAccount, folder: string = "INBOX") => {
    if (!account.enabled || !vaultPath) return;
    setSyncing(true);
    try {
      const imapHost = account.imapHost || "imap.example.com";
      const imapPort = account.imapPort || 993;
      const password = account.password || "";
      if (!password) { alert("请先在账户设置中填写密码"); setSyncing(false); return; }
      const emails = await imapSync({ email: account.email, password, imapHost, imapPort, protocol: account.protocol || "imap" }, vaultPath, folder, 50);
      console.log("Sync complete, emails:", emails.length);
      // Reload current folder
      const cached = await getCachedEmails(vaultPath, selectedFolder, 0, PAGE_SIZE);
      setEmails(cached);
      setHasMoreEmails(cached.length === PAGE_SIZE);
      alert(`同步完成！获取 ${emails.length} 封邮件`);
    } catch (e) {
      console.error("IMAP sync error:", e);
      alert("同步失败: " + e);
    } finally { setSyncing(false); }
  };

  const handleToggleEnabled = async (account: EmailAccount) => {
    if (!vaultPath) return;
    const slug = account.name.toLowerCase().replace(/\s+/g, "-");
    const path = `${vaultPath}/${EMAILS_DIR}/${slug}.md`;
    const fm: Record<string, string> = { id: account.id, name: account.name, email: account.email, imapHost: account.imapHost, imapPort: String(account.imapPort), protocol: account.protocol || "imap", username: account.username, authType: account.authType, folders: account.folders.join(","), enabled: String(!account.enabled), lastSync: account.lastSync || "" };
    if (account.password) fm.password = account.password;
    const content = `# ${account.name}\n\n## 账户信息\n- 邮箱: ${account.email}\n- IMAP: ${account.imapHost}:${account.imapPort}\n- 用户名: ${account.username}\n`;
    try { await writeNote(path, fm, content); await loadAccounts(); } catch (e) { console.error("Failed to toggle account:", e); }
  };

  const handleStartEdit = (account: EmailAccount) => {
    setEditingAccount(account);
    setFormName(account.name); setFormEmail(account.email);
    setFormImapHost(account.imapHost); setFormImapPort(String(account.imapPort));
    setFormSmtpHost(account.smtpHost || ""); setFormSmtpPort(String(account.smtpPort || 587));
    setFormUsername(account.username); setFormPassword(""); setFormFolders(account.folders.join(","));
    setShowAccountForm(true);
  };

  const handleSaveEdit = async () => {
    if (!vaultPath || !editingAccount || !formName.trim() || !formEmail.trim()) return;
    const slug = formName.toLowerCase().replace(/\s+/g, "-");
    const path = `${vaultPath}/${EMAILS_DIR}/${slug}.md`;
    const oldSlug = editingAccount.name.toLowerCase().replace(/\s+/g, "-");
    const oldPath = `${vaultPath}/${EMAILS_DIR}/${oldSlug}.md`;
    if (oldPath !== path) { try { await deleteFile(oldPath); } catch {} }
    const password = formPassword || (editingAccount as any).password || "";
    const fm: Record<string, string> = { id: editingAccount.id, name: formName, email: formEmail, imapHost: formImapHost, imapPort: formImapPort, smtpHost: formSmtpHost, smtpPort: formSmtpPort, protocol: formProtocol, username: formUsername, authType: "password", folders: formFolders, enabled: String(editingAccount.enabled) };
    if (password) fm.password = password;
    const content = `# ${formName}\n\n## 账户信息\n- 邮箱: ${formEmail}\n- IMAP: ${formImapHost}:${formImapPort}\n- 用户名: ${formUsername}\n`;
    try {
      await writeNote(path, fm, content);
      await loadAccounts();
      setShowAccountForm(false);
      setEditingAccount(null);
      resetForm();
    } catch (e) { alert("保存失败: " + e); }
  };

  const handleLoadMore = async () => {
    if (!vaultPath || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = emailPage + 1;
      const cached = await getCachedEmails(vaultPath, selectedFolder, nextPage * PAGE_SIZE, PAGE_SIZE);
      setEmails(prev => [...prev, ...cached]);
      setEmailPage(nextPage);
      setHasMoreEmails(cached.length === PAGE_SIZE);
    } catch (e) { console.error("Failed to load more emails:", e); }
    finally { setLoadingMore(false); }
  };

  const handleSendReply = async () => {
    if (!selectedAccount || !selectedEmail || !replyBody.trim()) return;
    if (!selectedAccount.smtpHost) { alert("请先在账户设置中配置 SMTP 服务器"); return; }
    setSending(true);
    try {
      const request: SendEmailRequest = {
        smtp: { from_email: selectedAccount.email, from_name: selectedAccount.name, password: selectedAccount.password || "", smtp_host: selectedAccount.smtpHost, smtp_port: selectedAccount.smtpPort || 587 },
        to: selectedEmail.from,
        subject: `Re: ${selectedEmail.subject}`,
        body: replyBody,
        in_reply_to: selectedEmail.id,
      };
      await sendEmail(request);
      alert("回复发送成功！");
      setReplyBody(""); setShowReply(false);
    } catch (e) { alert("发送失败: " + e); }
    finally { setSending(false); }
  };

  // ==================== 三层布局渲染 ====================
  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", gap: 0 }}>
      {/* 第一层：左侧 - 账号列表 + 文件夹 */}
      <div style={{ width: 240, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--panel)" }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "var(--font-disp)", fontSize: 16, letterSpacing: 1, color: "var(--accent)" }}>邮箱</div>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowAccountForm(true); }} style={{ fontSize: 11, padding: "4px 8px" }}>+ 添加</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
          {loading ? (
            <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 20 }}>加载中...</div>
          ) : emailAccounts.length === 0 ? (
            <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 20, fontSize: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📧</div>
              暂无邮箱账户
            </div>
          ) : (
            emailAccounts.map((account) => (
              <div key={account.id}>
                {/* 账号行 */}
                <div
                  onClick={() => toggleAccountExpand(account.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    borderRadius: "var(--radius-sm)", cursor: "pointer",
                    background: selectedAccount?.id === account.id ? "rgba(0,200,255,0.15)" : "transparent",
                    border: selectedAccount?.id === account.id ? "1px solid rgba(0,200,255,0.3)" : "1px solid transparent",
                  }}
                >
                  {expandedAccounts.has(account.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ fontSize: 16 }}>📧</span>
                  <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 500 }}>{account.name}</div>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: account.enabled ? "var(--accent3)" : "var(--text-dim)" }} />
                </div>

                {/* 文件夹列表（可展开） */}
                {expandedAccounts.has(account.id) && (
                  <div style={{ marginLeft: 20, marginTop: 4, marginBottom: 8 }}>
                    {account.folders.map((folder) => (
                      <div
                        key={folder}
                        onClick={() => handleSelectAccountAndFolder(account, folder)}
                        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, account }); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                          borderRadius: "var(--radius-sm)", cursor: "pointer",
                          background: selectedAccount?.id === account.id && selectedFolder === folder ? "rgba(0,200,255,0.1)" : "transparent",
                          fontSize: 12, color: selectedAccount?.id === account.id && selectedFolder === folder ? "var(--accent)" : "var(--text-dim)",
                        }}
                      >
                        {FOLDER_ICONS[folder] || <Inbox size={14} />}
                        <span>{folder}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 第二层：中间 - 邮件列表 */}
      <div style={{ width: 320, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        {/* 邮件列表头部 */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--panel)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedFolder}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{selectedAccount?.email}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => selectedAccount && handleSync(selectedAccount, selectedFolder)} disabled={syncing} style={{ padding: "6px" }}>
            <RefreshCw size={14} className={syncing ? "spin" : ""} />
          </button>
        </div>

        {/* 邮件列表 */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {!selectedAccount ? (
            <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 40, fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
              选择一个邮箱账户
            </div>
          ) : emails.length === 0 ? (
            <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 40, fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              暂无邮件<br />
              <span style={{ fontSize: 11 }}>点击同步按钮收取邮件</span>
            </div>
          ) : (
            <>
              {emails.map((email, i) => (
                <div
                  key={email.id || i}
                  onClick={() => { setSelectedEmail(email); setShowReply(false); }}
                  style={{
                    padding: "12px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                    background: selectedEmail?.id === email.id ? "rgba(0,200,255,0.1)" : "var(--panel)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email.subject || "(无主题)"}
                    </span>
                    {email.flags?.includes("Seen") === false && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{email.from}</span>
                    <span style={{ flexShrink: 0 }}>{email.date?.slice(0, 10) || ""}</span>
                  </div>
                </div>
              ))}
              {hasMoreEmails && (
                <button onClick={handleLoadMore} disabled={loadingMore} style={{ width: "100%", padding: 12, background: "transparent", border: "none", borderTop: "1px solid var(--border)", color: "var(--accent)", cursor: loadingMore ? "wait" : "pointer", fontSize: 12 }}>
                  {loadingMore ? "加载中..." : "加载更多"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 第三层：右侧 - 邮件详情 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
        {showAccountForm ? (
          <AccountForm
            formName={formName} setFormName={setFormName}
            formEmail={formEmail} setFormEmail={setFormEmail}
            formProtocol={formProtocol} setFormProtocol={setFormProtocol}
            formImapHost={formImapHost} setFormImapHost={setFormImapHost}
            formImapPort={formImapPort} setFormImapPort={setFormImapPort}
            formSmtpHost={formSmtpHost} setFormSmtpHost={setFormSmtpHost}
            formSmtpPort={formSmtpPort} setFormSmtpPort={setFormSmtpPort}
            formUsername={formUsername} setFormUsername={setFormUsername}
            formPassword={formPassword} setFormPassword={setFormPassword}
            formFolders={formFolders} setFormFolders={setFormFolders}
            showHelp={showHelp} setShowHelp={setShowHelp}
            editingAccount={editingAccount}
            onSave={editingAccount ? handleSaveEdit : handleSaveAccount}
            onCancel={() => { setShowAccountForm(false); setEditingAccount(null); resetForm(); }}
            autoFillProvider={autoFillProvider}
          />
        ) : selectedEmail ? (
          <EmailDetail
            email={selectedEmail}
            showReply={showReply} setShowReply={setShowReply}
            replyBody={replyBody} setReplyBody={setReplyBody}
            sending={sending}
            onSend={handleSendReply}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
              <div>选择一封邮件查看详情</div>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div style={{ position: "fixed", top: ctxMenu.y, left: ctxMenu.x, zIndex: 9999, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "4px 0", minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }} onClick={(e) => e.stopPropagation()}>
          {[
            { label: "编辑信息", action: () => handleStartEdit(ctxMenu.account) },
            { label: "同步邮件", action: () => handleSync(ctxMenu.account) },
            { label: ctxMenu.account.enabled ? "禁用账户" : "启用账户", action: () => handleToggleEnabled(ctxMenu.account) },
            { label: "删除账户", action: () => handleDeleteAccount(ctxMenu.account), danger: true },
          ].map((item, i) => (
            <div key={i} onClick={() => { item.action(); setCtxMenu(null); }} style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", color: (item as any).danger ? "var(--accent4)" : "var(--text)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              {item.label}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ==================== 子组件 ====================

function AccountForm({ formName, setFormName, formEmail, setFormEmail, formProtocol, setFormProtocol, formImapHost, setFormImapHost, formImapPort, setFormImapPort, formSmtpHost, setFormSmtpHost, formSmtpPort, setFormSmtpPort, formUsername, setFormUsername, formPassword, setFormPassword, formFolders, setFormFolders, showHelp, setShowHelp, editingAccount, onSave, onCancel, autoFillProvider }: any) {
  return (
    <div style={{ padding: 24, overflow: "auto", maxWidth: 500 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>{editingAccount ? "编辑邮箱账户" : "添加邮箱账户"}</div>
        <button className="btn btn-ghost" onClick={() => setShowHelp(!showHelp)} style={{ padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><HelpCircle size={14} />配置帮助</button>
      </div>
      {showHelp && (
        <div style={{ marginBottom: 16, padding: 12, background: "var(--panel2)", borderRadius: "var(--radius-sm)", fontSize: 12 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>常见邮箱配置</div>
          {Object.entries(EMAIL_PROVIDERS).map(([key, provider]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 500, color: "var(--accent)" }}>{provider.name}</div>
              <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>IMAP: {provider.imapHost} | 端口: {provider.imapPort}</div>
              <ol style={{ margin: 0, paddingLeft: 16, color: "var(--text-dim)", lineHeight: 1.6 }}>{provider.steps.map((step: any, i: number) => <li key={i}>{step}</li>)}</ol>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>账户名称</label><input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="工作邮箱" style={{ width: "100%" }} /></div>
        <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>邮箱地址</label><input className="input" value={formEmail} onChange={(e) => { setFormEmail(e.target.value); autoFillProvider(e.target.value, formProtocol); }} placeholder="you@example.com" style={{ width: "100%" }} /></div>
        <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>协议</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={`btn ${formProtocol === "imap" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setFormProtocol("imap"); autoFillProvider(formEmail, "imap"); }} style={{ flex: 1, fontSize: 12 }}>IMAP</button>
            <button type="button" className={`btn ${formProtocol === "pop3" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setFormProtocol("pop3"); autoFillProvider(formEmail, "pop3"); }} style={{ flex: 1, fontSize: 12 }}>POP3</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>{formProtocol === "imap" ? "IMAP" : "POP3"} 服务器</label><input className="input" value={formImapHost} onChange={(e) => setFormImapHost(e.target.value)} placeholder={formProtocol === "imap" ? "imap.example.com" : "pop.example.com"} style={{ width: "100%" }} /></div>
          <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>端口</label><input className="input" value={formImapPort} onChange={(e) => setFormImapPort(e.target.value)} placeholder="993" style={{ width: "100%" }} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>SMTP 服务器</label><input className="input" value={formSmtpHost} onChange={(e) => setFormSmtpHost(e.target.value)} placeholder="smtp.example.com" style={{ width: "100%" }} /></div>
          <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>端口</label><input className="input" value={formSmtpPort} onChange={(e) => setFormSmtpPort(e.target.value)} placeholder="587" style={{ width: "100%" }} /></div>
        </div>
        <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>用户名</label><input className="input" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="your@email.com" style={{ width: "100%" }} /></div>
        <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>密码/应用专用密码</label><input className="input" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%" }} /></div>
        <div><label style={{ fontSize: 12, color: "var(--text-mid)", display: "block", marginBottom: 4 }}>文件夹（逗号分隔）</label><input className="input" value={formFolders} onChange={(e) => setFormFolders(e.target.value)} placeholder="INBOX,Sent,Draft,Trash,Archive" style={{ width: "100%" }} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={onSave}>保存</button>
          <button className="btn btn-ghost" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}

function EmailDetail({ email, showReply, setShowReply, replyBody, setReplyBody, sending, onSend }: { email: EmailMessage; showReply: boolean; setShowReply: (v: boolean) => void; replyBody: string; setReplyBody: (v: string) => void; sending: boolean; onSend: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 头部 */}
      <div style={{ padding: 20, borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>{email.subject}</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div><span style={{ color: "var(--text-mid)" }}>From:</span> {email.from}</div>
          <div><span style={{ color: "var(--text-mid)" }}>To:</span> {email.to}</div>
          <div><span style={{ color: "var(--text-mid)" }}>Date:</span> {email.date}</div>
        </div>
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {email.bodyHtml ? (
          <iframe
            srcDoc={email.bodyHtml}
            sandbox="allow-same-origin"
            style={{ width: "100%", height: "100%", minHeight: 400, border: "none", background: "#fff", borderRadius: "var(--radius-sm)" }}
            title="Email content"
          />
        ) : (
          <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--text)" }}>
            {email.bodyText || "（邮件内容为空或需要进一步解析）"}
          </div>
        )}
      </div>

      {/* 回复区域 */}
      <div style={{ borderTop: "1px solid var(--border)", padding: 16, background: "var(--panel)" }}>
        {showReply ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>回复给: {email.from}</div>
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="输入回复内容..." rows={4} className="input" style={{ width: "100%", resize: "vertical", fontSize: 13 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={onSend} disabled={sending || !replyBody.trim()} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Send size={14} />{sending ? "发送中..." : "发送"}</button>
              <button className="btn btn-ghost" onClick={() => { setShowReply(false); setReplyBody(""); }} style={{ fontSize: 12 }}>取消</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => setShowReply(true)} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Send size={14} /> 回复</button>
        )}
      </div>
    </div>
  );
}
