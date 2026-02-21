import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/stores/app";
import { writeNote, listNotes, deleteFile, createDirAll } from "@/services/tauri";
import { format } from "date-fns";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  DollarSign,
  Smartphone,
  Monitor,
  Cloud,
  Tag,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";
import type { Subscription, AppType } from "@/types";

const SUBS_DIR = "subscriptions";

function calcTotalSpent(startDate: string, amount: number, cycle: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (cycle === "monthly") return Math.max(0, months) * amount;
  if (cycle === "yearly") return Math.max(0, Math.floor(months / 12)) * amount;
  if (cycle === "weekly")
    return (
      Math.max(0, Math.floor((now.getTime() - start.getTime()) / (7 * 86400000))) *
      amount
    );
  return 0;
}

function toMonthlyAmount(amount: number, cycle: string): number {
  if (cycle === "monthly") return amount;
  if (cycle === "yearly") return amount / 12;
  if (cycle === "weekly") return (amount * 52) / 12;
  return amount;
}

function daysUntilRenewal(renewalDate: string): number {
  const now = new Date();
  const renewal = new Date(renewalDate);
  return Math.ceil((renewal.getTime() - now.getTime()) / 86400000);
}

const appTypeIcon = (type: AppType) => {
  switch (type) {
    case "mobile":
      return <Smartphone size={14} />;
    case "desktop":
      return <Monitor size={14} />;
    case "saas":
      return <Cloud size={14} />;
  }
};

const appTypeColor = (type: AppType) => {
  switch (type) {
    case "mobile":
      return "var(--accent3)";
    case "desktop":
      return "var(--accent2)";
    case "saas":
      return "var(--accent)";
  }
};

const appTypeLabel = (type: AppType) => {
  switch (type) {
    case "mobile":
      return "Mobile";
    case "desktop":
      return "Desktop";
    case "saas":
      return "SaaS";
  }
};

const cycleLabel = (cycle: string) => {
  switch (cycle) {
    case "monthly":
      return "/月";
    case "yearly":
      return "/年";
    case "weekly":
      return "/周";
    default:
      return "";
  }
};

type SortKey = "name" | "amount" | "renewalDate" | "appType";

export default function SubscriptionsView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const subscriptions = useStore((s) => s.subscriptions);
  const setSubscriptions = useStore((s) => s.setSubscriptions);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [filterType, setFilterType] = useState<AppType | "all">("all");

  // Form states
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("CNY");
  const [formCycle, setFormCycle] = useState<"monthly" | "yearly" | "weekly">("monthly");
  const [formStartDate, setFormStartDate] = useState("");
  const [formRenewalDate, setFormRenewalDate] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("");
  const [formAppType, setFormAppType] = useState<AppType>("saas");
  const [formTags, setFormTags] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formNotes, setFormNotes] = useState("");

  const loadSubscriptions = async () => {
    if (!vaultPath) return;
    setLoading(true);
    try {
      const dir = `${vaultPath}/${SUBS_DIR}`;
      await createDirAll(dir);
      const notes = await listNotes(dir, false);
      const subs: Subscription[] = [];

      for (const n of notes) {
        if (n.frontmatter.id && n.frontmatter.name) {
          subs.push({
            id: n.frontmatter.id,
            name: n.frontmatter.name,
            amount: parseFloat(n.frontmatter.amount) || 0,
            currency: n.frontmatter.currency || "CNY",
            cycle: (n.frontmatter.cycle as "monthly" | "yearly" | "weekly") || "monthly",
            startDate: n.frontmatter.startDate || "",
            renewalDate: n.frontmatter.renewalDate || "",
            paymentMethod: n.frontmatter.paymentMethod || "",
            appType: (n.frontmatter.appType as AppType) || "saas",
            tags: n.frontmatter.tags ? n.frontmatter.tags.split(",").map((t: string) => t.trim()) : [],
            enabled: n.frontmatter.enabled !== "false",
            notes: n.content || "",
            path: n.path,
          });
        }
      }
      setSubscriptions(subs);
    } catch (e) {
      console.error("Failed to load subscriptions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, [vaultPath]);

  // Auto-calculate renewal date
  useEffect(() => {
    if (!formStartDate) return;
    const start = new Date(formStartDate);
    if (isNaN(start.getTime())) return;

    const now = new Date();
    let next = new Date(start);

    // Advance until next renewal is in the future
    while (next <= now) {
      if (formCycle === "monthly") {
        next.setMonth(next.getMonth() + 1);
      } else if (formCycle === "yearly") {
        next.setFullYear(next.getFullYear() + 1);
      } else if (formCycle === "weekly") {
        next.setDate(next.getDate() + 7);
      }
    }

    setFormRenewalDate(format(next, "yyyy-MM-dd"));
  }, [formStartDate, formCycle]);

  const resetForm = () => {
    setFormName("");
    setFormAmount("");
    setFormCurrency("CNY");
    setFormCycle("monthly");
    setFormStartDate(format(new Date(), "yyyy-MM-dd"));
    setFormRenewalDate(format(new Date(), "yyyy-MM-dd"));
    setFormPaymentMethod("");
    setFormAppType("saas");
    setFormTags("");
    setFormEnabled(true);
    setFormNotes("");
  };

  const openAddForm = () => {
    resetForm();
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (sub: Subscription) => {
    setFormName(sub.name);
    setFormAmount(String(sub.amount));
    setFormCurrency(sub.currency);
    setFormCycle(sub.cycle);
    setFormStartDate(sub.startDate);
    setFormRenewalDate(sub.renewalDate);
    setFormPaymentMethod(sub.paymentMethod);
    setFormAppType(sub.appType);
    setFormTags(sub.tags.join(", "));
    setFormEnabled(sub.enabled);
    setFormNotes(sub.notes);
    setEditingId(sub.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!vaultPath || !formName.trim() || !formAmount.trim()) return;

    const slug = formName
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-|-$/g, "");
    const id = editingId || slug;
    const path = `${vaultPath}/${SUBS_DIR}/${slug}.md`;

    // If editing and the name changed, delete the old file
    if (editingId) {
      const oldSub = subscriptions.find((s) => s.id === editingId);
      if (oldSub && oldSub.path !== path) {
        try {
          await deleteFile(oldSub.path);
        } catch {
          // old file may not exist
        }
      }
    }

    const fm: Record<string, unknown> = {
      id,
      name: formName,
      amount: formAmount,
      currency: formCurrency,
      cycle: formCycle,
      startDate: formStartDate,
      renewalDate: formRenewalDate,
      paymentMethod: formPaymentMethod,
      appType: formAppType,
      tags: formTags,
      enabled: String(formEnabled),
    };

    const content = `# ${formName}\n\n## 备注\n${formNotes || ""}`;

    try {
      await createDirAll(`${vaultPath}/${SUBS_DIR}`);
      await writeNote(path, fm, content);
      await loadSubscriptions();
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      console.error("Failed to save subscription:", e);
      alert("保存失败: " + e);
    }
  };

  const handleDelete = async (sub: Subscription) => {
    if (!confirm(`确定要删除订阅 "${sub.name}" 吗？`)) return;
    try {
      await deleteFile(sub.path);
      await loadSubscriptions();
    } catch (e) {
      console.error("Failed to delete subscription:", e);
      alert("删除失败: " + e);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const enabled = subscriptions.filter((s) => s.enabled);
    const monthlyTotal = enabled.reduce((acc, s) => acc + toMonthlyAmount(s.amount, s.cycle), 0);
    return {
      monthlyTotal,
      yearlyTotal: monthlyTotal * 12,
      activeCount: enabled.length,
    };
  }, [subscriptions]);

  // Filtered + sorted list
  const displayList = useMemo(() => {
    let list = [...subscriptions];
    if (filterType !== "all") {
      list = list.filter((s) => s.appType === filterType);
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "amount":
          return toMonthlyAmount(b.amount, b.cycle) - toMonthlyAmount(a.amount, a.cycle);
        case "renewalDate":
          return new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime();
        case "appType":
          return a.appType.localeCompare(b.appType);
        default:
          return 0;
      }
    });
    return list;
  }, [subscriptions, filterType, sortKey]);

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--text-mid)",
    display: "block",
    marginBottom: 4,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={20} style={{ color: "var(--accent)" }} />
          <span
            style={{
              fontFamily: "var(--font-disp)",
              fontSize: 20,
              letterSpacing: 2,
              color: "var(--accent)",
            }}
          >
            订阅管理
          </span>
        </div>
        <button
          className="btn btn-primary"
          onClick={openAddForm}
          style={{ fontSize: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 4 }}
        >
          <Plus size={14} /> 新增订阅
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div
          className="panel"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4 }}
        >
          <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
            <DollarSign size={12} /> 月度支出
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
            {stats.monthlyTotal.toFixed(0)}
            <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 4 }}>CNY/月</span>
          </div>
        </div>
        <div
          className="panel"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4 }}
        >
          <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={12} /> 年度支出
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent2)" }}>
            {stats.yearlyTotal.toFixed(0)}
            <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 4 }}>CNY/年</span>
          </div>
        </div>
        <div
          className="panel"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4 }}
        >
          <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
            <CreditCard size={12} /> 活跃订阅
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent3)" }}>
            {stats.activeCount}
            <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 4 }}>个</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>筛选:</span>
        {(["all", "mobile", "desktop", "saas"] as const).map((t) => (
          <button
            key={t}
            className="btn btn-ghost"
            onClick={() => setFilterType(t)}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              background: filterType === t ? "rgba(0,200,255,0.15)" : undefined,
              border: filterType === t ? "1px solid rgba(0,200,255,0.3)" : undefined,
            }}
          >
            {t === "all" ? "全部" : appTypeLabel(t as AppType)}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>排序:</span>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="input"
          style={{ fontSize: 11, padding: "3px 8px", width: "auto" }}
        >
          <option value="name">名称</option>
          <option value="amount">金额</option>
          <option value="renewalDate">续费日期</option>
          <option value="appType">类型</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 40 }}>加载中...</div>
        ) : displayList.length === 0 ? (
          <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 40 }}>
            <CreditCard size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div>还没有订阅记录</div>
            <div style={{ fontSize: 11, marginTop: 8 }}>点击 "新增订阅" 开始管理</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-dim)",
                  fontSize: 11,
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "8px 12px" }}>名称</th>
                <th style={{ padding: "8px 12px" }}>月费</th>
                <th style={{ padding: "8px 12px" }}>累计支出</th>
                <th style={{ padding: "8px 12px" }}>续费日期</th>
                <th style={{ padding: "8px 12px" }}>支付方式</th>
                <th style={{ padding: "8px 12px" }}>类型</th>
                <th style={{ padding: "8px 12px" }}>状态</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((sub) => {
                const days = daysUntilRenewal(sub.renewalDate);
                const nearRenewal = days >= 0 && days <= 7;
                const monthly = toMonthlyAmount(sub.amount, sub.cycle);
                const totalSpent = calcTotalSpent(sub.startDate, sub.amount, sub.cycle);

                return (
                  <tr
                    key={sub.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: nearRenewal ? "rgba(255,180,50,0.06)" : undefined,
                      opacity: sub.enabled ? 1 : 0.5,
                    }}
                  >
                    {/* Name */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{sub.name}</span>
                        {sub.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {sub.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(255,255,255,0.06)",
                                  color: "var(--text-dim)",
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Monthly cost */}
                    <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ fontWeight: 600 }}>
                        {sub.currency === "CNY" ? "\u00a5" : "$"}
                        {monthly.toFixed(sub.cycle === "monthly" ? 0 : 1)}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>/月</span>
                      {sub.cycle !== "monthly" && (
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                          ({sub.currency === "CNY" ? "\u00a5" : "$"}
                          {sub.amount}
                          {cycleLabel(sub.cycle)})
                        </div>
                      )}
                    </td>

                    {/* Total spent */}
                    <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                      {sub.currency === "CNY" ? "\u00a5" : "$"}
                      {totalSpent.toFixed(0)}
                    </td>

                    {/* Renewal date */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {nearRenewal && (
                          <AlertTriangle
                            size={13}
                            style={{ color: "var(--accent4)", flexShrink: 0 }}
                          />
                        )}
                        <span style={{ color: nearRenewal ? "var(--accent4)" : undefined }}>
                          {sub.renewalDate ? format(new Date(sub.renewalDate), "yyyy-MM-dd") : "-"}
                        </span>
                      </div>
                      {nearRenewal && (
                        <div style={{ fontSize: 10, color: "var(--accent4)" }}>
                          {days === 0 ? "今天续费" : `${days}天后续费`}
                        </div>
                      )}
                    </td>

                    {/* Payment method */}
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-mid)" }}>
                      {sub.paymentMethod || "-"}
                    </td>

                    {/* App type badge */}
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: `${appTypeColor(sub.appType)}22`,
                          color: appTypeColor(sub.appType),
                        }}
                      >
                        {appTypeIcon(sub.appType)}
                        {appTypeLabel(sub.appType)}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: sub.enabled ? "var(--accent3)" : "var(--text-dim)",
                        }}
                      />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => openEditForm(sub)}
                          style={{ padding: 4 }}
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDelete(sub)}
                          style={{ padding: 4, color: "var(--accent4)" }}
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setEditingId(null);
            }
          }}
        >
          <div
            className="panel"
            style={{
              padding: 24,
              width: 480,
              maxHeight: "80vh",
              overflow: "auto",
              borderRadius: "var(--radius)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {editingId ? "编辑订阅" : "新增订阅"}
              </span>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Name */}
              <div>
                <label style={labelStyle}>订阅名称</label>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ChatGPT Plus"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Amount + Currency + Cycle */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>金额</label>
                  <input
                    className="input"
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="20"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>货币</label>
                  <select
                    className="input"
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="CNY">CNY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>周期</label>
                  <select
                    className="input"
                    value={formCycle}
                    onChange={(e) => setFormCycle(e.target.value as "monthly" | "yearly" | "weekly")}
                    style={{ width: "100%" }}
                  >
                    <option value="monthly">月付</option>
                    <option value="yearly">年付</option>
                    <option value="weekly">周付</option>
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>开始日期</label>
                  <input
                    className="input"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>续费日期 <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 4 }}>自动计算</span></label>
                  <input
                    className="input"
                    type="date"
                    value={formRenewalDate}
                    readOnly
                    style={{ width: "100%", opacity: 0.8 }}
                  />
                </div>
              </div>

              {/* Payment + AppType */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>支付方式</label>
                  <input
                    className="input"
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    placeholder="微信 / 支付宝 / 信用卡"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>应用类型</label>
                  <select
                    className="input"
                    value={formAppType}
                    onChange={(e) => setFormAppType(e.target.value as AppType)}
                    style={{ width: "100%" }}
                  >
                    <option value="saas">SaaS</option>
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label style={labelStyle}>
                  <Tag size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  标签（逗号分隔）
                </label>
                <input
                  className="input"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="AI, 工具, 效率"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>备注</label>
                <textarea
                  className="input"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="添加备注信息..."
                  rows={3}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>

              {/* Enabled toggle */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                onClick={() => setFormEnabled(!formEnabled)}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    background: formEnabled ? "var(--accent)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {formEnabled && <Check size={12} style={{ color: "#fff" }} />}
                </div>
                <span style={{ fontSize: 13 }}>启用此订阅</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
                  {editingId ? "保存修改" : "添加订阅"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
