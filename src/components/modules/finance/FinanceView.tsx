import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/stores/app";
import { writeNote, listNotes, createDirAll } from "@/services/fs";
import { format } from "date-fns";
import type { FinancePerson, FinanceRecord, FinanceSubItem } from "@/types";
import {
  Wallet,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Plus,
  ChevronRight,
  ChevronLeft,
  Check,
  User,
  GitBranch,
  ArrowLeft,
} from "lucide-react";

const FINANCE_DIR = "finance";
const RECORDS_DIR = "finance/records";

type ViewMode = "overview" | "record" | "history" | "add-record";

const STEP_LABELS = [
  { key: "liquid" as const, label: "流动资金", desc: "银行存款、现金、余额宝等", defaults: ["银行存款", "现金", "余额宝", "微信钱包", "支付宝"] },
  { key: "fixed" as const, label: "固定资产", desc: "房产、车辆等", defaults: ["房产", "车辆", "贵重物品"] },
  { key: "investment" as const, label: "投资理财", desc: "股票、基金、理财产品等", defaults: ["股票", "基金", "理财产品", "国债", "黄金"] },
  { key: "receivable" as const, label: "应收款", desc: "借出的钱、待收款项", defaults: ["借款", "退款", "分红"] },
  { key: "debt" as const, label: "负债", desc: "房贷、车贷、信用卡欠款等", defaults: ["房贷", "车贷", "信用卡", "消费贷"] },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fff-]/g, "");
}

function formatMoney(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return value.toLocaleString();
}

function createDefaultSubItems(defaultNames: string[]): FinanceSubItem[] {
  return defaultNames.map((name, i) => ({
    id: `sub-${Date.now()}-${i}`,
    name,
    amount: 0,
  }));
}

export default function FinanceView() {
  const vaultPath = useStore((s) => s.vaultPath);
  const financePersons = useStore((s) => s.financePersons);
  const setFinancePersons = useStore((s) => s.setFinancePersons);
  const financeRecords = useStore((s) => s.financeRecords);
  const setFinanceRecords = useStore((s) => s.setFinanceRecords);

  const [selectedPerson, setSelectedPerson] = useState<FinancePerson | null>(null);
  const [view, setView] = useState<ViewMode>("overview");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Add person form
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRole, setNewPersonRole] = useState("family");

  // Record form values - arrays of sub-items
  const [recordValues, setRecordValues] = useState<Record<string, FinanceSubItem[]>>({
    liquid: createDefaultSubItems(STEP_LABELS[0].defaults),
    fixed: createDefaultSubItems(STEP_LABELS[1].defaults),
    investment: createDefaultSubItems(STEP_LABELS[2].defaults),
    receivable: createDefaultSubItems(STEP_LABELS[3].defaults),
    debt: createDefaultSubItems(STEP_LABELS[4].defaults),
  });

  // History month navigation
  const [historyMonth, setHistoryMonth] = useState(() => format(new Date(), "yyyy-MM"));

  // ── Load data ──────────────────────────────────────────────────
  const loadPersons = async () => {
    if (!vaultPath) return;
    try {
      const dir = `${vaultPath}/${FINANCE_DIR}`;
      await createDirAll(dir);
      const notes = await listNotes(dir, false);
      const persons: FinancePerson[] = [];
      for (const n of notes) {
        if (n.frontmatter.id) {
          persons.push({
            id: n.frontmatter.id,
            name: n.frontmatter.name || "",
            role: n.frontmatter.role || "family",
            created: n.frontmatter.created || "",
            updated: n.frontmatter.updated || "",
            path: n.path,
          });
        }
      }
      setFinancePersons(persons);
      if (persons.length > 0 && !selectedPerson) {
        setSelectedPerson(persons[0]);
      }
    } catch (e) {
      console.error("Failed to load finance persons:", e);
    }
  };

  const loadRecords = async () => {
    if (!vaultPath) return;
    try {
      const dir = `${vaultPath}/${RECORDS_DIR}`;
      await createDirAll(dir);
      const allRecords: FinanceRecord[] = [];
      for (const person of financePersons) {
        const slug = slugify(person.name);
        const personDir = `${dir}/${slug}`;
        try {
          await createDirAll(personDir);
          const notes = await listNotes(personDir, false);
          for (const n of notes) {
            // Parse sub-items from frontmatter (support both old single-value and new array format)
            const parseSubItems = (key: string): FinanceSubItem[] => {
              const raw = n.frontmatter[key];
              if (!raw) return createDefaultSubItems(STEP_LABELS.find(s => s.key === key)?.defaults || []);
              // Try JSON format first (new format)
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
              } catch {
                // Not JSON, might be old single number format
              }
              // Old format: single number - convert to array with default item
              const num = parseFloat(raw);
              if (!isNaN(num)) {
                return [{ id: `sub-${Date.now()}`, name: "总计", amount: num }];
              }
              return createDefaultSubItems(STEP_LABELS.find(s => s.key === key)?.defaults || []);
            };

            allRecords.push({
              person: n.frontmatter.person || person.name,
              date: n.frontmatter.date || "",
              liquid: parseSubItems("liquid"),
              fixed: parseSubItems("fixed"),
              investment: parseSubItems("investment"),
              receivable: parseSubItems("receivable"),
              debt: parseSubItems("debt"),
              path: n.path,
            });
          }
        } catch {
          // person dir might not exist yet
        }
      }
      setFinanceRecords(allRecords);
    } catch (e) {
      console.error("Failed to load finance records:", e);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadPersons().finally(() => setLoading(false));
  }, [vaultPath]);

  useEffect(() => {
    if (financePersons.length > 0) {
      loadRecords();
    }
  }, [financePersons]);

  // ── Derived data ───────────────────────────────────────────────
  const personRecords = useMemo(() => {
    if (!selectedPerson) return [];
    return financeRecords
      .filter((r) => r.person === selectedPerson.name)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [financeRecords, selectedPerson]);

  const latestRecord = personRecords[0] || null;
  const previousRecord = personRecords[1] || null;

  // Helper to sum sub-items
  const sumItems = (items: FinanceSubItem[]): number =>
    items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const totalAssets = latestRecord
    ? sumItems(latestRecord.liquid) + sumItems(latestRecord.fixed) + sumItems(latestRecord.investment) + sumItems(latestRecord.receivable)
    : 0;
  const netAssets = totalAssets - (latestRecord ? sumItems(latestRecord.debt) : 0);
  const debtRatio = totalAssets > 0 ? (latestRecord ? sumItems(latestRecord.debt) : 0) / totalAssets * 100 : 0;

  const prevTotalAssets = previousRecord
    ? sumItems(previousRecord.liquid) + sumItems(previousRecord.fixed) + sumItems(previousRecord.investment) + sumItems(previousRecord.receivable)
    : 0;
  const prevNetAssets = prevTotalAssets - (previousRecord ? sumItems(previousRecord.debt) : 0);

  // ── Actions ────────────────────────────────────────────────────
  const handleAddPerson = async () => {
    if (!vaultPath || !newPersonName.trim()) return;
    const slug = slugify(newPersonName);
    const now = format(new Date(), "yyyy-MM-dd");
    const path = `${vaultPath}/${FINANCE_DIR}/${slug}.md`;

    await writeNote(path, {
      id: slug,
      name: newPersonName,
      role: newPersonRole,
      created: now,
      updated: now,
    }, "");

    setNewPersonName("");
    setNewPersonRole("family");
    setShowAddPerson(false);
    await loadPersons();
  };

  const handleStartRecord = () => {
    setStep(1);
    // Initialize with defaults or pre-fill from latest record
    const initFromLatest = (key: string): FinanceSubItem[] => {
      if (latestRecord) {
        const items = latestRecord[key as keyof typeof latestRecord] as FinanceSubItem[];
        if (items && items.length > 0 && items[0].amount > 0) {
          return items;
        }
      }
      const defaults = STEP_LABELS.find(s => s.key === key)?.defaults || [];
      return createDefaultSubItems(defaults);
    };

    setRecordValues({
      liquid: initFromLatest("liquid"),
      fixed: initFromLatest("fixed"),
      investment: initFromLatest("investment"),
      receivable: initFromLatest("receivable"),
      debt: initFromLatest("debt"),
    });
    setView("add-record");
  };

  const handleSaveRecord = async () => {
    if (!vaultPath || !selectedPerson) return;
    const slug = slugify(selectedPerson.name);
    const now = format(new Date(), "yyyy-MM-dd");
    const recordDir = `${vaultPath}/${RECORDS_DIR}/${slug}`;
    await createDirAll(recordDir);

    const path = `${recordDir}/${now}.md`;
    // Serialize sub-items as JSON strings
    await writeNote(path, {
      person: selectedPerson.name,
      date: now,
      liquid: JSON.stringify(recordValues.liquid),
      fixed: JSON.stringify(recordValues.fixed),
      investment: JSON.stringify(recordValues.investment),
      receivable: JSON.stringify(recordValues.receivable),
      debt: JSON.stringify(recordValues.debt),
    }, "");

    // Update person's updated date
    await writeNote(selectedPerson.path, {
      id: selectedPerson.id,
      name: selectedPerson.name,
      role: selectedPerson.role,
      created: selectedPerson.created,
      updated: now,
    }, "");

    setView("overview");
    await loadPersons();
    await loadRecords();
  };

  // ── History month records ──────────────────────────────────────
  const historyRecords = useMemo(() => {
    return personRecords.filter((r) => r.date.startsWith(historyMonth));
  }, [personRecords, historyMonth]);

  const calendarDays = useMemo(() => {
    const [y, m] = historyMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun
    const recordDates = new Set(historyRecords.map((r) => r.date));
    return { daysInMonth, firstDow, recordDates, year: y, month: m };
  }, [historyMonth, historyRecords]);

  // ── Bar chart data ─────────────────────────────────────────────
  const barData = useMemo(() => {
    if (!latestRecord) return [];
    const items = STEP_LABELS.map((s) => ({
      label: s.label,
      value: sumItems(latestRecord[s.key as keyof typeof latestRecord] as FinanceSubItem[]),
      prev: previousRecord ? sumItems(previousRecord[s.key as keyof typeof previousRecord] as FinanceSubItem[]) : null,
    }));
    return items;
  }, [latestRecord, previousRecord]);

  const barMaxValue = useMemo(() => {
    return Math.max(...barData.map((d) => d.value), 1);
  }, [barData]);

  // ── Render helpers ─────────────────────────────────────────────

  const renderStatCard = (
    label: string,
    value: string,
    icon: React.ReactNode,
    change?: number | null,
  ) => (
    <div
      className="bg-[var(--panel)] rounded-[12px] py-[18px] px-5 border border-border flex-1 min-w-[160px]"
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[13px] text-text-dim">{label}</span>
      </div>
      <div className="text-[22px] font-bold">{value}</div>
      {change !== undefined && change !== null && (
        <div
          className="text-[12px] mt-1 flex items-center gap-0.5"
          style={{ color: change >= 0 ? "#22c55e" : "#ef4444" }}
        >
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change >= 0 ? "+" : ""}
          {formatMoney(change)}
        </div>
      )}
    </div>
  );

  const renderStepIndicator = () => (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((s, i) => {
        const stepNum = i + 1;
        const isActive = step === stepNum;
        const isDone = step > stepNum;
        return (
          <div key={s.key} className="flex items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all"
              style={{
                background: isDone
                  ? "var(--accent)"
                  : isActive
                    ? "var(--accent)"
                    : "var(--panel)",
                color: isDone || isActive ? "#fff" : "var(--text-dim)",
                border: isDone || isActive ? "none" : "1px solid var(--border)",
              }}
            >
              {isDone ? <Check size={14} /> : stepNum}
            </div>
            <span
              className="text-[12px] ml-1.5 whitespace-nowrap"
              style={{
                color: isActive ? "var(--accent)" : "var(--text-dim)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {s.label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div
                className="w-8 h-0.5 mx-2"
                style={{ background: isDone ? "var(--accent)" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderBarChart = () => {
    if (barData.length === 0) return null;
    return (
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-4 text-[15px] font-semibold">
          <BarChart3 size={16} />
          资产对比
        </div>
        <div className="flex items-end gap-6 h-[240px] px-3">
          {barData.map((d) => {
            const h = (d.value / barMaxValue) * 200;
            const diff = d.prev !== null ? d.value - d.prev : null;
            return (
              <div key={d.label} className="flex flex-col items-center flex-1">
                {diff !== null && (
                  <div
                    className="text-[11px] mb-1 font-medium"
                    style={{
                      color: diff >= 0 ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {diff >= 0 ? "↑" : "↓"}
                    {formatMoney(Math.abs(diff))}
                  </div>
                )}
                <div
                  className="rounded-t-[6px] transition-all"
                  style={{
                    height: Math.max(h, 4),
                    width: 40,
                    background: d.label === "负债"
                      ? "linear-gradient(to top, #ef4444, #f87171)"
                      : "linear-gradient(to top, var(--accent), var(--accent2-5, #60a5fa))",
                  }}
                />
                <div className="text-[11px] text-text-dim mt-1.5 text-center">
                  {d.label}
                </div>
                <div className="text-[12px] font-semibold mt-0.5">
                  {formatMoney(d.value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTreeChart = () => {
    if (!latestRecord) return null;
    const treeData = [
      {
        label: "总资产",
        value: totalAssets,
        color: "var(--accent)",
        children: [
          { label: "流动资金", value: sumItems(latestRecord.liquid), items: latestRecord.liquid },
          { label: "固定资产", value: sumItems(latestRecord.fixed), items: latestRecord.fixed },
          { label: "投资理财", value: sumItems(latestRecord.investment), items: latestRecord.investment },
          { label: "应收款", value: sumItems(latestRecord.receivable), items: latestRecord.receivable },
        ],
      },
      {
        label: "总负债",
        value: sumItems(latestRecord.debt),
        color: "#ef4444",
        children: [],
        items: latestRecord.debt,
      },
    ];

    return (
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-4 text-[15px] font-semibold">
          <GitBranch size={16} />
          资产构成
        </div>
        <div className="px-2">
          {treeData.map((node) => (
            <div key={node.label} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: node.color }} />
                <span className="font-semibold text-[14px]">{node.label}</span>
                <span className="text-text-dim text-[13px] ml-auto">
                  {formatMoney(node.value)}
                </span>
              </div>
              {node.children.map((child, ci) => (
                <div
                  key={child.label}
                  className="flex items-center gap-2 ml-6 py-1 relative"
                >
                  <div
                    className="absolute -left-4 top-0 bottom-0 w-0.5"
                    style={{
                      background: "var(--border)",
                      bottom: ci === node.children.length - 1 ? "50%" : undefined,
                    }}
                  />
                  <div
                    className="absolute -left-3 top-1/2 w-3 h-0.5 -translate-y-1/2"
                    style={{ background: "var(--border)" }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--text-dim)" }}
                  />
                  <span className="text-[13px]">{child.label}</span>
                  <span className="text-text-dim text-[12px] ml-auto">
                    {formatMoney(child.value)}
                  </span>
                  {totalAssets > 0 && (
                    <div className="w-[60px] h-1 rounded-[2px] bg-border overflow-hidden">
                      <div
                        className="h-full rounded-[2px]"
                        style={{
                          width: `${(child.value / totalAssets) * 100}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const { daysInMonth, firstDow, recordDates, year, month } = calendarDays;
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = new Array(firstDow).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            onClick={() => {
              const [y, m] = historyMonth.split("-").map(Number);
              const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
              setHistoryMonth(prev);
            }}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 8px",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {year}年{month}月
          </span>
          <button
            onClick={() => {
              const [y, m] = historyMonth.split("-").map(Number);
              const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
              setHistoryMonth(next);
            }}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 8px",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {dayNames.map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-dim)",
                padding: "4px 0",
                fontWeight: 500,
              }}
            >
              {d}
            </div>
          ))}
          {weeks.flat().map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasRecord = recordDates.has(dateStr);
            return (
              <div
                key={dateStr}
                style={{
                  textAlign: "center",
                  padding: "8px 4px",
                  borderRadius: 8,
                  fontSize: 13,
                  background: hasRecord ? "var(--accent)" : "transparent",
                  color: hasRecord ? "#fff" : "inherit",
                  fontWeight: hasRecord ? 600 : 400,
                  cursor: hasRecord ? "pointer" : "default",
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left sidebar - Person list */}
      <div
        style={{
          width: 240,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15 }}>
            <Users size={16} />
            家庭成员
          </div>
          <button
            onClick={() => setShowAddPerson(!showAddPerson)}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {showAddPerson && (
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
            <input
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="成员名称"
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "inherit",
                fontSize: 13,
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />
            <select
              value={newPersonRole}
              onChange={(e) => setNewPersonRole(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "inherit",
                fontSize: 13,
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            >
              <option value="family">家庭</option>
              <option value="personal">个人</option>
            </select>
            <button
              onClick={handleAddPerson}
              disabled={!newPersonName.trim()}
              style={{
                width: "100%",
                padding: "6px 0",
                borderRadius: 6,
                border: "none",
                background: newPersonName.trim() ? "var(--accent)" : "var(--border)",
                color: newPersonName.trim() ? "#fff" : "var(--text-dim)",
                fontSize: 13,
                fontWeight: 600,
                cursor: newPersonName.trim() ? "pointer" : "not-allowed",
              }}
            >
              添加
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {financePersons.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "var(--text-dim)",
                fontSize: 13,
              }}
            >
              暂无成员，点击 + 添加
            </div>
          ) : (
            financePersons.map((person) => (
              <div
                key={person.id}
                onClick={() => {
                  setSelectedPerson(person);
                  setView("overview");
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: selectedPerson?.id === person.id ? "var(--accent)" : "transparent",
                  color: selectedPerson?.id === person.id ? "#fff" : "inherit",
                  marginBottom: 4,
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={14} />
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{person.name}</span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    opacity: 0.7,
                  }}
                >
                  更新: {person.updated || "暂无记录"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
        {!selectedPerson ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-dim)",
              gap: 12,
            }}
          >
            <Wallet size={48} strokeWidth={1} />
            <div style={{ fontSize: 15 }}>请先选择或添加一个家庭成员</div>
          </div>
        ) : view === "overview" ? (
          // ── Overview mode ──
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {selectedPerson.name} - 资产总览
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleStartRecord}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  更新资产
                </button>
                <button
                  onClick={() => setView("history")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <Calendar size={14} />
                  历史记录
                </button>
              </div>
            </div>

            {!latestRecord ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 60,
                  color: "var(--text-dim)",
                }}
              >
                <Wallet size={40} strokeWidth={1} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, marginBottom: 8 }}>暂无资产记录</div>
                <div style={{ fontSize: 13 }}>点击"更新资产"开始录入第一笔记录</div>
              </div>
            ) : (
              <>
                {/* Stat cards */}
                <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                  {renderStatCard(
                    "总资产",
                    formatMoney(totalAssets),
                    <Wallet size={16} style={{ color: "var(--accent)" }} />,
                    previousRecord ? totalAssets - prevTotalAssets : null,
                  )}
                  {renderStatCard(
                    "净资产",
                    formatMoney(netAssets),
                    <TrendingUp size={16} style={{ color: "#22c55e" }} />,
                    previousRecord ? netAssets - prevNetAssets : null,
                  )}
                  {renderStatCard(
                    "负债率",
                    `${debtRatio.toFixed(1)}%`,
                    <TrendingDown size={16} style={{ color: "#ef4444" }} />,
                  )}
                  {renderStatCard(
                    "更新日期",
                    latestRecord.date,
                    <Calendar size={16} style={{ color: "var(--text-dim)" }} />,
                  )}
                </div>

                {/* Bar chart */}
                {renderBarChart()}

                {/* Tree chart */}
                {renderTreeChart()}
              </>
            )}
          </div>
        ) : view === "add-record" ? (
          // ── Add record (step wizard) ──
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => setView("overview")}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 700 }}>更新资产 - {selectedPerson.name}</span>
            </div>

            {renderStepIndicator()}

            <div
              style={{
                background: "var(--panel)",
                borderRadius: 12,
                padding: 24,
                border: "1px solid var(--border)",
                maxWidth: 480,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                {STEP_LABELS[step - 1].label}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>
                {STEP_LABELS[step - 1].desc}
              </div>

              {/* Sub-items list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recordValues[STEP_LABELS[step - 1].key].map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: "var(--panel2)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...recordValues[STEP_LABELS[step - 1].key]];
                        newItems[idx] = { ...newItems[idx], name: e.target.value };
                        setRecordValues({ ...recordValues, [STEP_LABELS[step - 1].key]: newItems });
                      }}
                      placeholder="名称"
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                    <span style={{ color: "var(--text-dim)", fontSize: 14 }}>¥</span>
                    <input
                      type="number"
                      value={item.amount || ""}
                      onChange={(e) => {
                        const newItems = [...recordValues[STEP_LABELS[step - 1].key]];
                        newItems[idx] = { ...newItems[idx], amount: parseFloat(e.target.value) || 0 };
                        setRecordValues({ ...recordValues, [STEP_LABELS[step - 1].key]: newItems });
                      }}
                      placeholder="0"
                      style={{
                        width: 100,
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: "right",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => {
                        const newItems = recordValues[STEP_LABELS[step - 1].key].filter((_, i) => i !== idx);
                        setRecordValues({ ...recordValues, [STEP_LABELS[step - 1].key]: newItems });
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent4)",
                        cursor: "pointer",
                        padding: 4,
                        fontSize: 16,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Add new sub-item */}
                <button
                  onClick={() => {
                    const newItem = { id: `sub-${Date.now()}`, name: "", amount: 0 };
                    setRecordValues({
                      ...recordValues,
                      [STEP_LABELS[step - 1].key]: [...recordValues[STEP_LABELS[step - 1].key], newItem],
                    });
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px dashed var(--border)",
                    background: "transparent",
                    color: "var(--accent)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  添加子项
                </button>
              </div>

              {/* Category total */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "rgba(0,200,255,0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(0,200,255,0.2)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>小计</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
                  ¥{recordValues[STEP_LABELS[step - 1].key].reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--panel)",
                      color: "inherit",
                      fontSize: 14,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ChevronLeft size={16} />
                    上一步
                  </button>
                )}
                {step < 5 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    下一步
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleSaveRecord}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Check size={16} />
                    保存记录
                  </button>
                )}
              </div>
            </div>

            {/* Preview summary */}
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 10,
                border: "1px solid var(--border)",
                maxWidth: 480,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-dim)" }}>
                当前录入摘要
              </div>
              {STEP_LABELS.map((s, i) => (
                <div
                  key={s.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontSize: 13,
                    color: i + 1 <= step ? "inherit" : "var(--text-dim)",
                    opacity: i + 1 <= step ? 1 : 0.5,
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{ fontWeight: 500 }}>
                    ¥{recordValues[s.key].reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
                  </span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  marginTop: 8,
                  paddingTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <span>净资产</span>
                <span>
                  ¥
                  {(
                    recordValues.liquid.reduce((sum, item) => sum + (item.amount || 0), 0) +
                    recordValues.fixed.reduce((sum, item) => sum + (item.amount || 0), 0) +
                    recordValues.investment.reduce((sum, item) => sum + (item.amount || 0), 0) +
                    recordValues.receivable.reduce((sum, item) => sum + (item.amount || 0), 0) -
                    recordValues.debt.reduce((sum, item) => sum + (item.amount || 0), 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : view === "history" ? (
          // ── History mode ──
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => setView("overview")}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                历史记录 - {selectedPerson.name}
              </span>
            </div>

            <div style={{ display: "flex", gap: 24 }}>
              {/* Calendar */}
              <div
                style={{
                  background: "var(--panel)",
                  borderRadius: 12,
                  padding: 20,
                  border: "1px solid var(--border)",
                  width: 320,
                }}
              >
                {renderCalendar()}
              </div>

              {/* Records list */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-dim)" }}>
                  {historyMonth} 记录 ({historyRecords.length})
                </div>
                {historyRecords.length === 0 ? (
                  <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 20, textAlign: "center" }}>
                    该月暂无记录
                  </div>
                ) : (
                  historyRecords.map((record) => {
                    const recTotal = sumItems(record.liquid) + sumItems(record.fixed) + sumItems(record.investment) + sumItems(record.receivable);
                    const recNet = recTotal - sumItems(record.debt);
                    return (
                      <div
                        key={record.date}
                        style={{
                          background: "var(--panel)",
                          borderRadius: 10,
                          padding: 16,
                          border: "1px solid var(--border)",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10,
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{record.date}</span>
                          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                            净资产: ¥{recNet.toLocaleString()}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 8,
                            fontSize: 12,
                          }}
                        >
                          {STEP_LABELS.map((s) => (
                            <div key={s.key}>
                              <div style={{ color: "var(--text-dim)" }}>{s.label}</div>
                              <div style={{ fontWeight: 500, marginTop: 2 }}>
                                ¥{record[s.key].toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
