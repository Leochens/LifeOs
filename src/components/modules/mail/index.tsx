import { useState, useEffect } from "react";
import { useStore } from "@/stores/app";
import { imapSync, getCachedEmails, deleteFile, sendEmail, readFile, writeFile, listDir, deleteEmail, markEmailRead, openExternalUrl } from "@/services/fs";
import type { EmailMessage, SendEmailRequest } from "@/services/fs";
import type { EmailAccount } from "@/types";
import { HelpCircle, Send, ChevronDown, ChevronRight, Inbox, Mail, Star, Trash2, Archive, RefreshCw, Plus, X, MailOpen, Circle, Search } from "lucide-react";

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
  const formProtocol: "imap" | "pop3" = "pop3";
  const [formImapHost, setFormImapHost] = useState("");
  const [formImapPort, setFormImapPort] = useState("995");
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

  // Compose new email state
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composing, setComposing] = useState(false);

  // Delete email state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Forward state
  const [forwardMode, setForwardMode] = useState<"reply" | "forward" | null>(null);

  // Load accounts from vault
  const loadAccounts = async () => {
    if (!vaultPath) return;
    setLoading(true);
    try {
      const dir = `${vaultPath}/${EMAILS_DIR}`;
      const files = await listDir(dir, false);
      const accounts: EmailAccount[] = [];
      for (const file of files) {
        if (!file.is_dir && file.name.endsWith(".json")) {
          try {
            const content = await readFile(file.path);
            const data = JSON.parse(content);
            console.log("[DEBUG] loadAccounts - file:", file.name, "data:", JSON.stringify(data));
            if (data.id && data.imapHost) {
              console.log("[DEBUG] loadAccounts - pushing account with id:", data.id);
              accounts.push({
                id: data.id,
                name: data.name || "",
                email: data.email || "",
                imapHost: data.imapHost || "",
                imapPort: parseInt(data.imapPort) || 993,
                smtpHost: data.smtpHost || "",
                smtpPort: parseInt(data.smtpPort) || 587,
                protocol: data.protocol || "pop3",
                username: data.username || "",
                password: data.password || "",
                authType: data.authType || "password",
                folders: data.folders ? data.folders.split(",") : [],
                lastSync: data.lastSync,
                enabled: data.enabled !== false,
              });
            }
          } catch (e) {
            console.error("Failed to parse account file:", file.path, e);
          }
        }
      }
      console.log("[DEBUG] loadAccounts - final accounts:", JSON.stringify(accounts));
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
        const cached = await getCachedEmails(vaultPath, selectedAccount?.id || "", 0, PAGE_SIZE);
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

  const autoFillProvider = (email: string, protocol: "imap" | "pop3" = "pop3") => {
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
    // 生成唯一的账户 ID
    const id = crypto.randomUUID();
    const path = `${vaultPath}/${EMAILS_DIR}/${id}.json`;
    const accountData = {
      id,
      name: formName,
      email: formEmail,
      imapHost: formImapHost,
      imapPort: formImapPort,
      smtpHost: formSmtpHost,
      smtpPort: formSmtpPort,
      protocol: formProtocol,
      username: formUsername,
      password: formPassword || "",
      authType: "password",
      folders: formFolders,
      enabled: true
    };
    try {
      await writeFile(path, JSON.stringify(accountData, null, 2));
      await loadAccounts();
      setShowAccountForm(false);
      resetForm();
    } catch (e) { alert("保存失败: " + e); }
  };

  const handleDeleteAccount = async (account: EmailAccount) => {
    if (!vaultPath) return;
    if (!confirm(`确定要删除账户 "${account.name}" 吗？`)) return;
    try {
      const path = `${vaultPath}/${EMAILS_DIR}/${account.id}.json`;
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
      console.log("[DEBUG] handleSync - account.id:", account.id, "account.email:", account.email);
      const emails = await imapSync({ email: account.email, password, imapHost, imapPort, protocol: account.protocol || "pop3", account_id: account.id }, vaultPath, folder, 50);
      console.log("Sync complete, emails:", emails.length);
      // Reload current folder
      const cached = await getCachedEmails(vaultPath, selectedAccount?.id || "", 0, PAGE_SIZE);
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
    const path = `${vaultPath}/${EMAILS_DIR}/${account.id}.json`;
    const accountData = {
      id: account.id,
      name: account.name,
      email: account.email,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      protocol: account.protocol || "pop3",
      username: account.username,
      password: account.password || "",
      authType: account.authType || "password",
      folders: account.folders.join(","),
      enabled: !account.enabled,
      lastSync: account.lastSync || ""
    };
    try { await writeFile(path, JSON.stringify(accountData, null, 2)); await loadAccounts(); } catch (e) { console.error("Failed to toggle account:", e); }
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
    // 保持原有的 account_id 不变
    const path = `${vaultPath}/${EMAILS_DIR}/${editingAccount.id}.json`;
    const password = formPassword || editingAccount.password || "";
    const accountData = {
      id: editingAccount.id,  // 保持不变
      name: formName,
      email: formEmail,
      imapHost: formImapHost,
      imapPort: formImapPort,
      smtpHost: formSmtpHost,
      smtpPort: formSmtpPort,
      protocol: formProtocol,
      username: formUsername,
      password,
      authType: "password",
      folders: formFolders,
      enabled: editingAccount.enabled
    };
    try {
      await writeFile(path, JSON.stringify(accountData, null, 2));
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
      const cached = await getCachedEmails(vaultPath, selectedAccount?.id || "", nextPage * PAGE_SIZE, PAGE_SIZE);
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
      console.log("[DEBUG] handleSendReply request:", JSON.stringify(request));
      await sendEmail(request);
      alert("回复发送成功！");
      setReplyBody(""); setShowReply(false);
    } catch (e) { alert("发送失败: " + e); }
    finally { setSending(false); }
  };

  // Handle compose new email
  const handleSendCompose = async () => {
    if (!selectedAccount) { alert("请先选择一个邮箱账户"); return; }
    if (!composeTo.trim()) { alert("请填写收件人"); return; }
    if (!composeSubject.trim()) { alert("请填写主题"); return; }
    if (!composeBody.trim()) { alert("请填写邮件内容"); return; }
    if (!selectedAccount.smtpHost) { alert("请先在账户设置中配置 SMTP 服务器"); return; }

    setComposing(true);
    try {
      const request: SendEmailRequest = {
        smtp: { from_email: selectedAccount.email, from_name: selectedAccount.name, password: selectedAccount.password || "", smtp_host: selectedAccount.smtpHost, smtp_port: selectedAccount.smtpPort || 587 },
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      };
      console.log("[DEBUG] handleSendCompose request:", JSON.stringify(request));
      await sendEmail(request);
      alert("邮件发送成功！");
      setShowCompose(false);
      setComposeTo(""); setComposeCc(""); setComposeBcc("");
      setComposeSubject(""); setComposeBody("");
      setForwardMode(null);
    } catch (e) { alert("发送失败: " + e); }
    finally { setComposing(false); }
  };

  // Handle forward email
  const handleForward = () => {
    if (!selectedEmail) return;
    const originalContent = selectedEmail.bodyText || selectedEmail.bodyHtml?.replace(/<[^>]*>/g, "") || "（无正文）";
    const forwardBody = `
---------- 转发邮件 ----------
发件人: ${selectedEmail.from}
收件人: ${selectedEmail.to || ""}
日期: ${selectedEmail.date}
主题: ${selectedEmail.subject}

${originalContent}`;
    setComposeTo("");
    setComposeCc("");
    setComposeBcc("");
    setComposeSubject(`Fwd: ${selectedEmail.subject}`);
    setComposeBody(forwardBody);
    setForwardMode("forward");
    setShowCompose(true);
  };

  // Handle delete email
  const handleDeleteEmail = async () => {
    if (!selectedAccount || !selectedEmail || !vaultPath) return;
    setDeleting(true);
    try {
      await deleteEmail(vaultPath, selectedAccount.id, selectedEmail.id, selectedAccount.imapHost, selectedAccount.imapPort, selectedAccount.password, selectedAccount.email, selectedEmail.folder);
      setEmails(prev => prev.filter(e => e.id !== selectedEmail.id));
      setSelectedEmail(null);
      setShowDeleteConfirm(false);
      alert("邮件已删除");
    } catch (e) { alert("删除失败: " + e); }
    finally { setDeleting(false); }
  };

  // Handle mark email as read/unread
  const handleMarkAsRead = async (read: boolean) => {
    if (!selectedAccount || !selectedEmail || !vaultPath) return;
    try {
      await markEmailRead(vaultPath, selectedAccount.id, selectedEmail.id, read, selectedEmail.folder, selectedAccount.imapHost, selectedAccount.imapPort, selectedAccount.password, selectedAccount.email);
      setSelectedEmail(prev => prev ? { ...prev, flags: read ? [...(prev.flags || []), "Seen"] : (prev.flags || []).filter(f => f !== "Seen") } : null);
      setEmails(prev => prev.map(e => e.id === selectedEmail.id ? { ...e, flags: read ? [...(e.flags || []), "Seen"] : (e.flags || []).filter(f => f !== "Seen") } : e));
    } catch (e) { console.error(e); }
  };

  // Handle selecting an email - auto mark as read
  const handleSelectEmail = (email: EmailMessage) => {
    setSelectedEmail(email);
    setShowReply(false);
    // Auto mark as read if not already read
    if (!email.flags?.includes("Seen") && selectedAccount && vaultPath) {
      markEmailRead(vaultPath, selectedAccount.id, email.id, true, email.folder, selectedAccount.imapHost, selectedAccount.imapPort, selectedAccount.password, selectedAccount.email)
        .then(() => {
          setEmails(prev => prev.map(e => e.id === email.id ? { ...e, flags: [...(e.flags || []), "Seen"] } : e));
        })
        .catch(console.error);
    }
  };

  // Check if email is read
  const isEmailRead = (email: EmailMessage) => email.flags?.includes("Seen") ?? false;

  // ==================== 三层布局渲染 ====================
  return (
    <div className="flex h-[calc(100vh-120px)] gap-0">
      {/* 第一层：左侧 - 账号列表 + 文件夹 */}
      <div className="w-[240px] border-r border-border flex flex-col bg-panel">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="font-[var(--font-disp)] text-[16px] tracking-[1px] text-accent">邮箱</div>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowAccountForm(true); }} style={{ fontSize: 11, padding: "4px 8px" }}>+ 添加</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="text-text-dim text-center p-5">加载中...</div>
          ) : emailAccounts.length === 0 ? (
            <div className="text-text-dim text-center p-5 text-[12px]">
              <div className="text-[24px] mb-2">📧</div>
              暂无邮箱账户
            </div>
          ) : (
            emailAccounts.map((account) => (
              <div key={account.id}>
                {/* 账号行 */}
                <div
                  onClick={() => toggleAccountExpand(account.id)}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, account }); }}
                  className="flex items-center gap-2 p-[8px_10px] rounded-[var(--radius-sm)] cursor-pointer"
                  style={{
                    background: selectedAccount?.id === account.id ? "rgba(0,200,255,0.15)" : "transparent",
                    border: selectedAccount?.id === account.id ? "1px solid rgba(0,200,255,0.3)" : "1px solid transparent",
                  }}
                >
                  {expandedAccounts.has(account.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="text-[16px]">📧</span>
                  <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium">{account.name}</div>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: account.enabled ? "var(--accent3)" : "var(--text-dim)" }} />
                </div>

                {/* 文件夹列表（可展开） */}
                {expandedAccounts.has(account.id) && (
                  <div className="ml-5 mt-1 mb-2">
                    {account.folders.map((folder) => (
                      <div
                        key={folder}
                        onClick={() => handleSelectAccountAndFolder(account, folder)}
                        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, account }); }}
                        className="flex items-center gap-2 p-[6px_10px] rounded-[var(--radius-sm)] cursor-pointer text-[12px]"
                        style={{
                          background: selectedAccount?.id === account.id && selectedFolder === folder ? "rgba(0,200,255,0.1)" : "transparent",
                          color: selectedAccount?.id === account.id && selectedFolder === folder ? "var(--accent)" : "var(--text-dim)",
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
      <div className="w-[320px] border-r border-border flex flex-col bg-bg">
        {/* 邮件列表头部 */}
        <div className="p-[12px_16px] border-b border-border flex items-center justify-between bg-panel">
          <div>
            <div className="text-[14px] font-semibold">{selectedFolder}</div>
            <div className="text-[11px] text-text-dim">{selectedAccount?.email}</div>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn btn-primary flex items-center gap-1" onClick={() => { if (!selectedAccount) { alert("请先选择一个邮箱账户"); return; } setShowCompose(true); }} style={{ fontSize: 11, padding: "4px 8px" }} disabled={!selectedAccount}>
              <Plus size={14} /> 写邮件
            </button>
            <button className="btn btn-ghost" onClick={() => selectedAccount && handleSync(selectedAccount, selectedFolder)} disabled={syncing} style={{ padding: "6px" }}>
              <RefreshCw size={14} className={syncing ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        {selectedAccount && !loading && emails.length > 0 && (
          <div className="px-3 py-2 border-b border-border bg-panel">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                className="input w-full pl-9 pr-8 text-[12px]"
                placeholder="搜索主题、发件人、收件人..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text" onClick={() => setSearchQuery("")}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 邮件列表 */}
        <div className="flex-1 overflow-auto">
          {!selectedAccount ? (
            <div className="text-text-dim text-center p-10 text-[13px]">
              <div className="text-[32px] mb-3">📬</div>
              选择一个邮箱账户
            </div>
          ) : emails.length === 0 ? (
            <div className="text-text-dim text-center p-10 text-[13px]">
              <div className="text-[32px] mb-3">📭</div>
              暂无邮件<br />
              <span className="text-[11px]">点击同步按钮收取邮件</span>
            </div>
          ) : (() => {
              const filteredEmails = searchQuery.trim()
                ? emails.filter(email => {
                    const query = searchQuery.toLowerCase();
                    return (
                      (email.subject?.toLowerCase().includes(query)) ||
                      (email.from?.toLowerCase().includes(query)) ||
                      (email.to?.toLowerCase().includes(query))
                    );
                  })
                : emails;

              if (searchQuery.trim() && filteredEmails.length === 0) {
                return (
                  <div className="text-text-dim text-center p-10 text-[13px]">
                    <div className="text-[32px] mb-3">🔍</div>
                    没有找到匹配的邮件<br />
                    <span className="text-[11px]">尝试其他关键词</span>
                  </div>
                );
              }

              return (
                <>
                  {searchQuery.trim() && (
                    <div className="px-4 py-2 text-[11px] text-text-dim bg-panel2 border-b border-border">
                      找到 {filteredEmails.length} 封邮件
                    </div>
                  )}
                  {filteredEmails.map((email, i) => (
                <div
                  key={email.id || i}
                  onClick={() => handleSelectEmail(email)}
                  className="p-[12px_16px] border-b border-border cursor-pointer"
                  style={{
                    background: selectedEmail?.id === email.id ? "rgba(0,200,255,0.1)" : "var(--panel)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex-1 text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                      {email.subject || "(无主题)"}
                    </span>
                    {email.flags?.includes("Seen") === false && <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />}
                  </div>
                  <div className="text-[11px] text-text-dim flex justify-between">
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]">{email.from}</span>
                    <span className="flex-shrink-0">{email.date?.slice(0, 10) || ""}</span>
                  </div>
                </div>
              ))}
              {hasMoreEmails && (
                <button onClick={handleLoadMore} disabled={loadingMore} className="w-full p-3 bg-transparent border-none border-t border-border text-accent cursor-pointer text-[12px]" style={{ cursor: loadingMore ? "wait" : "pointer" }}>
                  {loadingMore ? "加载中..." : "加载更多"}
                </button>
              )}
            </>
            );
          })()}
        </div>
      </div>

      {/* 第三层：右侧 - 邮件详情 */}
      <div className="flex-1 flex flex-col bg-bg overflow-hidden">
        {showAccountForm ? (
          <AccountForm
            formName={formName} setFormName={setFormName}
            formEmail={formEmail} setFormEmail={setFormEmail}
            formProtocol={formProtocol}
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
            onForward={handleForward}
            onDelete={() => setShowDeleteConfirm(true)}
            onMarkAsRead={handleMarkAsRead}
            isRead={isEmailRead(selectedEmail)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-dim">
            <div className="text-center">
              <div className="text-[48px] mb-3">📄</div>
              <div>选择一封邮件查看详情</div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedEmail && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-panel rounded-lg shadow-2xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                <X size={20} />
              </div>
              <div className="text-[16px] font-semibold">删除邮件</div>
            </div>
            <div className="text-[13px] text-text-dim mb-4">确定要删除这封邮件吗？此操作将同时删除本地缓存和服务器上的邮件。</div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>取消</button>
              <button className="btn text-white" onClick={handleDeleteEmail} disabled={deleting} style={{ background: "var(--accent4)" }}>
                {deleting ? "删除中..." : "删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Email Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50" onClick={() => setShowCompose(false)}>
          <div className="bg-panel rounded-lg shadow-2xl w-[700px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="text-[16px] font-semibold">{forwardMode === "forward" ? "转发邮件" : "写邮件"}</div>
              <button className="btn btn-ghost p-1" onClick={() => setShowCompose(false)}>
                <X size={18} />
              </button>
            </div>
            {/* Form */}
            <div className="flex-1 overflow-auto p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-text-mid w-12">From:</span>
                  <span className="text-text">{selectedAccount?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-mid w-12 text-[13px]">To:</span>
                  <input className="input flex-1 text-[13px]" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="收件人邮箱" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-mid w-12 text-[13px]">Cc:</span>
                  <input className="input flex-1 text-[13px]" value={composeCc} onChange={(e) => setComposeCc(e.target.value)} placeholder="抄送（可选）" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-mid w-12 text-[13px]">Bcc:</span>
                  <input className="input flex-1 text-[13px]" value={composeBcc} onChange={(e) => setComposeBcc(e.target.value)} placeholder="密送（可选）" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-mid w-12 text-[13px]">Subject:</span>
                  <input className="input flex-1 text-[13px]" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="邮件主题" />
                </div>
                <div className="mt-2">
                  <textarea className="input w-full resize-vertical text-[13px]" value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="邮件正文..." rows={12} style={{ minHeight: "200px" }} />
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <button className="btn btn-ghost" onClick={() => setShowCompose(false)}>取消</button>
              <button className="btn btn-primary flex items-center gap-1" onClick={handleSendCompose} disabled={composing || !composeTo.trim() || !composeSubject.trim()}>
                <Send size={14} />
                {composing ? "发送中..." : "发送"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <div className="fixed z-[9999] bg-panel border border-border rounded-[var(--radius-sm)] py-1 min-w-[160px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={(e) => e.stopPropagation()}>
          {[
            { label: "编辑信息", action: () => handleStartEdit(ctxMenu.account) },
            { label: "同步邮件", action: () => handleSync(ctxMenu.account) },
            { label: ctxMenu.account.enabled ? "禁用账户" : "启用账户", action: () => handleToggleEnabled(ctxMenu.account) },
            { label: "删除账户", action: () => handleDeleteAccount(ctxMenu.account), danger: true },
          ].map((item, i) => (
            <div key={i} onClick={() => { item.action(); setCtxMenu(null); }} className="p-[8px_16px] text-[13px] cursor-pointer" style={{ color: (item as any).danger ? "var(--accent4)" : "var(--text)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
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

function AccountForm({ formName, setFormName, formEmail, setFormEmail, formProtocol, formImapHost, setFormImapHost, formImapPort, setFormImapPort, formSmtpHost, setFormSmtpHost, formSmtpPort, setFormSmtpPort, formUsername, setFormUsername, formPassword, setFormPassword, formFolders, setFormFolders, showHelp, setShowHelp, editingAccount, onSave, onCancel, autoFillProvider }: any) {
  return (
    <div className="p-6 overflow-auto max-w-[500px]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[16px] font-medium">{editingAccount ? "编辑邮箱账户" : "添加邮箱账户"}</div>
        <button className="btn btn-ghost flex items-center gap-1" onClick={() => setShowHelp(!showHelp)} style={{ padding: "4px 8px", fontSize: 12 }}><HelpCircle size={14} />配置帮助</button>
      </div>
      {showHelp && (
        <div className="mb-4 p-3 bg-panel2 rounded-[var(--radius-sm)] text-[12px]">
          <div className="font-medium mb-2">常见邮箱配置</div>
          {Object.entries(EMAIL_PROVIDERS).map(([key, provider]) => (
            <div key={key} className="mb-3">
              <div className="font-medium text-accent">{provider.name}</div>
              <div className="text-text-dim mb-1">IMAP: {provider.imapHost} | 端口: {provider.imapPort}</div>
              <ol className="m-0 pl-4 text-text-dim leading-relaxed">{provider.steps.map((step: any, i: number) => <li key={i}>{step}</li>)}</ol>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <div><label className="text-[12px] text-text-mid block mb-1">账户名称</label><input className="input w-full" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="工作邮箱" /></div>
        <div><label className="text-[12px] text-text-mid block mb-1">邮箱地址</label><input className="input w-full" value={formEmail} onChange={(e) => { setFormEmail(e.target.value); autoFillProvider(e.target.value, formProtocol); }} placeholder="you@example.com" /></div>
        <div><label className="text-[12px] text-text-mid block mb-1">协议</label>
          <div className="text-sm">POP3 (默认)</div>
        </div>
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <div><label className="text-[12px] text-text-mid block mb-1">POP3 服务器</label><input className="input w-full" value={formImapHost} onChange={(e) => setFormImapHost(e.target.value)} placeholder="pop.example.com" /></div>
          <div><label className="text-[12px] text-text-mid block mb-1">端口</label><input className="input w-full" value={formImapPort} onChange={(e) => setFormImapPort(e.target.value)} placeholder="993" /></div>
        </div>
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <div><label className="text-[12px] text-text-mid block mb-1">SMTP 服务器</label><input className="input w-full" value={formSmtpHost} onChange={(e) => setFormSmtpHost(e.target.value)} placeholder="smtp.example.com" /></div>
          <div><label className="text-[12px] text-text-mid block mb-1">端口</label><input className="input w-full" value={formSmtpPort} onChange={(e) => setFormSmtpPort(e.target.value)} placeholder="587" /></div>
        </div>
        <div><label className="text-[12px] text-text-mid block mb-1">用户名</label><input className="input w-full" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="your@email.com" /></div>
        <div><label className="text-[12px] text-text-mid block mb-1">密码/应用专用密码</label><input className="input w-full" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" /></div>
        <div><label className="text-[12px] text-text-mid block mb-1">文件夹（逗号分隔）</label><input className="input w-full" value={formFolders} onChange={(e) => setFormFolders(e.target.value)} placeholder="INBOX,Sent,Draft,Trash,Archive" /></div>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary" onClick={onSave}>保存</button>
          <button className="btn btn-ghost" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}

function EmailDetail({ email, showReply, setShowReply, replyBody, setReplyBody, sending, onSend, onForward, onDelete, onMarkAsRead, isRead }: { email: EmailMessage; showReply: boolean; setShowReply: (v: boolean) => void; replyBody: string; setReplyBody: (v: string) => void; sending: boolean; onSend: () => void; onForward?: () => void; onDelete?: () => void; onMarkAsRead?: (read: boolean) => void; isRead?: boolean }) {
  // Handle external link clicks from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "open-url") {
        openExternalUrl(event.data.url).catch(console.error);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Pre-process HTML to intercept link clicks
  const getWrappedHtml = (html: string) => {
    // Parse HTML and add click handlers to all links
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const links = doc.querySelectorAll("a");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("javascript:") && !href.startsWith("mailto:")) {
        link.setAttribute("data-original-href", href);
        link.removeAttribute("href");
        link.style.cursor = "pointer";
        link.style.color = "blue";
        link.style.textDecoration = "underline";
      }
    });
    // Add inline onclick handlers
    const processedHtml = doc.body.innerHTML;
    return processedHtml.replace(
      /data-original-href="([^"]+)"/g,
      'onclick="window.parent.postMessage({ type: \'open-url\', url: \'$1\' }, \'*\'); return false;"'
    );
  };

  // Convert URLs in plain text to clickable links
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a
          key={i}
          href="#"
          className="text-blue-500 underline cursor-pointer"
          onClick={(e) => { e.preventDefault(); openExternalUrl(part).catch(console.error); }}
        >
          {part}
        </a>
      ) : part
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="p-5 border-b border-border bg-panel">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-[16px] font-semibold mb-3 leading-relaxed">{email.subject}</div>
            <div className="text-[12px] text-text-dim flex flex-col gap-1">
              <div><span className="text-text-mid">From:</span> {email.from}</div>
              <div><span className="text-text-mid">To:</span> {email.to}</div>
              <div><span className="text-text-mid">Date:</span> {email.date}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onForward && <button className="btn btn-ghost flex items-center gap-1 text-[12px]" onClick={onForward}><Send size={14} /> 转发</button>}
            {onMarkAsRead && <button className="btn btn-ghost flex items-center gap-1 text-[12px]" onClick={() => onMarkAsRead(!isRead)}>{isRead ? <Circle size={14} /> : <MailOpen size={14} />}{isRead ? "未读" : "已读"}</button>}
            {onDelete && <button className="btn btn-ghost flex items-center gap-1 text-[12px]" onClick={onDelete} style={{ color: "var(--accent4)" }}><Trash2 size={14} /> 删除</button>}
          </div>
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-5">
        {email.bodyHtml ? (
          <iframe
            srcDoc={getWrappedHtml(email.bodyHtml)}
            sandbox="allow-same-origin allow-scripts"
            className="w-full h-full min-h-[400px] border-none bg-white rounded-[var(--radius-sm)]"
            title="Email content"
          />
        ) : (
          <div className="text-[14px] leading-[1.7] whitespace-pre-wrap text-text">
            {email.bodyText ? renderTextWithLinks(email.bodyText) : "（邮件内容为空或需要进一步解析）"}
          </div>
        )}
      </div>

      {/* 回复区域 */}
      <div className="border-t border-border p-4 bg-panel">
        {showReply ? (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-text-dim">回复给: {email.from}</div>
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="输入回复内容..." rows={4} className="input w-full resize-vertical text-[13px]" />
            <div className="flex gap-2">
              <button className="btn btn-primary flex items-center gap-1" onClick={onSend} disabled={sending || !replyBody.trim()} style={{ fontSize: 12 }}><Send size={14} />{sending ? "发送中..." : "发送"}</button>
              <button className="btn btn-ghost text-[12px]" onClick={() => { setShowReply(false); setReplyBody(""); }}>取消</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost flex items-center gap-1 text-[12px]" onClick={() => setShowReply(true)}><Send size={14} /> 回复</button>
        )}
      </div>
    </div>
  );
}
